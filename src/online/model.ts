// 005 data-model.md: rooms and seats. Engine-free (constitution II): shared by the game server and the browser.
import type { SaveFile } from '../game/save.ts';
import type { Action, Side } from '../rules/index.ts';

export type SeatId = 'P1' | 'P2' | 'P3' | 'P4';
export type Actor = SeatId | 'server';
export type RoomStatus = 'lobby' | 'setup' | 'playing' | 'ended';

export interface RoomConfig {
  playerCount: 2 | 3 | 4;
  mode: 'draft' | 'mirror';
  /** 3 players only: the side with one seat (that seat controls both heroes). */
  singleSide: Side;
}

export interface Seat {
  /** Equals `Player.id` in `SetupChoices.players`, so `hero.playerId` names the seat. */
  id: SeatId;
  side: Side;
  /** Hero slots within the side this seat controls (0, 1); a single seat on a side has [0, 1]. */
  heroSlots: number[];
  /** Display name, 1–20 characters, trimmed, control characters removed; null = never taken. */
  name: string | null;
  /** SHA-256 (hex) of the seat token; null = free or released. */
  tokenHash: string | null;
  /** Live connection; never saved (always false after a restore). */
  connected: boolean;
}

export interface Room {
  code: string;
  createdAt: string;
  lastActiveAt: string;
  status: RoomStatus;
  config: RoomConfig;
  /** The seat the creator holds; it may start, rematch and release away seats (Q-55). */
  creatorSeat: SeatId | null;
  seats: Seat[];
  save: SaveFile;
  /** Who sent each action of `save.actions` (same length): needed for undo ownership (FR-030). */
  actors: Actor[];
  buildId: string;
  dataHash: string;
}

export interface SeatView {
  id: SeatId;
  side: Side;
  heroSlots: number[];
  name: string | null;
  taken: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  config: RoomConfig;
  creatorSeat: SeatId | null;
  seats: SeatView[];
  seq: number;
  you: SeatId | null;
}

export interface RoomFile {
  format: 'rosada-room';
  version: 1;
  room: Omit<Room, 'seats'> & { seats: Omit<Seat, 'connected'>[] };
}

/** One action the server accepted (contracts/protocol.md `applied`). */
export interface Applied {
  seq: number;
  action: Action;
  by: Actor;
  check: number;
  roll: boolean;
}

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string; rule?: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const no = (code: string, message: string, rule?: string): { ok: false; code: string; message: string; rule?: string } =>
  rule ? { ok: false, code, message, rule } : { ok: false, code, message };
