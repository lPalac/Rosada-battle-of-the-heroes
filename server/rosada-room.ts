// 005 T027: the Colyseus room, a thin adapter over the engine-free RoomCore (research R-06). Messages only, no
// Schema state: every client keeps its own copy of the game by applying the actions the server broadcasts.
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import type { SaveFile } from '../src/game/save.ts';
import { newRoomCode } from '../src/online/codes.ts';
import { ONLINE } from '../src/online/limits.ts';
import type { Applied, RoomFile, SeatId } from '../src/online/model.ts';
import { parseClientMessage, parseConfig, SEAT_IDS, type ClientMessage, type CreateOptions, type JoinOptions, type ServerMessages } from '../src/online/protocol.ts';
import { RoomCore, type RoomDeps } from '../src/online/room-core.ts';
import { CreationLimiter, RateLimiter } from './limits.ts';
import type { RoomStore } from './store.ts';

export interface ServerContext {
  store: RoomStore;
  deps: RoomDeps;
  buildId: string;
  dataHash: string;
  /** ROSADA_TEST=1: `forceNextRoll` works (e2e only). */
  testMode: boolean;
  creations: CreationLimiter;
  /** Per-connection message limit (online.json; raised in test mode, where scripts play fast). */
  messagesPerSecond: number;
  /** Loaded rooms by code. */
  rooms: Map<string, RosadaRoom>;
}

let context: ServerContext | null = null;

export function setServerContext(ctx: ServerContext): void {
  context = ctx;
}

function ctx(): ServerContext {
  if (!context) throw new Error('Server context not set');
  return context;
}

interface Data {
  seat: SeatId | null;
  limiter: RateLimiter;
  /** False while the connection is dropped and may come back. */
  live: boolean;
}

type CreateArgs = Partial<CreateOptions> & { restore?: string };
type JoinArgs = Partial<JoinOptions> & Partial<CreateOptions>;

const fail = (reason: string, message = reason): never => {
  throw new ServerError(4000, `${reason}: ${message}`);
};

export class RosadaRoom extends Room {
  maxClients = 12;
  core!: RoomCore;
  /** The first client to join a new room is its creator (takes `options.seat`). */
  private fresh = false;

  onCreate(options: CreateArgs): void {
    const c = ctx();
    this.autoDispose = false;
    if (options.restore) {
      const file = c.store.load(options.restore);
      if (!file) fail('ROOM_NOT_FOUND');
      this.core = RoomCore.restore(file as RoomFile, c.deps);
    } else {
      if (c.rooms.size >= ONLINE.maxRooms) fail('RATE_LIMITED', 'The server is full, try later');
      const config = parseConfig(options);
      if (!config) fail('BAD_OPTIONS', 'Choose 2, 3 or 4 players and Draft or Mirror');
      let code = newRoomCode(c.deps.randomInt);
      while (c.rooms.has(code) || c.store.load(code)) code = newRoomCode(c.deps.randomInt);
      try {
        this.core = RoomCore.create(code, config!, c.deps, { buildId: c.buildId, dataHash: c.dataHash }, options.save as SaveFile | undefined);
      } catch (e) {
        fail('BAD_SAVE', e instanceof Error ? e.message : 'The save file does not replay');
      }
      this.fresh = true;
      // A room nobody enters goes away with its seat reservation.
      this.autoDispose = true;
    }
    this.roomId = this.core.room.code;
    c.rooms.set(this.roomId, this);
    this.onMessage('*', (client, type, payload) => this.handle(client as Client<{ userData: Data }>, type, payload));
  }

  onAuth(_client: Client, options: JoinArgs, auth: AuthContext): { seat: SeatId | null } {
    const c = ctx();
    if (options?.buildId !== c.buildId || options?.dataHash !== c.dataHash) fail('VERSION_MISMATCH', 'A new version is available: reload');
    if (this.fresh) {
      if (!c.creations.allow(auth.ip, Date.now())) fail('RATE_LIMITED', 'Too many new rooms from this address, try later');
      return { seat: null };
    }
    const seat = this.core.seatForToken(options?.seatToken);
    if (seat) return { seat };
    if (!this.core.canEnter()) fail(this.core.room.status === 'lobby' ? 'ROOM_FULL' : 'ROOM_STARTED', 'This room has no free seat');
    return { seat: null };
  }

  onJoin(client: Client, options: JoinArgs, auth: { seat: SeatId | null }): void {
    const data: Data = { seat: auth?.seat ?? null, limiter: new RateLimiter(ctx().messagesPerSecond), live: true };
    client.userData = data;
    if (this.fresh) {
      this.fresh = false;
      this.autoDispose = false;
      const wanted = SEAT_IDS.includes(options.seat as SeatId) ? (options.seat as SeatId) : this.core.freeSeats()[0];
      const r = this.core.takeSeat(wanted, options.name);
      if (!r.ok) {
        // Bad name: the creator can still pick a seat from the lobby.
        this.refuse(client, null, r);
      } else {
        data.seat = wanted;
        client.send('seatToken', { seat: wanted, token: r.value.token } satisfies ServerMessages['seatToken']);
      }
    }
    this.persist();
    this.syncConnections();
    this.sendSnapshot(client);
    this.sendRooms();
  }

  async onDrop(client: Client): Promise<void> {
    (client.userData as Data).live = false;
    this.syncConnections(client);
    this.sendRooms();
    try {
      await this.allowReconnection(client, ONLINE.reconnectionSeconds);
    } catch {
      /* gave up: onLeave follows */
    }
  }

  onReconnect(client: Client): void {
    (client.userData as Data).live = true;
    this.syncConnections();
    this.sendSnapshot(client);
    this.sendRooms();
  }

  onLeave(client: Client): void {
    this.syncConnections(client);
    this.sendRooms();
  }

  onDispose(): void {
    const c = ctx();
    if (c.rooms.get(this.roomId) === this) c.rooms.delete(this.roomId);
  }

  // ── messages ────────────────────────────────────────────────────────────

  private handle(client: Client<{ userData: Data }>, type: string | number, payload: unknown): void {
    const data = client.userData as Data;
    const verdict = data.limiter.hit(Date.now());
    if (verdict === 'kick') return client.leave(4008);
    if (verdict === 'drop') return;
    const msg = parseClientMessage(type, payload);
    if (!msg) return this.refuse(client, null, { code: 'BAD_MESSAGE', message: 'That message is not valid' });
    this.dispatch(client, data, msg);
  }

  private dispatch(client: Client, data: Data, msg: ClientMessage): void {
    const seat = data.seat;
    const seqOf = 'clientSeq' in msg ? msg.clientSeq : null;
    if (msg.t === 'resync') return this.sendSnapshot(client);
    if (msg.t === 'takeSeat') {
      const r = this.core.takeSeat(msg.seat, msg.name, seat);
      if (!r.ok) return this.refuse(client, null, r);
      data.seat = msg.seat;
      client.send('seatToken', { seat: msg.seat, token: r.value.token } satisfies ServerMessages['seatToken']);
      return this.changed();
    }
    if (!seat) return this.refuse(client, seqOf, { code: 'NO_SEAT', message: 'Take a seat first' });
    switch (msg.t) {
      case 'leaveSeat': {
        const r = this.core.leaveSeat(seat);
        if (!r.ok) return this.refuse(client, null, r);
        data.seat = null;
        return this.changed();
      }
      case 'start': {
        const r = this.core.start(seat);
        if (!r.ok) return this.refuse(client, null, r);
        this.persist();
        // Seat names went into the starting state in the lobby: everyone gets the final one (and any auto setup).
        for (const c of this.clients) this.sendSnapshot(c);
        return;
      }
      case 'act': {
        const r = this.core.act(seat, msg.action);
        if (!r.ok) return this.refuse(client, msg.clientSeq, r);
        this.persist();
        this.broadcastApplied(r.value);
        return this.sendRooms();
      }
      case 'roll': {
        const r = this.core.roll(seat);
        if (!r.ok) return this.refuse(client, msg.clientSeq, r);
        this.persist();
        this.broadcastApplied([r.value]);
        return this.sendRooms();
      }
      case 'undo': {
        const r = this.core.undo(seat);
        if (!r.ok) return this.refuse(client, msg.clientSeq, r);
        this.persist();
        this.broadcast('undone', r.value satisfies ServerMessages['undone']);
        return this.sendRooms();
      }
      case 'releaseSeat': {
        const r = this.core.release(seat, msg.seat);
        if (!r.ok) return this.refuse(client, null, r);
        return this.changed();
      }
      case 'rematch': {
        const r = this.core.rematch(seat);
        if (!r.ok) return this.refuse(client, null, r);
        this.persist();
        for (const c of this.clients) this.sendSnapshot(c);
        return;
      }
      case 'forceNextRoll':
        if (!ctx().testMode) return this.refuse(client, null, { code: 'NOT_ALLOWED', message: 'Only in test mode' });
        this.core.forceNextRoll(msg.value);
        return;
    }
  }

  // ── sending ─────────────────────────────────────────────────────────────

  private refuse(client: Client, clientSeq: number | null, r: { code: string; message: string; rule?: string }): void {
    client.send('refused', { clientSeq, code: r.code, message: r.message, ...(r.rule ? { rule: r.rule } : {}) } satisfies ServerMessages['refused']);
  }

  private broadcastApplied(list: Applied[]): void {
    for (const a of list) this.broadcast('applied', a satisfies ServerMessages['applied']);
  }

  private sendSnapshot(client: Client): void {
    const data = client.userData as Data | undefined;
    client.send('snapshot', {
      room: this.core.view(data?.seat ?? null), save: this.core.room.save, seq: this.core.seq,
      actors: this.core.room.actors, buildId: ctx().buildId,
    } satisfies ServerMessages['snapshot']);
  }

  /** The room view is personal (`you`), so it goes to each client separately. */
  private sendRooms(): void {
    for (const c of this.clients) c.send('room', this.core.view((c.userData as Data | undefined)?.seat ?? null) satisfies ServerMessages['room']);
  }

  private changed(): void {
    this.persist();
    this.syncConnections();
    this.sendRooms();
  }

  /** A seat is connected while any of its clients is (`gone` is a client that just dropped or left). */
  private syncConnections(gone?: Client): void {
    for (const s of this.core.room.seats) {
      const on = this.clients.some((c) => {
        const d = c.userData as Data | undefined;
        return c !== gone && d?.live === true && d.seat === s.id;
      });
      this.core.setConnected(s.id, on);
    }
  }

  persist(): void {
    ctx().store.save(this.core.toFile());
  }
}
