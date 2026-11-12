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
import { hookSources } from './abilities/hooks.ts';
import type { WoundCause } from './abilities/types.ts';

/** Movement for a turn: base − penalties, never reduced by more than 2 (FR-022); ability caps apply (Martyrdom). */
export function movementForTurn(hero: Hero, penalty: number, state?: GameState): number {
  let m = Math.max(0, hero.movement - Math.min(penalty, RULES.maxMovementReduction));
  if (state) for (const { hooks, src } of hookSources(state, 'movementCap')) {
    const cap = hooks.movementCap(state, src, hero);
    if (cap !== null) m = Math.min(m, cap);
  }
  return m;
}

/**
 * A hero may not end a Move (or any voluntary placement) on an enemy unit or a King. 004: Elusive heroes may end on
 * an enemy (non-King) unit's square.
 */
export function isForbiddenEndSquare(state: Pick<GameState, 'units'> & Partial<GameState>, side: Side, p: Coord, h?: Hero): boolean {
  const here = state.units.filter((u) => eq(u.pos, p));
  if (here.some((u) => u.type === 'king')) return true;
  if (!here.some((u) => u.side !== side)) return false;
  if (h && hookSources(state, 'allowEndOnEnemy').some(({ hooks, src }) => hooks.allowEndOnEnemy(state as GameState, src, h))) return false;
  return true;
}

/** 006 FR-008: squares a hero standing on `pos` may step to (the rule `moveStep` checks): adjacent squares and
 * extra ones from effects (Smuggler's Grotto). */
export function moveSquaresFrom(state: GameState, hero: Hero, pos: Coord): Coord[] {
  const h = eq(hero.pos, pos) ? hero : { ...hero, pos };
  const extra = hookSources(state, 'extraMoveSquares').flatMap(({ hooks, src }) => hooks.extraMoveSquares(state, src, h));
  return [...adjacent8(pos).filter(inGrid), ...extra.filter((p) => !adjacent8(pos).some((q) => eq(q, p)))];
}

export function legalMoveSquares(state: GameState): Coord[] {
  if (state.status !== 'playing' || state.enforcement !== 'rules' || state.phase !== 'move' || state.pendingDecision) return [];
  if (state.turn.movementLeft <= 0) return [];
  const h = activeHero(state);
  return moveSquaresFrom(state, h, h.pos);
}

/** 006 FR-008: a square the active hero can reach this Move, the shortest path to it, and whether it may end there. */
export interface Reach {
  to: Coord;
  cost: number;
  path: Coord[];
  canEnd: boolean;
}

/**
 * Every square the active hero can reach with the Movement left (research R-09), by breadth-first search over
 * `moveSquaresFrom`. Between equally short paths: fewest squares with a visible enemy square token (a Bear Trap), then
 * fewest diagonal steps. Empty outside the Move phase. Never changes the state (guarantee 20).
 */
export function moveReach(state: GameState): Reach[] {
  if (!legalMoveSquares(state).length) return [];
  const h = activeHero(state);
  const key = (p: Coord) => `${p.x},${p.y}`;
  const tokens = new Set(state.effects
    .filter((e) => 'square' in e.target && state.heroes.find((x) => x.id === e.source.heroId)?.side !== h.side)
    .map((e) => key((e.target as { square: Coord }).square)));
  type Node = { pos: Coord; path: Coord[]; traps: number; diagonals: number };
  const better = (a: Node, b: Node) => a.traps !== b.traps ? a.traps < b.traps : a.diagonals < b.diagonals;
  const best = new Map<string, Node>([[key(h.pos), { pos: h.pos, path: [], traps: 0, diagonals: 0 }]]);
  let layer: Node[] = [best.get(key(h.pos))!];
  for (let cost = 1; cost <= state.turn.movementLeft && layer.length; cost++) {
    const next = new Map<string, Node>();
    for (const n of layer) {
      for (const p of moveSquaresFrom(state, h, n.pos)) {
        const k = key(p);
        if (best.has(k)) continue;
        const diagonal = p.x !== n.pos.x && p.y !== n.pos.y && chebyshev(p, n.pos) === 1 ? 1 : 0;
        const cand: Node = { pos: p, path: [...n.path, p], traps: n.traps + (tokens.has(k) ? 1 : 0), diagonals: n.diagonals + diagonal };
        const had = next.get(k);
        if (!had || better(cand, had)) next.set(k, cand);
      }
    }
    for (const [k, n] of next) best.set(k, n);
    layer = [...next.values()];
  }
  best.delete(key(h.pos));
  return [...best.values()].map((n) => ({ to: n.pos, cost: n.path.length, path: n.path, canEnd: !isForbiddenEndSquare(state, h.side, n.pos, h) }));
}

/** A hero arrives on a square by Move, push or placement: square tokens react (Bear Trap, Religious Fervor, Portal). */
export function heroEntered(ctx: Ctx, h: Hero): void {
  for (const { hooks, src } of hookSources(ctx.s, 'onHeroEnters')) {
    if (src.effect && !ctx.s.effects.some((e) => e.id === src.effect!.id)) continue;
    hooks.onHeroEnters(ctx, src, h);
  }
}

export function moveStep(ctx: Ctx, to: Coord): void {
  const { s } = ctx;
  if (s.phase !== 'move') fail('WRONG_PHASE', 'Heroes move only in the Move phase', 'Move');
  const h = activeHero(s);
  if (s.turn.movementLeft <= 0) fail('NO_MOVEMENT_LEFT', 'No Movement left', 'Move');
  if (!inGrid(to) || !legalMoveSquares(s).some((p) => eq(p, to))) fail('NOT_ADJACENT', 'Move one adjacent square at a time', 'Move');
  const from = h.pos;
  onHeroLeavesSquare(ctx, h);
  h.pos = to;
  s.turn.movementLeft -= 1;
  s.turn.movePath.push(to);
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason: 'move' });
  onHeroEntersSquare(ctx, h);
  heroEntered(ctx, h);
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
export function wound(ctx: Ctx, h: Hero, amount: number, source: { enemySide: Side | null }, cause: WoundCause = 'other'): void {
  if (h.status.unconscious || amount <= 0) return;
  // 004 hooks: Make Peace Not War, Elusive, Divine Protector (research R-06).
  for (const { hooks, src } of hookSources(ctx.s, 'woundTaken')) amount = hooks.woundTaken(ctx.s, src, h, amount, cause);
  for (const { hooks, src } of hookSources(ctx.s, 'redirectWounds')) {
    const to = hooks.redirectWounds(ctx.s, src, h);
    if (to && to.id !== h.id && !to.status.unconscious) {
      wound(ctx, to, amount, { enemySide: source.enemySide === to.side ? null : source.enemySide }, cause);
      return;
    }
  }
  if (amount <= 0) return;
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
    for (const { hooks, src } of hookSources({ ...ctx.s, heroes: ctx.s.heroes.filter((x) => x.id === h.id).map((x) => ({ ...x, status: { ...x.status, unconscious: false } })) }, 'onUnconscious')) {
      hooks.onUnconscious(ctx, src, h);
    }
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
