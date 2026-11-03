// Throwing the physics d20 (FR-034, FR-036, research R-06). The throw is simulated in fixed steps and recorded;
// the table plays the frames back. No seed: the value goes to the rules core through `submitRoll` and is logged.
import { hullPoints, restIsValid, SETTLE_SECONDS, topFace } from './d20.ts';
import type { DiceWorld } from './world.ts';

export interface Frame {
  p: [number, number, number];
  q: [number, number, number, number];
}

export interface RollResult {
  value: number;
  /** Every attempt's frames in order (re-throws included), at 60 steps per second. */
  frames: Frame[];
  attempts: number;
}

const STEP = 1 / 60;
const MAX_ATTEMPTS = 12;

export function throwDie(dw: DiceWorld, random: () => number = Math.random): RollResult {
  const { R, world, tray } = dw;
  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setLinearDamping(0.25).setAngularDamping(0.35).setCcdEnabled(true),
  );
  world.createCollider(
    R.ColliderDesc.convexHull(hullPoints())!.setDensity(1.2).setFriction(0.6).setRestitution(0.35),
    body,
  );
  const frames: Frame[] = [];
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const half = tray.size / 2 - 0.6;
      body.setTranslation({ x: tray.center.x + (random() - 0.5) * half, y: 2.2, z: tray.center.z + half * 0.8 }, true);
      const axis = { x: random() - 0.5, y: random() - 0.5, z: random() - 0.5 };
      const len = Math.hypot(axis.x, axis.y, axis.z) || 1;
      const angle = random() * Math.PI * 2;
      const s = Math.sin(angle / 2) / len;
      body.setRotation({ x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) }, true);
      body.setLinvel({ x: (random() - 0.5) * 4, y: 2 + random() * 2, z: -(5 + random() * 4) }, true);
      body.setAngvel({ x: (random() - 0.5) * 30, y: (random() - 0.5) * 30, z: (random() - 0.5) * 30 }, true);
      let steps = 0;
      const maxSteps = Math.round(SETTLE_SECONDS / STEP);
      while (steps < maxSteps) {
        world.timestep = STEP;
        world.step();
        steps++;
        const t = body.translation();
        const r = body.rotation();
        frames.push({ p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] });
        if (body.isSleeping()) break;
      }
      const t = body.translation();
      const top = topFace(body.rotation());
      const inside =
        Math.abs(t.x - tray.center.x) < tray.size / 2 && Math.abs(t.z - tray.center.z) < tray.size / 2 && t.y < 1;
      if (restIsValid({ dot: top.dot, inside, asleep: body.isSleeping(), elapsed: steps * STEP })) {
        return { value: top.value, frames, attempts: attempt };
      }
    }
    throw new Error('The die did not land flat after several throws');
  } finally {
    world.removeRigidBody(body);
  }
}
