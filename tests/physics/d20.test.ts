import { describe, expect, it } from 'vitest';
import { d20Faces, orientationForValue, restIsValid, topFace } from '../../src/physics/d20.ts';
import { throwDie } from '../../src/physics/roll.ts';
import { createDiceWorld } from '../../src/physics/world.ts';

describe('physics d20 (FR-034, FR-036, research R-06)', () => {
  it('numbers the 20 faces 1…20 once each; opposite faces add up to 21', () => {
    const { normals, numbers } = d20Faces();
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    normals.forEach((n, i) => {
      const opposite = normals.findIndex((m) => m.dot(n) < -0.999);
      expect(numbers[i] + numbers[opposite]).toBe(21);
    });
  });

  it('reads the face pointing up', () => {
    for (let v = 1; v <= 20; v++) {
      const q = orientationForValue(v);
      const top = topFace(q);
      expect(top.value).toBe(v);
      expect(top.dot).toBeGreaterThan(0.999);
    }
  });

  it('rejects a die that is tilted, outside the tray or not at rest in 6 s', () => {
    const ok = { dot: 0.995, inside: true, asleep: true, elapsed: 2 };
    expect(restIsValid(ok)).toBe(true);
    expect(restIsValid({ ...ok, dot: 0.97 })).toBe(false);
    expect(restIsValid({ ...ok, inside: false })).toBe(false);
    expect(restIsValid({ ...ok, asleep: false })).toBe(false);
    expect(restIsValid({ ...ok, elapsed: 6.5 })).toBe(false);
  });

  it('throws real Rapier dice in Node and always ends on a valid face', async () => {
    const dw = await createDiceWorld();
    const seen = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const r = throwDie(dw);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(20);
      expect(r.frames.length).toBeGreaterThan(0);
      const last = r.frames[r.frames.length - 1];
      expect(topFace({ x: last.q[0], y: last.q[1], z: last.q[2], w: last.q[3] }).value).toBe(r.value);
      seen.add(r.value);
    }
    expect(seen.size).toBeGreaterThan(5);
  }, 60_000);
});
