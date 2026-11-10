// 005 T032: the browser's connection to the game server (Colyseus SDK). Works in Node too (server tests).
import { Client, type EndpointSettings, type Room } from '@colyseus/sdk';
import type { ClientMessage, CreateOptions, JoinOptions, ServerMessages } from '../online/protocol.ts';

export type ServerMessageType = keyof ServerMessages;

/** One joined room: typed send and subscriptions. */
export interface RoomConnection {
  readonly code: string;
  send(msg: ClientMessage): void;
  on<K extends ServerMessageType>(type: K, fn: (payload: ServerMessages[K]) => void): () => void;
  onStatus(fn: (status: 'connected' | 'reconnecting' | 'closed') => void): () => void;
  leave(): Promise<void>;
}

/** Join and create errors carry a reason (contracts/protocol.md JOIN_ERRORS). */
export class JoinError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message);
  }
}

/** Same-origin `/ws` in the browser (Vite proxy in development, nginx in production). */
export function browserEndpoint(loc: { protocol: string; hostname: string; port: string }): EndpointSettings {
  const secure = loc.protocol === 'https:';
  const port = loc.port ? Number(loc.port) : secure ? 443 : 80;
  return { hostname: loc.hostname, port, secure, pathname: '/ws' };
}

function wrap(room: Room): RoomConnection {
  const statusFns = new Set<(s: 'connected' | 'reconnecting' | 'closed') => void>();
  const emit = (s: 'connected' | 'reconnecting' | 'closed') => statusFns.forEach((f) => f(s));
  room.onDrop(() => emit('reconnecting'));
  room.onReconnect(() => emit('connected'));
  room.onLeave(() => emit('closed'));
  return {
    code: room.roomId,
    send: (msg) => {
      const { t, ...payload } = msg;
      room.send(t, payload);
    },
    on: (type, fn) => room.onMessage(type, fn as (p: unknown) => void),
    onStatus: (fn) => {
      statusFns.add(fn);
      return () => statusFns.delete(fn);
    },
    leave: async () => {
      await room.leave(true);
    },
  };
}

function joinError(e: unknown): JoinError {
  const text = e instanceof Error ? e.message : String(e);
  const m = /^([A-Z_]+): (.*)$/s.exec(text);
  if (m) return new JoinError(m[1], m[2]);
  if (/not found/i.test(text)) return new JoinError('ROOM_NOT_FOUND', 'There is no room with that code');
  return new JoinError('SERVER_UNAVAILABLE', 'The game server is not available');
}

export class GameServer {
  private readonly client: Client;

  constructor(endpoint: string | EndpointSettings) {
    this.client = new Client(endpoint);
  }

  async create(options: CreateOptions): Promise<RoomConnection> {
    try {
      return wrap(await this.client.create('rosada', options));
    } catch (e) {
      throw joinError(e);
    }
  }

  async join(code: string, options: JoinOptions): Promise<RoomConnection> {
    try {
      return wrap(await this.client.joinById(code, options));
    } catch (e) {
      throw joinError(e);
    }
  }
}
