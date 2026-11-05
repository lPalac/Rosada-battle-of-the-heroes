// Destroy and special units (004 research R-07): undead, the Legendary Ancient, the Shadow Demon, Spy, clones.
// Destroy is shared by Battle and abilities, so every hook sees every destroyed unit.
import { emit, hero, type Ctx } from '../ctx.ts';
import { RULES } from '../data.ts';
import { DESTINY, gain } from '../destiny.ts';
import { wound } from '../heroes.ts';
import type { Hero } from '../model/hero.ts';
import type { Unit, UnitTag } from '../model/unit.ts';
import { otherSide, type Coord, type Side, type UnitType } from '../model/types.ts';
import { gainRevenge } from '../tokens.ts';
import { createUnit } from '../create.ts';
import { cleanTargets } from './effects.ts';
import { hookSources } from './hooks.ts';

/** Units whose path is one square in any direction (the Legendary Ancient). */
export const KINGLIKE_TAGS: readonly UnitTag[] = ['legendaryAncient'];
export const isKinglike = (u: Pick<Unit, 'tags'>): boolean => !!u.tags?.some((t) => KINGLIKE_TAGS.includes(t));
/** Units that do not count for Destiny Generation (research R-07; the Legendary Ancient too, spec Q-47). */
export const noGeneration = (u: Pick<Unit, 'tags'>): boolean => isKinglike(u) || !!u.tags?.includes('demon');

export function canDestroy(ctx: Ctx, unit: Unit, by: 'battle' | 'ability'): boolean {
  if (by === 'ability' && unit.type === 'king') return false; // King's Supremacy
  return hookSources(ctx.s, 'canDestroy').every(({ hooks, src }) => hooks.canDestroy(ctx.s, src, unit, by));
}

/**
 * Remove a destroyed unit: main units to the Graveyard, auxiliary and Hero Units leave play (003 FR-036), then the
 * onDestroyed hooks. No Destiny here: Battle and abilities add theirs.
 */
export function removeDestroyed(ctx: Ctx, unit: Unit, by: 'battle' | 'ability'): void {
  const { s } = ctx;
  if (!s.units.some((u) => u.id === unit.id)) return;
  s.units = s.units.filter((u) => u.id !== unit.id);
  const leftPlay = unit.kind !== 'main';
  if (!leftPlay) {
    const restored = { ...unit, enPassantTarget: null, modifiedFrom: null, type: unit.modifiedFrom && unit.modifiedFrom !== unit.type ? unit.originalType : unit.type };
    s.graveyard.push(restored);
  }
  emit(ctx, { type: 'unitDestroyed', unitId: unit.id, by, ...(leftPlay ? { leftPlay } : {}) });
  for (const { hooks, src } of hookSources(s, 'onDestroyed')) hooks.onDestroyed(ctx, src, unit, by);
  cleanTargets(ctx);
}

/** A destroyed Hero Unit: 3 wounds, back to the starting square, no longer a Hero Unit (003 FR-031). */
export function heroUnitDestroyed(ctx: Ctx, h: Hero, by: Side | null): void {
  h.heroUnitId = null;
  emit(ctx, { type: 'heroUnitChanged', heroId: h.id, on: false, types: [] });
  const from = h.pos;
  h.pos = { ...h.startSquare };
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: h.pos, reason: 'heroUnitDestroyed' });
  wound(ctx, h, RULES.heroUnit.destroyedWounds, { enemySide: by }, 'heroUnit');
}

/**
 * Destroy units with an ability used by `user` (rulebook *Destroy*, *Common Destiny Pool*): +2 D once when enemy units
 * fall, +1 D per own unit lost to the other side, Revenge for a Queen. Friendly units give no Destiny.
 * Returns the units actually destroyed (protection may stop some, spec Q-44).
 */
export function destroyByAbility(ctx: Ctx, user: Hero | null, units: Unit[], side?: Side): Unit[] {
  const by = user?.side ?? side ?? null;
  const done: Unit[] = [];
  for (const unit of units) {
    const live = ctx.s.units.find((u) => u.id === unit.id);
    if (!live || !canDestroy(ctx, live, 'ability')) continue;
    removeDestroyed(ctx, live, 'ability');
    done.push(live);
    if (live.kind === 'hero') heroUnitDestroyed(ctx, hero(ctx.s, live.heroId!), live.side !== by ? by : null);
  }
  const enemies = done.filter((u) => u.side !== by);
  if (by && enemies.length) {
    gain(ctx, { side: by }, DESTINY.destroyEnemy, 'destroyEnemy');
    for (const u of enemies) gain(ctx, { side: u.side }, DESTINY.ownUnitLost, 'ownUnitLost');
  }
  for (const u of enemies) if (u.type === 'queen') gainRevenge(ctx, u.side);
  return done;
}

/** Create an auxiliary unit with tags (undead, Legendary Ancient, Demon). */
export function createSpecial(
  ctx: Ctx, opts: { side: Side; type: UnitType; at: Coord; tags?: UnitTag[]; health?: number; kind?: Unit['kind']; shareFriendly?: boolean },
): Unit {
  const unit = createUnit(ctx, { side: opts.side, type: opts.type, at: opts.at, kind: opts.kind, shareFriendly: opts.shareFriendly });
  if (opts.tags?.length) unit.tags = [...opts.tags];
  if (opts.health !== undefined) unit.health = opts.health;
  return unit;
}

/** Wound a Legendary Ancient: it takes wounds like a hero and is Destroyed at 0. */
export function woundUnit(ctx: Ctx, unit: Unit, amount: number): void {
  if (unit.health === undefined || amount <= 0) return;
  unit.health = Math.max(0, unit.health - amount);
  if (unit.health === 0) destroyByAbility(ctx, null, [unit], otherSide(unit.side));
}
