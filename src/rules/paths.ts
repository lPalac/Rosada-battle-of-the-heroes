// Unit paths from units.json, plus pawn moves and en passant (FR-003). Castling lives in check.ts
// because it needs threat maps.
import { add, c, eq, isBattlefield, sign } from './board.ts';
import { DATA } from './data.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import type { Coord, Side } from './model/types.ts';

export interface LeadOption {
  unitId: string;
  from: Coord;
  to: Coord;
  isBattle: boolean;
  /** Unit destroyed by this Lead (differs from the `to` occupant only for en passant). */
  battleUnitId: string | null;
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

export function unitAt(state: UnitView, p: Coord): Unit | undefined {
  return state.units.find((u) => eq(u.pos, p));
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
export function basicLeads(state: UnitView, unit: Unit): LeadOption[] {
  const out: LeadOption[] = [];
  const base = { unitId: unit.id, from: unit.pos, isCastling: false, isEnPassant: false, isDoubleStep: false };
  if (unit.type === 'pawn') {
    const f = forward(unit.side);
    const one = c(unit.pos.x, unit.pos.y + f);
    if (isBattlefield(one) && !unitAt(state, one)) {
      out.push({ ...base, to: one, isBattle: false, battleUnitId: null, path: [one], pushDir: c(0, f) });
      const two = c(unit.pos.x, unit.pos.y + 2 * f);
      if (unit.pos.y === DATA.units.start[unit.side].pawnRank && isBattlefield(two) && !unitAt(state, two)) {
        out.push({ ...base, to: two, isBattle: false, battleUnitId: null, path: [one, two], pushDir: c(0, f), isDoubleStep: true });
      }
    }
    for (const dx of [-1, 1]) {
      const diag = c(unit.pos.x + dx, unit.pos.y + f);
      if (!isBattlefield(diag)) continue;
      const target = unitAt(state, diag);
      if (target && target.side !== unit.side) {
        out.push({ ...base, to: diag, isBattle: true, battleUnitId: target.id, path: [diag], pushDir: c(dx, f) });
      } else if (!target) {
        // En passant: an enemy pawn beside us that just made a 2-square Lead past `diag`.
        const passer = state.units.find(
          (u) => u.side !== unit.side && u.type === 'pawn' && u.enPassantTarget && eq(u.enPassantTarget, diag) &&
            u.pos.y === unit.pos.y && Math.abs(u.pos.x - unit.pos.x) === 1,
        );
        if (passer) {
          out.push({ ...base, to: diag, isBattle: true, battleUnitId: passer.id, path: [diag], pushDir: c(dx, f), isEnPassant: true });
        }
      }
    }
    return out;
  }
  const def = DATA.units.types[unit.type];
  const maxSteps = def.maxSteps ?? 1;
  for (const d of directions(def.directions)) {
    if (def.jump) {
      const to = add(unit.pos, d);
      if (!isBattlefield(to)) continue;
      const target = unitAt(state, to);
      if (target && target.side === unit.side) continue;
      out.push({
        ...base, to, isBattle: !!target, battleUnitId: target?.id ?? null, path: [to], pushDir: knightPushDir(unit.pos, to),
      });
      continue;
    }
    const path: Coord[] = [];
    let p = unit.pos;
    for (let step = 0; step < maxSteps; step++) {
      p = add(p, d);
      if (!isBattlefield(p)) break;
      const target = unitAt(state, p);
      if (target && target.side === unit.side) break;
      path.push(p);
      out.push({ ...base, to: p, isBattle: !!target, battleUnitId: target?.id ?? null, path: [...path], pushDir: d });
      if (target) break;
    }
  }
  return out;
}

/** Squares a unit threatens (rulebook *Threaten*): includes the first friendly unit on a line (protection). */
export function attackSquares(state: UnitView, unit: Unit): Coord[] {
  if (unit.type === 'pawn') {
    const f = forward(unit.side);
    return [c(unit.pos.x - 1, unit.pos.y + f), c(unit.pos.x + 1, unit.pos.y + f)].filter(isBattlefield);
  }
  const def = DATA.units.types[unit.type];
  const maxSteps = def.maxSteps ?? 1;
  const out: Coord[] = [];
  for (const d of directions(def.directions)) {
    if (def.jump) {
      const to = add(unit.pos, d);
      if (isBattlefield(to)) out.push(to);
      continue;
    }
    let p = unit.pos;
    for (let step = 0; step < maxSteps; step++) {
      p = add(p, d);
      if (!isBattlefield(p)) break;
      out.push(p);
      if (unitAt(state, p)) break;
    }
  }
  return out;
}
