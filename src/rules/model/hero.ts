import type { Coord, HeroId, RangeType, Side } from './types.ts';

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
  /** Recorded for the later Hero Unit rule (v1: no effect). */
  rammedBy: string | null;
  art: string;
}
