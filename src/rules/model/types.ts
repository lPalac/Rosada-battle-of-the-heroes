export type Side = 'light' | 'dark';
export type Coord = { x: number; y: number }; // 0..9 each
export type UnitType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type RangeType = 'short' | 'long';
export type Stage = 'starting' | 'epic';
export type EpicDestiny = 'fanatic' | 'resolute' | 'dominant';
export const EPIC_DESTINIES: readonly EpicDestiny[] = ['fanatic', 'resolute', 'dominant'];
export type UnitKind = 'main' | 'auxiliary' | 'hero';
export type FavorId =
  | 'bloodyTheCastleGates' | 'overwhelm' | 'greatIncursion' | 'tacticalGenius' | 'deployTroops' | 'royalsFury'
  | 'decimate' | 'offenseIsTheBestDefense' | 'vanquishYourFoes' | 'destinedForGreatness' | 'tidesOfDestiny'
  | 'manifestEpicDestiny';
export type PowerId = 'heroUnit' | 'kingsForces' | 'advancedWarfare' | 'farReach' | 'swiftChange' | 'finalForm';
export type HeroId = 'H1' | 'H2' | 'H3' | 'H4';
export type Phase =
  | 'beforeTurn' | 'beginningOfTurn' | 'beforeMove' | 'move'
  | 'beforeLead' | 'lead' | 'afterLead' | 'endOfTurn';

export const PHASES: readonly Phase[] = [
  'beforeTurn', 'beginningOfTurn', 'beforeMove', 'move',
  'beforeLead', 'lead', 'afterLead', 'endOfTurn',
];

export const RANGE_TYPES: readonly RangeType[] = ['short', 'long'];

export const otherSide = (side: Side): Side => (side === 'light' ? 'dark' : 'light');
