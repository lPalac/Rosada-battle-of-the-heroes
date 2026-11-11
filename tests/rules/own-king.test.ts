// 006 US1 (FR-014, FR-015, research R-18): a Lead that would leave the own King in check is refused with its own
// reason, also for every "Instead of Lead" ability; blockedLeads lists those Leads; wouldCheckOwnKing is derived.
import { describe, expect, it } from 'vitest';
import { act, reject } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import {
  abilityOffers, apply, blockedLeads, leadRefusal, wouldCheckOwnKing, type Action, type AbilityTarget, type GameState,
} from '../../src/rules/index.ts';
import { legalLeadsForUnit } from '../../src/rules/check.ts';
import { squareName } from '../../src/rules/board.ts';
import { lead, unitT, use } from './heroes/helpers.ts';

const id = (s: GameState, square: string) => unitOn(s, square)!.id;
const target = (s: GameState, from: string, to: string): AbilityTarget[] => [{ unitId: id(s, from) }, { square: sq(to) }];
const allBlocked = (s: GameState, abilityId: string) => abilityOffers(s).filter((o) => o.abilityId === abilityId).flatMap((o) => o.blocked);

// Light King e1, a Light unit on e2 pinned by the Dark Rook on e8.
const PIN = { e1: 'K', e8: 'r', a8: 'k', h7: 'p' };
// Light King e1, a Light Pawn d2 pinned on the diagonal by the Dark Bishop on b4; a Dark Pawn on d3.
const DIAG = { e1: 'K', b4: 'b', d2: 'P', d3: 'p', a8: 'k', h7: 'p' };

describe('US1 – Leads and the own King (FR-014)', () => {
  it('US1-AS16 a pinned unit\'s Lead off the line is refused with its own reason; an impossible move with another', () => {
    const s = board({ ...PIN, e2: 'R' }, { heroes: { H1: 'f1' }, phase: 'lead' });
    expect(reject(s, { type: 'announceLead', unitId: id(s, 'e2'), to: sq('d2') })).toBe('LEAD_LEAVES_KING_IN_CHECK');
    expect(reject(s, { type: 'announceLead', unitId: id(s, 'e2'), to: sq('d3') })).toBe('NOT_A_LEAD');
    expect(act(s, { type: 'announceLead', unitId: id(s, 'e2'), to: sq('e5') }).state.turn.lead).not.toBeNull();
    const r = apply(s, { type: 'announceLead', unitId: id(s, 'e2'), to: sq('d2') });
    expect(r.ok ? '' : r.error.message).toBe('That would place your King in check');
  });

  it('guarantee 25a: blockedLeads and legalLeadsForUnit never share an option; leadRefusal names exactly the blocked ones', () => {
    const s = board({ ...PIN, e2: 'R', c3: 'N' }, { heroes: { H1: 'f1' }, phase: 'lead' });
    for (const u of s.units.filter((x) => x.side === 'light')) {
      const legal = legalLeadsForUnit(s, u).map((o) => squareName(o.to));
      const blocked = blockedLeads(s, u.id).map((o) => squareName(o.to));
      expect(blocked.filter((q) => legal.includes(q))).toEqual([]);
      for (const q of blocked) expect(leadRefusal(s, u.id, sq(q))).toBe('wouldCheckOwnKing');
      for (const q of legal) expect(leadRefusal(s, u.id, sq(q))).toBeNull();
    }
    expect(blockedLeads(s, id(s, 'e2')).map((o) => squareName(o.to))).toContain('d2');
  });

  const CASES: { ability: string; opts: object; pieces: Record<string, string>; from: string; to: string }[] = [
    { ability: 'cavalier.tightFormation', opts: { heroDefs: { H1: 'cavalier' } }, pieces: { ...PIN, e2: 'N' }, from: 'e2', to: 'd4' },
    { ability: 'dragonLord.draconicDescent', opts: { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 } }, pieces: { ...PIN, e2: 'N' }, from: 'e2', to: 'c4' },
    { ability: 'holyPaladin.crusade', opts: { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'dominant' }, pools: { H1: 40 } }, pieces: { ...PIN, e2: 'N' }, from: 'e2', to: 'd4' },
    { ability: 'saint.pilgrimage', opts: { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 } }, pieces: DIAG, from: 'd2', to: 'd4' },
    { ability: 'supremeInquisitor.blindFaith', opts: { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'dominant' }, pools: { H1: 40 } }, pieces: DIAG, from: 'd2', to: 'd3' },
    { ability: 'royalAssassin.redCarpet', opts: { heroDefs: { H1: 'scout' }, stage: 'epic', epic: { H1: 'dominant' }, pools: { H1: 40 } }, pieces: { ...PIN, e2: 'Q', d3: 'n' }, from: 'e2', to: 'd3' },
    { ability: 'chronomonger.certaintyAndDeath', opts: { heroDefs: { H1: 'magus' }, stage: 'epic', epic: { H1: 'dominant' }, pools: { H1: 40 } }, pieces: { ...PIN, e2: 'N' }, from: 'e2', to: 'd4' },
  ];

  for (const c of CASES) {
    it(`US1-AS16 ${c.ability} refuses a Lead that would leave the own King in check, and lists it as blocked`, () => {
      const s = board(c.pieces, { ...c.opts, heroes: { H1: 'd1' }, phase: 'lead' } as never);
      const t = target(s, c.from, c.to);
      const r = apply(s, { type: 'useAbility', abilityId: c.ability, targets: t });
      expect(r.ok ? 'accepted' : r.error.code).toBe('LEAD_LEAVES_KING_IN_CHECK');
      const blocked = allBlocked(s, c.ability);
      if (abilityOffers(s).some((o) => o.abilityId === c.ability)) {
        expect(blocked).toContainEqual({ targets: t, code: 'LEAD_LEAVES_KING_IN_CHECK' });
        expect(abilityOffers(s).filter((o) => o.abilityId === c.ability).flatMap((o) => o.targets)).not.toContainEqual(t);
      }
    });
  }
});

describe('wouldCheckOwnKing (FR-015, guarantee 25b)', () => {
  it('is true exactly when the action would leave a unit newly checking the acting side\'s King; never changes the state', () => {
    // Souls Clash on the Light Pawn e2 that shields the Light King e1 from the Dark Rook e6.
    let s = board({ c3: 'N', e1: 'K', e2: 'P', e4: 'p', e6: 'r', e8: 'k', d2: 'P', d5: 'p', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const before = JSON.stringify(s);
    const exposing: Action = { type: 'useAbility', abilityId: 'magus.soulsClash', targets: [unitT(s, 'e2'), unitT(s, 'e4')] };
    const safe: Action = { type: 'useAbility', abilityId: 'magus.soulsClash', targets: [unitT(s, 'd2'), unitT(s, 'd5')] };
    expect(wouldCheckOwnKing(s, exposing)).toBe(true);
    expect(wouldCheckOwnKing(s, safe)).toBe(false);
    expect(wouldCheckOwnKing(s, { type: 'useAbility', abilityId: 'magus.soulsClash', targets: [unitT(s, 'e2'), unitT(s, 'h7')] })).toBe(false); // refused
    expect(JSON.stringify(s)).toBe(before);
    const r = use(s, 'magus.soulsClash', [unitT(s, 'e2'), unitT(s, 'e4')]);
    expect(r.events.some((e) => e.type === 'check' && e.side === 'light')).toBe(true);
  });
});
