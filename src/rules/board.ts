// 10×10 grid, regions, distances, adjacency (research R-05).
import { DATA } from './data.ts';
import type { Coord, Side } from './model/types.ts';

export type Region = 'battlefield' | 'kingsCourt' | 'wilderness' | 'tavern';

const SIZE = DATA.board.size;
const [BX0, BX1] = DATA.board.battlefield.x;
const [BY0, BY1] = DATA.board.battlefield.y;

export const c = (x: number, y: number): Coord => ({ x, y });
export const eq = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;
export const add = (a: Coord, d: Coord): Coord => ({ x: a.x + d.x, y: a.y + d.y });

export function inGrid(p: Coord): boolean {
  return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE;
}

export function isBattlefield(p: Coord): boolean {
  return p.x >= BX0 && p.x <= BX1 && p.y >= BY0 && p.y <= BY1;
}

export function tavernOwner(p: Coord): Side | null {
  const t = DATA.board.taverns.find((t) => t.at[0] === p.x && t.at[1] === p.y);
  return t ? t.owner : null;
}

export function isTavern(p: Coord): boolean {
  return tavernOwner(p) !== null;
}

export function taverns(owner?: Side): Coord[] {
  return DATA.board.taverns.filter((t) => !owner || t.owner === owner).map((t) => c(t.at[0], t.at[1]));
}

export function regionOf(p: Coord): Region | null {
  if (!inGrid(p)) return null;
  if (isBattlefield(p)) return 'battlefield';
  if (isTavern(p)) return 'tavern';
  if (p.y === DATA.board.kingsCourt.light || p.y === DATA.board.kingsCourt.dark) return 'kingsCourt';
  return 'wilderness';
}

/** King-step distance; Range is counted with it (FR-023). */
export function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export const DIRS8: readonly Coord[] = [
  c(1, 0), c(-1, 0), c(0, 1), c(0, -1), c(1, 1), c(1, -1), c(-1, 1), c(-1, -1),
];

export function adjacent8(p: Coord): Coord[] {
  return DIRS8.map((d) => add(p, d)).filter(inGrid);
}

/** [c-file square, f-file square] for the side (FR-025). */
export function heroStartSquares(side: Side): Coord[] {
  return DATA.board.heroStartSquares[side].map(([x, y]) => c(x, y));
}

const FILES = 'abcdefgh';

/** Chess notation on the Battlefield (`e4`), `c0`/`f9` in the Outskirts, `T-a0` for taverns. */
export function squareName(p: Coord): string {
  if (!inGrid(p)) return `(${p.x},${p.y})`;
  const file = p.x >= 1 && p.x <= 8 ? FILES[p.x - 1] : p.x === 0 ? '<' : '>';
  if (isTavern(p)) return `T-${file}${p.y}`;
  return `${file}${p.y}`;
}

export function parseSquare(name: string): Coord {
  const m = /^([a-h<>])(\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad square name ${name}`);
  const x = m[1] === '<' ? 0 : m[1] === '>' ? 9 : FILES.indexOf(m[1]) + 1;
  return c(x, Number(m[2]));
}

export const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);
