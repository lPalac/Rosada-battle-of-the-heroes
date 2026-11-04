// Sandbox physics controller (002 US1/US3, research R-07): owns the physics world while sandbox is on, draws its
// poses, turns rests into `sandboxPlace` actions, and keeps the bodies in step with the state. State stays the truth.
import { createSandboxWorld, restDestination, type PieceSpec, type SandboxWorld, type TableLayout } from '../physics/sandbox.ts';
import type { Action, Coord, GameState, Side } from '../rules/index.ts';
import { SQUARE, ZONES } from '../table/coords.ts';
import type { Pick } from '../table/picking.ts';
import type { PiecesView } from '../table/pieces.ts';
import type { TableScene } from '../table/scene.ts';

/** The table area the rules accept for sandbox pieces: squares −6…15 (research R-05) → ±13.1 world units. */
const RIM = (15 - 4.5) * SQUARE - 0.05;

export const LAYOUT: TableLayout = {
  square: SQUARE,
  graveyards: {
    light: { x: ZONES.graveyard.light.x, z: ZONES.graveyard.light.z, w: ZONES.graveyardSize.w, d: ZONES.graveyardSize.d },
    dark: { x: ZONES.graveyard.dark.x, z: ZONES.graveyard.dark.z, w: ZONES.graveyardSize.w, d: ZONES.graveyardSize.d },
  },
  rim: { minX: -RIM, maxX: RIM, minZ: -RIM, maxZ: RIM },
};

type Where = { square: Coord } | { graveyard: true };

const squareUnder = (x: number, z: number): Coord => ({ x: Math.round(x / SQUARE + 4.5), y: Math.round(4.5 - z / SQUARE) });

const sameWhere = (a: Where, b: Where): boolean =>
  'graveyard' in a ? 'graveyard' in b : 'square' in b && a.square.x === b.square.x && a.square.y === b.square.y;

export class SandboxPhysics {
  private world: SandboxWorld | null = null;
  private creating: Promise<void> | null = null;
  private looping = false;
  private sides = new Map<string, Side>();
  /** Set while dispatching placements that came from physics, so the state change does not teleport bodies. */
  private fromPhysics = false;

  constructor(
    private ts: TableScene,
    private pieces: PiecesView,
    private dispatch: (a: Action) => boolean,
    private state: () => GameState | null,
    private setOrbit: (enabled: boolean) => void,
  ) {}

  get ready(): boolean {
    return !!this.world;
  }

  /** Create the world when sandbox mode is on (lazy; Rapier loads on first use). */
  ensure(s: GameState): void {
    if (s.enforcement !== 'sandbox' || this.world || this.creating) return;
    const specs = this.specs(s);
    this.creating = createSandboxWorld(specs, LAYOUT).then((w) => {
      this.creating = null;
      if (this.state()?.enforcement !== 'sandbox') return w.dispose();
      this.world = w;
      this.pieces.physics = true;
      this.loop();
    });
  }

  dispose(): void {
    this.world?.dispose();
    this.world = null;
    this.pieces.physics = false;
    this.setOrbit(true);
  }

  private specs(s: GameState): PieceSpec[] {
    this.sides.clear();
    const out: PieceSpec[] = [];
    const graveCount: Record<Side, number> = { light: 0, dark: 0 };
    for (const u of s.units) {
      this.sides.set(u.id, u.side);
      const p = this.pieces.unitTarget(s, u, null);
      out.push({ kind: 'unit', id: u.id, shape: u.type, at: { x: p.x, z: p.z } });
    }
    for (const u of s.graveyard) {
      this.sides.set(u.id, u.side);
      const p = this.pieces.unitTarget(s, u, graveCount[u.side]++);
      out.push({ kind: 'unit', id: u.id, shape: u.type, at: { x: p.x, z: p.z } });
    }
    for (const h of s.heroes) {
      const p = this.pieces.heroTarget(s, h);
      out.push({ kind: 'hero', id: h.id, shape: h.rangeType === 'short' ? 'hero-short' : 'hero-long', at: { x: p.x, z: p.z } });
    }
    return out;
  }

  /** Step physics in the render loop while anything moves or is carried. */
  private loop(): void {
    if (this.looping) return;
    this.looping = true;
    this.ts.onFrame((dt) => {
      const w = this.world;
      if (!w) {
        this.looping = false;
        return false;
      }
      const awake = w.step(dt);
      this.pieces.applyPoses(w.poses(), this.sides);
      this.recordSettled();
      if (!awake) this.looping = false;
      return awake;
    });
  }

  /** Where the state has a piece now. */
  private stateWhere(s: GameState, id: string): Where | null {
    if (s.graveyard.some((u) => u.id === id)) return { graveyard: true };
    const u = s.units.find((x) => x.id === id);
    if (u) return { square: u.pos };
    const h = s.heroes.find((x) => x.id === id);
    return h ? { square: h.pos } : null;
  }

  /** Rests that change a piece's square become sandbox placements (FR-024). */
  private recordSettled(): void {
    const s = this.state();
    if (!this.world || !s) return;
    const settled = this.world.takeSettled();
    if (!settled.length) return;
    const poses = this.world.poses();
    this.fromPhysics = true;
    try {
      for (const r of settled) {
        const pose = poses.get(r.id)!;
        // Heroes never go to the Graveyard: a hero resting there stands on the square under it.
        const where: Where = 'graveyard' in r.rest
          ? (r.kind === 'hero' ? { square: squareUnder(pose.p[0], pose.p[2]) } : { graveyard: true })
          : { square: r.rest.square };
        const now = this.stateWhere(s, r.id);
        if (!now || sameWhere(now, where)) continue;
        const target = r.kind === 'hero' ? { heroId: r.id } : { unitId: r.id };
        if ('graveyard' in where) this.dispatch({ type: 'sandboxPlace', target, to: 'graveyard' });
        else this.dispatch({ type: 'sandboxPlace', target, to: where.square });
      }
    } finally {
      this.fromPhysics = false;
    }
  }

  /** After a state change from elsewhere (undo, editors, click placement, load), move bodies that disagree. */
  syncFromState(s: GameState): void {
    if (this.fromPhysics || !this.world) return;
    const poses = this.world.poses();
    const specs = this.specs(s);
    let moved = false;
    for (const spec of specs) {
      const pose = poses.get(spec.id);
      const want = this.stateWhere(s, spec.id);
      if (!pose || !want) continue;
      const rest = restDestination({ x: pose.p[0], z: pose.p[2] }, LAYOUT);
      const have: Where = 'graveyard' in rest ? { graveyard: true } : { square: rest.square };
      if (!sameWhere(have, want)) {
        this.world.place(spec.id, spec.at);
        moved = true;
      }
    }
    if (moved) {
      this.world.takeSettled(); // teleports are not placements
      this.pieces.applyPoses(this.world.poses(), this.sides);
      this.loop();
    }
  }

  // --- carrying (picker.carry) ---
  startCarry(p: Pick): boolean {
    if (!this.world || !('id' in p)) return false;
    this.world.pickUp(p.id);
    this.setOrbit(false);
    this.loop();
    return true;
  }

  moveCarry(point: { x: number; z: number }): void {
    this.world?.carryTo(point);
    this.loop();
  }

  endCarry(): void {
    this.world?.release();
    this.setOrbit(true);
    this.loop();
  }

  /** Before rules resume: wait for rest (at most `maxMs`), record the last placements (FR-026). */
  async settle(maxMs = 3000): Promise<void> {
    const w = this.world;
    if (!w) return;
    if (w.carrying()) w.release();
    const until = performance.now() + maxMs;
    while (!w.allAsleep() && performance.now() < until) {
      w.step(1 / 60);
      await new Promise((r) => setTimeout(r, 0));
    }
    this.recordSettled();
  }

  /** For tests: where a piece's body or mesh is. */
  poseOf(id: string): { x: number; y: number; z: number } | null {
    const p = this.world?.poses().get(id)?.p;
    return p ? { x: p[0], y: p[1], z: p[2] } : null;
  }
}
