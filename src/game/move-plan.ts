// 006 US4 (FR-021, research R-09): the Move path the player has clicked but not walked. UI state only: walking it
// sends one ordinary moveStep per square. Engine-free.
import { moveReach, type Coord, type GameState, type Reach } from '../rules/index.ts';

export interface MovePlan {
  /** Every step from the hero's square, in order. */
  path: Coord[];
  /** Movement left after the plan. */
  left: number;
  /** Squares reachable from the plan's end with what is left. */
  reach: Reach[];
}

const same = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

/** The active hero's reach as if it stood at `pos` with `left` Movement (the hero is not moved). */
function reachFrom(state: GameState, pos: Coord, left: number): Reach[] {
  if (left <= 0) return [];
  const view: GameState = {
    ...state,
    heroes: state.heroes.map((h) => (h.id === state.activeHeroId ? { ...h, pos } : h)),
    turn: { ...state.turn, movementLeft: left },
  };
  return moveReach(view);
}

/** Movement left after the plan. */
export const planLeft = (plan: MovePlan): number => plan.left;

/**
 * Add the shortest path from the plan's end (or the hero's square) to `to`. A square that cannot be reached with the
 * Movement left clears the plan (null).
 */
export function extendPlan(state: GameState, plan: MovePlan | null, to: Coord): MovePlan | null {
  const reach = plan ? plan.reach : moveReach(state);
  const r = reach.find((x) => same(x.to, to));
  if (!r) return null;
  const path = [...(plan?.path ?? []), ...r.path];
  const left = state.turn.movementLeft - path.length;
  return { path, left, reach: reachFrom(state, to, left) };
}
