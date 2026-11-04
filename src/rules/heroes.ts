// Hero Move, Range, wounds, healing, Unconscious (FR-022, FR-023, FR-051).
import { adjacent8, chebyshev, eq, inGrid, isTavern, taverns } from './board.ts';
import { activeHero, emit, fail, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { DESTINY, gain, resilientPointsPassed } from './destiny.ts';
import type { Hero } from './model/hero.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import type { Coord, Side } from './model/types.ts';
import { heroIsBloodied } from './generation.ts';
import { leadRange, removeHeroUnit } from './hero-unit.ts';
import { unitAt } from './paths.ts';
import { complete, progress } from './royal-favors.ts';
import { onHeroEntersSquare, onHeroLeavesSquare } from './taverns.ts';

/** Movement for a turn: base − penalties, never reduced by more than 2 (FR-022). */
export function movementForTurn(hero: Hero, penalty: number): number {
  return Math.max(0, hero.movement - Math.min(penalty, RULES.maxMovementReduction));
}

/** A hero may not end a Move (or any voluntary placement) on an enemy unit or a King. */
export function isForbiddenEndSquare(state: Pick<GameState, 'units'>, side: Side, p: Coord): boolean {
  const u = unitAt(state, p);
  return !!u && (u.type === 'king' || u.side !== side);
}

export function legalMoveSquares(state: GameState): Coord[] {
  if (state.status !== 'playing' || state.enforcement !== 'rules' || state.phase !== 'move' || state.pendingDecision) return [];
  if (state.turn.movementLeft <= 0) return [];
  return adjacent8(activeHero(state).pos).filter(inGrid);
}

export function moveStep(ctx: Ctx, to: Coord): void {
  const { s } = ctx;
  if (s.phase !== 'move') fail('WRONG_PHASE', 'Heroes move only in the Move phase', 'Move');
  const h = activeHero(s);
  if (s.turn.movementLeft <= 0) fail('NO_MOVEMENT_LEFT', 'No Movement left', 'Move');
  if (!inGrid(to) || chebyshev(h.pos, to) !== 1) fail('NOT_ADJACENT', 'Move one adjacent square at a time', 'Move');
  const from = h.pos;
  onHeroLeavesSquare(ctx, h);
  h.pos = to;
  s.turn.movementLeft -= 1;
  s.turn.movePath.push(to);
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason: 'move' });
  onHeroEntersSquare(ctx, h);
}

export function unitsInRange(state: GameState, hero: Hero): Unit[] {
  const range = leadRange(state, hero);
  return state.units.filter((u) => u.side === hero.side && chebyshev(u.pos, hero.pos) <= range);
}

export function heal(ctx: Ctx, h: Hero, amount: number, reason: string): void {
  const before = h.health;
  h.health = Math.min(h.maxHealth, h.health + amount);
  emit(ctx, { type: 'heroHealed', heroId: h.id, amount: h.health - before, health: h.health, reason });
}

/**
 * Wound a hero. Enemy wounds give the wounded hero Resilient Destiny (FR-054) and the attacking side 1 D.
 * At 0 health the hero goes Unconscious and must be placed in a friendly tavern (FR-051).
 */
export function wound(ctx: Ctx, h: Hero, amount: number, source: { enemySide: Side | null }): void {
  if (h.status.unconscious || amount <= 0) return;
  const before = h.health;
  const wasBloodied = heroIsBloodied(ctx.s, h);
  h.health = Math.max(0, h.health - amount);
  emit(ctx, { type: 'heroWounded', heroId: h.id, amount: before - h.health, health: h.health });
  if (source.enemySide) {
    gain(ctx, { side: source.enemySide }, DESTINY.woundEnemyHero, 'woundEnemyHero');
    const resilient = resilientPointsPassed(h.healthBarId, before, h.health);
    gain(ctx, { side: h.side, heroId: h.id }, resilient, 'resilientDestiny');
    // Vanquish your Foes: an enemy hero to 0 completes it; two different Epic enemies brought to Bloodied too.
    if (h.health === 0) complete(ctx, source.enemySide, 'vanquishYourFoes');
    else if (!wasBloodied && heroIsBloodied(ctx.s, h)) {
      const rec = ctx.s.royalFavors[source.enemySide];
      if (!rec.vanquishBloodied.includes(h.id)) {
        rec.vanquishBloodied.push(h.id);
        progress(ctx, source.enemySide, 'vanquishYourFoes', 1);
      }
    }
  }
  if (h.health === 0) {
    h.status.unconscious = true;
    h.status.skipNextTurn = true;
    h.status.recoverAtBeginningOfTurn = false;
    emit(ctx, { type: 'heroUnconscious', heroId: h.id });
    queueDecision(ctx, { type: 'unconsciousTavern', heroId: h.id, options: taverns(h.side) });
  }
}

export function queueDecision(ctx: Ctx, d: GameState['decisionQueue'][number]): void {
  if (!ctx.s.pendingDecision) ctx.s.pendingDecision = d;
  else ctx.s.decisionQueue.push(d);
}

/** Place a hero on a square (taverns, Retreat, sandbox); runs tavern bookkeeping. */
export function placeHero(ctx: Ctx, h: Hero, to: Coord, reason: string): void {
  const from = h.pos;
  if (eq(from, to)) return;
  // A hero placed elsewhere by a rule (Retreat, Unconscious) stops being a Hero Unit first (003 spec Q-37 default).
  if (h.heroUnitId) removeHeroUnit(ctx, h);
  if (h.id === ctx.s.activeHeroId) onHeroLeavesSquare(ctx, h);
  h.pos = to;
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason });
}

export function isInTavern(h: Hero): boolean {
  return isTavern(h.pos);
}
