import { describe, expect, it } from 'vitest';
import type { Ctx } from '../../src/rules/ctx.ts';
import { freeMeal } from '../../src/rules/taverns.ts';
import { act, hero, reject, run } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';

describe('US4 – taverns', () => {
  it('US4-AS10 a hero starting the turn in a tavern may buy before leaving it', () => {
    const s = board({}, { heroes: { H1: '<0' }, health: { H1: 5 } });
    expect(s.turn.tavernShopOpen).toEqual(sq('<0'));
    const r = run(s, [{ type: 'buy', item: 'drink' }, { type: 'buy', item: 'meal' }]).state;
    expect(hero(r, 'H1').health).toBe(9);
    expect(hero(r, 'H1').pool).toBe(0);
    expect(reject(r, { type: 'buy', item: 'drink' })).toBe('NOT_ENOUGH_DESTINY');
  });

  it('US4-AS11 a free Meal in a friendly tavern at End of Turn', () => {
    const s = board({ a1: 'R' }, { ranges: { H1: 'long' }, heroes: { H1: '<0' }, health: { H1: 4 }, pools: { H1: 0 }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a2') }).state;
    expect(r.activeHeroId).toBe('H2');
    expect(hero(r, 'H1').health).toBe(7);
  });

  it('US4-AS11 no free Meal when no Lead was possible', () => {
    const s = board({ h2: 'R' }, { ranges: { H1: 'long' }, heroes: { H1: '<0' }, health: { H1: 4 }, pools: { H1: 0 } });
    const r = act(s, { type: 'endPhase' }).state; // Move → nothing in Range: Lead, After Lead and End of Turn pass
    expect(r.turnNumber).toBe(2);
    expect(hero(r, 'H1').health).toBe(4);
  });

  it('US4-AS11 no free Meal when End of Turn abilities are blocked (King in check after the Lead)', () => {
    const s = board({}, { heroes: { H1: '<0' }, health: { H1: 4 } });
    const ctx: Ctx = { s: structuredClone(s), events: [] };
    freeMeal(ctx, ctx.s.heroes[0], true);
    expect(ctx.s.heroes[0].health).toBe(4);
    freeMeal(ctx, ctx.s.heroes[0], false);
    expect(ctx.s.heroes[0].health).toBe(7);
  });

  it('US4-AS12 starting the turn in a tavern costs 1 Movement; reductions never exceed 2', () => {
    expect(board({}, { heroes: { H1: '<0' } }).turn.movementLeft).toBe(4);
    expect(board({}, { heroes: { H1: '<0' }, movementPenalty: { H1: 1 } }).turn.movementLeft).toBe(3);
    expect(board({}, { heroes: { H1: '<0' }, movementPenalty: { H1: 2 } }).turn.movementLeft).toBe(3);
  });

  it('US4-AS13 pausing the Move in a tavern opens the shop; the hero then continues with leftover Movement', () => {
    let s = board({}, { heroes: { H1: 'a0' }, health: { H1: 6 } });
    s = act(s, { type: 'moveStep', to: sq('<0') }).state;
    expect(s.turn.tavernShopOpen).toEqual(sq('<0'));
    s = act(s, { type: 'buy', item: 'meal' }).state;
    expect(hero(s, 'H1').health).toBe(9);
    s = act(s, { type: 'moveStep', to: sq('<1') }).state;
    expect(s.turn.movementLeft).toBe(3);
  });

  it('US4-AS13 a hero with 0 Movement left in a tavern may still buy', () => {
    let s = board({}, { heroes: { H1: 'e0' }, health: { H1: 6 } });
    for (const to of ['d0', 'c0', 'b0', 'a0', '<0']) s = act(s, { type: 'moveStep', to: sq(to) }).state;
    expect(s.turn.movementLeft).toBe(0);
    expect(hero(act(s, { type: 'buy', item: 'drink' }).state, 'H1').health).toBe(7);
  });

  it('US4-AS14 no buying after leaving the tavern, and none during a Short range Lead advance', () => {
    let s = board({ b2: 'P' }, { heroes: { H1: '<0' } });
    s = act(s, { type: 'moveStep', to: sq('a0') }).state;
    expect(reject(s, { type: 'buy', item: 'drink' })).toBe('SHOP_CLOSED');
    s = act(s, { type: 'moveStep', to: sq('<0') }).state;
    expect(reject(s, { type: 'buy', item: 'drink' })).toBe('SHOP_CLOSED');
    // Advance into a tavern after a Lead: no shop.
    let t = board({ b2: 'P' }, { heroes: { H1: 'a1' }, phase: 'lead' });
    t = act(t, { type: 'announceLead', unitId: 'L-P@b2', to: sq('b3') }).state;
    expect(t.pendingDecision?.type).toBe('advanceSquare');
    t = act(t, { type: 'decide', decision: { type: 'square', to: sq('a2') } }).state;
    expect(reject(t, { type: 'buy', item: 'drink' })).not.toBe('');
  });
});
