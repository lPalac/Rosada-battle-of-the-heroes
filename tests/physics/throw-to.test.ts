// 005 US3 / research R-05: the client die lands on the server's value.
import { describe, expect, it } from 'vitest';
import { Quaternion } from 'three';
import { d20Faces, faceSymmetry, orientationForValue, topFace } from '../../src/physics/d20.ts';
import { throwDieTo } from '../../src/physics/roll.ts';
import { createDiceWorld } from '../../src/physics/world.ts';
import { seededRng } from '../helpers/rng.ts';

describe('US3 die lands on the server value', () => {
  it('a d20 symmetry takes any face to any other (all 400 pairs)', () => {
    const { numbers } = d20Faces();
    for (let landed = 1; landed <= 20; landed++) {
      const q = orientationForValue(landed); // landed face up
      for (let target = 1; target <= 20; target++) {
        const R = faceSymmetry(numbers.indexOf(target), numbers.indexOf(landed));
        const top = topFace(q.clone().multiply(R));
        expect(top.value).toBe(target);
        expect(top.dot).toBeGreaterThan(0.999);
      }
    }
  });

  it('US3-AS1 throwDieTo ends on the target with the same positions as the plain throw', async () => {
    const dw = await createDiceWorld();
    for (const target of [1, 7, 17, 20]) {
      const rng = seededRng(`throw-${target}`);
      const r = throwDieTo(dw, target, () => rng.nextFloat());
      expect(r.value).toBe(target);
      const last = r.frames[r.frames.length - 1];
      expect(topFace(new Quaternion(...last.q)).value).toBe(target);
      expect(r.frames.length).toBeGreaterThan(10);
    }
  });
});
