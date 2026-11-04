// Hero Units: heroes as units on the board (Legendary Powers 6, 8, 9, 10, 11; research R-06).
import { eq, isBattlefield } from './board.ts';
import { isInCheck, kingOf } from './check.ts';
import { activeHero, emit, fail, hero, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import type { Hero } from './model/hero.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import { otherSide, type HeroId, type Side, type UnitType } from './model/types.ts';
import { attackSquares, unitAt } from './paths.ts';
import { hasPower } from './royal-favors.ts';

export const heroUnitId = (heroId: HeroId): string => `HU-${heroId}`;

/** Whether the active hero may use a Hero Unit power in the current phase (Beginning of Turn; End of Turn with Swift Change). */
export function powerWindowOpen(state: GameState, h: Hero): boolean {
  if (state.status !== 'playing' || state.enforcement !== 'rules' || state.pendingDecision) return false;
  if (h.id !== state.activeHeroId || h.status.unconscious) return false;
  if (state.turn.heroUnitChanges.includes(state.phase)) return false;
  if (state.phase === 'beginningOfTurn') return true;
  return state.phase === 'endOfTurn' && hasPower(state, h.side, 'swiftChange');
}

function unitFor(h: Hero, types: UnitType[]): Unit {
  const [type, ...extra] = types;
  return {
    id: heroUnitId(h.id), side: h.side, type, originalType: type, kind: 'hero', heroId: h.id,
    ...(extra.length ? { extraTypes: extra } : {}),
    pos: { ...h.pos }, hasBeenLed: true, promoted: false, enPassantTarget: null,
  };
}

/** Why a unit may not appear on a hero's square, or null (US4-AS2, shared with King's Forces). */
export function placementProblem(state: Pick<GameState, 'units'>, side: Side, unit: Unit): string | null {
  if (!isBattlefield(unit.pos)) return 'HERO_UNIT_OFF_BATTLEFIELD';
  if (unitAt(state, unit.pos)) return 'HERO_UNIT_OCCUPIED';
  const enemyKing = kingOf(state, otherSide(side));
  if (enemyKing && attackSquares({ units: [...state.units, unit] }, unit).some((p) => eq(p, enemyKing.pos))) return 'HERO_UNIT_WOULD_CHECK';
  if (isInCheck(state, side) && !isInCheck({ units: [...state.units, unit] }, side)) return 'HERO_UNIT_IN_CHECK_PATH';
  return null;
}

/** Type sets the hero may become now: `[own]`, `['rook']` (Advanced Warfare), `['rook', own]` (Final Form). */
export function heroUnitOptions(state: GameState, heroId: HeroId): UnitType[][] {
  const h = hero(state, heroId);
  if (h.heroUnitId || !powerWindowOpen(state, h) || !hasPower(state, h.side, 'heroUnit')) return [];
  const own = h.heroUnitType;
  const sets: UnitType[][] = [[own]];
  if (hasPower(state, h.side, 'advancedWarfare') && own !== 'rook') sets.push(['rook']);
  if (hasPower(state, h.side, 'finalForm') && own !== 'rook') sets.push(['rook', own]);
  return sets.filter((types) => !placementProblem(state, h.side, unitFor(h, types)));
}

export function canLeaveHeroUnit(state: GameState, heroId: HeroId): boolean {
  const h = hero(state, heroId);
  return !!h.heroUnitId && powerWindowOpen(state, h);
}

const sameSet = (a: UnitType[], b: UnitType[]) => a.length === b.length && a.every((t) => b.includes(t));

export function becomeHeroUnit(ctx: Ctx, types: UnitType[]): void {
  const { s } = ctx;
  const h = activeHero(s);
  if (!hasPower(s, h.side, 'heroUnit')) fail('POWER_LOCKED', 'Hero Unit needs 6 Royal Favors', 'Royal Favors & Legendary Powers');
  if (h.heroUnitId) fail('ALREADY_HERO_UNIT', 'That hero is already a Hero Unit', 'Hero Unit');
  if (s.phase !== 'beginningOfTurn' && s.phase !== 'endOfTurn') fail('WRONG_PHASE', 'Only at Beginning of Turn (End of Turn with Swift Change)', 'Hero Unit');
  if (!powerWindowOpen(s, h)) fail('WRONG_PHASE', 'Not possible in this phase', 'Hero Unit');
  const own = h.heroUnitType;
  const allowed: UnitType[][] = [[own]];
  if (hasPower(s, h.side, 'advancedWarfare')) allowed.push(['rook']);
  if (hasPower(s, h.side, 'finalForm')) allowed.push(['rook', own]);
  const chosen = allowed.find((a) => sameSet(a, types));
  if (!chosen) {
    const locked = types.includes('rook') && !hasPower(s, h.side, types.length > 1 ? 'finalForm' : 'advancedWarfare');
    fail(locked ? 'POWER_LOCKED' : 'BAD_HERO_UNIT_TYPE', locked ? 'That Legendary Power is not unlocked' : 'That Hero Unit type is not available', 'Hero Unit');
  }
  const unit = unitFor(h, chosen);
  const problem = placementProblem(s, h.side, unit);
  if (problem) fail(problem, problemText[problem], 'Hero Unit');
  s.units.push(unit);
  h.heroUnitId = unit.id;
  s.turn.heroUnitChanges.push(s.phase);
  emit(ctx, { type: 'heroUnitChanged', heroId: h.id, on: true, types: chosen });
}

export function leaveHeroUnit(ctx: Ctx): void {
  const { s } = ctx;
  const h = activeHero(s);
  if (!h.heroUnitId) fail('NOT_HERO_UNIT', 'That hero is not a Hero Unit', 'Hero Unit');
  if (!powerWindowOpen(s, h)) fail('WRONG_PHASE', 'Only at Beginning of Turn (End of Turn with Swift Change)', 'Hero Unit');
  removeHeroUnit(ctx, h);
  s.turn.heroUnitChanges.push(s.phase);
}

export function removeHeroUnit(ctx: Ctx, h: Hero): void {
  const id = h.heroUnitId;
  if (!id) return;
  ctx.s.units = ctx.s.units.filter((u) => u.id !== id);
  h.heroUnitId = null;
  emit(ctx, { type: 'heroUnitChanged', heroId: h.id, on: false, types: [] });
}

/** Range to Lead: 2 as a Hero Unit, 4 with Far Reach; otherwise the hero's own Range (FR-031). */
export function leadRange(state: GameState, h: Hero): number {
  if (!h.heroUnitId) return h.range;
  return hasPower(state, h.side, 'farReach') ? RULES.heroUnit.farReachRange : RULES.heroUnit.range;
}

export const problemText: Record<string, string> = {
  HERO_UNIT_OFF_BATTLEFIELD: 'A Hero Unit must be on the Battlefield',
  HERO_UNIT_OCCUPIED: 'A hero cannot become a Hero Unit on an occupied square',
  HERO_UNIT_WOULD_CHECK: 'A hero cannot become a Hero Unit where it would check the King',
  HERO_UNIT_IN_CHECK_PATH: 'Your King is in check and the hero stands in the path of that check',
};
