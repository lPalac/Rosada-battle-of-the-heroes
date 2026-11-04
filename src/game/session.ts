// Game session: action log (with roll values), undo and replay (FR-012, FR-037, research R-11). Engine-free.
import { apply, REVEAL_EVENTS, type Action, type ApplyResult, type GameEvent, type GameState } from '../rules/index.ts';

/** Undo stops at reveal events and at every phase change (FR-012: undo within the current phase). */
function isBarrier(events: GameEvent[]): boolean {
  return events.some((e) => REVEAL_EVENTS.includes(e.type) || e.type === 'phaseChanged' || e.type === 'enforcementChanged');
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

/** Undo the last action if no reveal event or phase change happened since; returns the shorter log or null. */
export function undo(initial: GameState, history: Action[]): Action[] | null {
  if (history.length === 0) return null;
  let s = initial;
  let barrier = 0;
  history.forEach((a, i) => {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`Replay failed at ${a.type}`);
    if (isBarrier(r.events)) barrier = i + 1;
    s = r.state;
  });
  return history.length > barrier ? history.slice(0, -1) : null;
}

type Listener = (state: GameState, events: GameEvent[], action: Action | null) => void;

export class GameSession {
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
    if (isBarrier(r.events)) this.barrier = this.history.length;
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
