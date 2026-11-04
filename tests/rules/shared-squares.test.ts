// 002 US2: two friendly units on one square — rules, Battle, position check (FR-003…FR-011).
import { describe, expect, it } from 'vitest';
import { legalLeadsForUnit, threatenedSquares } from '../../src/rules/check.ts';
import { apply, legalLeadTargets, type GameState } from '../../src/rules/index.ts';
import { basicLeads } from '../../src/rules/paths.ts';
import { act, eventsOf, reject } from '../helpers/game.ts';
import { board, name, sq, toPhase, type PositionOptions } from '../fixtures/position.ts';

/** `board()` puts one unit per square, so stacks are made in sandbox and then the rules are turned back on. */
function stacked(pieces: Record<string, string>, moves: [string, string][], opts: PositionOptions = {}) {
  let s = act(board(pieces, opts), { type: 'setEnforcement', mode: 'sandbox' }).state;
  for (const [unitId, to] of moves) s = act(s, { type: 'sandboxPlace', target: { unitId }, to: sq(to) }).state;
  return { sandbox: s, resume: apply(s, { type: 'setEnforcement', mode: 'rules' }) };
}

function resumed(pieces: Record<string, string>, moves: [string, string][], opts: PositionOptions = {}): GameState {
  const r = stacked(pieces, moves, opts).resume;
  if (!r.ok) throw new Error(`resume refused: ${r.error.problems?.map((p) => p.message).join('; ')}`);
  return r.state;
}

const problems = (r: ReturnType<typeof stacked>['resume']) => (r.ok ? [] : r.error.problems ?? []);

describe('002 US2 – two friendly units on one square', () => {
  it('US2-AS2 two Light units on one square: the position is accepted', () => {
    const r = stacked({ c2: 'P', d2: 'P' }, [['L-P@c2', 'd3'], ['L-P@d2', 'd3']]).resume;
    expect(r.ok).toBe(true);
  });

  it('US2-AS3 a Light and a Dark unit on one square: "Units of opposing sides share" is listed, stays in sandbox', () => {
    const r = stacked({ d2: 'P', d7: 'p' }, [['L-P@d2', 'd4'], ['D-P@d7', 'd4']]).resume;
    expect(problems(r)).toContainEqual(expect.objectContaining({
      code: 'OPPOSING_UNITS_SHARE', message: 'Light and Dark units share d4 (L-P@d2, D-P@d7)',
    }));
  });

  it('US2-AS4 any unit on a King’s square is listed (King’s Majesty)', () => {
    const r = stacked({ b1: 'N' }, [['L-N@b1', 'e1']]).resume;
    expect(problems(r)).toContainEqual(expect.objectContaining({ code: 'KING_SHARES', message: 'Light King shares e1 (L-N@b1)' }));
    expect(problems(r).map((p) => p.code)).not.toContain('TWO_UNITS');
  });

  it('US2-AS5 more units on a square than the maximum (2) is listed', () => {
    const r = stacked({ c2: 'P', d2: 'P', f2: 'P' }, [['L-P@c2', 'd3'], ['L-P@d2', 'd3'], ['L-P@f2', 'd3']]).resume;
    expect(problems(r)).toContainEqual(expect.objectContaining({ code: 'TOO_MANY_UNITS', message: '3 units on d3 (max 2)' }));
  });

  it('US2-AS6 a unit is never Led onto a square holding a friendly unit', () => {
    const s = board({ a1: 'R', a3: 'P' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const targets = legalLeadTargets(s, 'L-R@a1').map((t) => name(t.to)).sort();
    expect(targets).toEqual(['a2', 'b1', 'c1', 'd1']);
    expect(reject(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a3') })).toBe('LEAD_LEAVES_KING_IN_CHECK');
  });

  it('US2-AS7 a Battle on two enemy units destroys both: Leading side +2 D once, losing side +1 D per unit', () => {
    let s = resumed({ d1: 'R', d7: 'p', e7: 'p' }, [['D-P@d7', 'd5'], ['D-P@e7', 'd5']], { heroes: { H1: 'c0' }, peaceTreaty: 'war' });
    s = toPhase(s, 'lead');
    expect(legalLeadTargets(s, 'L-R@d1').find((t) => name(t.to) === 'd5')?.isBattle).toBe(true);
    s = act(s, { type: 'announceLead', unitId: 'L-R@d1', to: sq('d5') }).state;
    const r = act(s, { type: 'submitRoll', value: 15 });
    expect(eventsOf(r.events, 'unitDestroyed').map((e) => e.unitId).sort()).toEqual(['D-P@d7', 'D-P@e7']);
    expect(r.state.graveyard.map((u) => u.id).sort()).toEqual(['D-P@d7', 'D-P@e7']);
    expect(r.state.destiny.common).toEqual({ light: 2, dark: 2 });
    expect(r.state.destiny.entries.filter((e) => e.reason === 'destroyEnemy')).toHaveLength(1);
  });

  it('US2-AS7 a destroyed Queen among them gives Revenge', () => {
    let s = resumed({ d1: 'R', d8: 'q', e7: 'p' }, [['D-Q@d8', 'd5'], ['D-P@e7', 'd5']], { heroes: { H1: 'c0' } });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: 'L-R@d1', to: sq('d5') }).state; // Peace: no roll
    expect(s.graveyard).toHaveLength(2);
    expect(s.tokens.revenge.dark).toBe(1);
    expect(s.destiny.common).toEqual({ light: 2, dark: 2 });
  });

  it('US2-AS8 two friendly units on a square: each Leads by its own path, both threaten, the square stops paths', () => {
    const s = resumed({ d2: 'P', b1: 'N', a6: 'b' }, [['L-P@d2', 'd3'], ['L-N@b1', 'd3']]);
    const pawn = s.units.find((u) => u.id === 'L-P@d2')!;
    const knight = s.units.find((u) => u.id === 'L-N@b1')!;
    expect(legalLeadsForUnit(s, pawn).map((o) => name(o.to))).toEqual(['d4']);
    expect(legalLeadsForUnit(s, knight).map((o) => name(o.to)).sort()).toEqual(['b2', 'b4', 'c1', 'c5', 'e5', 'f2', 'f4']);
    const t = threatenedSquares(s, 'light');
    expect(t.has('3,4') && t.has('5,4')).toBe(true); // pawn: c4, e4
    expect(t.has('2,4')).toBe(true); // knight: b4
    const bishop = s.units.find((u) => u.id === 'D-B@a6')!;
    const bishopTargets = legalLeadsForUnit(s, bishop).map((o) => name(o.to));
    expect(bishopTargets).toContain('d3');
    expect(bishopTargets).not.toContain('e2');
    expect(legalLeadsForUnit(s, bishop).find((o) => name(o.to) === 'd3')?.battleUnitIds.sort()).toEqual(['L-N@b1', 'L-P@d2']);
  });

  it('US2-AS10 hero figures do not count towards the units on a square', () => {
    const r = stacked({ c2: 'P', d2: 'P' }, [['L-P@c2', 'd3'], ['L-P@d2', 'd3']], { heroes: { H3: 'd3', H2: 'd3' } }).resume;
    expect(r.ok).toBe(true);
  });

  it('FR-005 seam: a later special rule may allow ending on a friendly square; the default never does', () => {
    const s = board({ a1: 'R', a3: 'P' });
    const rook = s.units.find((u) => u.id === 'L-R@a1')!;
    expect(basicLeads(s, rook).map((o) => name(o.to))).not.toContain('a3');
    const special = basicLeads(s, rook, { allowFriendlyEnd: () => true }).map((o) => name(o.to));
    expect(special).toContain('a3');
    expect(special).not.toContain('a4'); // the path still stops there
  });
});
