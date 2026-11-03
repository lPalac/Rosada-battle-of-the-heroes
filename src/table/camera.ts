// Orbit + zoom camera with limits, default view from the active side, reset control (FR-110).
import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Side } from '../rules/index.ts';
import type { TableScene } from './scene.ts';

export interface TableCamera {
  controls: OrbitControls;
  setSide(side: Side, animate?: boolean): void;
  reset(): void;
}

const TARGET = new Vector3(0.6, 0, 0);

function homePosition(side: Side): Vector3 {
  return side === 'light' ? new Vector3(0.6, 13.5, 11.5) : new Vector3(0.6, 13.5, -11.5);
}

export function createCamera(ts: TableScene, canvas: HTMLCanvasElement): TableCamera {
  const { camera } = ts;
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET);
  controls.enableDamping = false;
  controls.minDistance = 7;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.addEventListener('change', () => ts.requestRender());
  let side: Side = 'light';
  camera.position.copy(homePosition(side));
  camera.lookAt(TARGET);
  controls.update();

  function moveTo(pos: Vector3, animate: boolean): void {
    if (!animate) {
      camera.position.copy(pos);
      controls.target.copy(TARGET);
      controls.update();
      ts.requestRender();
      return;
    }
    const from = camera.position.clone();
    const fromTarget = controls.target.clone();
    let t = 0;
    ts.onFrame((dt) => {
      t = Math.min(1, t + dt / 0.7);
      const k = t * t * (3 - 2 * t);
      // Swing around the board instead of passing through it.
      const p = from.clone().lerp(pos, k);
      p.y += Math.sin(k * Math.PI) * 4;
      camera.position.copy(p);
      controls.target.copy(fromTarget.clone().lerp(TARGET, k));
      controls.update();
      return t < 1;
    });
  }

  return {
    controls,
    setSide(next, animate = true) {
      if (next === side) return;
      side = next;
      moveTo(homePosition(side), animate);
    },
    reset() {
      moveTo(homePosition(side), true);
    },
  };
}
