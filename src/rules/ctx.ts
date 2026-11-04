// Shared helpers for rules modules. `apply` clones the state once and passes a Ctx that modules mutate;
// the caller's state is never touched.
import type { GameEvent, RuleError } from './model/actions.ts';
import type { Hero } from './model/hero.ts';
import type { GameState } from './model/state.ts';
import type { HeroId, Side } from './model/types.ts';

export interface Ctx {
  s: GameState;
  events: GameEvent[];
}

export class RuleFailure extends Error {
  constructor(public readonly error: RuleError) {
    super(error.message);
  }
}

export function fail(code: string, message: string, rule: string): never {
  throw new RuleFailure({ code, message, rule });
}

export function emit(ctx: Ctx, event: GameEvent): void {
  ctx.events.push(event);
}

export function hero(s: GameState, id: HeroId): Hero {
  const h = s.heroes.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown hero ${id}`);
  return h;
}

export function activeHero(s: GameState): Hero {
  return hero(s, s.activeHeroId);
}

export function activeSide(s: GameState): Side {
  return activeHero(s).side;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
