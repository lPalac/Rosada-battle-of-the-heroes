import { describe, expect, it } from 'vitest';
import { act, hero, passTurn, reject, run } from '../helpers/game.ts';
import { board, name, sq } from '../fixtures/position.ts';

describe('US5 – general abilities and Revenge', () => {
  it('US5-AS5 Inspired Lead: X D in Before Lead gives this turn’s Lead +2×X, once per turn', () => {
    let s = board({ d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'beforeLead', peaceTreaty: 'war', common: { light: 2 } });
    expect(reject(s, { type: 'inspiredLead', destiny: 6 })).toBe('NOT_ENOUGH_DESTINY');
    s = act(s, { type: 'inspiredLead', destiny: 3, pay: { hero: 1, common: 2 } }).state;
    expect(hero(s, 'H1').pool).toBe(2);
    expect(s.destiny.common.light).toBe(0);
    // 006 FR-007: the Lead phase is an Inspired Lead window too, so a second use is refused as once per turn.
    expect(reject(s, { type: 'inspiredLead', destiny: 1 })).toBe('ABILITY_USED');
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
    expect(s.turn.lead?.modifiers).toContainEqual({ source: 'inspiredLead', value: 6 });
    // Even a 1 + War 2 + Inspired 6 = 9 succeeds, so no roll is made (spec Q-24).
    expect(s.turn.lead).toMatchObject({ needsRoll: false, success: true });
    expect(s.units.find((u) => u.id === 'L-P@d2')?.pos).toEqual(sq('d4'));
  });

  it('US5-AS5 an Inspired Lead bonus without a Lead that turn is lost; the Destiny stays spent', () => {
    let s = board({ h2: 'P', h7: 'p' }, { heroes: { H1: 'b0' }, phase: 'beforeLead', peaceTreaty: 'war' });
    s = act(s, { type: 'inspiredLead', destiny: 2 }).state;
    expect(hero(s, 'H1').pool).toBe(1);
    expect(s.turnNumber).toBe(2); // no Lead possible: the turn passed
    expect(s.turn.inspiredLeadBonus).toBe(0);
  });

  it('US5-AS6 Hero Retreat (2 D) at End of Turn: friendly tavern and a free Drink', () => {
    let s = board({ d2: 'P' }, { ranges: { H1: 'long' }, heroes: { H1: 'd1' }, health: { H1: 5 }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d3') }).state;
    expect(s.phase).toBe('endOfTurn');
    expect(reject(s, { type: 'heroRetreat', tavern: sq('<9') })).toBe('NOT_FRIENDLY_TAVERN');
    const r = act(s, { type: 'heroRetreat', tavern: sq('>0') }).state;
    const h1 = hero(r, 'H1');
    expect(name(h1.pos)).toBe('T->0');
    expect(h1.health).toBe(6); // free Drink +1; the free Meal is only checked when End of Turn starts (spec Q-23)
    expect(h1.pool).toBe(1);
  });

  it('US5-AS6 Hero Retreat is unavailable when no Lead was possible', () => {
    const s = board({ h2: 'P' }, { heroes: { H1: 'b0' }, pools: { H1: 3 }, phase: 'beforeLead' });
    const r = act(s, { type: 'endPhase' }).state;
    expect(r.turnNumber).toBe(2); // End of Turn passed straight away: nothing to choose
  });

  it('US5-AS7 a destroyed Queen gives Revenge (max 2); discarding it makes a Lead succeed without a roll', () => {
    let s = board({ a1: 'R', a6: 'q' }, { heroes: { H1: 'b0' }, phase: 'lead', revenge: { dark: 1 } });
    s = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') }).state;
    expect(s.tokens.revenge.dark).toBe(2);
    const capped = act(board({ a1: 'R', a6: 'q' }, { heroes: { H1: 'b0' }, phase: 'lead', revenge: { dark: 2 } }),
      { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') }).state;
    expect(capped.tokens.revenge.dark).toBe(2);
    // Dark uses a token instead of rolling.
    s = passTurn(s).state;
    let d = board({ d7: 'p' }, { active: 'H2', heroes: { H2: 'd8' }, phase: 'lead', peaceTreaty: 'war', revenge: { dark: 1 } });
    d = act(d, { type: 'announceLead', unitId: 'D-P@d7', to: sq('d5') }).state;
    const r = run(d, [{ type: 'useRevenge' }]).state;
    expect(r.tokens.revenge.dark).toBe(0);
    expect(r.units.find((u) => u.id === 'D-P@d7')?.pos).toEqual(sq('d5'));
    expect(r.turn.lead?.usedRevenge ?? true).toBe(true);
  });
});
