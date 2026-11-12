// Public API of the rules core (contracts/rules-api.md). Pure: same input, same output; never mutates input.
import { canHeroRetreat, canInspiredLead, heroRetreat, inspiredLead } from './abilities.ts';
import { eq, taverns } from './board.ts';
import { checkingUnits, isInCheck } from './check.ts';
import { activeHero, clone, emit, fail, hero, RuleFailure, type Ctx } from './ctx.ts';
import { DATA, RULES, type StaticData } from './data.ts';
import { available, DESTINY, gain } from './destiny.ts';
import { otherSide } from './model/types.ts';
import { answerDraw, offerDraw } from './endgame.ts';
import { isForbiddenEndSquare, legalMoveSquares, moveReach, moveSquaresFrom, moveStep, placeHero, type Reach } from './heroes.ts';
import {
  announceLead, awaitingRoll, leadOptionsForActiveHero, leadPreview, legalLeadTargets, promote, submitRoll, useRevenge,
} from './lead.ts';
import type { Action, DecisionAnswer, GameEvent, RuleError } from './model/actions.ts';
import type { GameState, LogEntry, SetupChoices } from './model/state.ts';
import { RANGE_TYPES } from './model/types.ts';
import { freeRoll, positionWarnings, sandboxPlace, sandboxSet, setEnforcement, validatePosition } from './sandbox.ts';
import {
  createGameState, createSetup, nextPicker, pickHero, picksComplete, setStartFile, setTurnOrder, setupReady, sidePicks,
} from './setup.ts';
import { buy, shopOpen } from './taverns.ts';
import { autoAdvance, endPhase, settleFavors, startFirstTurn } from './turn.ts';
import { canKingsForces, kingsForces } from './create.ts';
import { chooseDestiny } from './epic.ts';
import { becomeHeroUnit, canLeaveHeroUnit, heroUnitOptions, leaveHeroUnit } from './hero-unit.ts';
import { abilityOffers, useAbility } from './abilities/engine.ts';
import { answerReaction } from './abilities/reactions.ts';
import { answerChoice } from './abilities/choices.ts';
import { resumeLead } from './lead.ts';
import { pickableHeroes } from './setup.ts';
import { cleanTargets } from './abilities/effects.ts';

export type ApplyResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: RuleError };

function toLog(s: GameState, type: string, data: Record<string, unknown>): LogEntry {
  const started = s.status !== 'setup';
  return { turn: s.turnNumber, heroId: started ? s.activeHeroId : null, phase: started ? s.phase : null, type, data };
}

function newCtx(state: GameState): Ctx {
  const { log, ...rest } = state;
  const s = clone(rest) as GameState;
  s.log = log.slice();
  return { s, events: [] };
}

function finish(ctx: Ctx, action: Action | null): GameState {
  const { s } = ctx;
  if (action) s.log.push(toLog(s, 'action', { action }));
  for (const e of ctx.events) {
    // 006: the log line of a check names the checking units' types (the event itself carries their ids).
    const data = e.type === 'check' ? { ...e, types: e.units.map((id) => s.units.find((u) => u.id === id)?.type ?? null) } : { ...e };
    s.log.push(toLog(s, e.type, data));
  }
  return s;
}

/** Create a new game from completed setup choices and static data; turn 1 waits at the first player choice. */
export function createGame(setup: SetupChoices, data: StaticData = DATA): GameState {
  const ctx: Ctx = { s: createGameState(setup, data), events: [] };
  startFirstTurn(ctx);
  autoAdvance(ctx);
  return finish(ctx, null);
}

export { createSetup };

function decide(ctx: Ctx, answer: DecisionAnswer): void {
  const { s } = ctx;
  const d = s.pendingDecision;
  if (!d || d.type === 'drawOffer') fail('NO_DECISION', 'Nothing to decide', 'Decisions');
  if (d.type === 'promotion') {
    if (answer.type !== 'promotion') fail('BAD_ANSWER', 'Choose a unit type', 'Promotion');
    promote(ctx, d.unitId, answer.to);
  } else if (d.type === 'epicDestiny') {
    if (answer.type !== 'destiny') fail('BAD_ANSWER', 'Choose a destiny', 'Epic Heroes');
    s.pendingDecision = null;
    chooseDestiny(ctx, d.heroId, answer.destiny, d.appliesTo);
  } else if (d.type === 'reaction') {
    if (answer.type !== 'reaction') fail('BAD_ANSWER', 'Use the reaction or decline it', 'Hero Abilities');
    answerReaction(ctx, answer.use, answer.targets, answer.pay);
    s.pendingDecision = s.decisionQueue.shift() ?? null;
    if (!s.pendingDecision) resumeLead(ctx);
    return;
  } else if (d.type === 'abilityChoice') {
    if (answer.type !== 'abilityChoice' || !d.choices.includes(answer.choice)) fail('BAD_ANSWER', 'Choose one of the options', 'Hero Abilities');
    s.pendingDecision = s.decisionQueue.shift() ?? null;
    answerChoice(ctx, d, answer.choice);
    return;
  } else {
    if (answer.type !== 'square') fail('BAD_ANSWER', 'Choose one of the offered squares', 'Decisions');
    if (!d.options.some((o) => eq(o, answer.to))) fail('BAD_ANSWER', 'Choose one of the offered squares', 'Decisions');
    const h = hero(s, d.heroId);
    placeHero(ctx, h, answer.to, d.type === 'unconsciousTavern' ? 'unconscious' : 'advance');
  }
  s.pendingDecision = s.decisionQueue.shift() ?? null;
}

function dispatch(ctx: Ctx, action: Action): void {
  const { s } = ctx;
  if (s.status === 'setup') {
    switch (action.type) {
      case 'pickHero': return pickHero(ctx, action.side, action.rangeType, action.heroDefinitionId);
      case 'setTurnOrder': return setTurnOrder(ctx, action.side, action.first);
      case 'setStartFile': return setStartFile(ctx, action.pickIndex, action.file);
      case 'startGame': {
        if (!setupReady(s.setup)) fail('SETUP_INCOMPLETE', 'Pick heroes, turn order and starting squares first', 'Setup');
        const log = s.log;
        ctx.s = createGameState(s.setup);
        ctx.s.log = log;
        startFirstTurn(ctx);
        return;
      }
      default: fail('NOT_PLAYING', 'Finish setup first', 'Setup');
    }
  }
  if (s.enforcement === 'sandbox') {
    switch (action.type) {
      case 'setEnforcement': return setEnforcement(ctx, action.mode, action.restart);
      case 'sandboxPlace': return sandboxPlace(ctx, action.target, action.to);
      case 'sandboxSet': return sandboxSet(ctx, action.path, action.target, action.value);
      case 'submitRoll': return freeRoll(ctx, action.value);
      default: fail('SANDBOX_MODE', 'Rules are off: only sandbox actions work', 'Sandbox');
    }
  }
  if (action.type === 'setEnforcement') return setEnforcement(ctx, action.mode);
  if (s.status === 'ended') fail('GAME_ENDED', 'The game has ended', 'Ending the Game');
  if (s.pendingDecision) {
    if (action.type === 'decide') return decide(ctx, action.decision);
    if (action.type === 'answerDraw') return answerDraw(ctx, action.accept);
    fail('DECISION_PENDING', 'Answer the open decision first', 'Decisions');
  }
  switch (action.type) {
    case 'endPhase': return endPhase(ctx);
    case 'moveStep': return moveStep(ctx, action.to);
    case 'buy': return buy(ctx, action.item, action.pay);
    case 'inspiredLead': return inspiredLead(ctx, action.destiny, action.pay);
    case 'heroRetreat': return heroRetreat(ctx, action.tavern, action.pay);
    case 'becomeHeroUnit': return becomeHeroUnit(ctx, action.types);
    case 'leaveHeroUnit': return leaveHeroUnit(ctx);
    case 'kingsForces': return kingsForces(ctx);
    case 'useAbility': return useAbility(ctx, action.abilityId, action.targets ?? [], action.option, action.pay);
    case 'announceLead': return announceLead(ctx, action.unitId, action.to, action.promoteTo);
    case 'useRevenge': return useRevenge(ctx);
    case 'submitRoll': return submitRoll(ctx, action.value);
    case 'offerDraw':
      if (awaitingRoll(s)) fail('ROLL_PENDING', 'Roll the die first', 'Lead');
      return offerDraw(ctx);
    default: fail('NOT_ALLOWED', `${action.type} is not possible now`, 'Rules');
  }
}

const inRules = (s: GameState): boolean => s.status === 'playing' && s.enforcement === 'rules';

/**
 * 006 FR-001 (research R-02): after an action, a unit that checks a King and did not check it before the action is a
 * new check. The `check` event names the new checking units; the checking side gains `DESTINY.check` unless it already
 * did this turn, whichever side took the action. Not in sandbox mode; simulations run on copies, not through `apply`.
 */
function newChecks(ctx: Ctx, before: GameState): void {
  const { s } = ctx;
  if (!inRules(before) || !inRules(s)) return;
  for (const kingSide of ['light', 'dark'] as const) {
    const was = new Set(checkingUnits(before, kingSide));
    const fresh = checkingUnits(s, kingSide).filter((id) => !was.has(id));
    if (!fresh.length) continue;
    emit(ctx, { type: 'check', side: kingSide, units: fresh });
    const maker = otherSide(kingSide);
    if (!s.turn.checkDestinyClaimed.includes(maker)) {
      s.turn.checkDestinyClaimed.push(maker);
      gain(ctx, { side: maker }, DESTINY.check, 'check');
    }
  }
}

/** Apply one action. Never mutates the input. */
export function apply(state: GameState, action: Action): ApplyResult {
  const ctx = newCtx(state);
  try {
    dispatch(ctx, action);
    newChecks(ctx, state);
    if (ctx.s.effects?.length) cleanTargets(ctx);
    if (ctx.s.status === 'playing' && ctx.s.enforcement === 'rules') autoAdvance(ctx);
    else settleFavors(ctx);
  } catch (e) {
    if (e instanceof RuleFailure) return { ok: false, error: e.error };
    throw e;
  }
  return { ok: true, state: finish(ctx, action), events: ctx.events };
}

/**
 * 006 FR-015 (guarantee 25b): would `action`, applied now, leave a unit newly checking the acting side's own King?
 * Runs on a copy (apply never mutates its input); false when the action would be refused.
 */
export function wouldCheckOwnKing(state: GameState, action: Action): boolean {
  if (state.status !== 'playing' || state.enforcement !== 'rules') return false;
  const side = activeHero(state).side;
  const r = apply(state, action);
  return r.ok && r.events.some((e) => e.type === 'check' && e.side === side);
}

/** Every action the active player (or the player owning a pendingDecision) may take now. Sandbox placement and
 * editing actions are open-ended and not listed. */
export function legalActions(state: GameState): Action[] {
  const s = state;
  const out: Action[] = [];
  if (s.status === 'setup') {
    const picker = nextPicker(s.setup);
    // Named heroes (004); range-type picks stay accepted for the generic heroes but are not offered (spec Q-42).
    if (picker) for (const def of pickableHeroes(s.setup)) out.push({ type: 'pickHero', side: picker, heroDefinitionId: def.id });
    void RANGE_TYPES;
    if (picksComplete(s.setup)) {
      for (const side of ['light', 'dark'] as const) {
        if (side === 'dark' && !s.setup.turnOrder.light) continue;
        for (const p of sidePicks(s.setup, side)) out.push({ type: 'setTurnOrder', side, first: p.pickIndex });
      }
      for (const p of s.setup.picks) for (const file of ['c', 'f'] as const) out.push({ type: 'setStartFile', pickIndex: p.pickIndex, file });
    }
    if (setupReady(s.setup)) out.push({ type: 'startGame' });
    return out;
  }
  if (s.enforcement === 'sandbox') {
    if (validatePosition(s).length === 0) out.push({ type: 'setEnforcement', mode: 'rules' });
    for (let v = 1; v <= RULES.die; v++) out.push({ type: 'submitRoll', value: v });
    return out;
  }
  out.push({ type: 'setEnforcement', mode: 'sandbox' });
  if (s.status === 'ended') return out;
  const d = s.pendingDecision;
  if (d) {
    out.length = 0;
    if (d.type === 'drawOffer') out.push({ type: 'answerDraw', accept: true }, { type: 'answerDraw', accept: false });
    else if (d.type === 'promotion') for (const to of DATA.units.promotion) out.push({ type: 'decide', decision: { type: 'promotion', to } });
    else if (d.type === 'epicDestiny') for (const destiny of d.options) out.push({ type: 'decide', decision: { type: 'destiny', destiny } });
    else if (d.type === 'reaction') {
      out.push({ type: 'decide', decision: { type: 'reaction', use: false } });
      for (const targets of d.options) out.push({ type: 'decide', decision: { type: 'reaction', use: true, targets } });
    } else if (d.type === 'abilityChoice') for (const choice of d.choices) out.push({ type: 'decide', decision: { type: 'abilityChoice', choice } });
    else for (const to of d.options) out.push({ type: 'decide', decision: { type: 'square', to } });
    return out;
  }
  const ctx: Ctx = { s, events: [] };
  const h = activeHero(s);
  const powers = () => {
    for (const types of heroUnitOptions(s, h.id)) out.push({ type: 'becomeHeroUnit', types });
    if (canLeaveHeroUnit(s, h.id)) out.push({ type: 'leaveHeroUnit' });
    if (canKingsForces(s)) out.push({ type: 'kingsForces' });
  };
  switch (s.phase) {
    case 'beginningOfTurn':
      powers();
      out.push({ type: 'endPhase' });
      break;
    case 'move':
      for (const to of legalMoveSquares(s)) out.push({ type: 'moveStep', to });
      if (shopOpen(ctx)) {
        for (const item of ['drink', 'meal'] as const) if (available(ctx, h) >= RULES.tavern[item].cost) out.push({ type: 'buy', item });
      }
      if (!isForbiddenEndSquare(s, h.side, h.pos, h)) out.push({ type: 'endPhase' });
      break;
    case 'beforeLead':
      if (canInspiredLead(ctx)) for (let x = 1; x <= available(ctx, h); x++) out.push({ type: 'inspiredLead', destiny: x });
      out.push({ type: 'endPhase' });
      break;
    case 'lead':
      // 006 FR-007: Inspired Lead until the die is rolled.
      if (canInspiredLead(ctx)) for (let x = 1; x <= available(ctx, h); x++) out.push({ type: 'inspiredLead', destiny: x });
      if (awaitingRoll(s)) {
        for (let v = 1; v <= RULES.die; v++) out.push({ type: 'submitRoll', value: v });
        if (s.tokens.revenge[h.side] > 0) out.push({ type: 'useRevenge' });
      } else if (!s.turn.leadAttempted) {
        for (const o of leadOptionsForActiveHero(s)) out.push({ type: 'announceLead', unitId: o.unitId, to: o.to });
        if (!s.turn.leadPossible) out.push({ type: 'endPhase' });
      } else out.push({ type: 'endPhase' });
      break;
    case 'endOfTurn':
      if (canHeroRetreat(ctx)) for (const tavern of taverns(h.side)) out.push({ type: 'heroRetreat', tavern });
      powers();
      out.push({ type: 'endPhase' });
      break;
    default:
      // Before Turn, Before Move, After Lead rest only when an ability is usable (004 R-03).
      out.push({ type: 'endPhase' });
      break;
  }
  // 004: hero abilities usable now, one action per target choice.
  for (const o of abilityOffers(s)) {
    for (const targets of o.targets) out.push({ type: 'useAbility', abilityId: o.abilityId, targets, ...(o.option ? { option: o.option } : {}) });
  }
  if (!awaitingRoll(s)) out.push({ type: 'offerDraw' });
  return out;
}

export { isInCheck, legalLeadTargets, legalMoveSquares, leadPreview, validatePosition, positionWarnings, moveReach, moveSquaresFrom, type Reach };
export { DATA, RULES, loadStaticData, healthBar as healthBarOf } from './data.ts';
export type { StaticData } from './data.ts';
export * from './model/types.ts';
export type * from './model/actions.ts';
export { REVEAL_EVENTS } from './model/actions.ts';
export type * from './model/state.ts';
export type { Hero, HeroStatus } from './model/hero.ts';
export type { Unit } from './model/unit.ts';
export { squareName, parseSquare, regionOf, chebyshev, tavernOwner, taverns, heroStartSquares, inGrid, isBattlefield } from './board.ts';
export { nextPicker, picksComplete, setupReady, sidePicks, defaultPlayers } from './setup.ts';
export { abilitiesBlocked } from './abilities.ts';
export { abilityOffers, abilityCost, abilityStatus, usesLeft, type AbilityOffer, type AbilityStatus, type AbilityStatusReason } from './abilities/engine.ts';
export { activeEffects } from './abilities/effects.ts';
export { heroAbilityIds } from './abilities/hooks.ts';
export { selectableHeroes, pickableHeroes } from './setup.ts';
export { awaitingRoll } from './lead.ts';
export { unitsAt } from "./paths.ts";
export { isProtected, isCheckmate, threatenedSquares, checkingUnits, blockedLeads, leadRefusal, type LeadRefusal } from './check.ts';
export { destinyGeneration, isBloodied } from './generation.ts';
export { hasPower, unlockedPowers } from './royal-favors.ts';
export { heroUnitOptions, canLeaveHeroUnit, leadRange } from './hero-unit.ts';
export { canKingsForces } from './create.ts';
export { destinyOptions } from './epic.ts';
export { FAVORS } from './data.ts';
export type { FavorDefinition, FavorsData } from './data.ts';
