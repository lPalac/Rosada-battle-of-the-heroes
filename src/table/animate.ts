// Tweens for units, heroes and tokens. Each object's moves are chained so visuals stay in state order.
import { Object3D, Quaternion, Vector3 } from 'three';
import type { TableScene } from './scene.ts';

const chains = new WeakMap<Object3D, Promise<void>>();
let active = 0;

export function animationsRunning(): boolean {
  return active > 0;
}

/** Move an object to a position (with an optional hop) after its earlier moves finish. */
export function tweenTo(ts: TableScene, obj: Object3D, to: Vector3, opts: { duration?: number; hop?: number; rotation?: Quaternion } = {}): Promise<void> {
  const prev = chains.get(obj) ?? Promise.resolve();
  const next = prev.then(
    () =>
      new Promise<void>((resolve) => {
        const from = obj.position.clone();
        const fromQ = obj.quaternion.clone();
        const duration = opts.duration ?? 0.35;
        const hop = opts.hop ?? Math.min(0.6, from.distanceTo(to) * 0.15);
        let t = 0;
        active++;
        ts.onFrame((dt) => {
          t = Math.min(1, t + dt / duration);
          const k = t * t * (3 - 2 * t);
          obj.position.lerpVectors(from, to, k);
          obj.position.y += Math.sin(k * Math.PI) * hop;
          if (opts.rotation) obj.quaternion.slerpQuaternions(fromQ, opts.rotation, k);
          if (t >= 1) {
            active--;
            resolve();
            return false;
          }
          return true;
        });
      }),
  );
  chains.set(obj, next);
  return next;
}

/** A short shake for wounds. */
export function shake(ts: TableScene, obj: Object3D): void {
  const base = obj.position.clone();
  let t = 0;
  ts.onFrame((dt) => {
    t += dt;
    obj.position.x = base.x + Math.sin(t * 60) * 0.05 * Math.max(0, 1 - t / 0.4);
    if (t >= 0.4) {
      obj.position.x = base.x;
      return false;
    }
    return true;
  });
}
