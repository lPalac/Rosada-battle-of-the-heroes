import type { Coord, Side, UnitType } from './types.ts';

export interface Unit {
  /** Stable, e.g. `L-N-b` (Light Knight from the b-file). */
  id: string;
  side: Side;
  /** Current type. */
  type: UnitType;
  /** For future Modify; equals `type` in v1 except after Promotion. */
  originalType: UnitType;
  /** Always `main` in v1. */
  kind: 'main' | 'auxiliary';
  pos: Coord;
  /** Castling rights; set true by sandbox moves (FR-104). */
  hasBeenLed: boolean;
  promoted: boolean;
  /** Set for one turn after a 2-square pawn Lead from its starting square: the square it passed. */
  enPassantTarget: Coord | null;
}
