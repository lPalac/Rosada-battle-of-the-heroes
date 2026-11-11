// 006 US1 (FR-002, research R-04): each use of a Starting Hero ability with a Destiny symbol costs 1 D.
import { describe, expect, it } from 'vitest';
import { act, reject } from '../helpers/game.ts';
import { board } from '../fixtures/position.ts';
import { abilityOffers, createGame, createSetup, legalActions, type GameState } from '../../src/rules/index.ts';
import { lead, offered, refuse, use } from './heroes/helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const CAV = { heroDefs: { H1: 'cavalier' } } as const;
const firstTargets = (s: GameState, abilityId: string) => abilityOffers(s).find((o) => o.abilityId === abilityId)!.targets[0];

describe('US1 – Starting abilities cost Destiny (B-09)', () => {
  it('US1-AS7 Demoralise pays 1 D from the Hero Pool, spends the use and logs the ability as the reason', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    expect(h(s, 'H1').pool).toBe(3);
    expect(abilityOffers(s).find((o) => o.abilityId === 'cavalier.demoralise')?.cost).toBe(1);
    const r = use(s, 'cavalier.demoralise');
    expect(h(r.state, 'H1').pool).toBe(2);
    expect(r.state.abilityState.H1!.uses['cavalier.demoralise']).toBe(0);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'destinyChanged', pool: 'hero', heroId: 'H1', delta: -1, reason: 'cavalier.demoralise' }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', ability: 'cavalier.demoralise', destiny: 1 }));
  });

  it('US1-AS7 with an empty Hero Pool the Common Pool pays; a chosen split is followed', () => {
    const common = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, pools: { H1: 0 }, common: { light: 2 }, phase: 'beforeMove' });
    const r = use(common, 'cavalier.demoralise').state;
    expect([h(r, 'H1').pool, r.destiny.common.light]).toEqual([0, 1]);
    const split = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, pools: { H1: 2 }, common: { light: 2 }, phase: 'beforeMove' });
    const p = act(split, { type: 'useAbility', abilityId: 'cavalier.demoralise', targets: [], pay: { hero: 0, common: 1 } }).state;
    expect([h(p, 'H1').pool, p.destiny.common.light]).toEqual([2, 1]);
  });

  it('US1-AS8 with no Destiny the ability is not offered and a forced use is refused', () => {
    // With 0 D Before Move has nothing usable and passes by itself; After Lead stays open for the free Warhorse.
    let s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' }, pools: { H1: 0 } });
    s = lead(s, 'c3', 'b5');
    expect(s.phase).toBe('afterLead');
    expect(offered(s, 'cavalier.warhorse')).toBe(true);
    expect(offered(s, 'cavalier.demoralise')).toBe(false);
    expect(legalActions(s).some((a) => a.type === 'useAbility' && a.abilityId === 'cavalier.demoralise')).toBe(false);
    expect(refuse(s, 'cavalier.demoralise')).toBe('NOT_ENOUGH_DESTINY');
  });

  it('US1-AS9 Warhorse, Rejuvenating Stroll, Elusive and Future Sight cost nothing', () => {
    // Warhorse (After Lead).
    let w = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' } });
    w = lead(w, 'c3', 'b5');
    const pw = h(w, 'H1').pool;
    expect(abilityOffers(w).find((o) => o.abilityId === 'cavalier.warhorse')?.cost).toBe(0);
    w = use(w, 'cavalier.warhorse', firstTargets(w, 'cavalier.warhorse')).state;
    expect(h(w, 'H1').pool).toBe(pw);
    // Rejuvenating Stroll (During Move, a friendly hero on the square).
    let m = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd2', H3: 'd3' }, health: { H3: 5 }, phase: 'move' });
    m = act(m, { type: 'moveStep', to: { x: 4, y: 3 } }).state;
    const pm = h(m, 'H1').pool;
    m = use(m, 'monk.rejuvenatingStroll', firstTargets(m, 'monk.rejuvenatingStroll')).state;
    expect(h(m, 'H1').pool).toBe(pm);
    // Future Sight (Before Lead).
    let f = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4' }, phase: 'beforeLead' });
    const pf = h(f, 'H1').pool;
    f = use(f, 'magus.futureSight').state;
    expect(h(f, 'H1').pool).toBe(pf);
    // Elusive is passive: it has no cost in the data.
    expect(abilityOffers(f).some((o) => o.abilityId === 'scout.elusive')).toBe(false);
  });

  it('US1-AS10 Flaming Bolt and Preaching cost 1 D for each use', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    const r = use(s, 'magus.flamingBolt', [{ heroId: 'H2' }]).state;
    expect(h(r, 'H1').pool).toBe(h(s, 'H1').pool - 1);
    const p = board({ c3: 'N', d5: 'n', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    // One use 1 D; both uses at once 2 D (FR-017).
    expect(abilityOffers(p).filter((o) => o.abilityId === 'monk.preaching').map((o) => [o.option, o.cost])).toEqual([['one', 1], ['both', 2]]);
  });

  it('US1-AS11 Destiny paid on Starting sheets is not returned when the Epic Stage starts', () => {
    let s = createSetup({ mode: 'draft', playerCount: 4 });
    const order = ['light', 'dark', 'dark', 'light'] as const;
    ['cavalier', 'scout', 'magus', 'monk'].forEach((id, i) => {
      s = act(s, { type: 'pickHero', side: order[i], heroDefinitionId: id }).state;
    });
    for (const a of [
      { type: 'setTurnOrder', side: 'light', first: 0 }, { type: 'setTurnOrder', side: 'dark', first: 1 },
      { type: 'setStartFile', pickIndex: 0, file: 'c' }, { type: 'setStartFile', pickIndex: 1, file: 'c' },
    ] as const) s = act(s, a).state;
    let g = createGame(s.setup);
    expect(g.phase).toBe('beforeMove');
    g = use(g, 'cavalier.demoralise').state;
    const paid = g.destiny.entries.length;
    g = { ...g, epicPending: true, destiny: { ...g.destiny, well: { ...g.destiny.well, initialRemaining: 0, depleted: true, depletedBy: 'H4' } } };
    for (let i = 0; i < 40 && g.stage !== 'epic'; i++) {
      const legal = legalActions(g);
      const pick = legal.find((a) => a.type === 'decide') ?? legal.find((a) => a.type === 'announceLead')
        ?? legal.find((a) => a.type === 'submitRoll') ?? legal.find((a) => a.type === 'endPhase');
      g = act(g, pick!).state;
    }
    expect(g.stage).toBe('epic');
    const after = g.destiny.entries.slice(paid);
    expect(after.filter((e) => e.reason === 'cavalier.demoralise')).toEqual([]);
    expect(reject(g, { type: 'useAbility', abilityId: 'cavalier.demoralise', targets: [] })).toBeTruthy();
  });
});
