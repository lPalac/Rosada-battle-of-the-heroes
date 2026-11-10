// 005 server tests: a real game server on a random port, with clients built from the browser code (src/net).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { startServer, type RunningServer } from '../../server/index.ts';
import { GameServer, type RoomConnection } from '../../src/net/client.ts';
import { OnlineSession } from '../../src/net/online-session.ts';
import type { SeatId } from '../../src/online/model.ts';
import { BUILD_ID, dataHash } from '../../src/online/version.ts';
import type { CreateOptions, ServerMessages } from '../../src/online/protocol.ts';

export const VERSION = { buildId: BUILD_ID, dataHash: dataHash() };

export interface TestServer extends RunningServer {
  dir: string;
  url: string;
  close(keepDir?: boolean): Promise<void>;
}

export async function testServer(dir = mkdtempSync(joinPath(tmpdir(), 'rosada-rooms-'))): Promise<TestServer> {
  const running = await startServer({ port: 0, roomsDir: dir, testMode: true, log: () => {} });
  return {
    ...running,
    dir,
    url: `http://127.0.0.1:${running.port}`,
    close: async (keepDir = false) => {
      await running.stop();
      if (!keepDir) rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface Player {
  conn: RoomConnection;
  session: OnlineSession;
  tokens: ServerMessages['seatToken'][];
  refused: ServerMessages['refused'][];
}

function player(conn: RoomConnection): Player {
  const session = new OnlineSession(conn);
  const p: Player = { conn, session, tokens: [], refused: [] };
  session.onSeatToken((t) => p.tokens.push(t));
  session.onRefused((r) => p.refused.push(r));
  return p;
}

export async function create(url: string, opts: Partial<CreateOptions> = {}): Promise<Player> {
  const conn = await new GameServer(url).create({ name: 'Luka', playerCount: 2, mode: 'draft', ...VERSION, ...opts });
  const p = player(conn);
  await p.session.ready();
  return p;
}

export async function join(url: string, code: string, opts: { name?: string; seatToken?: string; buildId?: string } = {}): Promise<Player> {
  const conn = await new GameServer(url).join(code, { ...VERSION, ...opts });
  const p = player(conn);
  await p.session.ready();
  return p;
}

/** Wait until a condition holds (messages arrive asynchronously). */
export async function until(fn: () => boolean, ms = 5000, what = 'condition'): Promise<void> {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Take a seat and wait for its token. */
export async function sit(p: Player, seat: SeatId, name: string): Promise<void> {
  const n = p.tokens.length;
  p.session.takeSeat(seat, name);
  await until(() => p.tokens.length > n && p.session.mySeat === seat, 5000, `seat ${seat}`);
}
