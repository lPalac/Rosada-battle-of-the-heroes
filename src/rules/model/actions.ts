import type { Coord, HeroId, Phase, RangeType, Side, UnitType } from './types.ts';
import type { GameResult } from './state.ts';

/** How a cost is split between the hero's own pool and the side's Common Pool (FR-072). */
export interface Payment {
  hero: number;
  common: number;
}

export type Action =
  // setup
  | { type: 'pickHero'; side: Side; rangeType: RangeType }
  | { type: 'setTurnOrder'; side: Side; first: number }
  | { type: 'setStartFile'; pickIndex: number; file: 'c' | 'f' }
  | { type: 'startGame' }
  // phase control
  | { type: 'endPhase' }
  // move
  | { type: 'moveStep'; to: Coord }
  | { type: 'buy'; item: 'drink' | 'meal'; pay?: Payment }
  // general abilities
  | { type: 'inspiredLead'; destiny: number; pay?: Payment }
  | { type: 'heroRetreat'; tavern: Coord; pay?: Payment }
  // lead
  | { type: 'announceLead'; unitId: string; to: Coord; promoteTo?: UnitType }
  | { type: 'useRevenge' }
  | { type: 'submitRoll'; value: number }
  // decisions
  | { type: 'decide'; decision: DecisionAnswer }
  // game
  | { type: 'offerDraw' }
  | { type: 'answerDraw'; accept: boolean }
  | { type: 'setEnforcement'; mode: 'rules' | 'sandbox' }
  // sandbox only
  | { type: 'sandboxPlace'; target: { unitId?: string; heroId?: string }; to: Coord | 'graveyard' }
  | {
      type: 'sandboxSet';
      path: 'health' | 'pool' | 'common' | 'revenge' | 'peaceTreaty';
      target?: string;
      value: number | string;
    };

export type PendingDecision =
  | { type: 'promotion'; unitId: string; chooserHeroId: HeroId }
  | { type: 'unconsciousTavern'; heroId: HeroId; options: Coord[] }
  | { type: 'advanceSquare'; heroId: HeroId; options: Coord[] }
  | { type: 'drawOffer'; fromSide: Side };

export type DecisionAnswer =
  | { type: 'promotion'; to: UnitType }
  | { type: 'square'; to: Coord };

export type GameEvent =
  | { type: 'phaseChanged'; heroId: HeroId; phase: Phase }
  | { type: 'turnStarted'; heroId: HeroId; turnNumber: number }
  | { type: 'turnSkipped'; heroId: HeroId }
  | { type: 'heroMoved'; heroId: HeroId; from: Coord; to: Coord; reason: string }
  | { type: 'rollRequested'; unitId: string }
  | { type: 'rolled'; value: number; total: number | null; success: boolean | null }
  | { type: 'leadAnnounced'; unitId: string; from: Coord; to: Coord; needsRoll: boolean }
  | { type: 'leadFailed'; unitId: string }
  | { type: 'unitLed'; unitId: string; from: Coord; to: Coord; path: Coord[] }
  | { type: 'unitDestroyed'; unitId: string; by: 'battle' }
  | { type: 'heroRammed'; heroId: HeroId; byUnitId: string; landing: Coord; sentToStart: boolean }
  | { type: 'heroPushed'; heroId: HeroId; byUnitId: string; landing: Coord; sentToStart: boolean }
  | { type: 'heroWounded'; heroId: HeroId; amount: number; health: number }
  | { type: 'heroHealed'; heroId: HeroId; amount: number; health: number; reason: string }
  | { type: 'heroUnconscious'; heroId: HeroId }
  | { type: 'heroRecovered'; heroId: HeroId }
  | {
      type: 'destinyChanged';
      pool: 'common' | 'hero';
      side: Side;
      heroId?: HeroId;
      delta: number;
      reason: string;
    }
  | { type: 'wellDepleted' }
  | { type: 'tokenChanged'; token: 'peaceTreaty' | 'revenge'; side?: Side; value: string | number }
  | { type: 'promoted'; unitId: string; to: UnitType }
  | { type: 'check'; side: Side }
  | { type: 'abilityUsed'; heroId: HeroId; ability: 'inspiredLead' | 'heroRetreat'; destiny: number }
  | { type: 'bought'; heroId: HeroId; item: 'drink' | 'meal' }
  | { type: 'drawOffered'; fromSide: Side }
  | { type: 'drawDeclined'; bySide: Side }
  | { type: 'gameEnded'; result: GameResult }
  | { type: 'enforcementChanged'; mode: 'rules' | 'sandbox' }
  | { type: 'sandboxEdited'; what: string; target?: string; value: unknown }
  | { type: 'setupChanged' };

/** Events that reveal new information: undo stops at them (FR-012, research R-11). */
export const REVEAL_EVENTS: readonly GameEvent['type'][] = [
  'rolled', 'unitDestroyed', 'heroRammed', 'heroWounded',
];

export interface PositionProblem {
  code: string;
  message: string;
  where?: Coord;
}

export interface RuleError {
  code: string;
  message: string;
  /** Rulebook section that blocked the action (for FR-202). */
  rule: string;
  problems?: PositionProblem[];
}
