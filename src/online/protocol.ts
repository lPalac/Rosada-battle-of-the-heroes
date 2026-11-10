// 005 contracts/protocol.md: messages between the browser and the game server, with runtime guards.
// The server checks every incoming message here before RoomCore sees it (FR-062, research R-11).
import type { SaveFile } from '../game/save.ts';
import type { Action } from '../rules/index.ts';
import { ONLINE } from './limits.ts';
import type { Actor, RoomConfig, RoomView, SeatId } from './model.ts';

export const SEAT_IDS: readonly SeatId[] = ['P1', 'P2', 'P3', 'P4'];

export type ClientMessage =
  | { t: 'takeSeat'; seat: SeatId; name: string }
  | { t: 'leaveSeat' }
  | { t: 'start' }
  | { t: 'act'; action: Action; clientSeq: number }
  | { t: 'roll'; clientSeq: number }
  | { t: 'undo'; clientSeq: number }
  | { t: 'releaseSeat'; seat: SeatId }
  | { t: 'rematch' }
  | { t: 'resync' }
  | { t: 'forceNextRoll'; value: number };

export type ClientMessageType = ClientMessage['t'];

export interface SnapshotMessage {
  room: RoomView;
  save: SaveFile;
  seq: number;
  actors: Actor[];
  buildId: string;
}

export interface ServerMessages {
  snapshot: SnapshotMessage;
  room: RoomView;
  applied: { seq: number; action: Action; by: Actor; check: number; roll: boolean };
  undone: { seq: number; check: number };
  refused: { clientSeq: number | null; code: string; message: string; rule?: string };
  seatToken: { seat: SeatId; token: string };
}

/** Options for creating a room (`client.create('rosada', …)`). */
export interface CreateOptions {
  name: string;
  playerCount: 2 | 3 | 4;
  mode: 'draft' | 'mirror';
  singleSide?: 'light' | 'dark';
  seat?: SeatId;
  save?: SaveFile;
  buildId: string;
  dataHash: string;
}

/** Options for joining a room by code (`client.joinById(code, …)`). */
export interface JoinOptions {
  name?: string;
  seatToken?: string;
  buildId: string;
  dataHash: string;
}

export const JOIN_ERRORS = ['VERSION_MISMATCH', 'ROOM_NOT_FOUND', 'ROOM_FULL', 'ROOM_STARTED', 'RATE_LIMITED', 'BAD_SAVE', 'BAD_OPTIONS'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSeat = (v: unknown): v is SeatId => typeof v === 'string' && (SEAT_IDS as readonly string[]).includes(v);
const isSeq = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

/** JSON size in UTF-16 units, close enough to bytes for a limit (names are short). */
export function sizeOf(payload: unknown): number {
  try {
    return JSON.stringify(payload ?? null).length;
  } catch {
    return Infinity;
  }
}

/** Shape check of an action: an object with a known string `type`. Field checks are the rules core's job
 * (RoomCore catches anything `apply` throws). */
function isAction(v: unknown): v is Action {
  return isObj(v) && typeof v.type === 'string' && v.type.length > 0 && v.type.length < 40;
}

/** A client message, or null when it is malformed or too big (it is then dropped). */
export function parseClientMessage(type: unknown, payload: unknown): ClientMessage | null {
  if (typeof type !== 'string') return null;
  if (sizeOf(payload) > ONLINE.intentMaxBytes) return null;
  const p = payload === undefined ? {} : payload;
  if (!isObj(p)) return null;
  switch (type) {
    case 'takeSeat':
      return isSeat(p.seat) && typeof p.name === 'string' ? { t: 'takeSeat', seat: p.seat, name: p.name } : null;
    case 'leaveSeat':
    case 'start':
    case 'rematch':
    case 'resync':
      return { t: type };
    case 'act':
      return isAction(p.action) && isSeq(p.clientSeq) ? { t: 'act', action: p.action, clientSeq: p.clientSeq } : null;
    case 'roll':
    case 'undo':
      return isSeq(p.clientSeq) ? { t: type, clientSeq: p.clientSeq } : null;
    case 'releaseSeat':
      return isSeat(p.seat) ? { t: 'releaseSeat', seat: p.seat } : null;
    case 'forceNextRoll':
      return Number.isInteger(p.value) && (p.value as number) >= 1 && (p.value as number) <= 20
        ? { t: 'forceNextRoll', value: p.value as number } : null;
    default:
      return null;
  }
}

/** Room config from create options, or null if invalid. */
export function parseConfig(o: unknown): RoomConfig | null {
  if (!isObj(o)) return null;
  const { playerCount, mode, singleSide } = o;
  if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) return null;
  if (mode !== 'draft' && mode !== 'mirror') return null;
  if (singleSide !== undefined && singleSide !== 'light' && singleSide !== 'dark') return null;
  return { playerCount, mode, singleSide: (singleSide as 'light' | 'dark' | undefined) ?? 'light' };
}
