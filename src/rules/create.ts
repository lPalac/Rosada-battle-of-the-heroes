// Create (rulebook *Create*) and King's Forces (Legendary Power 7): auxiliary units placed during play
// (FR-033, FR-035, research R-07).
import { eq } from './board.ts';
import { kingOf } from './check.ts';
import { activeHero, emit, fail, type Ctx } from './ctx.ts';
import type { GameState } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import { otherSide, type Coord, type Side, type UnitKind, type UnitType } from './model/types.ts';
import { attackSquares, unitAt } from './paths.ts';
import { placementProblem, powerWindowOpen } from './hero-unit.ts';

const LETTER: Record<UnitType, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };

function newId(state: GameState, side: Side, type: UnitType): string {
  const prefix = `A-${side === 'light' ? 'L' : 'D'}-${LETTER[type]}-`;
  const used = new Set([...state.units, ...state.graveyard].map((u) => u.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Create a unit: only on an unoccupied square, never where it would give check (FR-035). */
export function createUnit(ctx: Ctx, opts: { side: Side; type: UnitType; at: Coord; kind?: UnitKind }): Unit {
  const { s } = ctx;
  if (unitAt(s, opts.at)) fail('CREATE_OCCUPIED', 'A unit can only be created on an unoccupied square', 'Create');
  const unit: Unit = {
    id: newId(s, opts.side, opts.type), side: opts.side, type: opts.type, originalType: opts.type, kind: opts.kind ?? 'auxiliary',
    pos: { ...opts.at }, hasBeenLed: false, promoted: false, enPassantTarget: null,
  };
  const enemyKing = kingOf(s, otherSide(opts.side));
  if (enemyKing && attackSquares({ units: [...s.units, unit] }, unit).some((p) => eq(p, enemyKing.pos))) {
    fail('CREATE_WOULD_CHECK', 'A unit may never be created where it would give check', 'Create');
  }
  s.units.push(unit);
  emit(ctx, { type: 'unitCreated', unitId: unit.id, side: unit.side, unitType: unit.type, kind: unit.kind, at: unit.pos });
  return unit;
}

/** King's Forces can be spent now: a token, Beginning of Turn, once per turn, and the Hero Unit placement rules hold. */
export function canKingsForces(state: GameState): boolean {
  const h = activeHero(state);
  if (state.phase !== 'beginningOfTurn' || state.turn.kingsForcesUsed || state.royalFavors[h.side].kingsForces < 1) return false;
  if (!powerWindowOpen({ ...state, turn: { ...state.turn, heroUnitChanges: [] } }, h)) return false;
  return !kingsForcesProblem(state);
}

function kingsForcesProblem(state: GameState): string | null {
  const h = activeHero(state);
  const probe: Unit = {
    id: 'probe', side: h.side, type: h.heroUnitType, originalType: h.heroUnitType, kind: 'auxiliary', pos: h.pos,
    hasBeenLed: false, promoted: false, enPassantTarget: null,
  };
  const p = placementProblem(state, h.side, probe);
  return p === 'HERO_UNIT_WOULD_CHECK' ? 'CREATE_WOULD_CHECK' : p;
}

export function kingsForces(ctx: Ctx): void {
  const { s } = ctx;
  const h = activeHero(s);
  if (s.royalFavors[h.side].kingsForces < 1) fail('NO_KINGS_FORCES', "No King's Forces token", "King's Forces");
  if (s.phase !== 'beginningOfTurn') fail('WRONG_PHASE', "King's Forces is used at Beginning of Turn", "King's Forces");
  if (s.turn.kingsForcesUsed) fail('NO_KINGS_FORCES', "King's Forces was already used this turn", "King's Forces");
  const problem = kingsForcesProblem(s);
  if (problem) {
    const code = problem === 'HERO_UNIT_OCCUPIED' ? 'CREATE_OCCUPIED' : problem;
    fail(code, code === 'CREATE_OCCUPIED' ? 'A unit can only be created on an unoccupied square' : 'Not allowed on this square', "King's Forces");
  }
  createUnit(ctx, { side: h.side, type: h.heroUnitType, at: h.pos });
  s.royalFavors[h.side].kingsForces -= 1;
  s.turn.kingsForcesUsed = true;
}
