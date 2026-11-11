// 006 US1 (FR-016, research R-19): any ability is refused when a unit it creates, moves, places or changes would itself
// check a King; a discovered check (a unit the ability did not touch) is allowed. Leads made by abilities follow the
// Lead rules instead.
import { describe, expect, it } from 'vitest';
import { act, eventsOf } from '../helpers/game.ts';
import { board, sq, toPhase } from '../fixtures/position.ts';
import { abilityOffers, abilityStatus, apply, type GameState } from '../../src/rules/index.ts';
import { lead, unitT } from './heroes/helpers.ts';

const DRAGON = { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 } } as const;
const SPY = { heroDefs: { H1: 'scout' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 } } as const;
const offerOf = (s: GameState, id: string) => abilityOffers(s).find((o) => o.abilityId === id);

describe('US1 – abilities and check (FR-016)', () => {
  it('US1-AS17 a push without the symbol (Terrifying Roar) that makes the pushed unit check a King is refused and blocked', () => {
    // The Knight Led to d5 is next to the Dark Knight on e6; pushed back to e7 it would check the Light King on f5.
    let s = board({ c3: 'N', e6: 'n', f5: 'K', h7: 'p' }, { ...DRAGON, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    const t = [unitT(s, 'e6')];
    const r = apply(s, { type: 'useAbility', abilityId: 'dragonLord.terrifyingRoar', targets: t });
    expect(r.ok ? 'accepted' : r.error.code).toBe('ABILITY_WOULD_CHECK');
    expect(r.ok ? '' : r.error.message).toBe('That would place a King in check');
    expect(offerOf(s, 'dragonLord.terrifyingRoar')).toBeUndefined();
    expect(abilityStatus(s).find((x) => x.abilityId === 'dragonLord.terrifyingRoar')).toMatchObject({ usable: false, reason: 'wouldCheck' });
  });

  it('US1-AS18 a push that moves a unit off a line, so that another unit checks, is allowed (a discovered check)', () => {
    // Pushing the Dark Knight from e6 to e7 opens rank 6: the Light Rook on a6 checks the Dark King on h6.
    let s = board({ c3: 'N', a6: 'R', e6: 'n', h6: 'k', h7: 'p' }, { ...DRAGON, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    expect(offerOf(s, 'dragonLord.terrifyingRoar')?.targets).toContainEqual([unitT(s, 'e6')]);
    const r = act(s, { type: 'useAbility', abilityId: 'dragonLord.terrifyingRoar', targets: [unitT(s, 'e6')] });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['L-R@a6'] }]);
  });

  it('US1-AS17 Infiltrate: a Spy Pawn that would check from the Royal Rank is refused and blocked; one that only opens a line is allowed', () => {
    // The Spy on c8 would attack d7 (it is Led backwards): the Dark King there would be in check.
    let s = board({ c3: 'P', d7: 'k', h7: 'p' }, { ...SPY, heroes: { H1: 'd4' } });
    s = toPhase(s, 'lead');
    const r = apply(s, { type: 'useAbility', abilityId: 'spyMaster.infiltrate', targets: [unitT(s, 'c3')] });
    expect(r.ok ? 'accepted' : r.error.code).toBe('ABILITY_WOULD_CHECK');
    // The Pawn leaving c3 opens rank 3: the Light Rook on a3 checks the Dark King on h3 (discovered).
    let open = board({ a3: 'R', c3: 'P', h3: 'k', h7: 'p' }, { ...SPY, heroes: { H1: 'd4' } });
    open = toPhase(open, 'lead');
    const ok = act(open, { type: 'useAbility', abilityId: 'spyMaster.infiltrate', targets: [unitT(open, 'c3')] });
    expect(eventsOf(ok.events, 'check')).toHaveLength(1);
  });

  it('guarantee 25c / 25d: every blocked target is refused with its code and is never also a target', () => {
    let s = board({ c3: 'N', e6: 'n', c6: 'n', f5: 'K', h7: 'p' }, { ...DRAGON, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    const offer = offerOf(s, 'dragonLord.terrifyingRoar')!;
    expect(offer.targets).toContainEqual([unitT(s, 'c6')]);
    expect(offer.blocked).toEqual([{ targets: [unitT(s, 'e6')], code: 'ABILITY_WOULD_CHECK' }]);
    for (const b of offer.blocked) {
      expect(offer.targets).not.toContainEqual(b.targets);
      const r = apply(s, { type: 'useAbility', abilityId: offer.abilityId, targets: b.targets });
      expect(r.ok ? '' : r.error.code).toBe(b.code);
    }
  });

  it('an ability that makes the turn\'s Lead may check the enemy King (Lead rules, not this test)', () => {
    // Tight Formation Leads the Knight from c3 to d5, from where it checks the Dark King on e7.
    const s = board({ c3: 'N', e7: 'k', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' }, phase: 'lead' });
    const r = act(s, { type: 'useAbility', abilityId: 'cavalier.tightFormation', targets: [unitT(s, 'c3'), { square: sq('d5') }] });
    expect(eventsOf(r.events, 'check')).toHaveLength(1);
  });
});
