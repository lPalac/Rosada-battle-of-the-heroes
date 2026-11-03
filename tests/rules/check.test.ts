import { describe, expect, it } from 'vitest';
import {
  isCheckmate, isDiscoveredCheck, isInCheck, isProtected, isThreatened, legalLeadsForUnit, threatenedSquares,
} from '../../src/rules/check.ts';
import { basicLeads } from '../../src/rules/paths.ts';
import { board, name, sq, unitOn } from '../fixtures/position.ts';

describe('Threaten, Protected, Check (FR-040)', () => {
  it('a Rook threatens its lines up to and including the first unit', () => {
    const s = board({ a1: 'R', a4: 'P', c1: 'n', h2: 'K', h8: 'k' });
    const t = threatenedSquares({ units: [unitOn(s, 'a1')!, unitOn(s, 'a4')!, unitOn(s, 'c1')!] }, 'light');
    expect(t.has('1,4')).toBe(true); // a4 friendly: protected
    expect(t.has('1,5')).toBe(false);
    expect(t.has('3,1')).toBe(true); // c1 enemy
    expect(t.has('4,1')).toBe(false);
  });

  it('pawns threaten only diagonally forward', () => {
    const s = board({ e4: 'P', h1: 'K', a8: 'k' });
    expect(isThreatened(s, sq('d5'), 'light')).toBe(true);
    expect(isThreatened(s, sq('f5'), 'light')).toBe(true);
    expect(isThreatened(s, sq('e5'), 'light')).toBe(false);
  });

  it('a unit is Protected when a friendly unit threatens its square', () => {
    const s = board({ e4: 'P', d3: 'P', a8: 'k', h1: 'K' });
    expect(isProtected(s, unitOn(s, 'e4')!)).toBe(true);
    expect(isProtected(s, unitOn(s, 'd3')!)).toBe(false);
  });

  it('detects check', () => {
    const s = board({ e1: 'K', e8: 'r', a8: 'k' });
    expect(isInCheck(s, 'light')).toBe(true);
    expect(isInCheck(s, 'dark')).toBe(false);
  });

  it('a pinned unit still threatens (rulebook Threaten)', () => {
    // Light bishop on e2 is pinned by the rook on e8, but still threatens d3/f3.
    const s = board({ e1: 'K', e2: 'B', e8: 'r', a8: 'k' });
    expect(isThreatened(s, sq('d3'), 'light')).toBe(true);
    expect(legalLeadsForUnit(s, unitOn(s, 'e2')!)).toEqual([]);
  });

  it('A King may not be Led into a threatened square', () => {
    const s = board({ e1: 'K', d8: 'r', a8: 'k' });
    const kingTargets = legalLeadsForUnit(s, unitOn(s, 'e1')!).map((o) => name(o.to));
    expect(kingTargets).not.toContain('d1');
    expect(kingTargets).not.toContain('d2');
    expect(kingTargets).toContain('f2');
  });

  it('detects discovered check', () => {
    const s = board({ e1: 'R', e4: 'N', e8: 'k', a1: 'K' });
    const opt = basicLeads(s, unitOn(s, 'e4')!).find((o) => name(o.to) === 'c5')!;
    expect(isDiscoveredCheck(s, opt)).toBe(true);
  });

  it('detects checkmate with units only', () => {
    const mate = board({ a8: 'k', b6: 'K', h8: 'R' });
    expect(isCheckmate(mate, 'dark')).toBe(true);
    const escape = board({ a8: 'k', b5: 'K', h8: 'R' });
    expect(isCheckmate(escape, 'dark')).toBe(false);
  });
});
