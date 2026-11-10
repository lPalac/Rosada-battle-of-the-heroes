// 005 T033 / research R-13: a game session driven by the server. The table and HUD use it like the hot-seat
// GameSession; every change comes from the server's `applied` actions, applied here with the same rules core.
import { replay, undo as undoLog, type Listener, type SessionLike } from '../game/session.ts';
import { actorFor, lastActor } from '../online/authority.ts';
import { stateCheck } from '../online/check.ts';
import type { Actor, RoomView, SeatId } from '../online/model.ts';
import type { ServerMessages } from '../online/protocol.ts';
import { apply, awaitingRoll, type Action, type ApplyResult, type GameState } from '../rules/index.ts';
import type { RoomConnection } from './client.ts';

export type Refusal = ServerMessages['refused'];

/** What came with an applied action: who sent it and whether the server rolled it (play the die). */
export interface AppliedInfo {
  by: Actor;
  roll: boolean;
  seq: number;
}

/** `dispatch` sends to the server and returns this "error" so callers know nothing changed yet. */
export const SENT = { code: 'SENT', message: 'Sent to the server', rule: 'Online' } as const;

export class OnlineSession implements SessionLike {
  state!: GameState;
  initial!: GameState;
  private history: Action[] = [];
  private actors: Actor[] = [];
  room: RoomView | null = null;
  /** True until the first snapshot arrives. */
  loading = true;
  private clientSeq = 0;
  private listeners = new Set<Listener>();
  private appliedFns = new Set<(info: AppliedInfo, action: Action) => void>();
  private roomFns = new Set<(room: RoomView) => void>();
  private refusedFns = new Set<(r: Refusal) => void>();
  private undoneFns = new Set<(m: ServerMessages['undone']) => void>();
  private tokenFns = new Set<(t: ServerMessages['seatToken']) => void>();
  private readyFns = new Set<() => void>();
  resyncs = 0;

  constructor(readonly conn: RoomConnection) {
    conn.on('snapshot', (m) => this.onSnapshot(m));
    conn.on('applied', (m) => this.receive(m));
    conn.on('undone', (m) => this.receiveUndo(m));
    conn.on('room', (m) => this.setRoom(m));
    conn.on('refused', (m) => this.refusedFns.forEach((f) => f(m)));
    conn.on('seatToken', (m) => this.tokenFns.forEach((f) => f(m)));
  }

  get actions(): readonly Action[] {
    return this.history;
  }

  get seq(): number {
    return this.history.length;
  }

  get mySeat(): SeatId | null {
    return this.room?.you ?? null;
  }

  // ── events ──────────────────────────────────────────────────────────────

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Called before the change listeners, so the table can start the die animation for a server roll. */
  onApplied(fn: (info: AppliedInfo, action: Action) => void): () => void {
    this.appliedFns.add(fn);
    return () => this.appliedFns.delete(fn);
  }

  onRoom(fn: (room: RoomView) => void): () => void {
    this.roomFns.add(fn);
    if (this.room) fn(this.room);
    return () => this.roomFns.delete(fn);
  }

  /** Someone undid an action (FR-030): the HUD says who and what. */
  onUndone(fn: (m: ServerMessages['undone']) => void): () => void {
    this.undoneFns.add(fn);
    return () => this.undoneFns.delete(fn);
  }

  onRefused(fn: (r: Refusal) => void): () => void {
    this.refusedFns.add(fn);
    return () => this.refusedFns.delete(fn);
  }

  onSeatToken(fn: (t: ServerMessages['seatToken']) => void): () => void {
    this.tokenFns.add(fn);
    return () => this.tokenFns.delete(fn);
  }

  /** Resolves on the first snapshot. */
  ready(): Promise<void> {
    if (!this.loading) return Promise.resolve();
    return new Promise((resolve) => this.readyFns.add(resolve));
  }

  // ── from the server ─────────────────────────────────────────────────────

  private setRoom(room: RoomView): void {
    this.room = room;
    this.roomFns.forEach((f) => f(room));
  }

  private onSnapshot(m: ServerMessages['snapshot']): void {
    this.initial = m.save.initial;
    this.history = [...m.save.actions];
    this.actors = [...m.actors];
    this.state = replay(this.initial, this.history);
    this.loading = false;
    this.setRoom(m.room);
    this.listeners.forEach((l) => l(this.state, [], null));
    const fns = [...this.readyFns];
    this.readyFns.clear();
    fns.forEach((f) => f());
  }

  private receive(m: ServerMessages['applied']): void {
    if (this.loading) return;
    if (m.seq !== this.seq + 1) return this.resync();
    const r = apply(this.state, m.action);
    if (!r.ok || stateCheck(r.state) !== m.check) return this.resync();
    this.history.push(m.action);
    this.actors.push(m.by);
    this.state = r.state;
    this.appliedFns.forEach((f) => f({ by: m.by, roll: m.roll, seq: m.seq }, m.action));
    this.listeners.forEach((l) => l(this.state, r.events, m.action));
  }

  private receiveUndo(m: ServerMessages['undone']): void {
    if (this.loading) return;
    if (m.seq !== this.seq - 1) return this.resync();
    this.history.pop();
    this.actors.pop();
    this.state = replay(this.initial, this.history);
    if (stateCheck(this.state) !== m.check) return this.resync();
    this.undoneFns.forEach((f) => f(m));
    this.listeners.forEach((l) => l(this.state, [], null));
  }

  /** Ask for a fresh snapshot (FR-013). */
  resync(): void {
    this.resyncs++;
    this.loading = true;
    this.conn.send({ t: 'resync' });
  }

  // ── to the server ───────────────────────────────────────────────────────

  /** True if the local seat may act now (the HUD greys out controls otherwise). */
  canAct(): boolean {
    const seat = this.mySeat;
    return !!seat && !this.loading && !!this.room && actorFor(this.room, this.state).has(seat);
  }

  /** The seats that must act now, for "waiting for <name>". */
  waitingFor(): SeatId[] {
    if (!this.room || this.loading) return [];
    return [...actorFor(this.room, this.state)];
  }

  /** Online the roll is the server's: a `submitRoll` becomes a roll request (FR-020). */
  dispatch(action: Action): ApplyResult {
    if (action.type === 'submitRoll') return this.roll();
    this.conn.send({ t: 'act', action, clientSeq: ++this.clientSeq });
    return { ok: false, error: { ...SENT } };
  }

  roll(): ApplyResult {
    this.conn.send({ t: 'roll', clientSeq: ++this.clientSeq });
    return { ok: false, error: { ...SENT } };
  }

  get awaitingRoll(): boolean {
    return !this.loading && awaitingRoll(this.state);
  }

  canUndo(): boolean {
    if (this.loading || !this.mySeat || lastActor({ actors: this.actors }) !== this.mySeat) return false;
    return undoLog(this.initial, this.history) !== null;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    this.conn.send({ t: 'undo', clientSeq: ++this.clientSeq });
    return true;
  }

  takeSeat(seat: SeatId, name: string): void {
    this.conn.send({ t: 'takeSeat', seat, name });
  }

  leaveSeat(): void {
    this.conn.send({ t: 'leaveSeat' });
  }

  start(): void {
    this.conn.send({ t: 'start' });
  }

  release(seat: SeatId): void {
    this.conn.send({ t: 'releaseSeat', seat });
  }

  rematch(): void {
    this.conn.send({ t: 'rematch' });
  }
}
