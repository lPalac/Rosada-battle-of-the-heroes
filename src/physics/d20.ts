// d20 geometry, face numbers and reading the top face (research R-06). Pure; used by the physics roll and tests.
import { IcosahedronGeometry, Quaternion, Vector3 } from 'three';

export const D20_RADIUS = 0.42;
/** A roll counts only if the top face is this close to flat (dot of face normal and world-up). */
export const FLAT_DOT = 0.98;
export const SETTLE_SECONDS = 6;

export interface D20Faces {
  normals: Vector3[];
  numbers: number[];
}

let cached: D20Faces | null = null;

/** Non-indexed icosahedron: 20 triangles, 3 vertices each. */
export function d20Geometry(radius = D20_RADIUS): IcosahedronGeometry {
  return new IcosahedronGeometry(radius, 0);
}

/** Face normals and numbers; opposite faces add up to 21 like a real d20. */
export function d20Faces(): D20Faces {
  if (cached) return cached;
  const pos = d20Geometry(1).getAttribute('position');
  const normals: Vector3[] = [];
  for (let f = 0; f < pos.count / 3; f++) {
    const c = new Vector3();
    for (let v = 0; v < 3; v++) c.add(new Vector3().fromBufferAttribute(pos, f * 3 + v));
    normals.push(c.normalize());
  }
  const numbers = new Array<number>(normals.length).fill(0);
  let next = 1;
  for (let i = 0; i < normals.length; i++) {
    if (numbers[i]) continue;
    const opposite = normals.findIndex((n, j) => j !== i && !numbers[j] && n.dot(normals[i]) < -0.999);
    numbers[i] = next;
    numbers[opposite] = 21 - next;
    next++;
  }
  cached = { normals, numbers };
  return cached;
}

/** The face pointing up for a body orientation, and how flat it is. */
export function topFace(q: { x: number; y: number; z: number; w: number }): { value: number; dot: number; face: number } {
  const { normals, numbers } = d20Faces();
  const quat = new Quaternion(q.x, q.y, q.z, q.w);
  const up = new Vector3(0, 1, 0);
  let best = -2;
  let face = 0;
  normals.forEach((n, i) => {
    const d = n.clone().applyQuaternion(quat).dot(up);
    if (d > best) {
      best = d;
      face = i;
    }
  });
  return { value: numbers[face], dot: best, face };
}

export interface RestCheck {
  dot: number;
  inside: boolean;
  asleep: boolean;
  elapsed: number;
}

/** Only a die resting flat, inside the tray, within the time limit counts; anything else is re-thrown (FR-036). */
export function restIsValid(r: RestCheck): boolean {
  return r.dot >= FLAT_DOT && r.inside && r.asleep && r.elapsed <= SETTLE_SECONDS;
}

/** An orientation that shows `value` on top (used for forced test rolls and the final pose). */
export function orientationForValue(value: number): Quaternion {
  const { normals, numbers } = d20Faces();
  const i = numbers.indexOf(value);
  return new Quaternion().setFromUnitVectors(normals[i], new Vector3(0, 1, 0));
}

/** Unique hull points for the physics collider. */
export function hullPoints(radius = D20_RADIUS): Float32Array {
  const pos = d20Geometry(radius).getAttribute('position');
  const seen = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    seen.set(p.map((v) => v.toFixed(4)).join(','), p);
  }
  return new Float32Array([...seen.values()].flat());
}
