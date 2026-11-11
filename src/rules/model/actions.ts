import type { Coord, EpicDestiny, FavorId, HeroId, Phase, PowerId, RangeType, Side, UnitKind, UnitType } from './types.ts';
import type { GameResult } from './state.ts';

/** How a cost is split between the hero's own pool and the side's Common Pool (FR-072). */
export interface Payment {
  hero: number;
  common: number;
}

export type Action =
  // setup
  | { type: 'pickHero'; side: Side; rangeType?: RangeType; heroDefinitionId?: string }
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
  // 004 hero abilities
  | { type: 'useAbility'; abilityId: string; targets?: AbilityTarget[]; option?: string; pay?: Payment }
  // Legendary Powers (Beginning of Turn; End of Turn with Swift Change)
  | { type: 'becomeHeroUnit'; types: UnitType[] }
  | { type: 'leaveHeroUnit' }
  | { type: 'kingsForces' }
  // lead
  | { type: 'announceLead'; unitId: string; to: Coord; promoteTo?: UnitType }
  | { type: 'useRevenge' }
  | { type: 'submitRoll'; value: number }
  // decisions
  | { type: 'decide'; decision: DecisionAnswer }
  // game
  | { type: 'offerDraw' }
  | { type: 'answerDraw'; accept: boolean }
  /** 006: `restart` always begins at Before Turn (position editor, test fixtures). */
  | { type: 'setEnforcement'; mode: 'rules' | 'sandbox'; restart?: boolean }
  // sandbox only
  | { type: 'sandboxPlace'; target: { unitId?: string; heroId?: string }; to: Coord | 'graveyard' }
  | {
      type: 'sandboxSet';
      path: SandboxPath;
      target?: string;
      value: number | string;
    };

export type SandboxPath =
  | 'health' | 'pool' | 'common' | 'revenge' | 'peaceTreaty'
  | 'stage' | 'destiny' | 'favor' | 'kingsForces' | 'heroUnit' | 'well'
  | 'form' | 'uses' | 'removeEffect';

/** 004: what an ability points at. */
export type AbilityTarget = { square: Coord } | { unitId: string } | { heroId: HeroId } | { unitType: UnitType };

export type PendingDecision =
  | { type: 'promotion'; unitId: string; chooserHeroId: HeroId }
  | { type: 'unconsciousTavern'; heroId: HeroId; options: Coord[] }
  | { type: 'advanceSquare'; heroId: HeroId; options: Coord[] }
  | { type: 'drawOffer'; fromSide: Side }
  /** `appliesTo`: the heroes that take the chosen destiny (006: the chooser; in Mirror also its twin). */
  | { type: 'epicDestiny'; heroId: HeroId; options: EpicDestiny[]; appliesTo: HeroId[] }
  /** 004: a "During Enemy Lead" ability may be used now by its owner (research R-03). */
  | { type: 'reaction'; heroId: HeroId; abilityId: string; key: string; at: 'battle'; cost: number; options: AbilityTarget[][] }
  /** 004: a choice inside an ability (Converge Timelines: which copy stays; No Time to Lose; Evasive). */
  | { type: 'abilityChoice'; heroId: HeroId; abilityId: string; choices: string[] };

export type DecisionAnswer =
  | { type: 'promotion'; to: UnitType }
  | { type: 'square'; to: Coord }
  | { type: 'destiny'; destiny: EpicDestiny }
  | { type: 'reaction'; use: boolean; targets?: AbilityTarget[]; pay?: Payment }
  | { type: 'abilityChoice'; choice: string };

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
  | { type: 'unitDestroyed'; unitId: string; by: 'battle' | 'ability'; leftPlay?: boolean }
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
  /** side: whose King is checked; units (006): the units that newly check it. */
  | { type: 'check'; side: Side; units: string[] }
  | { type: 'abilityUsed'; heroId: HeroId; ability: string; destiny: number; targets?: AbilityTarget[]; option?: string }
  | { type: 'effectAdded'; effect: import('./state.ts').Effect }
  | { type: 'effectRemoved'; id: number; kind: string; reason: string }
  | { type: 'unitModified'; unitId: string; from: UnitType; to: UnitType }
  | { type: 'unitPushed'; unitId: string; from: Coord; to: Coord }
  | { type: 'bought'; heroId: HeroId; item: 'drink' | 'meal' }
  | { type: 'drawOffered'; fromSide: Side }
  | { type: 'drawDeclined'; bySide: Side }
  | { type: 'gameEnded'; result: GameResult }
  | { type: 'enforcementChanged'; mode: 'rules' | 'sandbox' }
  | { type: 'sandboxEdited'; what: string; target?: string; value: unknown }
  | { type: 'setupChanged' }
  | { type: 'epicStageStarted' }
  | { type: 'destinyChosen'; heroId: HeroId; destiny: EpicDestiny }
  | { type: 'favorProgress'; side: Side; id: FavorId; progress: number; target: number }
  | { type: 'favorCompleted'; side: Side; id: FavorId; slot: number }
  | { type: 'powerUnlocked'; side: Side; power: PowerId }
  | { type: 'heroUnitChanged'; heroId: HeroId; on: boolean; types: UnitType[] }
  | { type: 'unitCreated'; unitId: string; side: Side; unitType: UnitType; kind: UnitKind; at: Coord };

/** Events that reveal new information: undo stops at them (FR-012, research R-11). */
export const REVEAL_EVENTS: readonly GameEvent['type'][] = [
  'rolled', 'unitDestroyed', 'heroRammed', 'heroWounded',
];

/** 006 FR-009: something the players should know before rules come back on; never blocks. */
export interface PositionWarning {
  code: 'CHECKMATE';
  side: Side;
}

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
