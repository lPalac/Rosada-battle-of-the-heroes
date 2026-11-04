// Board ↔ world coordinates. Light's King's Court (y = 0) is nearest the default camera.
import { Vector3 } from 'three';
import type { Coord } from '../rules/index.ts';

/** World units per square: 25% larger than 001 so two units fit on one square (002 FR-001, research R-01). */
export const SQUARE = 1.25;

export function toWorld(c: Coord, height = 0): Vector3 {
  return new Vector3((c.x - 4.5) * SQUARE, height, (4.5 - c.y) * SQUARE);
}

export function fromWorld(p: Vector3): Coord {
  return { x: Math.round(p.x / SQUARE + 4.5), y: Math.round(4.5 - p.z / SQUARE) };
}

/** A point given in squares from the board centre, in world units. */
const sq = (x: number, z: number) => new Vector3(x * SQUARE, 0, z * SQUARE);

/** Side zones beside the board, in squares from the board centre. */
export const ZONES = {
  graveyard: { light: sq(-7.2, 2.6), dark: sq(-7.2, -2.6) },
  /** Graveyard rectangle size (width, depth) in world units. */
  graveyardSize: { w: 3 * SQUARE, d: 2.6 * SQUARE },
  well: sq(-7.2, 0),
  common: { light: sq(6.6, 4.4), dark: sq(6.6, -4.4) },
  tokens: sq(8.2, -2.2),
} as const;

/** Where units stand on a square with 1 or 2 units: centre, or the square's diagonal (002 research R-02). */
export function unitOffset(index: number, count: number): Vector3 {
  if (count <= 1) return new Vector3();
  const d = 0.27 * SQUARE * (index === 0 ? -1 : 1);
  return new Vector3(d, 0, -d);
}
