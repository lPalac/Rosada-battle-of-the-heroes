// 004 contract guarantees 13–17 over seeded random playouts with the named heroes using abilities (T067).
// Guarantee 18 (generic heroes behave as in 003) is the unchanged 001–003 suite.
import { describe, expect, it } from 'vitest';
import { replay } from '../../src/game/session.ts';
import { abilityCost, apply, legalActions, validatePosition, type Action, type GameState } from '../../src/rules/index.ts';
import { abilityDefinition } from '../../src/rules/data.ts';
import { newCheck } from '../../src/rules/abilities/targets.ts';
import { seededRng, type Rng } from '../helpers/rng.ts';
import { board, START } from '../fixtures/position.ts';

interface Step {
  before: GameState;
  action: Action;
  after: GameState;
  events: { type: string; [k: string]: unknown }[];
}

const NAMED = { H1: 'cavalier', H2: 'scout', H3: 'magus', H4: 'monk' } as const;

function start(epic: boolean, i: number): GameState {
  const destinies = ['fanatic', 'resolute', 'dominant'] as const;
  return board(START, {
    heroDefs: NAMED, heroes: { H1: 'd3', H2: 'e6', H3: 'f3', H4: 'c6' },
    ...(epic ? {
      stage: 'epic' as const,
      epic: { H1: destinies[i % 3], H2: destinies[(i + 1) % 3], H3: destinies[(i + 2) % 3], H4: destinies[(i + 3) % 3] },
      pools: { H1: 30, H2: 30, H3: 30, H4: 30 },
    } : { wellRemaining: 6 }),
  });
}

/** Random play that prefers abilities, so effects pile up. */
function playout(rng: Rng, initial: GameState, max = 220): { initial: GameState; actions: Action[]; steps: Step[] } {
  let s = initial;
  const actions: Action[] = [];
  const steps: Step[] = [];
  for (let i = 0; i < max && s.status === 'playing'; i++) {
    const legal = legalActions(s).filter((a) => a.type !== 'setEnforcement' && a.type !== 'offerDraw');
    if (!legal.length) break;
    const abilities = legal.filter((a) => a.type === 'useAbility');
    const nonEnd = legal.filter((a) => a.type !== 'endPhase');
    const a = abilities.length && rng.nextFloat() < 0.6 ? rng.pick(abilities) : nonEnd.length && rng.nextFloat() < 0.8 ? rng.pick(nonEnd) : rng.pick(legal);
    const r = apply(s, a);
    // Guarantee 13: every listed action (useAbility included) is accepted.
    if (!r.ok) throw new Error(`Legal action ${JSON.stringify(a)} failed: ${r.error.code}`);
    steps.push({ before: s, action: a, after: r.state, events: r.events as Step['events'] });
    actions.push(a);
    s = r.state;
  }
  return { initial, actions, steps };
}

const games = [
  ...Array.from({ length: 6 }, (_, i) => playout(seededRng(`named-start-${i}`), start(false, i))),
  ...Array.from({ length: 9 }, (_, i) => playout(seededRng(`named-epic-${i}`), start(true, i))),
];

describe('004 guarantees (named heroes, random playouts)', () => {
  it('abilities were used in the playouts', () => {
    const used = new Set(games.flatMap((g) => g.steps.filter((x) => x.action.type === 'useAbility').map((x) => (x.action as { abilityId: string }).abilityId)));
    expect(used.size).toBeGreaterThan(15);
  });

  it('13 + 1: every legal action applied; positions stay valid', () => {
    for (const g of games) for (const st of g.steps) {
      const s = st.after;
      if (s.status !== 'playing') continue;
      const active = s.heroes.find((h) => h.id === s.activeHeroId)!;
      const transit = (p: { code: string; where?: { x: number; y: number } }) =>
        s.phase === 'move' && p.code === 'KING_SHARES' && p.where?.x === active.pos.x && p.where?.y === active.pos.y;
      expect(validatePosition(s).filter((p) => !transit(p)), JSON.stringify(st.action)).toEqual([]);
    }
  });

  it('14: no effect outlives its target, and turn-numbered expiries are gone', () => {
    for (const g of games) for (const { after: s } of g.steps) {
      for (const e of s.effects) {
        if ('unitId' in e.target) expect(s.units.some((u) => u.id === (e.target as { unitId: string }).unitId)).toBe(true);
        if (e.expires.at === 'turnEnd' && e.expires.turn !== undefined) expect(e.expires.turn).toBeGreaterThanOrEqual(s.turnNumber);
      }
    }
  });

  it('15: a "Must not check the King" ability never gives a new check', () => {
    for (const g of games) for (const st of g.steps) {
      if (st.action.type !== 'useAbility') continue;
      const def = abilityDefinition(st.action.abilityId);
      if (!def.flags.mustNotCheck) continue;
      for (const side of ['light', 'dark'] as const) expect(newCheck(st.before, st.after, side)).toBe(false);
    }
  });

  it('16: uses never go below 0; the Destiny paid equals the cost for the Bloodied state', () => {
    for (const g of games) for (const st of g.steps) {
      for (const h of Object.values(st.after.abilityState)) for (const n of Object.values(h?.uses ?? {})) expect(n).toBeGreaterThanOrEqual(0);
      if (st.action.type !== 'useAbility') continue;
      const used = st.events.find((e) => e.type === 'abilityUsed')!;
      // 006 FR-017: spending both uses at once pays the cost twice.
      const times = st.action.option === 'both' ? 2 : 1;
      expect(used.destiny).toBe(abilityCost(st.before, st.before.activeHeroId, st.action.abilityId) * times);
    }
  });

  it('17: replaying the log rebuilds effects, uses and forms', { timeout: 60_000 }, () => {
    for (const g of games) {
      const end = g.steps.at(-1)!.after;
      const r = replay(g.initial, g.actions);
      expect([r.effects, r.abilityState, r.heroes.map((h) => h.form)]).toEqual([end.effects, end.abilityState, end.heroes.map((h) => h.form)]);
    }
  });
});
