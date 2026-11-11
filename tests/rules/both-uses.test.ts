// 006 US1 (FR-017, research R-21): an ability with a different effect when both uses are spent (Preaching) offers one
// use or both, when both are available; it is used once per turn.
import { describe, expect, it } from 'vitest';
import { passTurn, reject } from '../helpers/game.ts';
import { board } from '../fixtures/position.ts';
import { abilityOffers, type GameState } from '../../src/rules/index.ts';
import { unitT, use } from './heroes/helpers.ts';

const MONK = { heroDefs: { H1: 'monk' } } as const;
const kinds = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);
const options = (s: GameState) => abilityOffers(s).filter((o) => o.abilityId === 'monk.preaching').map((o) => [o.option, o.cost]);
const h1 = (s: GameState) => s.heroes.find((x) => x.id === 'H1')!;

describe('US1 – Preaching, one use or both (FR-017)', () => {
  it('US1-AS19 with 2 uses and 2 D the Monk chooses one use (−4, 1 D) or both (cannot be Led, 2 D)', () => {
    const s = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, phase: 'beforeMove' });
    expect(options(s)).toEqual([['one', 1], ['both', 2]]);
    const one = use(s, 'monk.preaching', [unitT(s, 'd4')], 'one').state;
    expect(kinds(one, 'leadModifier').map((e) => e.data.value)).toEqual([-4]);
    expect(kinds(one, 'cannotLead')).toEqual([]);
    expect([one.abilityState.H1!.uses['monk.preaching'], h1(one).pool]).toEqual([1, 2]);
    const both = use(s, 'monk.preaching', [unitT(s, 'd4')], 'both').state;
    expect(kinds(both, 'cannotLead')).toHaveLength(1);
    expect([both.abilityState.H1!.uses['monk.preaching'], h1(both).pool]).toEqual([0, 1]);
  });

  it('US1-AS19 with 1 D, or with one use left, only the single use is offered', () => {
    const poor = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, pools: { H1: 1 }, phase: 'beforeMove' });
    expect(options(poor)).toEqual([['one', 1]]);
    expect(reject(poor, { type: 'useAbility', abilityId: 'monk.preaching', targets: [unitT(poor, 'd4')], option: 'both' })).toBeTruthy();
    const once = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, uses: { H1: { 'monk.preaching': 1 } }, phase: 'beforeMove' });
    expect(options(once)).toEqual([['one', 1]]);
  });

  it('Preaching is once per turn; the second use can be spent on a later turn', () => {
    let s = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, phase: 'beforeMove' });
    s = use(s, 'monk.preaching', [unitT(s, 'd4')], 'one').state;
    expect(reject(s, { type: 'useAbility', abilityId: 'monk.preaching', targets: [unitT(s, 'd4')], option: 'one' })).toBe('ABILITY_USED_THIS_TURN');
    // Four turns later it is the Monk's turn again.
    for (let i = 0; i < 4; i++) s = passTurn(s).state;
    expect(s.activeHeroId).toBe('H1');
    expect(s.abilityState.H1!.usedThisTurn).not.toContain('monk.preaching');
    expect(s.abilityState.H1!.uses['monk.preaching']).toBe(1);
  });
});
