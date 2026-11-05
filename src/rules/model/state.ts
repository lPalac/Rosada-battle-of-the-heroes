import type { Hero } from './hero.ts';
import type { PendingDecision } from './actions.ts';
import type { Unit } from './unit.ts';
import type { Coord, FavorId, HeroId, Phase, RangeType, Side, Stage, UnitType } from './types.ts';

export interface Player {
  id: string;
  name: string;
  side: Side;
}

export interface Pick {
  side: Side;
  rangeType: RangeType;
  /** 004: the named hero picked (`cavalier` …); absent for range-type picks (generic heroes). */
  heroDefinitionId?: string;
  /** Index into `picks`: identifies the hero slot until hero ids exist. */
  pickIndex: number;
}

export interface SetupChoices {
  mode: 'draft' | 'mirror';
  playerCount: 2 | 3 | 4;
  players: Player[];
  /** In pick order (Draft: L, D, D, L; Mirror: Light's pick fills hero 1 of both sides, Dark's pick hero 2). */
  picks: Pick[];
  /** Chosen by each side, Light first: [plays turn 1|2, plays turn 3|4] as pickIndex. */
  turnOrder: { light: number[] | null; dark: number[] | null };
  /** Which Bishop file each hero starts behind, keyed by pickIndex. */
  startFiles: Record<string, 'c' | 'f'>;
}

export interface Modifier {
  /** `war`, `check`, `inspiredLead`, `heroUnit`, or an ability id (004 research R-05). */
  source: string;
  value: number;
}

/** 004 research R-04: marks, square tokens, Modify, auras and other ability effects. */
export interface Effect {
  id: number;
  kind: string;
  source: { abilityId: string; heroId: HeroId };
  target: EffectTarget;
  expires: Expiry;
  data: Record<string, unknown>;
}

export type EffectTarget =
  | { unitId: string }
  | { heroId: HeroId }
  | { square: Coord }
  | { area: Coord[] }
  | { side: Side }
  | { unitType: UnitType; side: Side }
  | { none: true };

/**
 * `turnStart` + heroId: gone when that hero's next turn begins. `turnEnd` + turn: gone at the end of that turn number.
 * `turnEnd` + heroId + count: gone at the end of that hero's `count`-th turn from now. `epicStage`: gone when it starts.
 * `removed`: only by its own condition.
 */
export interface Expiry {
  at: 'turnStart' | 'turnEnd' | 'epicStage' | 'removed';
  heroId?: HeroId;
  turn?: number;
  count?: number;
}

export interface AbilityHeroState {
  /** Uses left for limited abilities. */
  uses: Record<string, number>;
  usedThisTurn: string[];
}

export interface RamOutcome {
  heroId: HeroId;
  landing: Coord;
  sentToStart: boolean;
  wounds: number;
  friendly: boolean;
}

export interface LeadAttempt {
  unitId: string;
  from: Coord;
  to: Coord;
  /** Interacted squares (Knight: from + to only; castling: the King's squares). */
  path: Coord[];
  isBattle: boolean;
  isCastling: boolean;
  isEnPassant: boolean;
  needsRoll: boolean;
  usedRevenge: boolean;
  roll: number | null;
  modifiers: Modifier[];
  total: number | null;
  success: boolean | null;
  rams: RamOutcome[];
  promoteTo: UnitType | null;
  /** 004: the option as announced (ability Leads change paths). */
  option?: import('../paths.ts').LeadOption;
  /** 004: the ability that made this Lead (Instead of Lead), if any. */
  ability?: string;
  /** 004: no Ram on this Lead (Pilgrimage). */
  noRam?: boolean;
  /** 004: reaction answers collected before the Battle (Paragon of Honor, Devious Gambit, Counterintelligence). */
  reactions?: { abilityId: string; heroId: HeroId; key: string; use: boolean; targets?: unknown[] }[];
  /** Units destroyed by this Lead (for After Lead abilities). */
  destroyed?: { unitId: string; type: UnitType; side: Side; pos: Coord }[];
}

export interface TurnFlags {
  movementLeft: number;
  movePath: Coord[];
  /** Tavern square where buying is allowed now, or null (FR-060). */
  tavernShopOpen: Coord | null;
  /** Taverns the hero has left this turn; no more buying there. */
  leftTaverns: Coord[];
  leadAttempted: boolean;
  leadPossible: boolean;
  kingInCheckAfterLead: boolean;
  checkBonusClaimed: boolean;
  abilitiesUsed: ('inspiredLead' | 'heroRetreat')[];
  /** +2 per D spent; used by this turn's Lead only, lost if no Lead is made. */
  inspiredLeadBonus: number;
  lead: LeadAttempt | null;
  bothKingsInCheckAtBeginning: boolean;
  /** Pawn that made a 2-square Lead this turn (keeps its en passant target one more turn). */
  doubleStepUnitId: string | null;
  /** Phases in which the active hero already became or left a Hero Unit this turn (once per phase). */
  heroUnitChanges: Phase[];
  kingsForcesUsed: boolean;
}

export interface LedgerEntry {
  turn: number;
  side: Side;
  heroId?: HeroId;
  delta: number;
  pool: 'common' | 'hero';
  reason: string;
}

export interface DestinyLedger {
  well: { initialRemaining: number; depleted: boolean; depletedBy: HeroId | null };
  common: { light: number; dark: number };
  entries: LedgerEntry[];
}

export interface Tokens {
  /** `removed` from the Epic Stage on: no War bonus. */
  peaceTreaty: 'peace' | 'war' | 'removed';
  revenge: { light: number; dark: number };
}

export type GameResult = (
  | { kind: 'win'; winner: Side; by: 'checkmate' | 'kingDestroyed' }
  | { kind: 'draw'; by: 'bothKingsInCheck' | 'noEligibleUnits' | 'agreed' }
) & { summary: { turnsPlayed: number; destroyed: { light: number; dark: number } } };

export interface LogEntry {
  turn: number;
  heroId: HeroId | null;
  phase: Phase | null;
  type: string;
  data: Record<string, unknown>;
}

export interface FavorStatus {
  progress: number;
  done: boolean;
}

export interface RoyalFavorRecord {
  status: Record<FavorId, FavorStatus>;
  /** Different enemy heroes brought to Bloodied (Vanquish your Foes). */
  vanquishBloodied: HeroId[];
  /** Tides of Destiny completions, 0…5. */
  tides: number;
  tidesThisTurn: boolean;
  /** Completion order: one entry per filled slot. Never shrinks. */
  track: FavorId[];
  /** Unspent King's Forces tokens. */
  kingsForces: number;
}

export interface GameState {
  version: number;
  setup: SetupChoices;
  status: 'setup' | 'playing' | 'ended';
  enforcement: 'rules' | 'sandbox';
  turnNumber: number;
  activeHeroId: HeroId;
  phase: Phase;
  turn: TurnFlags;
  units: Unit[];
  graveyard: Unit[];
  heroes: Hero[];
  destiny: DestinyLedger;
  tokens: Tokens;
  stage: Stage;
  /** The initial 16 ran out; the Epic Stage starts at the next Before Turn. */
  epicPending: boolean;
  royalFavors: Record<Side, RoyalFavorRecord>;
  pendingDecision: PendingDecision | null;
  /** Further decisions waiting behind `pendingDecision`, answered in order. */
  decisionQueue: PendingDecision[];
  result: GameResult | null;
  /** Unit ids moved by hand in sandbox; count as Led when rules resume (FR-104). */
  sandboxMoved: string[];
  log: LogEntry[];
  /** 004: ability effects, ability uses, stable effect ids. */
  effects: Effect[];
  abilityState: Partial<Record<HeroId, AbilityHeroState>>;
  nextEffectId: number;
}
