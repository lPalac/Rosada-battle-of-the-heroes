// 005 contracts/online-core-api.md: one online room. Pure and engine-free: randomness, token hashing and the clock
// are injected (RoomDeps), so it runs in Vitest without a network. The game server wraps it (server/rosada-room.ts).
import { toSaveFile, type SaveFile } from '../game/save.ts';
import { replay, undo as undoLog } from '../game/session.ts';
import {
  apply, awaitingRoll, createSetup, defaultPlayers, type Action, type GameState, type Player, type Side,
} from '../rules/index.ts';
import { actorFor, lastActor } from './authority.ts';
import { autoSetupActions } from './auto-setup.ts';
import { stateCheck } from './check.ts';
import { cleanName } from './codes.ts';
import { ONLINE } from './limits.ts';
import { no, ok, type Actor, type Applied, type Result, type Room, type RoomConfig, type RoomFile, type RoomStatus, type RoomView, type Seat, type SeatId } from './model.ts';

export interface RoomDeps {
  /** Uniform integer in [minIncl, maxExcl): crypto.randomInt on the server, scripted in tests. */
  randomInt(minIncl: number, maxExcl: number): number;
  /** A fresh 128-bit secret, base64url. */
  newToken(): string;
  /** SHA-256 hex of a token. */
  hashToken(token: string): string;
  now(): Date;
}

/** Actions a client may never send online (FR-017 sandbox, FR-020 dice). */
const NOT_ONLINE = new Set<Action['type']>(['submitRoll', 'setEnforcement', 'sandboxPlace', 'sandboxSet']);

function seatsFor(players: readonly Player[]): Seat[] {
  const index: Record<Side, number> = { light: 0, dark: 0 };
  const count = (side: Side) => players.filter((p) => p.side === side).length;
  return players.map((p) => {
    const heroSlots = count(p.side) === 1 ? [0, 1] : [index[p.side]++];
    return { id: p.id as SeatId, side: p.side, heroSlots, name: null, tokenHash: null, connected: false };
  });
}

function statusOf(state: GameState, lobby: boolean): RoomStatus {
  if (lobby) return 'lobby';
  return state.status === 'setup' ? 'setup' : state.status === 'ended' ? 'ended' : 'playing';
}

export class RoomCore {
  private current: GameState;
  private forcedRoll: number | null = null;

  private constructor(readonly room: Room, private readonly deps: RoomDeps) {
    this.current = replay(room.save.initial, room.save.actions);
  }

  /** A new room in the lobby. `from` is a save file to continue (US6); its players decide the seats. */
  static create(code: string, config: RoomConfig, deps: RoomDeps, ids: { buildId: string; dataHash: string }, from?: SaveFile): RoomCore {
    const now = deps.now().toISOString();
    let save: SaveFile;
    if (from) {
      const initial = from.initial;
      if (initial.enforcement !== 'rules') throw new Error('A game in sandbox mode cannot be played online');
      const state = replay(initial, from.actions); // throws if it does not replay
      if (state.enforcement !== 'rules') throw new Error('A game in sandbox mode cannot be played online');
      save = { ...from, initial, actions: [...from.actions] };
      const setup = initial.setup;
      const lights = setup.players.filter((p) => p.side === 'light').length;
      const singleSide: Side = setup.playerCount === 3 && lights === 2 ? 'dark' : 'light';
      config = { playerCount: setup.playerCount, mode: setup.mode, singleSide };
    } else {
      const players = defaultPlayers(config.playerCount, config.singleSide);
      save = toSaveFile(createSetup({ mode: config.mode, playerCount: config.playerCount, players }), [], deps.now());
    }
    const seats = seatsFor(save.initial.setup.players);
    const room: Room = {
      code, createdAt: now, lastActiveAt: now, status: 'lobby', config, creatorSeat: null, seats, save,
      actors: save.actions.map(() => 'server' as Actor), buildId: ids.buildId, dataHash: ids.dataHash,
    };
    return new RoomCore(room, deps);
  }

  /** A room from its file (FR-044). Throws if the log does not replay. */
  static restore(file: RoomFile, deps: RoomDeps): RoomCore {
    if (file?.format !== 'rosada-room' || file.version !== 1) throw new Error('Not a room file');
    const room: Room = { ...file.room, seats: file.room.seats.map((s) => ({ ...s, connected: false })) };
    if (room.actors.length !== room.save.actions.length) throw new Error('Room file actors do not match its log');
    return new RoomCore(room, deps);
  }

  get state(): GameState {
    return this.current;
  }

  get seq(): number {
    return this.room.save.actions.length;
  }

  seat(id: SeatId): Seat | undefined {
    return this.room.seats.find((s) => s.id === id);
  }

  private touch(): void {
    this.room.lastActiveAt = this.deps.now().toISOString();
  }

  private syncStatus(): void {
    if (this.room.status !== 'lobby') this.room.status = statusOf(this.current, false);
  }

  // ── seats ──────────────────────────────────────────────────────────────

  /** True when someone without a seat token may still come in: a free seat (in the lobby, or released later). */
  canEnter(): boolean {
    return this.room.seats.some((s) => !s.tokenHash);
  }

  freeSeats(): SeatId[] {
    return this.room.seats.filter((s) => !s.tokenHash).map((s) => s.id);
  }

  /** Take a free seat, or move from `from` to it (lobby only). The token is returned once and stored hashed. */
  takeSeat(id: SeatId, rawName: unknown, from: SeatId | null = null): Result<{ token: string }> {
    const seat = this.seat(id);
    if (!seat) return no('NO_SEAT', 'There is no such seat in this room');
    const name = cleanName(rawName);
    if (!name) return no('BAD_NAME', `Enter a name of 1–${ONLINE.nameMax} characters`);
    if (seat.tokenHash) return no('SEAT_TAKEN', 'That seat is taken');
    if (from) {
      if (this.room.status !== 'lobby') return no('ROOM_STARTED', 'Seats can only change before the game starts');
      const old = this.seat(from);
      if (old) {
        old.tokenHash = null;
        old.name = null;
        old.connected = false;
      }
    }
    const token = this.deps.newToken();
    seat.tokenHash = this.deps.hashToken(token);
    seat.name = name;
    if (!this.room.creatorSeat || this.room.creatorSeat === from) this.room.creatorSeat = id;
    this.syncPlayerName(seat);
    this.touch();
    return ok({ token });
  }

  /** Leave a seat in the lobby (it becomes free). */
  leaveSeat(id: SeatId): Result {
    if (this.room.status !== 'lobby') return no('ROOM_STARTED', 'Seats can only change before the game starts');
    const seat = this.seat(id);
    if (!seat?.tokenHash) return no('NO_SEAT', 'You have no seat');
    seat.tokenHash = null;
    seat.name = null;
    seat.connected = false;
    if (this.room.creatorSeat === id) this.room.creatorSeat = this.room.seats.find((s) => s.tokenHash)?.id ?? null;
    this.touch();
    return ok(undefined);
  }

  /** The seat a stored token belongs to (rejoin, FR-040). */
  seatForToken(token: unknown): SeatId | null {
    if (typeof token !== 'string' || token.length < 16 || token.length > 64) return null;
    const hash = this.deps.hashToken(token);
    return this.room.seats.find((s) => s.tokenHash === hash)?.id ?? null;
  }

  setConnected(id: SeatId, on: boolean): void {
    const seat = this.seat(id);
    if (seat) seat.connected = on;
  }

  /** Hand an away seat to whoever opens the link next (Q-55): by the creator, or by any seated player when the
   * creator is away. */
  release(by: SeatId, id: SeatId): Result {
    const seat = this.seat(id);
    const me = this.seat(by);
    if (!seat || !me?.tokenHash) return no('NO_SEAT', 'There is no such seat');
    if (by === id) return no('NOT_ALLOWED', 'You cannot release your own seat');
    if (!seat.tokenHash) return no('SEAT_FREE', 'That seat is already free');
    if (seat.connected) return no('SEAT_CONNECTED', 'That player is connected');
    const creator = this.room.creatorSeat ? this.seat(this.room.creatorSeat) : undefined;
    const creatorAway = !creator?.tokenHash || !creator.connected;
    if (by !== this.room.creatorSeat && !creatorAway) return no('NOT_CREATOR', 'Only the room creator can release a seat');
    seat.tokenHash = null;
    if (this.room.creatorSeat === id) this.room.creatorSeat = by;
    this.touch();
    return ok(undefined);
  }

  /** Display names become the players' names in the game (setup and save files). */
  private syncPlayerName(seat: Seat): void {
    if (this.room.status !== 'lobby' || !seat.name) return;
    const p = this.room.save.initial.setup.players.find((x) => x.id === seat.id);
    if (p && this.room.save.actions.length === 0) {
      p.name = seat.name;
      this.current = replay(this.room.save.initial, this.room.save.actions);
    }
  }

  // ── game ───────────────────────────────────────────────────────────────

  /** Start: every seat must be taken; only the creator may start (US1-AS4). */
  start(by: SeatId): Result<Applied[]> {
    if (this.room.status !== 'lobby') return no('ROOM_STARTED', 'The game has already started');
    if (by !== this.room.creatorSeat) return no('NOT_CREATOR', 'Only the room creator can start');
    if (this.room.seats.some((s) => !s.tokenHash)) return no('SEATS_FREE', 'Every seat must be taken first');
    this.room.status = statusOf(this.current, false);
    this.touch();
    // A save that stopped right after the picks continues with the automatic setup.
    return ok(this.runAutoSetup());
  }

  private push(action: Action, by: Actor, state: GameState, roll = false): Applied {
    this.room.save.actions.push(action);
    this.room.actors.push(by);
    this.current = state;
    return { seq: this.seq, action, by, check: stateCheck(state), roll };
  }

  private runAutoSetup(): Applied[] {
    const out: Applied[] = [];
    for (const action of autoSetupActions(this.current)) {
      const r = apply(this.current, action);
      if (!r.ok) throw new Error(`Automatic setup failed at ${action.type}: ${r.error.message}`);
      out.push(this.push(action, 'server', r.state));
    }
    this.syncStatus();
    return out;
  }

  private notYours(): { ok: false; code: string; message: string } {
    return this.current.status !== 'setup' && this.current.pendingDecision
      ? no('NOT_YOUR_DECISION', 'Another player decides this')
      : no('NOT_YOUR_TURN', 'It is not your turn');
  }

  private gate(by: SeatId): { ok: false; code: string; message: string; rule?: string } | null {
    if (this.room.status === 'lobby') return no('NOT_STARTED', 'The game has not started');
    if (this.current.status === 'ended') return no('GAME_ENDED', 'The game has ended', 'Ending the Game');
    if (!this.seat(by)?.tokenHash) return no('NO_SEAT', 'You have no seat');
    if (!actorFor(this.room, this.current).has(by)) return this.notYours();
    return null;
  }

  /** Apply one action from a seat (G-1, G-2). The room does not change on failure. */
  act(by: SeatId, action: Action): Result<Applied[]> {
    if (NOT_ONLINE.has(action.type)) {
      return action.type === 'submitRoll'
        ? no('NOT_ALLOWED_ONLINE', 'The server rolls the die online: press Roll')
        : no('NOT_ALLOWED_ONLINE', 'Sandbox mode is not available online');
    }
    const blocked = this.gate(by);
    if (blocked) return blocked;
    let r;
    try {
      r = apply(this.current, action);
    } catch {
      return no('BAD_MESSAGE', 'That action is not valid');
    }
    if (!r.ok) return no(r.error.code, r.error.message, r.error.rule);
    const out = [this.push(action, by, r.state)];
    out.push(...this.runAutoSetup());
    this.syncStatus();
    this.touch();
    return ok(out);
  }

  /** The server rolls the d20 for the active seat (FR-020, FR-021, research R-05). */
  roll(by: SeatId): Result<Applied> {
    const blocked = this.gate(by);
    if (blocked) return blocked;
    if (this.current.status !== 'playing' || !awaitingRoll(this.current) || this.current.pendingDecision) {
      return no('NO_ROLL', 'There is nothing to roll for now', 'Lead');
    }
    const value = this.forcedRoll ?? this.deps.randomInt(1, 21);
    this.forcedRoll = null;
    const action: Action = { type: 'submitRoll', value };
    const r = apply(this.current, action);
    if (!r.ok) return no(r.error.code, r.error.message, r.error.rule);
    const applied = this.push(action, by, r.state, true);
    this.syncStatus();
    this.touch();
    return ok(applied);
  }

  /** Test mode only (the server checks ROSADA_TEST): the next roll uses this value. */
  forceNextRoll(value: number): void {
    this.forcedRoll = value;
  }

  /** True if `by` may undo now (FR-030): its own last action, within the 001 undo limits. */
  canUndoBy(by: SeatId): boolean {
    if (this.room.status !== 'playing' && this.room.status !== 'setup') return false;
    if (lastActor(this.room) !== by) return false;
    return undoLog(this.room.save.initial, this.room.save.actions) !== null;
  }

  /** Undo one step (FR-030): repeated calls go back through the seat's own turn to the last reveal. Everyone gets
   * the result, with who undid which action. */
  undo(by: SeatId): Result<{ seq: number; check: number; by: SeatId; action: Action }> {
    if (!this.canUndoBy(by)) return no('CANNOT_UNDO', 'You can only undo your own actions in your turn, back to the last reveal');
    const action = this.room.save.actions.pop()!;
    this.room.actors.pop();
    this.current = replay(this.room.save.initial, this.room.save.actions);
    this.syncStatus();
    this.touch();
    return ok({ seq: this.seq, check: stateCheck(this.current), by, action });
  }

  /** After a result: same seats, a new game from hero picking (US2-AS8). */
  rematch(by: SeatId): Result {
    if (this.room.status !== 'ended') return no('NOT_ENDED', 'The game has not ended');
    if (by !== this.room.creatorSeat) return no('NOT_CREATOR', 'Only the room creator can start a rematch');
    const setup = this.room.save.initial.setup;
    const players = setup.players.map((p) => ({ ...p }));
    this.room.save = toSaveFile(createSetup({ mode: setup.mode, playerCount: setup.playerCount, players }), [], this.deps.now());
    this.room.actors = [];
    this.current = this.room.save.initial;
    this.room.status = 'setup';
    this.touch();
    return ok(undefined);
  }

  // ── views and files ────────────────────────────────────────────────────

  view(you: SeatId | null): RoomView {
    const r = this.room;
    return {
      code: r.code, status: r.status, config: { ...r.config }, creatorSeat: r.creatorSeat, seq: this.seq, you,
      seats: r.seats.map((s) => ({ id: s.id, side: s.side, heroSlots: [...s.heroSlots], name: s.name, taken: !!s.tokenHash, connected: s.connected })),
    };
  }

  /** The room as saved on disk (G-4, G-7: no raw tokens, no connection state). */
  toFile(): RoomFile {
    const { seats, ...rest } = this.room;
    return {
      format: 'rosada-room', version: 1,
      room: JSON.parse(JSON.stringify({ ...rest, seats: seats.map(({ connected: _c, ...s }) => s) })),
    };
  }

  /** When the room may be removed (Q-56): 7 days after the last activity while playing, 24 hours otherwise. */
  expiresAt(): Date {
    const hours = this.room.status === 'playing' ? ONLINE.lifetimeHours.playing : ONLINE.lifetimeHours.other;
    return new Date(new Date(this.room.lastActiveAt).getTime() + hours * 3600_000);
  }
}
