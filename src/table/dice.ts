// The d20 on the table: plays back the recorded physics throw (FR-034), or shows a forced value in test builds.
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Object3D } from 'three';
import { orientationForValue, D20_RADIUS } from '../physics/d20.ts';
import type { Frame } from '../physics/roll.ts';
import { TRAY } from '../physics/world.ts';
import { createAsset } from './assets.ts';
import type { TableScene } from './scene.ts';

export class DiceView {
  readonly group = new Group();
  readonly die: Object3D;

  constructor(private ts: TableScene) {
    const wall = new MeshStandardMaterial({ color: '#3e2723', roughness: 0.8 });
    const felt = new MeshStandardMaterial({ color: '#1b5e20', roughness: 1 });
    const { x, z } = TRAY.center;
    const half = TRAY.size / 2;
    const floor = new Mesh(new BoxGeometry(TRAY.size, 0.04, TRAY.size), felt);
    floor.position.set(x, -0.02, z);
    floor.receiveShadow = true;
    this.group.add(floor);
    const h = 0.35;
    for (const [w, d, px, pz] of [
      [TRAY.size + 0.3, 0.15, x, z - half - 0.075], [TRAY.size + 0.3, 0.15, x, z + half + 0.075],
      [0.15, TRAY.size, x - half - 0.075, z], [0.15, TRAY.size, x + half + 0.075, z],
    ] as const) {
      const m = new Mesh(new BoxGeometry(w, h, d), wall);
      m.position.set(px, h / 2, pz);
      m.castShadow = true;
      this.group.add(m);
    }
    this.die = createAsset('die.d20');
    this.die.position.set(x, D20_RADIUS * 0.8, z);
    this.group.add(this.die);
  }

  /** Play recorded frames in real time; resolves when the die rests. */
  play(frames: Frame[], speed = 1.6): Promise<void> {
    return new Promise((resolve) => {
      let t = 0;
      this.ts.onFrame((dt) => {
        t += dt * 60 * speed;
        const f = frames[Math.min(frames.length - 1, Math.floor(t))];
        this.die.position.set(f.p[0], f.p[1], f.p[2]);
        this.die.quaternion.set(f.q[0], f.q[1], f.q[2], f.q[3]);
        if (t >= frames.length - 1) {
          resolve();
          return false;
        }
        return true;
      });
    });
  }

  /** Show a value without simulating (test builds only). */
  show(value: number): void {
    this.die.quaternion.copy(orientationForValue(value));
    this.die.position.set(TRAY.center.x, D20_RADIUS * 0.8, TRAY.center.z);
    this.ts.requestRender();
  }
}
