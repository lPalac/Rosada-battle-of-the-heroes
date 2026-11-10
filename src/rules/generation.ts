// Hero Destiny Generation and Bloodied: derived from the state, never stored (research R-04).
import { healthBar, RULES } from './data.ts';
import type { Hero } from './model/hero.ts';
import type { GameState } from './model/state.ts';
import type { HeroId, Side, UnitType } from './model/types.ts';
import { enemyRoyalRank } from './paths.ts';
import { hookSources } from './abilities/hooks.ts';

const COUNTED: readonly UnitType[] = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

/**
 * 1 + one per unit type the side has no main or auxiliary unit of on the board (Hero Units do not count), + 1 while
 * an auxiliary pawn of the side stands on the enemy royal rank (FR-010). 0 in the Starting Stage.
 */
export function destinyGeneration(state: Pick<GameState, 'stage' | 'units'> & Partial<GameState>, side: Side): number {
  if (state.stage !== 'epic') return 0;
  // Special units (Shadow Demon, Legendary Ancient) do not count as a unit type (004 research R-07).
  const units = state.units.filter((u) => u.side === side && u.kind !== 'hero' && !u.tags?.some((t) => t === 'demon' || t === 'legendaryAncient'));
  const missing = COUNTED.filter((t) => !units.some((u) => u.type === t)).length;
  const auxOnRoyal = units.some((u) => u.kind === 'auxiliary' && u.type === 'pawn' && u.pos.y === enemyRoyalRank(side));
  const bonus = hookSources(state, 'generationBonus').reduce((a, { hooks, src }) => a + hooks.generationBonus(state as GameState, src, side), 0);
  return RULES.generation.base + missing + (auxOnRoyal ? 1 : 0) + bonus;
}

export function heroIsBloodied(state: Pick<GameState, 'stage'>, h: Hero): boolean {
  return state.stage === 'epic' && !!h.epic && h.health <= healthBar(h.healthBarId).startingMax;
}

/** Epic heroes in the red (starting) area of their health bar (FR-012). */
export function isBloodied(state: Pick<GameState, 'stage' | 'heroes'>, heroId: HeroId): boolean {
  const h = state.heroes.find((x) => x.id === heroId);
  return !!h && heroIsBloodied(state, h);
}
