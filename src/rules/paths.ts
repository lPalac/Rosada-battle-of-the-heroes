// Unit paths from units.json, plus pawn moves and en passant (FR-003). Castling lives in check.ts
// because it needs threat maps.
import { add, c, eq, isBattlefield, sign } from './board.ts';
import { DATA } from './data.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import type { Coord, Side } from './model/types.ts';

/** Units whose path is one square in any direction (004: the Legendary Ancient; research R-07). */
const kinglike = (u: Unit): boolean => !!u.tags?.includes('legendaryAncient');
const KINGLIKE_DEF: { directions: string; maxSteps: number; jump?: boolean } = { directions: 'all8', maxSteps: 1 };
/** A Spy pawn (Infiltrate) is Led in the opposite direction (004). */
export const pawnForward = (u: Unit): number => (u.tags?.includes('spy') ? -forward(u.side) : forward(u.side));

export interface LeadOption {
  unitId: string;
  from: Coord;
  to: Coord;
  isBattle: boolean;
  /** Every enemy unit destroyed by this Lead: all units on `to` (en passant: the passed pawn). Empty: no Battle. */
  battleUnitIds: string[];
  /** Interacted squares, start excluded (Knight: end only; castling: the King's 2 squares). */
  path: Coord[];
  /** Direction a Rammed hero is pushed: last 1-square step (research R-10). */
  pushDir: Coord;
  isCastling: boolean;
  isEnPassant: boolean;
  isDoubleStep: boolean;
  rook?: { unitId: string; to: Coord };
}

type UnitView = Pick<GameState, 'units'>;

const ORTHO = [c(1, 0), c(-1, 0), c(0, 1), c(0, -1)];
const DIAG = [c(1, 1), c(1, -1), c(-1, 1), c(-1, -1)];
const KNIGHT = [c(1, 2), c(2, 1), c(-1, 2), c(-2, 1), c(1, -2), c(2, -1), c(-1, -2), c(-2, -1)];

function directions(name: string | undefined): Coord[] {
  switch (name) {
    case 'orthogonal': return ORTHO;
    case 'diagonal': return DIAG;
    case 'all8': return [...ORTHO, ...DIAG];
    case 'knight': return KNIGHT;
    default: return [];
  }
}

/** The first unit on a square: use it for "is this square occupied". */
export function unitAt(state: UnitView, p: Coord): Unit | undefined {
  return state.units.find((u) => eq(u.pos, p));
}

/** Every unit on a square (up to `maxUnitsPerSquare`, spec 002 FR-003). */
export function unitsAt(state: UnitView, p: Coord): Unit[] {
  return state.units.filter((u) => eq(u.pos, p));
}

export interface PathOptions {
  /** Seam for later abilities: allow ending on a square held by friendly units. No v1 rule uses it (002 FR-005). */
  allowFriendlyEnd?: (unit: Unit, square: Coord) => boolean;
}

/** Who holds a square, seen from a unit: friendly units block, enemy units are Battle targets. */
function occupancy(state: UnitView, unit: Unit, p: Coord): { friendly: boolean; enemies: string[] } {
  const here = unitsAt(state, p);
  return { friendly: here.some((u) => u.side === unit.side), enemies: here.filter((u) => u.side !== unit.side).map((u) => u.id) };
}

export const forward = (side: Side): number => (side === 'light' ? 1 : -1);

export function enemyRoyalRank(side: Side): number {
  return side === 'light' ? DATA.units.start.dark.rank : DATA.units.start.light.rank;
}

export function isPromotionSquare(unit: Unit, to: Coord): boolean {
  return unit.type === 'pawn' && unit.kind === 'main' && unit.originalType === 'pawn' && to.y === enemyRoyalRank(unit.side);
}

/** Knight push direction: the 1-square leg after the 2-square leg (FR-052). */
export function knightPushDir(from: Coord, to: Coord): Coord {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) === 1 ? c(sign(dx), 0) : c(0, sign(dy));
}

/** Basic Leads for one unit, ignoring check (castling excluded). */
export function basicLeads(state: UnitView, unit: Unit, opts: PathOptions = {}): LeadOption[] {
  const out: LeadOption[] = [];
  const friendlyEnd = (p: Coord) => !!opts.allowFriendlyEnd?.(unit, p);
  const base = { unitId: unit.id, from: unit.pos, isCastling: false, isEnPassant: false, isDoubleStep: false };
  if (unit.type === 'pawn' && !kinglike(unit)) {
    const f = pawnForward(unit);
    const one = c(unit.pos.x, unit.pos.y + f);
    if (isBattlefield(one) && !unitAt(state, one)) {
      out.push({ ...base, to: one, isBattle: false, battleUnitIds: [], path: [one], pushDir: c(0, f) });
      const two = c(unit.pos.x, unit.pos.y + 2 * f);
      if (unit.pos.y === DATA.units.start[unit.side].pawnRank && !unit.tags?.includes('spy') && isBattlefield(two) && !unitAt(state, two)) {
        out.push({ ...base, to: two, isBattle: false, battleUnitIds: [], path: [one, two], pushDir: c(0, f), isDoubleStep: true });
      }
    }
    for (const dx of [-1, 1]) {
      const diag = c(unit.pos.x + dx, unit.pos.y + f);
      if (!isBattlefield(diag)) continue;
      const occ = occupancy(state, unit, diag);
      if (occ.enemies.length && !occ.friendly) {
        out.push({ ...base, to: diag, isBattle: true, battleUnitIds: occ.enemies, path: [diag], pushDir: c(dx, f) });
      } else if (!occ.enemies.length && !occ.friendly) {
        // En passant: an enemy pawn beside us that just made a 2-square Lead past `diag`.
        const passer = state.units.find(
          (u) => u.side !== unit.side && u.type === 'pawn' && u.enPassantTarget && eq(u.enPassantTarget, diag) &&
            u.pos.y === unit.pos.y && Math.abs(u.pos.x - unit.pos.x) === 1,
        );
        if (passer) {
          out.push({ ...base, to: diag, isBattle: true, battleUnitIds: [passer.id], path: [diag], pushDir: c(dx, f), isEnPassant: true });
        }
      }
    }
    return out;
  }
  // Several path types (Final Form): the union, first type wins when two reach the same square (003 FR-034).
  for (const type of pathTypes(unit)) {
    const def = kinglike(unit) ? KINGLIKE_DEF : DATA.units.types[type];
    const maxSteps = def.maxSteps ?? 1;
    const add1 = (o: LeadOption) => {
      if (!out.some((x) => eq(x.to, o.to))) out.push(o);
    };
    for (const d of directions(def.directions)) {
      if (def.jump) {
        const to = add(unit.pos, d);
        if (!isBattlefield(to)) continue;
        const occ = occupancy(state, unit, to);
        if (occ.friendly && !friendlyEnd(to)) continue;
        add1({
          ...base, to, isBattle: occ.enemies.length > 0, battleUnitIds: occ.enemies, path: [to], pushDir: knightPushDir(unit.pos, to),
        });
        continue;
      }
      const path: Coord[] = [];
      let p = unit.pos;
      for (let step = 0; step < maxSteps; step++) {
        p = add(p, d);
        if (!isBattlefield(p)) break;
        const occ = occupancy(state, unit, p);
        if (occ.friendly && !friendlyEnd(p)) break;
        path.push(p);
        add1({ ...base, to: p, isBattle: occ.enemies.length > 0, battleUnitIds: occ.enemies, path: [...path], pushDir: d });
        if (occ.friendly || occ.enemies.length) break;
      }
    }
  }
  return out;
}

/** The unit's path types: its type plus any extra types (pawn and castling rules only apply to the primary type). */
export function pathTypes(unit: Unit): Unit['type'][] {
  if (kinglike(unit)) return [unit.type];
  return [unit.type, ...(unit.extraTypes ?? []).filter((t) => t !== unit.type && t !== 'pawn')];
}

/** Squares a unit threatens (rulebook *Threaten*): includes the first friendly unit on a line (protection). */
export function attackSquares(state: UnitView, unit: Unit): Coord[] {
  if (unit.type === 'pawn' && !kinglike(unit)) {
    const f = pawnForward(unit);
    return [c(unit.pos.x - 1, unit.pos.y + f), c(unit.pos.x + 1, unit.pos.y + f)].filter(isBattlefield);
  }
  const out: Coord[] = [];
  const push = (p: Coord) => {
    if (!out.some((x) => eq(x, p))) out.push(p);
  };
  for (const type of pathTypes(unit)) {
    const def = kinglike(unit) ? KINGLIKE_DEF : DATA.units.types[type];
    const maxSteps = def.maxSteps ?? 1;
    for (const d of directions(def.directions)) {
      if (def.jump) {
        const to = add(unit.pos, d);
        if (isBattlefield(to)) push(to);
        continue;
      }
      let p = unit.pos;
      for (let step = 0; step < maxSteps; step++) {
        p = add(p, d);
        if (!isBattlefield(p)) break;
        push(p);
        if (unitAt(state, p)) break;
      }
    }
  }
  return out;
}
