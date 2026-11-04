import { describe, expect, it } from 'vitest';
import {
  adjacent8, c, chebyshev, heroStartSquares, inGrid, isBattlefield, parseSquare, regionOf, squareName, tavernOwner,
} from '../../src/rules/board.ts';

describe('board geometry (research R-05)', () => {
  it('maps every region boundary', () => {
    expect(regionOf(c(1, 1))).toBe('battlefield');
    expect(regionOf(c(8, 8))).toBe('battlefield');
    expect(regionOf(c(1, 0))).toBe('kingsCourt');
    expect(regionOf(c(8, 9))).toBe('kingsCourt');
    expect(regionOf(c(0, 1))).toBe('wilderness');
    expect(regionOf(c(9, 8))).toBe('wilderness');
    for (const t of [c(0, 0), c(9, 0), c(0, 9), c(9, 9)]) expect(regionOf(t)).toBe('tavern');
    expect(regionOf(c(10, 0))).toBeNull();
    expect(regionOf(c(-1, 4))).toBeNull();
  });

  it('knows the Battlefield and grid edges', () => {
    expect(isBattlefield(c(0, 4))).toBe(false);
    expect(isBattlefield(c(4, 9))).toBe(false);
    expect(inGrid(c(9, 9))).toBe(true);
    expect(inGrid(c(9, 10))).toBe(false);
  });

  it('counts Chebyshev distance, diagonals included (FR-023)', () => {
    expect(chebyshev(c(4, 4), c(5, 5))).toBe(1);
    expect(chebyshev(c(4, 4), c(7, 6))).toBe(3);
    expect(chebyshev(c(0, 0), c(9, 9))).toBe(9);
  });

  it('gives 8 neighbours in the middle and 3 in a corner', () => {
    expect(adjacent8(c(4, 4))).toHaveLength(8);
    expect(adjacent8(c(0, 0))).toHaveLength(3);
    expect(adjacent8(c(9, 5))).toHaveLength(5);
  });

  it('assigns two friendly taverns per side', () => {
    expect(tavernOwner(c(0, 0))).toBe('light');
    expect(tavernOwner(c(9, 0))).toBe('light');
    expect(tavernOwner(c(0, 9))).toBe('dark');
    expect(tavernOwner(c(9, 9))).toBe('dark');
    expect(tavernOwner(c(4, 0))).toBeNull();
  });

  it('puts hero starting squares behind the Bishops (FR-025)', () => {
    expect(heroStartSquares('light')).toEqual([c(3, 0), c(6, 0)]);
    expect(heroStartSquares('dark')).toEqual([c(3, 9), c(6, 9)]);
  });

  it('names squares in chess notation and back', () => {
    expect(squareName(c(5, 4))).toBe('e4');
    expect(squareName(c(3, 0))).toBe('c0');
    expect(squareName(c(0, 0))).toBe('T-<0');
    for (const n of ['a1', 'h8', 'c0', 'f9', '<3', '>5']) expect(squareName(parseSquare(n)).replace('T-', '')).toBe(n);
  });
});
