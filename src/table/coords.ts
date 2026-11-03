// Board ↔ world coordinates. One square = 1 world unit; Light's King's Court (y = 0) is nearest the default camera.
import { Vector3 } from 'three';
import type { Coord } from '../rules/index.ts';

export const SQUARE = 1;

export function toWorld(c: Coord, height = 0): Vector3 {
  return new Vector3((c.x - 4.5) * SQUARE, height, (4.5 - c.y) * SQUARE);
}

export function fromWorld(p: Vector3): Coord {
  return { x: Math.round(p.x / SQUARE + 4.5), y: Math.round(4.5 - p.z / SQUARE) };
}

/** Side zones beside the board. */
export const ZONES = {
  graveyard: { light: new Vector3(-7.2, 0, 2.6), dark: new Vector3(-7.2, 0, -2.6) },
  well: new Vector3(-7.2, 0, 0),
  common: { light: new Vector3(6.6, 0, 4.4), dark: new Vector3(6.6, 0, -4.4) },
  tokens: new Vector3(8.2, 0, -2.2),
} as const;
