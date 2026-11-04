// Rapier world with a walled dice tray beside the board (research R-06). Rapier loads lazily on the first roll.
import type RAPIER_NS from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER_NS;

export interface TrayGeometry {
  center: { x: number; z: number };
  /** Inner width/depth of the tray. */
  size: number;
  wallHeight: number;
}

// Beside the 002 board (squares are 1.25 world units).
export const TRAY: TrayGeometry = { center: { x: 10.25, z: 1.9 }, size: 3.6, wallHeight: 1.2 };

let rapierPromise: Promise<Rapier> | null = null;

export function loadRapier(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (m) => {
      const R = (m.default ?? m) as Rapier;
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

export interface DiceWorld {
  R: Rapier;
  world: InstanceType<Rapier['World']>;
  tray: TrayGeometry;
}

export async function createDiceWorld(tray: TrayGeometry = TRAY): Promise<DiceWorld> {
  const R = await loadRapier();
  const world = new R.World({ x: 0, y: -25, z: 0 });
  const half = tray.size / 2;
  const t = 0.2;
  const { x, z } = tray.center;
  const fixed = (hx: number, hy: number, hz: number, px: number, py: number, pz: number) => {
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(px, py, pz));
    world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.8).setRestitution(0.3), body);
  };
  fixed(half + t, t, half + t, x, -t, z); // floor, top surface at y = 0
  fixed(t, tray.wallHeight, half + t, x - half - t, tray.wallHeight, z);
  fixed(t, tray.wallHeight, half + t, x + half + t, tray.wallHeight, z);
  fixed(half + t, tray.wallHeight, t, x, tray.wallHeight, z - half - t);
  fixed(half + t, tray.wallHeight, t, x, tray.wallHeight, z + half + t);
  return { R, world, tray };
}
