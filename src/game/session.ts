// Game session: action log (with roll values), undo and replay (FR-012, FR-037, research R-11). Engine-free.
import { apply, REVEAL_EVENTS, type Action, type ApplyResult, type GameEvent, type GameState } from '../rules/index.ts';

/** Undo stops at reveal events (a roll, a destroyed unit, a wound), at a switch of rules / sandbox, at the Active Hero
 * hand-off and at another hero's decision (a reaction, a promotion choice, an Epic destiny). Phase changes inside the
 * turn are not barriers: the acting player undoes step by step through their whole turn (001 FR-012 as amended by
 * 005 FR-030, decided by the game's designer on 2026-11-10). */
function isBarrier(before: GameState, action: Action, events: GameEvent[]): boolean {
  if (events.some((e) => REVEAL_EVENTS.includes(e.type) || e.type === 'enforcementChanged' || e.type === 'turnStarted' || e.type === 'turnSkipped')) {
    return true;
  }
  if (action.type === 'answerDraw' || action.type === 'offerDraw') return true;
  const d = before.pendingDecision;
  if (action.type === 'decide' && d && before.status === 'playing') {
    const owner = d.type === 'promotion' ? d.chooserHeroId : d.type === 'drawOffer' ? null : d.heroId;
    if (owner !== before.activeHeroId) return true;
  }
  return false;
}

/** Rebuild a state by re-applying the action log. No seed is needed: rolls are in the log. */
export function replay(initial: GameState, history: Action[]): GameState {
  let s = initial;
  for (const a of history) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`Replay failed at ${a.type}: ${r.error.message}`);
    s = r.state;
  }
  return s;
}

/** Index after the last barrier in the log: actions from there on may be undone (newest first). */
export function undoFloor(initial: GameState, history: readonly Action[]): number {
  let s = initial;
  let barrier = 0;
  history.forEach((a, i) => {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`Replay failed at ${a.type}`);
    if (isBarrier(s, a, r.events)) barrier = i + 1;
    s = r.state;
  });
  return barrier;
}

/** Undo the last action if no barrier came after it; returns the shorter log or null. */
export function undo(initial: GameState, history: Action[]): Action[] | null {
  if (history.length === 0) return null;
  return history.length > undoFloor(initial, history) ? history.slice(0, -1) : null;
}

export type Listener = (state: GameState, events: GameEvent[], action: Action | null) => void;

/** What the table and HUD need from a game: hot-seat (GameSession) or online (src/net OnlineSession, 005 R-13). */
export interface SessionLike {
  readonly state: GameState;
  readonly initial: GameState;
  readonly actions: readonly Action[];
  onChange(fn: Listener): () => void;
  dispatch(action: Action): ApplyResult;
  canUndo(): boolean;
  undo(): boolean;
}

export class GameSession implements SessionLike {
  private history: Action[] = [];
  private barrier = 0;
  private listeners: Listener[] = [];
  state: GameState;

  constructor(readonly initial: GameState) {
    this.state = initial;
  }

  get actions(): readonly Action[] {
    return this.history;
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  dispatch(action: Action): ApplyResult {
    const r = apply(this.state, action);
    if (!r.ok) return r;
    this.history.push(action);
    if (isBarrier(this.state, action, r.events)) this.barrier = this.history.length;
    this.state = r.state;
    for (const l of this.listeners) l(this.state, r.events, action);
    return r;
  }

  canUndo(): boolean {
    return this.history.length > this.barrier;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    this.history.pop();
    this.state = replay(this.initial, this.history);
    for (const l of this.listeners) l(this.state, [], null);
    return true;
  }

  /** Replace the session (new game, rematch, load). */
  reset(initial: GameState, history: Action[] = []): void {
    (this as { initial: GameState }).initial = initial;
    this.history = [...history];
    this.state = replay(initial, history);
    this.barrier = this.history.length;
    for (const l of this.listeners) l(this.state, [], null);
  }
}
