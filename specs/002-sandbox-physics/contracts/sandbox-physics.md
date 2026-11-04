# Contract: Sandbox Physics

**Feature**: `002-sandbox-physics` | Module: `src/physics/sandbox.ts` (Rapier, no Three.js, no DOM)

The interface between the 3D table/UI and the sandbox physics world. The rules core never sees it (constitution II); the UI turns its results into `sandboxPlace` actions.

## Functions

```ts
// Create the world for the current position (sandbox turned on). Loads Rapier lazily.
function createSandboxWorld(pieces: PieceSpec[], layout: TableLayout): Promise<SandboxWorld>;

interface PieceSpec {
  kind: 'unit' | 'hero';
  id: string;
  shape: UnitType | 'hero-short' | 'hero-long';
  /** Rest point in world units (from the state square and the shared-square layout). */
  at: { x: number; z: number };
}

interface TableLayout {
  square: number;                                  // world units per square (1.25)
  graveyards: Record<Side, { x: number; z: number; w: number; d: number }>;
  rim: { minX: number; maxX: number; minZ: number; maxZ: number };
}

interface SandboxWorld {
  /** Advance by dt seconds in fixed steps; returns true while any body is awake. */
  step(dt: number): boolean;
  /** Current poses for drawing. */
  poses(): Map<string, { p: [number, number, number]; q: [number, number, number, number] }>;
  /** Carrying: start, move to a point on the carry plane, release (lands upright). */
  pickUp(id: string): void;
  carryTo(point: { x: number; z: number }): void;
  release(): void;
  /** Bodies that came to rest since the last call, with where they rest. */
  takeSettled(): { id: string; kind: 'unit' | 'hero'; rest: RestDestination }[];
  /** Put a body upright at a point (state changed elsewhere: undo, editor, load). */
  place(id: string, at: { x: number; z: number }): void;
  allAsleep(): boolean;
  dispose(): void;
}

type RestDestination = { square: Coord } | { graveyard: Side };

// Pure: where a resting point belongs (tested without Rapier).
function restDestination(point: { x: number; z: number }, layout: TableLayout): RestDestination;
// Pure: keep a point inside the table rim.
function clampToRim(point: { x: number; z: number }, layout: TableLayout): { x: number; z: number };
```

## Behaviour (tested)

1. A piece placed by `createSandboxWorld` or `place` rests upright on its point and falls asleep within 1 s.
2. `pickUp` + `carryTo` through other pieces pushes them; one hit hard enough falls over.
3. `release` drops the piece upright with zero velocity; it rests on the square under its centre.
4. A body that ends outside the rim is moved back inside it (`clampToRim`) before it is reported.
5. `takeSettled` reports each body once per rest; a body that wobbles but stays reports its own square, and the UI sends nothing.
6. `allAsleep` becomes true within 3 s after the last input when nothing is carried.
7. `restDestination` returns `{ graveyard }` inside a Graveyard rectangle, otherwise the square under the point (which may be off the 10×10 grid).
