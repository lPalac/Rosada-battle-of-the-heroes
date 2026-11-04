import type { Coord, HeroId, Side, UnitKind, UnitType } from './types.ts';

export interface Unit {
  /** Stable, e.g. `L-N-b` (Light Knight from the b-file). */
  id: string;
  side: Side;
  /** Current type. */
  type: UnitType;
  /** For future Modify; equals `type` in v1 except after Promotion. */
  originalType: UnitType;
  /** `main` from setup, `auxiliary` when created in play, `hero` for a Hero Unit (id `HU-<heroId>`). */
  kind: UnitKind;
  /** More path types at once (Final Form: Rook + own type). Paths and threats are the union. */
  extraTypes?: UnitType[];
  /** Only for `kind: 'hero'`. */
  heroId?: HeroId;
  pos: Coord;
  /** Castling rights; set true by sandbox moves (FR-104). */
  hasBeenLed: boolean;
  promoted: boolean;
  /** Set for one turn after a 2-square pawn Lead from its starting square: the square it passed. */
  enPassantTarget: Coord | null;
}
