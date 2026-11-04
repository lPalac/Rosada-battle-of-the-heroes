import { expect } from 'vitest';
import {
  apply, createGame, createSetup, legalActions, type Action, type GameEvent, type GameState, type RangeType, type SetupChoices,
} from '../../src/rules/index.ts';

export interface Step {
  state: GameState;
  events: GameEvent[];
}

/** Apply an action that must succeed. */
export function act(state: GameState, action: Action): Step {
  const r = apply(state, action);
  if (!r.ok) throw new Error(`${action.type} failed: ${r.error.code} ${r.error.message}`);
  return { state: r.state, events: r.events };
}

/** Apply an action that must fail; returns the error code. */
export function reject(state: GameState, action: Action): string {
  const r = apply(state, action);
  expect(r.ok, `${action.type} should fail`).toBe(false);
  return r.ok ? '' : r.error.code;
}

export function run(state: GameState, actions: Action[]): Step {
  let step: Step = { state, events: [] };
  for (const a of actions) {
    const next = act(step.state, a);
    step = { state: next.state, events: [...step.events, ...next.events] };
  }
  return step;
}

/** Draft picks in order L, D, D, L. */
export function setupChoices(ranges: RangeType[] = ['short', 'short', 'long', 'long']): SetupChoices {
  let s = createSetup({ mode: 'draft', playerCount: 4 });
  const order = ['light', 'dark', 'dark', 'light'] as const;
  ranges.forEach((rangeType, i) => {
    s = act(s, { type: 'pickHero', side: order[i], rangeType }).state;
  });
  s = act(s, { type: 'setTurnOrder', side: 'light', first: 0 }).state;
  s = act(s, { type: 'setTurnOrder', side: 'dark', first: 1 }).state;
  s = act(s, { type: 'setStartFile', pickIndex: 0, file: 'c' }).state;
  s = act(s, { type: 'setStartFile', pickIndex: 1, file: 'c' }).state;
  return s.setup;
}

/** Standard new game: H1 Light short, H2 Dark short, H3 Light long, H4 Dark long. */
export function newGame(): GameState {
  return createGame(setupChoices(['short', 'short', 'long', 'long']));
}

/** Play the active hero's turn with simple choices until the Active Hero token passes. */
export function passTurn(state: GameState, roll = 20): Step {
  let s = state;
  const events: GameEvent[] = [];
  const start = s.turnNumber;
  for (let i = 0; i < 20 && s.status === 'playing' && s.turnNumber === start; i++) {
    const legal = legalActions(s);
    const pick =
      legal.find((a) => a.type === 'decide') ??
      legal.find((a) => a.type === 'submitRoll' && a.value === roll) ??
      legal.find((a) => a.type === 'announceLead') ??
      legal.find((a) => a.type === 'endPhase');
    if (!pick) throw new Error(`passTurn stuck in ${s.phase}`);
    const r = act(s, pick);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export function hero(state: GameState, id: string) {
  return state.heroes.find((h) => h.id === id)!;
}

export function eventsOf<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];
}
