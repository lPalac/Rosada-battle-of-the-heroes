import type { Coord, EpicDestiny, HeroId, RangeType, Side, UnitType } from './types.ts';

export interface HeroStatus {
  unconscious: boolean;
  skipNextTurn: boolean;
  recoverAtBeginningOfTurn: boolean;
  /** King's Banishment −1 etc.; applied at the hero's next Beginning of Turn. */
  movementPenaltyNextTurn: number;
}

export interface Hero {
  /** Equals turn order. */
  id: HeroId;
  side: Side;
  /** 1…4. Light 1 & 3, Dark 2 & 4. */
  turnOrder: number;
  playerId: string;
  /** Key into heroes.json (`generic-short`, `generic-long`). */
  definitionId: string;
  rangeType: RangeType;
  movement: number;
  range: number;
  maxHealth: number;
  /** 0…max. */
  health: number;
  healthBarId: string;
  pos: Coord;
  startSquare: Coord;
  /** Hero Destiny Pool, starts at 3. */
  pool: number;
  status: HeroStatus;
  /** The unit that last Rammed this hero and on which turn (Hero Unit rule, FR-032). */
  rammedBy: { unitId: string; turn: number } | null;
  /** Chosen when the Epic Stage starts. */
  epic: { destiny: EpicDestiny } | null;
  /** The unit this hero is while a Hero Unit. */
  heroUnitId: string | null;
  /** From heroes.json: Short range → knight, Long range → bishop. */
  heroUnitType: UnitType;
  art: string;
}
