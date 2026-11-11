// Phase machine, Active Hero hand-off, automatic steps (FR-010, FR-011, research R-08).
// Phases with nothing for the player to do are passed automatically, so the game rests only where a choice exists.
import { canHeroRetreat, canInspiredLead, abilitiesBlocked } from './abilities.ts';
import { activeHero, emit, fail, hero, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { bothKingsInCheck, checkmateCheck, endGame } from './endgame.ts';
import { isForbiddenEndSquare, movementForTurn } from './heroes.ts';
import { awaitingRoll, leadOptionsForActiveHero, noEligibleUnits } from './lead.ts';
import type { GameState, TurnFlags } from './model/state.ts';
import type { HeroId, Phase } from './model/types.ts';
import { freeMeal, isTavernFor, onHeroEntersSquare } from './taverns.ts';
import { canKingsForces } from './create.ts';
import { gain } from './destiny.ts';
import { maybeStartEpic } from './epic.ts';
import { destinyGeneration } from './generation.ts';
import { canLeaveHeroUnit, heroUnitOptions } from './hero-unit.ts';
import { checkEndOfTurn, checkState, flushFavors } from './royal-favors.ts';
import { onTurnEnd, onTurnStart } from './abilities/effects.ts';
import { hasAbilityOffer } from './abilities/engine.ts';

export function freshTurnFlags(): TurnFlags {
  return {
    movementLeft: 0, movePath: [], tavernShopOpen: null, leftTaverns: [], leadAttempted: false,
    leadPossible: false, kingInCheckAfterLead: false, checkDestinyClaimed: [], moveStart: null, abilitiesUsed: [],
    inspiredLeadBonus: 0, lead: null, bothKingsInCheckAtBeginning: false, doubleStepUnitId: null,
    heroUnitChanges: [], kingsForcesUsed: false,
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
      onTurnStart(ctx); // 004: "until the beginning of your next turn" effects end, turn-start hooks
      for (const side of ['light', 'dark'] as const) s.royalFavors[side].tidesThisTurn = false;
      if (!checkmateCheck(ctx)) maybeStartEpic(ctx);
      break;
    case 'beginningOfTurn': {
      if (h.status.recoverAtBeginningOfTurn) {
        // Heroic Recovery: half max health, no longer Unconscious (FR-051).
        h.health = Math.floor(h.maxHealth / 2);
        h.status.unconscious = false;
        h.status.recoverAtBeginningOfTurn = false;
        emit(ctx, { type: 'heroRecovered', heroId: h.id });
      }
      const penalty = h.status.movementPenaltyNextTurn + (isTavernFor(s, h, h.pos) ? RULES.tavern.startTurnMovementPenalty : 0);
      h.status.movementPenaltyNextTurn = 0;
      s.turn.movementLeft = movementForTurn(h, penalty, s);
      onHeroEntersSquare(ctx, h);
      s.turn.bothKingsInCheckAtBeginning = bothKingsInCheck(ctx);
      break;
    }
    case 'move':
      s.turn.moveStart = { ...h.pos }; // 006 FR-003: the start square is part of the Move's path.
      break;
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
      // Hero Destiny Generation, then Destined for Greatness (003 FR-011, research R-05).
      gain(ctx, { side: h.side, heroId: h.id }, destinyGeneration(s, h.side), 'destinyGeneration');
      checkEndOfTurn(ctx, h.side);
      freeMeal(ctx, h, abilitiesBlocked(s));
      break;
    default:
      break;
  }
}

/** Pass the Active Hero token to the next hero in turn order (FR-011). */
function handOff(ctx: Ctx): void {
  const { s } = ctx;
  onTurnEnd(ctx); // 004: end-of-turn ability effects, then "end of turn" expiries
  if (s.status !== 'playing') return;
  const keep = s.turn.doubleStepUnitId;
  for (const u of s.units) if (u.id !== keep) u.enPassantTarget = null;
  // By turn order, not by id: Timey-Wimey Shift swaps turn orders (004).
  const next = (activeHero(s).turnOrder % 4) + 1;
  s.activeHeroId = (s.heroes.find((x) => x.turnOrder === next)?.id ?? `H${next}`) as HeroId;
  s.turnNumber += 1;
  setPhase(ctx, 'beforeTurn');
}

/** The Active Hero token was passed inside Before Turn (Timey-Wimey Shift): the new active hero's turn begins. */
export function restartTurn(ctx: Ctx): void {
  setPhase(ctx, 'beforeTurn');
}

/** The active hero has a Legendary Power choice now (Hero Unit on/off, King's Forces; research R-08). */
export function hasPowerChoice(s: GameState): boolean {
  const h = activeHero(s);
  return heroUnitOptions(s, h.id).length > 0 || canLeaveHeroUnit(s, h.id) || canKingsForces(s);
}

/** Whether the current phase can be passed without a player choice; a usable ability makes it rest (004 R-03). */
function isAutomatic(ctx: Ctx): boolean {
  return isAutomaticBase(ctx) && !hasAbilityOffer(ctx.s);
}

function isAutomaticBase(ctx: Ctx): boolean {
  const { s } = ctx;
  switch (s.phase) {
    case 'beforeTurn':
    case 'beforeMove':
    case 'afterLead':
      return true;
    case 'beginningOfTurn':
      return !hasPowerChoice(s);
    case 'move':
      return !!activeHero(s).heroUnitId; // A Hero Unit skips its Move (003 FR-031).
    case 'beforeLead':
      return !canInspiredLead(ctx);
    case 'lead':
      return !awaitingRoll(s) && (!s.turn.leadPossible || s.turn.leadAttempted);
    case 'endOfTurn':
      return !canHeroRetreat(ctx) && !hasPowerChoice(s);
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
    settleFavors(ctx);
    if (!playing(ctx.s) || s.pendingDecision || !isAutomatic(ctx)) return;
    step(ctx);
  }
  throw new Error('autoAdvance did not settle');
}

/** The player ends the current phase (FR-031: not while a possible Lead is unattempted). */
export function endPhase(ctx: Ctx): void {
  const { s } = ctx;
  const h = activeHero(s);
  if (s.phase === 'move' && isForbiddenEndSquare(s, h.side, h.pos, h)) {
    fail('MOVE_ENDS_ON_UNIT', 'A Move may not end on an enemy unit or a King', 'Move');
  }
  if (s.phase === 'lead') {
    if (awaitingRoll(s)) fail('ROLL_PENDING', 'Roll the die first', 'Lead');
    if (s.turn.leadPossible && !s.turn.leadAttempted) fail('MUST_ATTEMPT_LEAD', 'A possible Lead must be attempted', 'Lead');
  }
  step(ctx);
}

/** Position Royal Favors for both sides, then place completions on the tracks (FR-020a). */
export function settleFavors(ctx: Ctx): void {
  checkState(ctx);
  flushFavors(ctx);
}

export function startFirstTurn(ctx: Ctx): void {
  setPhase(ctx, 'beforeTurn');
}

export function isHeroActive(s: GameState, id: HeroId): boolean {
  return hero(s, id).id === s.activeHeroId;
}
