// 002 US1: sandbox physics in Node with real Rapier (contracts/sandbox-physics.md).
import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  clampToRim, createSandboxWorld, restDestination, type PieceSpec, type SandboxWorld, type TableLayout,
} from '../../src/physics/sandbox.ts';

const SQ = 1.25;
const layout: TableLayout = {
  square: SQ,
  graveyards: { light: { x: -9, z: 3.25, w: 3.75, d: 3.25 }, dark: { x: -9, z: -3.25, w: 3.75, d: 3.25 } },
  rim: { minX: -18, maxX: 18, minZ: -12, maxZ: 12 },
};
const at = (x: number, y: number) => ({ x: (x - 4.5) * SQ, z: (4.5 - y) * SQ });

/** Light pawns on a2…h2 and a Rook on a1, like the start of the Light side. */
function lightSide(): PieceSpec[] {
  const pieces: PieceSpec[] = [];
  for (let x = 1; x <= 8; x++) pieces.push({ kind: 'unit', id: `P${x}`, shape: 'pawn', at: at(x, 2) });
  pieces.push({ kind: 'unit', id: 'R', shape: 'rook', at: at(1, 1) });
  pieces.push({ kind: 'hero', id: 'H1', shape: 'hero-short', at: at(3, 0) });
  return pieces;
}

function run(w: SandboxWorld, seconds: number, each?: (t: number) => void): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.(t);
    w.step(1 / 60);
  }
}

/** Carry the a1 Rook along the pawn row from a2's left to h2's right in 1.5 s, release, let things settle. */
function sweepRookThroughPawns(w: SandboxWorld): void {
  w.pickUp('R');
  const start = at(0, 2);
  const end = at(9, 2);
  run(w, 2, (t) => w.carryTo({ x: start.x + ((end.x - start.x) * Math.min(t, 1.5)) / 1.5, z: start.z }));
  w.release();
  run(w, 3);
}

function tilt(w: SandboxWorld, id: string): number {
  const q = w.poses().get(id)!.q;
  const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(q[0], q[1], q[2], q[3]));
  return (Math.acos(Math.min(1, up.y)) * 180) / Math.PI;
}

describe('002 US1 – pure helpers', () => {
  it('maps a rest point to the square under it, off-grid squares included', () => {
    expect(restDestination(at(4, 3), layout)).toEqual({ square: { x: 4, y: 3 } });
    expect(restDestination({ x: at(4, 3).x + 0.5, z: at(4, 3).z - 0.5 }, layout)).toEqual({ square: { x: 4, y: 3 } });
    expect(restDestination(at(12, 5), layout)).toEqual({ square: { x: 12, y: 5 } });
  });

  it('maps a point inside a Graveyard rectangle to that Graveyard', () => {
    expect(restDestination({ x: -9, z: 3.25 }, layout)).toEqual({ graveyard: 'light' });
    expect(restDestination({ x: -10.5, z: -4 }, layout)).toEqual({ graveyard: 'dark' });
  });

  it('keeps points inside the table rim', () => {
    expect(clampToRim({ x: 30, z: -40 }, layout)).toEqual({ x: 18, z: -12 });
    expect(clampToRim({ x: 1, z: 2 }, layout)).toEqual({ x: 1, z: 2 });
  });
});

describe('002 US1 – Rapier world', () => {
  it('placed pieces stand upright and are asleep within 1 s (contract 1)', async () => {
    const w = await createSandboxWorld(lightSide(), layout);
    run(w, 1);
    expect(w.allAsleep()).toBe(true);
    for (const p of lightSide()) expect(tilt(w, p.id)).toBeLessThan(5);
    w.dispose();
  });

  it('US1-AS2 a released piece rests upright on the square under its centre within 2 s', async () => {
    const w = await createSandboxWorld(lightSide(), layout);
    run(w, 0.5);
    w.takeSettled(); // drop reports from the pieces settling after creation
    w.pickUp('R');
    run(w, 0.5, () => w.carryTo(at(4, 4)));
    w.release();
    let settled: ReturnType<SandboxWorld['takeSettled']> = [];
    for (let t = 0; t < 2 && !settled.some((s) => s.id === 'R'); t += 1 / 60) {
      w.step(1 / 60);
      settled = [...settled, ...w.takeSettled()];
    }
    expect(settled.find((s) => s.id === 'R')?.rest).toEqual({ square: { x: 4, y: 4 } });
    expect(tilt(w, 'R')).toBeLessThan(5);
    w.dispose();
  });

  it('US1-AS3 carrying a Rook through the pawn row pushes pawns and knocks one over', async () => {
    const w = await createSandboxWorld(lightSide(), layout);
    run(w, 0.5);
    sweepRookThroughPawns(w);
    const tilts = Array.from({ length: 8 }, (_, i) => tilt(w, `P${i + 1}`));
    expect(Math.max(...tilts)).toBeGreaterThan(45);
    w.dispose();
  });

  it('US1-AS4 a fallen piece picked up and released lands standing', async () => {
    const w = await createSandboxWorld(lightSide(), layout);
    run(w, 0.5);
    sweepRookThroughPawns(w);
    const fallen = Array.from({ length: 8 }, (_, i) => `P${i + 1}`).find((id) => tilt(w, id) > 45)!;
    expect(fallen).toBeDefined();
    w.pickUp(fallen);
    run(w, 0.3, () => w.carryTo(at(5, 5)));
    w.release();
    run(w, 2);
    expect(tilt(w, fallen)).toBeLessThan(5);
    w.dispose();
  });

  it('a piece pushed past the rim is reported inside it (contract 4) and every rest is reported once (contract 5)', async () => {
    const w = await createSandboxWorld([{ kind: 'unit', id: 'P', shape: 'pawn', at: at(4, 4) }], layout);
    run(w, 0.5);
    w.takeSettled();
    w.place('P', { x: 40, z: 0 });
    const reports: ReturnType<SandboxWorld['takeSettled']> = [];
    run(w, 3, () => reports.push(...w.takeSettled()));
    const p = w.poses().get('P')!.p;
    expect(p[0]).toBeLessThanOrEqual(layout.rim.maxX);
    expect(reports.filter((r) => r.id === 'P')).toHaveLength(1);
    w.dispose();
  });

  it('allAsleep becomes true within 3 s after the last input (contract 6)', async () => {
    const w = await createSandboxWorld(lightSide(), layout);
    w.pickUp('R');
    run(w, 0.4, () => w.carryTo(at(5, 1)));
    w.release();
    let t = 0;
    while (!w.allAsleep() && t < 3) {
      w.step(1 / 60);
      t += 1 / 60;
    }
    expect(w.allAsleep()).toBe(true);
    w.dispose();
  });
});
