// What the HUD shows, derived from the state only (US7-AS2, US7-AS3). Engine-free, so it is tested headless.
import {
  awaitingRoll, chebyshev, legalActions, legalLeadTargets, legalMoveSquares, leadPreview, PHASES, RULES,
  type Action, type Coord, type GameState, type HeroId, type Modifier, type Phase, type Side,
} from '../rules/index.ts';

export interface HeroCard {
  id: HeroId;
  side: Side;
  rangeType: string;
  playerId: string;
  health: number;
  maxHealth: number;
  movement: number;
  movementLeft: number | null;
  range: number;
  pool: number;
  active: boolean;
  unconscious: boolean;
  skipNextTurn: boolean;
}

export interface LeadPanel {
  unitId: string | null;
  needsRoll: boolean;
  modifiers: Modifier[];
  modifierTotal: number;
  target: number;
  roll: number | null;
  total: number | null;
  success: boolean | null;
  awaitingRoll: boolean;
}

export interface HudModel {
  turnNumber: number;
  phase: Phase;
  phases: { id: Phase; current: boolean }[];
  activeHeroId: HeroId;
  activeSide: Side;
  heroes: HeroCard[];
  well: { remaining: number; depleted: boolean };
  common: Record<Side, number>;
  peaceTreaty: 'peace' | 'war';
  revenge: Record<Side, number>;
  enforcement: 'rules' | 'sandbox';
  status: GameState['status'];
  lead: LeadPanel | null;
  can: {
    endPhase: boolean;
    offerDraw: boolean;
    useRevenge: boolean;
    buyDrink: boolean;
    buyMeal: boolean;
    inspiredLeadMax: number;
    heroRetreat: boolean;
    resumeRules: boolean;
  };
  shopOpen: boolean;
  decision: GameState['pendingDecision'];
}

function has(actions: Action[], pred: (a: Action) => boolean): boolean {
  return actions.some(pred);
}

export function hudModel(state: GameState, selectedUnitId: string | null = null): HudModel {
  const actions = state.status === 'setup' ? [] : legalActions(state);
  const active = state.heroes.find((h) => h.id === state.activeHeroId);
  const preview = leadPreview(state, selectedUnitId ?? undefined);
  const lead = state.turn.lead;
  const modifiers = lead?.modifiers ?? preview?.modifiers ?? [];
  const inspired = actions.filter((a) => a.type === 'inspiredLead') as { destiny: number }[];
  return {
    turnNumber: state.turnNumber,
    phase: state.phase,
    phases: PHASES.map((id) => ({ id, current: id === state.phase })),
    activeHeroId: state.activeHeroId,
    activeSide: active?.side ?? 'light',
    heroes: state.heroes.map((h) => ({
      id: h.id, side: h.side, rangeType: h.rangeType, playerId: h.playerId, health: h.health, maxHealth: h.maxHealth,
      movement: h.movement, movementLeft: h.id === state.activeHeroId ? state.turn.movementLeft : null, range: h.range,
      pool: h.pool, active: h.id === state.activeHeroId, unconscious: h.status.unconscious, skipNextTurn: h.status.skipNextTurn,
    })),
    well: { remaining: state.destiny.well.initialRemaining, depleted: state.destiny.well.depleted },
    common: { ...state.destiny.common },
    peaceTreaty: state.tokens.peaceTreaty,
    revenge: { ...state.tokens.revenge },
    enforcement: state.enforcement,
    status: state.status,
    lead: state.phase === 'lead' && (lead || selectedUnitId)
      ? {
          unitId: lead?.unitId ?? selectedUnitId,
          needsRoll: lead?.needsRoll ?? preview?.needsRoll ?? false,
          modifiers,
          modifierTotal: modifiers.reduce((a, m) => a + m.value, 0),
          target: RULES.leadTarget,
          roll: lead?.roll ?? null,
          total: lead?.total ?? null,
          success: lead?.success ?? null,
          awaitingRoll: awaitingRoll(state),
        }
      : null,
    can: {
      endPhase: has(actions, (a) => a.type === 'endPhase'),
      offerDraw: has(actions, (a) => a.type === 'offerDraw'),
      useRevenge: has(actions, (a) => a.type === 'useRevenge'),
      buyDrink: has(actions, (a) => a.type === 'buy' && a.item === 'drink'),
      buyMeal: has(actions, (a) => a.type === 'buy' && a.item === 'meal'),
      inspiredLeadMax: inspired.length ? Math.max(...inspired.map((a) => a.destiny)) : 0,
      heroRetreat: has(actions, (a) => a.type === 'heroRetreat'),
      resumeRules: has(actions, (a) => a.type === 'setEnforcement' && a.mode === 'rules'),
    },
    shopOpen: !!state.turn.tavernShopOpen && state.phase === 'move',
    decision: state.pendingDecision,
  };
}

export interface Highlights {
  selectable: string[];
  moves: Coord[];
  leads: { to: Coord; isBattle: boolean }[];
  decision: Coord[];
}

/** Squares and units the table highlights now (US7-AS1, FR-111). */
export function highlights(state: GameState, selectedUnitId: string | null): Highlights {
  const out: Highlights = { selectable: [], moves: [], leads: [], decision: [] };
  if (state.status !== 'playing' || state.enforcement !== 'rules') return out;
  const d = state.pendingDecision;
  if (d && (d.type === 'advanceSquare' || d.type === 'unconsciousTavern')) {
    out.decision = d.options;
    return out;
  }
  if (d) return out;
  if (state.phase === 'move') out.moves = legalMoveSquares(state);
  if (state.phase === 'lead' && !state.turn.leadAttempted) {
    const h = state.heroes.find((x) => x.id === state.activeHeroId)!;
    out.selectable = state.units
      .filter((u) => u.side === h.side && chebyshev(u.pos, h.pos) <= h.range && legalLeadTargets(state, u.id).length > 0)
      .map((u) => u.id);
    if (selectedUnitId) out.leads = legalLeadTargets(state, selectedUnitId).map((t) => ({ to: t.to, isBattle: t.isBattle }));
  }
  return out;
}
