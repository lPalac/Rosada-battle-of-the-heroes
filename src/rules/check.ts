// Threaten, Protected, Check, discovered check, castling and check-legal Leads (FR-003, FR-040).
// Heroes never threaten in v1 (research R-10).
import { c, eq } from './board.ts';
import { DATA } from './data.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import { otherSide, type Coord, type Side } from './model/types.ts';
import { attackSquares, basicLeads, unitAt, type LeadOption, type PathOptions } from './paths.ts';
import { hookSources } from './abilities/hooks.ts';

/** Units, plus effects and heroes when known (004: ability effects change which Leads exist). */
type UnitView = Pick<GameState, 'units'> & Partial<GameState>;

const key = (p: Coord): string => `${p.x},${p.y}`;

export function threatenedSquares(state: UnitView, bySide: Side): Set<string> {
  const out = new Set<string>();
  for (const u of state.units) if (u.side === bySide) for (const p of attackSquares(state, u)) out.add(key(p));
  return out;
}

/** Units of a side that threaten a square. */
export function attackersOf(state: UnitView, p: Coord, bySide: Side): Unit[] {
  return state.units.filter((u) => u.side === bySide && attackSquares(state, u).some((q) => eq(q, p)));
}

export function isThreatened(state: UnitView, p: Coord, bySide: Side): boolean {
  return threatenedSquares(state, bySide).has(key(p));
}

export function kingOf(state: UnitView, side: Side): Unit | undefined {
  return state.units.find((u) => u.side === side && u.type === 'king');
}

export function isInCheck(state: UnitView, side: Side): boolean {
  const king = kingOf(state, side);
  return !!king && isThreatened(state, king.pos, otherSide(side));
}

/** 006 FR-001: ids of the units that check `side`'s King now (empty when not in check or without a King). */
export function checkingUnits(state: UnitView, side: Side): string[] {
  const king = kingOf(state, side);
  return king ? attackersOf(state, king.pos, otherSide(side)).map((u) => u.id) : [];
}

/** A unit is Protected when a friendly unit threatens its square. */
export function isProtected(state: UnitView, unit: Unit): boolean {
  return isThreatened(state, unit.pos, unit.side);
}

/** Units after a Lead succeeds (heroes are not needed for check). */
export function unitsAfterLead(state: UnitView, opt: LeadOption): Unit[] {
  return state.units
    .filter((u) => !opt.battleUnitIds.includes(u.id))
    .map((u) => {
      if (u.id === opt.unitId) return { ...u, pos: opt.to };
      if (opt.rook && u.id === opt.rook.unitId) return { ...u, pos: opt.rook.to };
      return u;
    });
}

export function leadLeavesKingInCheck(state: UnitView, opt: LeadOption): boolean {
  const unit = state.units.find((u) => u.id === opt.unitId);
  if (!unit) return false;
  return isInCheck({ units: unitsAfterLead(state, opt) }, unit.side);
}

/** Check given by a unit other than the Led one, revealed by the Lead. */
export function isDiscoveredCheck(state: UnitView, opt: LeadOption): boolean {
  const unit = state.units.find((u) => u.id === opt.unitId);
  if (!unit) return false;
  const after = { units: unitsAfterLead(state, opt) };
  const enemyKing = kingOf(after, otherSide(unit.side));
  if (!enemyKing) return false;
  // Only a check that the Lead reveals: a unit that did not already give check before (003 Tactical Genius).
  const checking = (view: UnitView, u: Unit) => attackSquares(view, u).some((p) => eq(p, enemyKing.pos));
  const others = after.units.filter((u) => u.side === unit.side && u.id !== unit.id);
  return others.some((u) => checking(after, u) && !checking(state, u));
}

/** Castling (rulebook *Castling*): King 2 squares toward a Rook in the royal rank, Rook on the crossed square. */
export function castlingLeads(state: UnitView, king: Unit): LeadOption[] {
  if (king.type !== 'king' || king.hasBeenLed) return [];
  const rank = DATA.units.start[king.side].rank;
  if (king.pos.y !== rank || king.pos.x !== 5) return [];
  const enemy = otherSide(king.side);
  const threats = threatenedSquares(state, enemy);
  if (threats.has(key(king.pos))) return [];
  const out: LeadOption[] = [];
  for (const dir of [-1, 1]) {
    const rookX = dir === 1 ? 8 : 1;
    const rook = unitAt(state, c(rookX, rank));
    if (!rook || rook.type !== 'rook' || rook.side !== king.side || rook.hasBeenLed) continue;
    let clear = true;
    for (let x = king.pos.x + dir; x !== rookX; x += dir) if (unitAt(state, c(x, rank))) clear = false;
    if (!clear) continue;
    const crossed = c(king.pos.x + dir, rank);
    const to = c(king.pos.x + 2 * dir, rank);
    if (threats.has(key(crossed)) || threats.has(key(to))) continue;
    out.push({
      unitId: king.id, from: king.pos, to, isBattle: false, battleUnitIds: [], path: [crossed, to],
      pushDir: c(dir, 0), isCastling: true, isEnPassant: false, isDoubleStep: false,
      rook: { unitId: rook.id, to: crossed },
    });
  }
  return out;
}

/** Leads a unit could make by its own rules and the ability effects, before the check rule (006: for refusals). */
export function leadCandidates(state: UnitView, unit: Unit, pathOpts: PathOptions = {}): LeadOption[] {
  let opts = [...basicLeads(state, unit, pathOpts), ...castlingLeads(state, unit)];
  // 004 hooks: marks, protection, portals … (research R-06). Check and checkmate use the same filters (spec Q-43).
  if (state.effects?.length || state.heroes?.length) {
    for (const { hooks, src } of hookSources(state, 'filterLeads')) opts = hooks.filterLeads(state as GameState, src, unit, opts);
  }
  return opts;
}

/** The check rule for one Lead: it may not leave the own King in check, unless it Destroys the enemy King. */
function passesCheck(state: UnitView, o: LeadOption): boolean {
  const destroysKing = state.units.some((u) => o.battleUnitIds.includes(u.id) && u.type === 'king');
  if (destroysKing) return true; // Destroying the enemy King ends the game at once.
  return !leadLeavesKingInCheck(state, o);
}

/** Leads of one unit that are legal by unit rules (range ignored): never leaving the own King in check. */
export function legalLeadsForUnit(state: UnitView, unit: Unit, pathOpts: PathOptions = {}): LeadOption[] {
  return leadCandidates(state, unit, pathOpts).filter((o) => passesCheck(state, o));
}

/** 006 FR-014: Leads the unit could make by its own rules that are refused only because they leave its King in check. */
export function blockedLeads(state: UnitView, unitOrId: Unit | string): LeadOption[] {
  const unit = typeof unitOrId === 'string' ? state.units.find((u) => u.id === unitOrId) : unitOrId;
  if (!unit) return [];
  return leadCandidates(state, unit).filter((o) => !passesCheck(state, o));
}

/** 006: why a Lead of `unitId` to `to` is refused by the unit rules, or null. Range and phase are the caller's. */
export type LeadRefusal = 'wouldCheckOwnKing' | 'notALead';

export function leadRefusal(state: UnitView, unitId: string, to: Coord): LeadRefusal | null {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return 'notALead';
  const there = leadCandidates(state, unit).filter((o) => eq(o.to, to));
  if (!there.length) return 'notALead';
  return there.some((o) => passesCheck(state, o)) ? null : 'wouldCheckOwnKing';
}

export function allLegalLeads(state: UnitView, side: Side): LeadOption[] {
  return state.units.filter((u) => u.side === side).flatMap((u) => legalLeadsForUnit(state, u));
}

/** Standard chess checkmate over Battlefield units, range and abilities ignored (rulebook *Checkmate*). */
export function isCheckmate(state: UnitView, side: Side): boolean {
  return isInCheck(state, side) && allLegalLeads(state, side).length === 0;
}
