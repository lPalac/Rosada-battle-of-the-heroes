// Ability effects: marks, square tokens, Modify, Push and their expiries (004 research R-04, US4).
import { add, eq, inGrid, isBattlefield } from '../board.ts';
import { emit, fail, type Ctx } from '../ctx.ts';
import { abilityDefinition, hasAbilityDefinition } from '../data.ts';
import type { Effect, EffectTarget, Expiry, GameState } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import type { Coord, HeroId, UnitType } from '../model/types.ts';
import { unitAt } from '../paths.ts';
import { hookSources, runHooks } from './hooks.ts';

type V = Pick<GameState, 'units'> & Partial<GameState>;

export function addEffect(ctx: Ctx, e: Omit<Effect, 'id' | 'data'> & { data?: Record<string, unknown> }): Effect {
  const { s } = ctx;
  const effect: Effect = { id: s.nextEffectId++, data: {}, ...e };
  s.effects.push(effect);
  emit(ctx, { type: 'effectAdded', effect: JSON.parse(JSON.stringify(effect)) as Effect });
  return effect;
}

export function removeEffect(ctx: Ctx, id: number, reason: string): void {
  const e = ctx.s.effects.find((x) => x.id === id);
  if (!e) return;
  ctx.s.effects = ctx.s.effects.filter((x) => x.id !== id);
  emit(ctx, { type: 'effectRemoved', id, kind: e.kind, reason });
  if (e.kind === 'modify') restoreModify(ctx, e);
}

export function activeEffects(state: V, target?: EffectTarget): Effect[] {
  const all = state.effects ?? [];
  if (!target) return all;
  const key = JSON.stringify(target);
  return all.filter((e) => JSON.stringify(e.target) === key);
}

export const effectsOnUnit = (v: V, unitId: string, kind?: string): Effect[] =>
  (v.effects ?? []).filter((e) => 'unitId' in e.target && e.target.unitId === unitId && (!kind || e.kind === kind));

export const effectsOnHero = (v: V, heroId: HeroId, kind?: string): Effect[] =>
  (v.effects ?? []).filter((e) => 'heroId' in e.target && e.target.heroId === heroId && (!kind || e.kind === kind));

export const effectsOfKind = (v: V, kind: string): Effect[] => (v.effects ?? []).filter((e) => e.kind === kind);

/** Squares a square token covers (one square or an area). */
export function effectSquares(e: Effect): Coord[] {
  if ('square' in e.target) return [e.target.square];
  if ('area' in e.target) return e.target.area;
  return [];
}

/** Square tokens on a square. */
export const tokensAt = (v: V, p: Coord): Effect[] => (v.effects ?? []).filter((e) => effectSquares(e).some((q) => eq(q, p)));

/** Expiry helpers. `until the beginning of your next turn`. */
export const untilMyNextTurn = (heroId: HeroId): Expiry => ({ at: 'turnStart', heroId });
/** `on the next turn`: the next turn in turn order. */
export const nextTurn = (s: GameState): Expiry => ({ at: 'turnEnd', turn: s.turnNumber + 1 });
/** `until the end of your next turn`: counted on the owner's turns. */
export const endOfMyNextTurn = (s: GameState, heroId: HeroId): Expiry => ({ at: 'turnEnd', heroId, count: s.activeHeroId === heroId ? 2 : 1 });
export const thisTurn = (s: GameState): Expiry => ({ at: 'turnEnd', turn: s.turnNumber });

/** Beginning of a hero's turn (Before Turn): `turnStart` expiries, then turn-start hooks. */
export function onTurnStart(ctx: Ctx): void {
  const { s } = ctx;
  for (const st of Object.values(s.abilityState)) if (st) st.usedThisTurn = [];
  for (const e of [...s.effects]) if (e.expires.at === 'turnStart' && e.expires.heroId === s.activeHeroId) removeEffect(ctx, e.id, 'expired');
  runHooks(ctx, 'onTurnStart');
}

/** End of the active hero's turn: end-of-turn hooks (Kill Order, Fireball …), then `turnEnd` expiries. */
export function onTurnEnd(ctx: Ctx): void {
  const { s } = ctx;
  runHooks(ctx, 'onTurnEnd');
  for (const e of [...s.effects]) {
    if (e.expires.at !== 'turnEnd') continue;
    if (e.expires.turn !== undefined && e.expires.turn <= s.turnNumber) removeEffect(ctx, e.id, 'expired');
    else if (e.expires.heroId === s.activeHeroId && e.expires.count !== undefined) {
      e.expires.count -= 1;
      if (e.expires.count <= 0) removeEffect(ctx, e.id, 'expired');
    }
  }
}

export function onEpicStage(ctx: Ctx): void {
  for (const e of [...ctx.s.effects]) if (e.expires.at === 'epicStage') removeEffect(ctx, e.id, 'epicStage');
  runHooks(ctx, 'onEpicStage');
}

/** A target that left play drops its effects (spec edge case, guarantee 14). */
export function cleanTargets(ctx: Ctx): void {
  const ids = new Set(ctx.s.units.map((u) => u.id));
  for (const e of [...ctx.s.effects]) if ('unitId' in e.target && !ids.has(e.target.unitId)) removeEffect(ctx, e.id, 'targetGone');
}

/** Promotion removes marks of abilities that no longer target the new type (rulebook *Mark*). */
export function onPromoted(ctx: Ctx, unit: Unit): void {
  for (const e of effectsOnUnit(ctx.s, unit.id)) {
    const id = e.source.abilityId;
    if (hasAbilityDefinition(id) && abilityDefinition(id).flags.notRoyalty && (unit.type === 'queen' || unit.type === 'king')) {
      removeEffect(ctx, e.id, 'promoted');
    }
  }
}

/** A square counts as occupied: a unit, or a token that says so (Portal, Religious Fervor). */
export function isOccupied(v: V, p: Coord): boolean {
  if (unitAt(v, p)) return true;
  return hookSources(v, 'occupied').some(({ hooks, src }) => hooks.occupied(v as GameState, src, p));
}

/** Empty (rulebook): no units, heroes or tokens. */
export function isEmpty(v: V, p: Coord): boolean {
  return !unitAt(v, p) && !(v.heroes ?? []).some((h) => eq(h.pos, p)) && tokensAt(v, p).length === 0;
}

/** Modify a unit's type (rulebook *Modify*). Temporary when `expires` is given: the type returns afterwards. */
export function modifyUnit(ctx: Ctx, unit: Unit, to: UnitType, source: Effect['source'], expires?: Expiry): void {
  const from = unit.type;
  unit.modifiedFrom ??= from;
  unit.type = to;
  emit(ctx, { type: 'unitModified', unitId: unit.id, from, to });
  if (expires) addEffect(ctx, { kind: 'modify', source, target: { unitId: unit.id }, expires, data: { from } });
}

function restoreModify(ctx: Ctx, e: Effect): void {
  if (!('unitId' in e.target)) return;
  const id = e.target.unitId;
  const unit = ctx.s.units.find((u) => u.id === id);
  if (!unit) return;
  const to = e.data.from as UnitType;
  emit(ctx, { type: 'unitModified', unitId: unit.id, from: unit.type, to });
  unit.type = to;
  unit.modifiedFrom = null;
}

/** Push a unit one square; refused when the square is off the Battlefield or occupied. */
export function pushUnit(ctx: Ctx, unit: Unit, dir: Coord): void {
  const to = add(unit.pos, dir);
  if (!inGrid(to) || !isBattlefield(to) || isOccupied(ctx.s, to)) fail('PUSH_BLOCKED', 'The unit cannot be pushed there', 'Push');
  const from = unit.pos;
  unit.pos = to;
  emit(ctx, { type: 'unitPushed', unitId: unit.id, from, to });
}
