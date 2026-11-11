import { describe, expect, it } from 'vitest';
import type { Ctx } from '../../src/rules/ctx.ts';
import { wound } from '../../src/rules/heroes.ts';
import { leadPreview } from '../../src/rules/index.ts';
import { act, eventsOf, hero, passTurn, run } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';

describe('US5 – Destiny economy', () => {
  it('US5-AS1 checking the enemy King gives the Common Pool 2 D, once per turn', () => {
    const s = board({ a1: 'R', h1: 'K', e8: 'k' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('e1') });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['L-R@a1'] }]);
    expect(r.state.destiny.common.light).toBe(2);
    expect(r.state.turn.checkDestinyClaimed).toEqual(['light']);
  });

  it('US5-AS2 destroying an enemy unit gives 2 D; the side that lost it gains 1 D per unit', () => {
    const s = board({ a1: 'R', a6: 'n' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') }).state;
    expect(r.destiny.common).toEqual({ light: 2, dark: 1 });
    expect(r.destiny.well.initialRemaining).toBe(13);
  });

  it('US5-AS3 Resilient Destiny: Short 10 → 7 gains 1 D', () => {
    const s = board({ a1: 'R' }, { heroes: { H1: 'b0', H2: 'a3' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a5') }).state;
    expect(hero(r, 'H2').health).toBe(7);
    expect(hero(r, 'H2').pool).toBe(4);
  });

  it('US5-AS3 Resilient Destiny: Long 8 takes 5 wounds → 3, gains 2 D (rulebook example)', () => {
    const s = board({}, {});
    const ctx: Ctx = { s: structuredClone(s), events: [] };
    const h4 = ctx.s.heroes.find((h) => h.id === 'H4')!;
    wound(ctx, h4, 5, { enemySide: 'light' });
    expect(h4.health).toBe(3);
    expect(h4.pool).toBe(5);
  });

  it('US5-AS3 no Destiny for wounds that are not from an enemy', () => {
    const s = board({}, {});
    const ctx: Ctx = { s: structuredClone(s), events: [] };
    const h1 = ctx.s.heroes[0];
    wound(ctx, h1, 3, { enemySide: null });
    expect(h1.pool).toBe(3);
    expect(ctx.s.destiny.common).toEqual({ light: 0, dark: 0 });
  });

  it('US5-AS4 the first Destiny gain flips Peace to War and Leads get +2 from then on', () => {
    let s = board({ a1: 'R', a6: 'n', h2: 'P', h7: 'p' }, { heroes: { H1: 'b0', H2: 'h8' }, phase: 'lead' });
    expect(s.tokens.peaceTreaty).toBe('peace');
    s = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') }).state;
    expect(s.tokens.peaceTreaty).toBe('war');
    s = passTurn(s).state;
    expect(s.activeHeroId).toBe('H2');
    s = run(s, [{ type: 'endPhase' }, { type: 'endPhase' }]).state;
    expect(leadPreview(s, 'D-P@h7')).toMatchObject({ needsRoll: true, modifiers: [{ source: 'war', value: 2 }] });
  });

  it('US5-AS8 Destiny spent before the Well is depleted leaves play: the Well does not refill', () => {
    const s = board({}, { heroes: { H1: '<0' } });
    const r = act(s, { type: 'buy', item: 'meal' }).state;
    expect(r.destiny.well.initialRemaining).toBe(16);
    expect(hero(r, 'H1').pool).toBe(1);
  });

  it('US5-AS9 when the initial 16 run out the Well is unlimited, a notice event is sent and play continues', () => {
    const s = board({ a1: 'R', a6: 'n' }, { heroes: { H1: 'b0' }, phase: 'lead', wellRemaining: 2 });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') });
    expect(eventsOf(r.events, 'wellDepleted')).toHaveLength(1);
    expect(r.state.destiny.well).toMatchObject({ initialRemaining: 0, depleted: true });
    expect(r.state.destiny.common).toEqual({ light: 2, dark: 1 }); // overflow still taken (FAQ 11)
    expect(r.state.heroes.every((h) => h.maxHealth <= 10)).toBe(true); // still Starting Heroes
    expect(r.state.status).toBe('playing');
  });
});
