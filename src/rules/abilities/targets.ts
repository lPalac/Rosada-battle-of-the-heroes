// Targeting helpers shared by the hero modules (004 T015, FR-014). King's Supremacy: the King and its square are
// immune to hero abilities (Basic Rules *King's Powers*).
import { c, chebyshev, eq, isBattlefield } from '../board.ts';
import { attackersOf, isInCheck, kingOf } from '../check.ts';
import { DATA } from '../data.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Hero } from '../model/hero.ts';
import type { GameState } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import { otherSide, type Coord, type Side, type UnitType } from '../model/types.ts';
import { enemyRoyalRank, unitAt, unitsAt } from '../paths.ts';
import type { AbilityCall } from './types.ts';

/** Adjacent (rulebook): the 3×3 area centred on the square, the square included. */
export const adjacent = (a: Coord, b: Coord): boolean => chebyshev(a, b) <= 1;
export const inRange = (h: Hero, p: Coord): boolean => chebyshev(h.pos, p) <= h.range;
export const isRoyal = (u: Unit): boolean => u.type === 'king' || u.type === 'queen';

/** A unit a hero ability may affect: never a King or a unit on its square; no Queen when the ability skips royalty. */
export function affectable(s: GameState, u: Unit, notRoyalty = false): boolean {
  if (u.type === 'king') return false;
  if (unitsAt(s, u.pos).some((x) => x.type === 'king')) return false;
  if (notRoyalty && u.type === 'queen') return false;
  return true;
}

export const enemyUnits = (s: GameState, side: Side): Unit[] => s.units.filter((u) => u.side !== side);
export const friendlyUnits = (s: GameState, side: Side): Unit[] => s.units.filter((u) => u.side === side);

/** The units of a call that pass `affectable` and a filter. */
export function unitChoices(c0: AbilityCall, side: 'enemy' | 'friendly', pred: (u: Unit) => boolean): AbilityTarget[][] {
  const { s, h, def } = c0;
  return s.units
    .filter((u) => (side === 'enemy' ? u.side !== h.side : u.side === h.side))
    .filter((u) => affectable(s, u, !!def.flags.notRoyalty))
    .filter(pred)
    .map((u) => [{ unitId: u.id }]);
}

export function unitOf(s: GameState, t: AbilityTarget | undefined): Unit {
  const u = t && 'unitId' in t ? s.units.find((x) => x.id === t.unitId) : undefined;
  if (!u) throw new Error('Ability target is not a unit');
  return u;
}

export function heroOf(s: GameState, t: AbilityTarget | undefined): Hero {
  const h = t && 'heroId' in t ? s.heroes.find((x) => x.id === t.heroId) : undefined;
  if (!h) throw new Error('Ability target is not a hero');
  return h;
}

export function squareOf(t: AbilityTarget | undefined): Coord {
  if (!t || !('square' in t)) throw new Error('Ability target is not a square');
  return t.square;
}

/** Starting squares of a unit type for a side (Royal Rank order, Pawn rank). */
export function startingSquares(side: Side, type: UnitType): Coord[] {
  const start = DATA.units.start[side];
  if (type === 'pawn') return start.order.map((_, i) => c(i + 1, start.pawnRank));
  return start.order.flatMap((t, i) => (t === type ? [c(i + 1, start.rank)] : []));
}

export const onStartingSquareOfType = (u: Unit): boolean => startingSquares(u.side, u.type).some((p) => eq(p, u.pos));

export const inEnemyRoyalRank = (side: Side, p: Coord): boolean => p.y === enemyRoyalRank(side);

export function heroOnBattlefield(h: Hero): boolean {
  return isBattlefield(h.pos);
}

/** True when the side's King is in check by a unit that differs from before (not a discovered check, FR-014). */
export function newCheck(before: Pick<GameState, 'units'>, after: Pick<GameState, 'units'>, kingSide: Side): boolean {
  if (!isInCheck(after, kingSide)) return false;
  const king = kingOf(after, kingSide)!;
  const was = (u: Unit) => before.units.find((b) => b.id === u.id && eq(b.pos, u.pos) && b.type === u.type);
  return attackersOf(after, king.pos, otherSide(kingSide)).some((u) => !was(u));
}

export { unitAt };
