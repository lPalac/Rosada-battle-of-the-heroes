// contracts/rules-api.md Guarantees, checked over seeded random playouts (test PRNG only; the game has no seed).
import { describe, expect, it } from 'vitest';
import { replay } from '../../src/game/session.ts';
import {
  apply, legalActions, validatePosition, type Action, type GameState,
} from '../../src/rules/index.ts';
import { seededRng, type Rng } from '../helpers/rng.ts';
import { newGame } from '../helpers/game.ts';
import { board, START } from '../fixtures/position.ts';

interface Playout {
  initial: GameState;
  actions: Action[];
  states: GameState[];
}

/** Random legal play. Rolls are random too; ending the phase is less likely so heroes move and Lead. */
function playout(rng: Rng, maxActions = 300, initial: GameState = newGame()): Playout {
  let s = initial;
  const actions: Action[] = [];
  const states: GameState[] = [s];
  for (let i = 0; i < maxActions && s.status === 'playing'; i++) {
    // 006: Inspired Lead in the Lead phase (FR-007) is left out so the playouts keep their mix of Leads, Rams and
    // wounds; it has its own tests (tests/rules/inspired-lead.test.ts).
    const legal = legalActions(s).filter((a) => a.type !== 'setEnforcement' && a.type !== 'offerDraw' && !(a.type === 'inspiredLead' && s.phase === 'lead'));
    if (legal.length === 0) break;
    const nonEnd = legal.filter((a) => a.type !== 'endPhase');
    const a = nonEnd.length > 0 && rng.nextFloat() < 0.8 ? rng.pick(nonEnd) : rng.pick(legal);
    const r = apply(s, a);
    if (!r.ok) throw new Error(`Legal action ${JSON.stringify(a)} failed: ${r.error.code}`);
    actions.push(a);
    s = r.state;
    states.push(s);
  }
  return { initial, actions, states };
}

const games = Array.from({ length: 12 }, (_, i) => playout(seededRng(`contract-${i}`)));

/** Heroes in the middle of the board, so unit paths cross them often (Rams, pushes, Unconscious; T086). */
function crowded(): GameState {
  return board(START, { heroes: { H1: 'd3', H2: 'e6', H3: 'f3', H4: 'c6' }, health: { H2: 4, H4: 3 } });
}

function stableProblems(s: GameState) {
  const active = s.heroes.find((h) => h.id === s.activeHeroId)!;
  return validatePosition(s).filter((p) => !(s.phase === 'move' && p.code === 'KING_SHARES' && p.where?.x === active.pos.x && p.where?.y === active.pos.y
    && s.heroes.filter((h) => h.pos.x === active.pos.x && h.pos.y === active.pos.y).length === 1));
}

describe('rules core guarantees (contracts/rules-api.md)', () => {
  it('1. apply never returns a state that fails validatePosition while enforcing rules', () => {
    for (const g of games) for (const s of g.states) {
      // The active hero may pass over a King's square during its Move (FR-022 only forbids ending there).
      const active = s.heroes.find((h) => h.id === s.activeHeroId)!;
      const transit = (p: { code: string; where?: { x: number; y: number } }) =>
        s.phase === 'move' && p.code === 'KING_SHARES' && p.where?.x === active.pos.x && p.where?.y === active.pos.y &&
        s.heroes.filter((h) => h.pos.x === active.pos.x && h.pos.y === active.pos.y).length === 1;
      expect(validatePosition(s).filter((p) => !transit(p))).toEqual([]);
    }
  });

  it('2. every legal action applies (checked during playouts) and illegal ones fail', () => {
    for (const g of games) {
      const s = g.states[Math.floor(g.states.length / 2)];
      if (s.status !== 'playing') continue;
      const illegal: Action[] = [
        { type: 'moveStep', to: { x: -1, y: 0 } },
        { type: 'submitRoll', value: 0 },
        { type: 'announceLead', unitId: 'nope', to: { x: 1, y: 1 } },
        { type: 'sandboxSet', path: 'pool', target: 'H1', value: 99 },
        { type: 'pickHero', side: 'light', rangeType: 'short' },
      ];
      for (const a of illegal) expect(apply(s, a).ok).toBe(false);
    }
  });

  it('3. the state survives JSON round trips', () => {
    for (const g of games) for (const s of g.states.filter((_, i) => i % 25 === 0)) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('3a. re-applying the action log rebuilds the same state (no seed needed)', () => {
    for (const g of games.slice(0, 4)) expect(replay(g.initial, g.actions)).toEqual(g.states[g.states.length - 1]);
  });

  it('4. while a decision is pending, only its answers are legal', () => {
    for (const g of games) for (const s of g.states) {
      if (!s.pendingDecision || s.status !== 'playing') continue;
      for (const a of legalActions(s)) expect(['decide', 'answerDraw']).toContain(a.type);
    }
  });

  it('apply never mutates its input', () => {
    const g = games[0];
    const before = JSON.stringify(g.states[5]);
    apply(g.states[5], g.actions[5]);
    expect(JSON.stringify(g.states[5])).toBe(before);
  });

  it('1. holds over 200 seeded random playouts (T105), half of them with heroes in unit paths (T086)', () => {
    let rams = 0;
    let unconscious = 0;
    for (let i = 0; i < 200; i++) {
      const g = playout(seededRng(`guarantee-1-${i}`), 120, i % 2 ? crowded() : newGame());
      for (const s of g.states) expect(stableProblems(s), `playout ${i}`).toEqual([]);
      const last = g.states[g.states.length - 1];
      rams += last.log.filter((l) => l.type === 'heroRammed').length;
      unconscious += last.log.filter((l) => l.type === 'heroUnconscious').length;
    }
    expect(rams).toBeGreaterThan(20);
    expect(unconscious).toBeGreaterThan(0);
  }, 120_000);

  it('6. (002) in rules mode no square holds both sides, too many units, or anything besides the King on its square', () => {
    for (const g of games) for (const s of g.states) {
      const codes = stableProblems(s).map((p) => p.code);
      expect(codes.filter((c) => ['OPPOSING_UNITS_SHARE', 'TOO_MANY_UNITS', 'KING_SHARES'].includes(c))).toEqual([]);
    }
  });

  it('playouts reach many turns', () => {
    const turns = games.map((g) => g.states[g.states.length - 1].turnNumber);
    expect(Math.max(...turns)).toBeGreaterThan(10);
  });
});

// 003 contracts/rules-api-changes.md guarantees 8–12, over playouts that reach the Epic Stage and use Hero Units.
const SIX = ['overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury', 'destinedForGreatness'] as const;
const epicGames = Array.from({ length: 10 }, (_, i) => playout(seededRng(`epic-${i}`), 300,
  board(START, {
    heroes: { H1: 'd3', H2: 'e6', H3: 'f3', H4: 'c6' }, wellRemaining: 3,
    ...(i % 2 ? { royalFavors: { light: [...SIX], dark: [...SIX] }, kingsForces: { light: 1, dark: 1 } } : {}),
  })));

describe('003 guarantees (contracts/rules-api-changes.md)', () => {
  it('the playouts reach the Epic Stage and use Hero Units', () => {
    expect(epicGames.filter((g) => g.states.at(-1)!.stage === 'epic').length).toBeGreaterThanOrEqual(3);
    expect(epicGames.some((g) => g.states.some((s) => s.units.some((u) => u.kind === 'hero')))).toBe(true);
  });

  it('8. the Epic Stage starts once, at a Before Turn after the Well is depleted', () => {
    for (const g of epicGames) {
      const log = g.states.at(-1)!.log;
      const starts = log.filter((l) => l.type === 'epicStageStarted');
      expect(starts.length).toBeLessThanOrEqual(1);
      if (starts.length) {
        expect(log.findIndex((l) => l.type === 'wellDepleted')).toBeLessThan(log.indexOf(starts[0]));
        const i = g.states.findIndex((s) => s.stage === 'epic');
        expect(g.states[i - 1].phase).toBe('beforeTurn'); // the last destiny answer comes in Before Turn
        expect(g.states[i - 1].pendingDecision?.type).toBe('epicDestiny');
      }
    }
  });

  it('9. no side ever holds one Fanatic and one Dominant hero', () => {
    for (const g of epicGames) for (const s of g.states) for (const side of ['light', 'dark'] as const) {
      const d = s.heroes.filter((h) => h.side === side).map((h) => h.epic?.destiny);
      expect(d.includes('fanatic') && d.includes('dominant')).toBe(false);
    }
  });

  it('10. each numbered Royal Favor at most once, Tides at most 5, the track never shrinks', () => {
    for (const g of epicGames) {
      let prev = { light: 0, dark: 0 };
      for (const s of g.states) for (const side of ['light', 'dark'] as const) {
        const rec = s.royalFavors[side];
        expect(rec.track.length).toBeGreaterThanOrEqual(prev[side]);
        prev = { ...prev, [side]: rec.track.length };
        expect(rec.tides).toBeLessThanOrEqual(5);
        const numbered = rec.track.filter((id) => id !== 'tidesOfDestiny');
        expect(new Set(numbered).size).toBe(numbered.length);
      }
    }
  });

  it('11. a Hero Unit is on the Battlefield, alone among units, and its hero stands on it', () => {
    for (const g of epicGames) for (const s of g.states) for (const u of s.units.filter((x) => x.kind === 'hero')) {
      expect(u.pos.x >= 1 && u.pos.x <= 8 && u.pos.y >= 1 && u.pos.y <= 8).toBe(true);
      expect(s.units.filter((x) => x.pos.x === u.pos.x && x.pos.y === u.pos.y)).toHaveLength(1);
      const h = s.heroes.find((x) => x.id === u.heroId)!;
      expect([h.heroUnitId, h.pos]).toEqual([u.id, u.pos]);
    }
  });

  it('12. replaying the log rebuilds stage, destinies, Royal Favors and Hero Units', () => {
    for (const g of epicGames) {
      const end = g.states.at(-1)!;
      const r = replay(g.initial, g.actions);
      expect([r.stage, r.heroes.map((h) => [h.epic, h.heroUnitId]), r.royalFavors, r.units.filter((u) => u.kind !== 'main')])
        .toEqual([end.stage, end.heroes.map((h) => [h.epic, h.heroUnitId]), end.royalFavors, end.units.filter((u) => u.kind !== 'main')]);
    }
  });
});
