// Helpers for ability scenario tests (004).
import { expect } from 'vitest';
import { act, reject, type Step } from '../../helpers/game.ts';
import { sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { abilityOffers, apply, legalActions, type AbilityTarget, type GameState, type Phase } from '../../../src/rules/index.ts';

export const at = (square: string): AbilityTarget => ({ square: sq(square) });

/** Unit id of the unit on a square. */
export function uid(s: GameState, square: string): string {
  const u = unitOn(s, square);
  if (!u) throw new Error(`No unit on ${square}`);
  return u.id;
}

export const unitT = (s: GameState, square: string): AbilityTarget => ({ unitId: uid(s, square) });

export function use(s: GameState, abilityId: string, targets: AbilityTarget[] = [], option?: string): Step {
  return act(s, { type: 'useAbility', abilityId, targets, ...(option ? { option } : {}) });
}

export function refuse(s: GameState, abilityId: string, targets: AbilityTarget[] = [], option?: string): string {
  return reject(s, { type: 'useAbility', abilityId, targets, ...(option ? { option } : {}) });
}

export const offered = (s: GameState, abilityId: string): boolean => abilityOffers(s).some((o) => o.abilityId === abilityId);

/** Answer every pending decision with its first legal answer (advance square, promotion …). */
export function settle(s: GameState): GameState {
  let state = s;
  for (let i = 0; i < 10 && state.pendingDecision; i++) {
    const d = legalActions(state).find((a) => a.type === 'decide');
    if (!d) break;
    state = act(state, d).state;
  }
  return state;
}

/** Go to the Lead phase, Lead the unit on `from` to `to` with a roll, answer decisions. */
export function lead(s: GameState, from: string, to: string, roll = 20): GameState {
  let state = s.phase === 'lead' ? s : toPhase(s, 'lead');
  state = act(state, { type: 'announceLead', unitId: uid(state, from), to: sq(to) }).state;
  if (state.turn.lead && state.turn.lead.success === null && !state.pendingDecision) state = act(state, { type: 'submitRoll', value: roll }).state;
  return settle(state);
}

/** End phases until `phase` (endPhase only; a Lead must already be made past the Lead phase). */
export function until(s: GameState, phase: Phase): GameState {
  return s.phase === phase ? s : toPhase(s, phase);
}

export function expectOk(s: GameState, action: Parameters<typeof apply>[1]): GameState {
  const r = apply(s, action);
  expect(r.ok, r.ok ? '' : r.error.code).toBe(true);
  return r.ok ? r.state : s;
}

/** Finish an announced Lead: roll if needed, answer decisions. */
export function finish(s: GameState, roll = 20): GameState {
  let state = settle(s);
  if (state.turn.lead && state.turn.lead.success === null && !state.pendingDecision) state = act(state, { type: 'submitRoll', value: roll }).state;
  return settle(state);
}
