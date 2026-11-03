import { describe, expect, it } from 'vitest';
import { basicLeads } from '../../src/rules/paths.ts';
import { board, name, unitOn } from '../fixtures/position.ts';

const targets = (s: ReturnType<typeof board>, square: string) =>
  basicLeads(s, unitOn(s, square)!).map((o) => name(o.to)).sort();

describe('unit paths (FR-003, FR-004)', () => {
  it('King steps one square in any direction', () => {
    const s = board({ e4: 'K', a8: 'k' });
    expect(targets(s, 'e4')).toEqual(['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5']);
  });

  it('Rook slides orthogonally and stops at the first unit (Battle on enemies only)', () => {
    const s = board({ d4: 'R', d6: 'p', f4: 'P', a1: 'K', h8: 'k' });
    expect(targets(s, 'd4')).toEqual(['a4', 'b4', 'c4', 'd1', 'd2', 'd3', 'd5', 'd6', 'e4']);
    const battle = basicLeads(s, unitOn(s, 'd4')!).find((o) => name(o.to) === 'd6')!;
    expect(battle.isBattle).toBe(true);
    expect(battle.path.map(name)).toEqual(['d5', 'd6']);
  });

  it('Bishop slides diagonally and never leaves the Battlefield', () => {
    const s = board({ a1: 'B', h1: 'K', a8: 'k' });
    expect(targets(s, 'a1')).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']);
  });

  it('Queen combines Rook and Bishop', () => {
    const s = board({ d1: 'Q', h1: 'K', a8: 'k' });
    expect(targets(s, 'd1')).toHaveLength(7 + 3 + 3 + 3 + 4);
  });

  it('Knight jumps and only interacts with its end square', () => {
    const s = board({ b1: 'N', c3: 'P', d2: 'p', h1: 'K', a8: 'k' });
    expect(targets(s, 'b1')).toEqual(['a3', 'd2']);
    const jump = basicLeads(s, unitOn(s, 'b1')!).find((o) => name(o.to) === 'd2')!;
    expect(jump.path.map(name)).toEqual(['d2']);
    expect(jump.isBattle).toBe(true);
  });

  it('Pawn: one forward, two from its starting square, diagonal Battle only', () => {
    const s = board({ e2: 'P', d3: 'p', f3: 'P', h1: 'K', a8: 'k' });
    expect(targets(s, 'e2')).toEqual(['d3', 'e3', 'e4']);
    const blocked = board({ e2: 'P', e3: 'p', h1: 'K', a8: 'k' });
    expect(targets(blocked, 'e2')).toEqual([]);
    const moved = board({ e3: 'P', h1: 'K', a8: 'k' });
    expect(targets(moved, 'e3')).toEqual(['e4']);
  });

  it('Dark pawns move down the board', () => {
    const s = board({ d7: 'p', e6: 'P', h1: 'K', a8: 'k' });
    expect(targets(s, 'd7')).toEqual(['d5', 'd6', 'e6']);
  });

  it('a path never enters a friendly unit square', () => {
    const s = board({ a1: 'R', a2: 'P', b1: 'N', h1: 'K', h8: 'k' });
    expect(targets(s, 'a1')).toEqual([]);
  });
});
