// Helpers the hero modules share: ability movement, marks, ability Leads, values of a hero's ability.
import { adjacent8, c, chebyshev, eq, inGrid, isBattlefield, sign } from '../board.ts';
import { leadLeavesKingInCheck, legalLeadsForUnit } from '../check.ts';
import { emit, fail, hero, type Ctx } from '../ctx.ts';
import { abilityDefinition } from '../data.ts';
import { heroIsBloodied } from '../generation.ts';
import { heroEntered, isForbiddenEndSquare, unitsInRange } from '../heroes.ts';
import { startLead } from '../lead.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Hero } from '../model/hero.ts';
import type { Effect, Expiry, GameState } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import type { Coord, HeroId } from '../model/types.ts';
import type { LeadOption } from '../paths.ts';
import { forward, unitsAt } from '../paths.ts';
import { onHeroEntersSquare, onHeroLeavesSquare } from '../taverns.ts';
import { addEffect } from '../abilities/effects.ts';
import { hookSources } from '../abilities/hooks.ts';
import type { AbilityCall, HookSrc } from '../abilities/types.ts';

/** A value of a hero's ability, Bloodied-aware, for passives and effects (no AbilityCall there). */
export function val(s: GameState, h: Hero, abilityId: string, key: string): number {
  const v = abilityDefinition(abilityId).values[key];
  if (v === undefined) throw new Error(`${abilityId}: no value ${key}`);
  return Array.isArray(v) ? v[heroIsBloodied(s, h) ? 1 : 0] : v;
}

export const srcHero = (s: GameState, src: HookSrc): Hero => src.hero ?? hero(s, src.effect!.source.heroId);
export const targetUnitId = (e: Effect | undefined): string | null => (e && 'unitId' in e.target ? e.target.unitId : null);
export const targetHeroId = (e: Effect | undefined): HeroId | null => (e && 'heroId' in e.target ? e.target.heroId : null);
export const targetSquare = (e: Effect | undefined): Coord | null => (e && 'square' in e.target ? e.target.square : null);

/** Squares a hero may be moved to by a "move one square" ability (Warhorse, Pale Steed …). */
export function stepSquares(s: GameState, h: Hero, steps = 1): AbilityTarget[][] {
  const out: AbilityTarget[][] = [];
  for (let x = h.pos.x - steps; x <= h.pos.x + steps; x++) {
    for (let y = h.pos.y - steps; y <= h.pos.y + steps; y++) {
      const p = c(x, y);
      if (!inGrid(p) || eq(p, h.pos) || isForbiddenEndSquare(s, h.side, p, h)) continue;
      out.push([{ square: p }]);
    }
  }
  return out;
}

/** Move a hero by an ability: tavern bookkeeping and square tokens as for a Move step. */
export function moveHeroTo(ctx: Ctx, h: Hero, to: Coord, reason: string): void {
  const from = h.pos;
  if (eq(from, to)) return;
  if (h.id === ctx.s.activeHeroId) onHeroLeavesSquare(ctx, h);
  h.pos = { ...to };
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: h.pos, reason });
  if (h.id === ctx.s.activeHeroId) onHeroEntersSquare(ctx, h);
  heroEntered(ctx, h);
}

/** Whether the hero can be pushed (Divine Protector stops it; Hero Units are not pushed). */
export function canPushHero(s: GameState, h: Hero): boolean {
  if (h.heroUnitId) return false;
  return !hookSources(s, 'pushBlocked').some(({ hooks, src }) => hooks.pushBlocked(s, src, h));
}

export function mark(ctx: Ctx, c0: AbilityCall, kind: string, target: Effect['target'], expires: Expiry, data: Record<string, unknown> = {}): Effect {
  return addEffect(ctx, { kind, source: { abilityId: c0.def.id, heroId: c0.h.id }, target, expires, data });
}

/** Friendly units the hero could Lead now (Range, Hero Unit range). */
export const leadable = (s: GameState, h: Hero): Unit[] => unitsInRange(s, h);

/** Lead options of a unit by the normal rules (check-legal, effects applied). */
export const optionsOf = (s: GameState, u: Unit): LeadOption[] => legalLeadsForUnit(s, u);

/** `[unit, square]` target pairs for a set of Lead options. */
export const leadTargets = (opts: LeadOption[]): AbilityTarget[][] => opts.map((o) => [{ unitId: o.unitId }, { square: o.to }]);

/** Make the turn's Lead with an ability (Instead of Lead). Refused if it would leave the own King in check. */
export function abilityLead(ctx: Ctx, c0: AbilityCall, unit: Unit, opt: LeadOption, extra: { auto?: boolean; noRam?: boolean } = {}): void {
  if (leadLeavesKingInCheck(ctx.s, opt)) fail('LEAD_LEAVES_KING_IN_CHECK', 'That Lead is not legal', 'Check');
  startLead(ctx, unit, opt, { ability: c0.def.id, ...extra });
}

/** The option a `[unit, square]` target names, among the given options. */
export function pickOption(opts: LeadOption[], t: AbilityTarget[]): LeadOption {
  const unitId = t[0] && 'unitId' in t[0] ? t[0].unitId : '';
  const sq = t[1] && 'square' in t[1] ? t[1].square : null;
  const o = opts.find((x) => x.unitId === unitId && sq && eq(x.to, sq));
  if (!o) fail('ABILITY_BAD_TARGET', 'Not a legal target', 'Hero Abilities');
  return o;
}

/** A Lead option for a jump to a square (Draconic Descent, Rapid March, Pilgrimage, Blind Faith). */
export function jumpOption(s: GameState, unit: Unit, to: Coord, path: Coord[] = [to]): LeadOption | null {
  if (!isBattlefield(to)) return null;
  const here = unitsAt(s, to);
  if (here.some((u) => u.side === unit.side)) return null;
  const enemies = here.filter((u) => u.side !== unit.side).map((u) => u.id);
  const last = path.length > 1 ? path[path.length - 2] : unit.pos;
  const d = c(sign(to.x - last.x), sign(to.y - last.y));
  return {
    unitId: unit.id, from: unit.pos, to, isBattle: enemies.length > 0, battleUnitIds: enemies, path,
    pushDir: d, isCastling: false, isEnPassant: false, isDoubleStep: false,
  };
}

/** One square "back towards its side of the board" for a unit. */
export const backDir = (u: Unit): Coord => c(0, -forward(u.side));

/** Heroes in a square (not Unconscious). */
export const heroesAt = (s: GameState, p: Coord): Hero[] => s.heroes.filter((h) => eq(h.pos, p) && !h.status.unconscious);

/** Squares adjacent to p, p included. */
export const area3 = (p: Coord): Coord[] => [p, ...adjacent8(p)];

/** Did the path of a Lead ([from, ...path]) touch a square adjacent to p? */
export const touchesAdjacent = (opt: LeadOption, p: Coord): boolean => [opt.from, ...opt.path].some((q) => chebyshev(q, p) <= 1);
