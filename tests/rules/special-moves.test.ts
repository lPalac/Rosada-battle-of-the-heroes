import { describe, expect, it } from 'vitest';
import { legalLeadTargets } from '../../src/rules/index.ts';
import { act, run } from '../helpers/game.ts';
import { board, name, sq, toPhase, unitOn } from '../fixtures/position.ts';

const targets = (s: ReturnType<typeof board>, unitId: string) => legalLeadTargets(s, unitId).map((t) => name(t.to)).sort();

describe('castling, en passant, Promotion (FR-003)', () => {
  it('castles on both wings for Light', () => {
    const s = board({ e1: 'K', a1: 'R', h1: 'R', e8: 'k' }, { heroes: { H1: 'e0' }, phase: 'lead' });
    expect(targets(s, 'L-K@e1')).toEqual(expect.arrayContaining(['c1', 'g1']));
    const q = act(s, { type: 'announceLead', unitId: 'L-K@e1', to: sq('c1') }).state;
    expect(unitOn(q, 'c1')?.type).toBe('king');
    expect(unitOn(q, 'd1')?.id).toBe('L-R@a1');
  });

  it('castles for Dark', () => {
    const s = board({ e1: 'K', e8: 'k', h8: 'r' }, { heroes: { H2: 'e9' }, active: 'H2', phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'D-K@e8', to: sq('g8') }).state;
    expect(unitOn(r, 'f8')?.id).toBe('D-R@h8');
  });

  it('no castling when the King or Rook was Led', () => {
    expect(targets(board({ e1: 'K', h1: 'R', e8: 'k' }, { heroes: { H1: 'e0' }, phase: 'lead', led: ['e1'] }), 'L-K@e1')).not.toContain('g1');
    expect(targets(board({ e1: 'K', h1: 'R', e8: 'k' }, { heroes: { H1: 'e0' }, phase: 'lead', led: ['h1'] }), 'L-K@e1')).not.toContain('g1');
  });

  it('no castling with units between', () => {
    expect(targets(board({ e1: 'K', a1: 'R', b1: 'N', e8: 'k' }, { heroes: { H1: 'e0' }, phase: 'lead' }), 'L-K@e1')).not.toContain('c1');
  });

  it("no castling out of, through or into a threatened square", () => {
    expect(targets(board({ e1: 'K', h1: 'R', e8: 'k', f8: 'r' }, { heroes: { H1: 'e0' }, phase: 'lead' }), 'L-K@e1')).not.toContain('g1');
    expect(targets(board({ e1: 'K', h1: 'R', e8: 'k', g8: 'r' }, { heroes: { H1: 'e0' }, phase: 'lead' }), 'L-K@e1')).not.toContain('g1');
    expect(targets(board({ e1: 'K', h1: 'R', a8: 'k', e8: 'r' }, { heroes: { H1: 'e0' }, phase: 'lead' }), 'L-K@e1')).not.toContain('g1');
  });

  it('en passant is possible only on the turn right after the 2-square Lead', () => {
    // Dark (H2) Leads d7-d5 next to the Light pawn on e5; Light (H3) may then battle it en passant on d6.
    let s = board({ e1: 'K', e8: 'k', e5: 'P', d7: 'p', a2: 'P' }, { active: 'H2', heroes: { H2: 'c8', H3: 'e3' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'D-P@d7', to: sq('d5') }).state;
    s = act(s, { type: 'decide', decision: { type: 'square', to: sq('c6') } }).state;
    s = act(s, { type: 'endPhase' }).state; // End of Turn (Hero Retreat offered) → H3
    expect(s.activeHeroId).toBe('H3');
    const lead = toPhase(s, 'lead');
    expect(targets(lead, 'L-P@e5')).toContain('d6');
    const ep = act(lead, { type: 'announceLead', unitId: 'L-P@e5', to: sq('d6') });
    expect(ep.state.graveyard.map((u) => u.id)).toEqual(['D-P@d7']);
    expect(unitOn(ep.state, 'd5')).toBeUndefined();
    // If Light does something else, the chance is gone after that turn.
    const other = act(lead, { type: 'announceLead', unitId: 'L-P@e5', to: sq('e6') }).state;
    const afterTurn = other.phase === 'endOfTurn' ? act(other, { type: 'endPhase' }).state : other;
    expect(afterTurn.activeHeroId).toBe('H4');
    expect(afterTurn.units.find((u) => u.id === 'D-P@d7')?.enPassantTarget).toBeNull();
  });

  it('Promotion asks the active hero for Queen, Rook, Bishop or Knight', () => {
    let s = board({ e1: 'K', h8: 'k', a7: 'P' }, { heroes: { H1: 'b7' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@a7', to: sq('a8') }).state;
    expect(s.pendingDecision).toEqual({ type: 'promotion', unitId: 'L-P@a7', chooserHeroId: 'H1' });
    s = act(s, { type: 'decide', decision: { type: 'promotion', to: 'knight' } }).state;
    expect(unitOn(s, 'a8')).toMatchObject({ type: 'knight', promoted: true, originalType: 'pawn' });
    expect(s.pendingDecision?.type).toBe('advanceSquare');
  });

  it('Promotion can be chosen up front with the Lead', () => {
    const s = board({ e1: 'K', h8: 'k', a7: 'P' }, { ranges: { H1: 'long' }, heroes: { H1: 'b5' }, phase: 'lead' });
    const r = run(s, [{ type: 'announceLead', unitId: 'L-P@a7', to: sq('a8'), promoteTo: 'rook' }]).state;
    expect(unitOn(r, 'a8')?.type).toBe('rook');
  });
});
