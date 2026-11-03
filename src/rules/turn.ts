// Phase machine, Active Hero hand-off, automatic steps (FR-010, FR-011, research R-08).
// Phases with nothing for the player to do are passed automatically, so the game rests only where a choice exists.
import { canHeroRetreat, canInspiredLead, abilitiesBlocked } from './abilities.ts';
import { isTavern } from './board.ts';
import { activeHero, emit, fail, hero, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { bothKingsInCheck, checkmateCheck, endGame } from './endgame.ts';
import { isForbiddenEndSquare, movementForTurn } from './heroes.ts';
import { awaitingRoll, leadOptionsForActiveHero, noEligibleUnits } from './lead.ts';
import type { GameState, TurnFlags } from './model/state.ts';
import type { HeroId, Phase } from './model/types.ts';
import { freeMeal, onHeroEntersSquare } from './taverns.ts';

export function freshTurnFlags(): TurnFlags {
  return {
    movementLeft: 0, movePath: [], tavernShopOpen: null, leftTaverns: [], leadAttempted: false,
    leadPossible: false, kingInCheckAfterLead: false, checkBonusClaimed: false, abilitiesUsed: [],
    inspiredLeadBonus: 0, lead: null, bothKingsInCheckAtBeginning: false, doubleStepUnitId: null,
  };
}

function setPhase(ctx: Ctx, phase: Phase): void {
  ctx.s.phase = phase;
  emit(ctx, { type: 'phaseChanged', heroId: ctx.s.activeHeroId, phase });
  onEnter(ctx, phase);
}

function playing(s: GameState): boolean {
  return s.status === 'playing' && s.enforcement === 'rules';
}

function onEnter(ctx: Ctx, phase: Phase): void {
  const { s } = ctx;
  const h = activeHero(s);
  switch (phase) {
    case 'beforeTurn':
      s.turn = freshTurnFlags();
      emit(ctx, { type: 'turnStarted', heroId: h.id, turnNumber: s.turnNumber });
      checkmateCheck(ctx);
      break;
    case 'beginningOfTurn': {
      if (h.status.recoverAtBeginningOfTurn) {
        // Heroic Recovery: half max health, no longer Unconscious (FR-051).
        h.health = Math.floor(h.maxHealth / 2);
        h.status.unconscious = false;
        h.status.recoverAtBeginningOfTurn = false;
        emit(ctx, { type: 'heroRecovered', heroId: h.id });
      }
      const penalty = h.status.movementPenaltyNextTurn + (isTavern(h.pos) ? RULES.tavern.startTurnMovementPenalty : 0);
      h.status.movementPenaltyNextTurn = 0;
      s.turn.movementLeft = movementForTurn(h, penalty);
      onHeroEntersSquare(ctx, h);
      s.turn.bothKingsInCheckAtBeginning = bothKingsInCheck(ctx);
      break;
    }
    case 'beforeLead':
      s.turn.tavernShopOpen = null; // Buying only before or during Move (FR-060).
      break;
    case 'lead':
      if (noEligibleUnits(s)) {
        endGame(ctx, { kind: 'draw', by: 'noEligibleUnits' });
        break;
      }
      s.turn.leadPossible = leadOptionsForActiveHero(s).length > 0;
      break;
    case 'endOfTurn':
      if (s.turn.bothKingsInCheckAtBeginning && bothKingsInCheck(ctx)) {
        endGame(ctx, { kind: 'draw', by: 'bothKingsInCheck' });
        break;
      }
      freeMeal(ctx, h, abilitiesBlocked(s));
      break;
    default:
      break;
  }
}

/** Pass the Active Hero token to the next hero in turn order (FR-011). */
function handOff(ctx: Ctx): void {
  const { s } = ctx;
  const keep = s.turn.doubleStepUnitId;
  for (const u of s.units) if (u.id !== keep) u.enPassantTarget = null;
  const next = (activeHero(s).turnOrder % 4) + 1;
  s.activeHeroId = `H${next}` as HeroId;
  s.turnNumber += 1;
  setPhase(ctx, 'beforeTurn');
}

/** Whether the current phase can be passed without a player choice. */
function isAutomatic(ctx: Ctx): boolean {
  const { s } = ctx;
  switch (s.phase) {
    case 'beforeTurn':
    case 'beginningOfTurn':
    case 'beforeMove':
    case 'afterLead':
      return true;
    case 'move':
      return false;
    case 'beforeLead':
      return !canInspiredLead(ctx);
    case 'lead':
      return !s.turn.leadPossible || (s.turn.leadAttempted && !awaitingRoll(s));
    case 'endOfTurn':
      return !canHeroRetreat(ctx);
  }
}

function step(ctx: Ctx): void {
  const { s } = ctx;
  const h = activeHero(s);
  switch (s.phase) {
    case 'beforeTurn':
      if (h.status.skipNextTurn) {
        h.status.skipNextTurn = false;
        h.status.recoverAtBeginningOfTurn = true;
        emit(ctx, { type: 'turnSkipped', heroId: h.id });
        handOff(ctx);
      } else setPhase(ctx, 'beginningOfTurn');
      return;
    case 'beginningOfTurn': return setPhase(ctx, 'beforeMove');
    case 'beforeMove': return setPhase(ctx, 'move');
    case 'move': return setPhase(ctx, 'beforeLead');
    case 'beforeLead': return setPhase(ctx, 'lead');
    case 'lead': return setPhase(ctx, 'afterLead');
    case 'afterLead': return setPhase(ctx, 'endOfTurn');
    case 'endOfTurn': return handOff(ctx);
  }
}

/** Run automatic phases until the game needs a player (or a decision, or it ended). */
export function autoAdvance(ctx: Ctx): void {
  for (let guard = 0; guard < 200; guard++) {
    const { s } = ctx;
    if (!playing(s) || s.pendingDecision || !isAutomatic(ctx)) return;
    step(ctx);
  }
  throw new Error('autoAdvance did not settle');
}

/** The player ends the current phase (FR-031: not while a possible Lead is unattempted). */
export function endPhase(ctx: Ctx): void {
  const { s } = ctx;
  const h = activeHero(s);
  if (s.phase === 'move' && isForbiddenEndSquare(s, h.side, h.pos)) {
    fail('MOVE_ENDS_ON_UNIT', 'A Move may not end on an enemy unit or a King', 'Move');
  }
  if (s.phase === 'lead') {
    if (awaitingRoll(s)) fail('ROLL_PENDING', 'Roll the die first', 'Lead');
    if (s.turn.leadPossible && !s.turn.leadAttempted) fail('MUST_ATTEMPT_LEAD', 'A possible Lead must be attempted', 'Lead');
  }
  step(ctx);
}

export function startFirstTurn(ctx: Ctx): void {
  setPhase(ctx, 'beforeTurn');
}

export function isHeroActive(s: GameState, id: HeroId): boolean {
  return hero(s, id).id === s.activeHeroId;
}
