// Sandbox physics (002 US1, contracts/sandbox-physics.md, research R-06/R-07): units and hero figures as Rapier
// bodies that collide, slide and fall over. No Three.js and no DOM; the UI turns rests into `sandboxPlace` actions.
import type { Coord, Side, UnitType } from '../rules/index.ts';
import { loadRapier, type Rapier } from './world.ts';

export interface PieceSpec {
  kind: 'unit' | 'hero';
  id: string;
  shape: UnitType | 'hero-short' | 'hero-long';
  /** Rest point in world units. */
  at: { x: number; z: number };
}

export interface TableLayout {
  /** World units per square. */
  square: number;
  graveyards: Record<Side, { x: number; z: number; w: number; d: number }>;
  rim: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export type RestDestination = { square: Coord } | { graveyard: Side };

type Pose = { p: [number, number, number]; q: [number, number, number, number] };

export interface SandboxWorld {
  step(dt: number): boolean;
  poses(): Map<string, Pose>;
  pickUp(id: string): void;
  carryTo(point: { x: number; z: number }): void;
  release(): void;
  takeSettled(): { id: string; kind: 'unit' | 'hero'; rest: RestDestination }[];
  place(id: string, at: { x: number; z: number }): void;
  allAsleep(): boolean;
  /** The piece being carried, if any. */
  carrying(): string | null;
  dispose(): void;
}

/** Where a resting point belongs: a Graveyard rectangle, otherwise the square under it (may be off the 10×10 grid). */
export function restDestination(point: { x: number; z: number }, layout: TableLayout): RestDestination {
  for (const side of ['light', 'dark'] as const) {
    const g = layout.graveyards[side];
    if (Math.abs(point.x - g.x) <= g.w / 2 && Math.abs(point.z - g.z) <= g.d / 2) return { graveyard: side };
  }
  return { square: { x: Math.round(point.x / layout.square + 4.5), y: Math.round(4.5 - point.z / layout.square) } };
}

export function clampToRim(point: { x: number; z: number }, layout: TableLayout): { x: number; z: number } {
  const { minX, maxX, minZ, maxZ } = layout.rim;
  return { x: Math.min(maxX, Math.max(minX, point.x)), z: Math.min(maxZ, Math.max(minZ, point.z)) };
}

/** Tops of the placeholder meshes in src/table/assets.ts (lathe profiles), hero figures ~0.75 at 0.85 scale. */
const HEIGHT: Record<PieceSpec['shape'], number> = {
  pawn: 0.42, rook: 0.66, knight: 0.7, bishop: 0.74, queen: 0.82, king: 0.95, 'hero-short': 0.75, 'hero-long': 0.75,
};
const BASE_R = 0.26;
const BASE_H = 0.16;
const BODY_R = 0.2;
/** Carried pieces float just above the board, so they still hit the pieces they pass (spec US1-AS3). */
const CARRY_Y = 0.22;
const STEP = 1 / 60;
const REST_LIN = 0.05;
const REST_ANG = 0.15;
const REST_TIME = 0.3;

interface Piece {
  spec: PieceSpec;
  body: InstanceType<Rapier['RigidBody']>;
  restTime: number;
  moving: boolean;
}

export async function createSandboxWorld(pieces: PieceSpec[], layout: TableLayout): Promise<SandboxWorld> {
  const R = await loadRapier();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  const { minX, maxX, minZ, maxZ } = layout.rim;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2;
  const hz = (maxZ - minZ) / 2;
  const fixed = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const b = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(px, py, pz));
    world.createCollider(R.ColliderDesc.cuboid(sx, sy, sz).setFriction(1.0).setRestitution(0.1), b);
  };
  // Table top (board surface at y = 0) and a low rim so pieces stay reachable.
  fixed(hx + 1, 0.5, hz + 1, cx, -0.5, cz);
  const rimH = 0.4;
  fixed(0.2, rimH, hz + 1, minX - 0.2, rimH, cz);
  fixed(0.2, rimH, hz + 1, maxX + 0.2, rimH, cz);
  fixed(hx + 1, rimH, 0.2, cx, rimH, minZ - 0.2);
  fixed(hx + 1, rimH, 0.2, cx, rimH, maxZ + 0.2);

  const list = new Map<string, Piece>();
  for (const spec of pieces) {
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(spec.at.x, 0.002, spec.at.z).setLinearDamping(0.3).setAngularDamping(0.6)
        .setCcdEnabled(true),
    );
    const h = HEIGHT[spec.shape];
    if (spec.kind === 'hero') {
      const r = 0.2;
      world.createCollider(R.ColliderDesc.capsule(h / 2 - r, r).setTranslation(0, h / 2, 0).setDensity(1.4).setFriction(0.6), body);
    } else {
      // Heavy base, light body: a low centre of mass, so pieces stand but tip when hit.
      world.createCollider(R.ColliderDesc.cylinder(BASE_H / 2, BASE_R).setTranslation(0, BASE_H / 2, 0).setDensity(1.6).setFriction(1.0), body);
      const bodyH = Math.max(0.1, h - BASE_H);
      world.createCollider(R.ColliderDesc.cylinder(bodyH / 2, BODY_R).setTranslation(0, BASE_H + bodyH / 2, 0).setDensity(1.0).setFriction(0.6), body);
    }
    body.sleep();
    list.set(spec.id, { spec, body, restTime: 0, moving: false });
  }

  let carried: Piece | null = null;
  let acc = 0;
  const settled: { id: string; kind: 'unit' | 'hero'; rest: RestDestination }[] = [];

  const upright = (p: Piece, x: number, y: number, z: number) => {
    p.body.setTranslation({ x, y, z }, true);
    p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  function fixedStep(): void {
    world.timestep = STEP;
    world.step();
    for (const p of list.values()) {
      if (p === carried) continue;
      const t = p.body.translation();
      if (t.y < -1) {
        // Fell off the table: back inside the rim, standing, where the player can pick it up.
        const c = clampToRim({ x: t.x, z: t.z }, layout);
        upright(p, c.x, 0.05, c.z);
        p.moving = true;
        continue;
      }
      if (p.body.isSleeping()) continue;
      const v = p.body.linvel();
      const w = p.body.angvel();
      const slow = Math.hypot(v.x, v.y, v.z) < REST_LIN && Math.hypot(w.x, w.y, w.z) < REST_ANG;
      if (!slow) {
        p.moving = true;
        p.restTime = 0;
        continue;
      }
      p.restTime += STEP;
      if (p.restTime < REST_TIME) continue;
      p.body.sleep();
      if (p.moving) {
        p.moving = false;
        const c = clampToRim({ x: t.x, z: t.z }, layout);
        if (c.x !== t.x || c.z !== t.z) upright(p, c.x, 0.05, c.z);
        settled.push({ id: p.spec.id, kind: p.spec.kind, rest: restDestination(c, layout) });
      }
    }
  }

  const get = (id: string): Piece => {
    const p = list.get(id);
    if (!p) throw new Error(`Unknown piece ${id}`);
    return p;
  };

  return {
    step(dt) {
      acc = Math.min(acc + dt, STEP * 5);
      while (acc >= STEP) {
        fixedStep();
        acc -= STEP;
      }
      return !!carried || [...list.values()].some((p) => !p.body.isSleeping());
    },
    poses() {
      const out = new Map<string, Pose>();
      for (const [id, p] of list) {
        const t = p.body.translation();
        const r = p.body.rotation();
        out.set(id, { p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] });
      }
      return out;
    },
    pickUp(id) {
      const p = get(id);
      carried = p;
      const t = p.body.translation();
      p.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
      p.body.setTranslation({ x: t.x, y: CARRY_Y, z: t.z }, true);
      p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    },
    carryTo(point) {
      if (!carried) return;
      const c = clampToRim(point, layout);
      carried.body.wakeUp();
      carried.body.setNextKinematicTranslation({ x: c.x, y: CARRY_Y, z: c.z });
      carried.body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      for (const p of list.values()) if (p !== carried) p.body.wakeUp();
    },
    release() {
      if (!carried) return;
      const p = carried;
      carried = null;
      const t = p.body.translation();
      p.body.setBodyType(R.RigidBodyType.Dynamic, true);
      upright(p, t.x, t.y, t.z);
      p.moving = true;
      p.restTime = 0;
    },
    takeSettled() {
      return settled.splice(0);
    },
    place(id, at) {
      const p = get(id);
      if (p === carried) carried = null;
      p.body.setBodyType(R.RigidBodyType.Dynamic, true);
      upright(p, at.x, 0.002, at.z);
      p.moving = false;
      p.restTime = 0;
      p.body.sleep();
      // Outside the table it falls and is brought back to the rim, then reported (contract 4).
      if (clampToRim(at, layout).x !== at.x || clampToRim(at, layout).z !== at.z) {
        p.body.wakeUp();
        p.moving = true;
      }
    },
    allAsleep() {
      return !carried && [...list.values()].every((p) => p.body.isSleeping());
    },
    carrying() {
      return carried?.spec.id ?? null;
    },
    dispose() {
      world.free();
    },
  };
}
