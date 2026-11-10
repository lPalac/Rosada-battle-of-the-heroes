// 005 T028: the Rošada game server. Colyseus over WebSockets plus GET /api/health; rooms are restored from their
// files on start (FR-044) and removed once expired (Q-56). Run: `npm run dev:server` (tsx) or `node dist-server/index.js`.
import http from 'node:http';
import { createEndpoint, createRouter, matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ONLINE } from '../src/online/limits.ts';
import { BUILD_ID, dataHash } from '../src/online/version.ts';
import { serverDeps } from './deps.ts';
import { CreationLimiter } from './limits.ts';
import { RosadaRoom, setServerContext, type ServerContext } from './rosada-room.ts';
import { RoomStore } from './store.ts';

export interface StartOptions {
  port: number;
  host?: string;
  roomsDir: string;
  testMode?: boolean;
  /** Override the build id (tests use it to check the version refusal). */
  buildId?: string;
  log?: (msg: string) => void;
}

export interface RunningServer {
  port: number;
  context: ServerContext;
  stop(): Promise<void>;
}

const HOUR = 3600_000;

export async function startServer(opts: StartOptions): Promise<RunningServer> {
  const log = opts.log ?? ((m: string) => console.log(`[rosada] ${m}`));
  const context: ServerContext = {
    store: new RoomStore(opts.roomsDir),
    deps: serverDeps,
    buildId: opts.buildId ?? BUILD_ID,
    dataHash: dataHash(),
    testMode: !!opts.testMode,
    creations: new CreationLimiter(opts.testMode ? 10_000 : ONLINE.createsPerIpPerHour),
    messagesPerSecond: opts.testMode ? 10_000 : ONLINE.messagesPerSecond,
    rooms: new Map(),
  };
  setServerContext(context);

  const httpServer = http.createServer();
  const server = new Server({
    transport: new WebSocketTransport({ server: httpServer, maxPayload: ONLINE.maxPayloadBytes }),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define('rosada', RosadaRoom);
  server.router = createRouter({
    health: createEndpoint('/api/health', { method: 'GET' }, async () => ({
      ok: true, buildId: context.buildId, rooms: context.rooms.size,
    })),
  });
  await server.listen(opts.port, opts.host ?? '127.0.0.1');
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;

  // Restore rooms from disk (FR-044). Expired or damaged files are removed / skipped.
  const now = Date.now();
  for (const code of context.store.codes()) {
    try {
      const file = context.store.load(code);
      if (!file) continue;
      await matchMaker.createRoom('rosada', { restore: code });
      const room = context.rooms.get(code);
      if (room && room.core.expiresAt().getTime() < now) {
        context.rooms.delete(code);
        await room.disconnect();
        context.store.delete(code);
      }
    } catch (e) {
      log(`room ${code} not restored: ${e instanceof Error ? e.message : e}`);
    }
  }
  log(`listening on ${opts.host ?? '127.0.0.1'}:${port}, ${context.rooms.size} rooms restored, build ${context.buildId}`);

  // Hourly cleanup (Q-56): a room past its lifetime with nobody connected goes away with its file.
  const timer = setInterval(() => void cleanup(context, log), HOUR);
  timer.unref();

  return {
    port,
    context,
    stop: async () => {
      clearInterval(timer);
      for (const room of [...context.rooms.values()]) room.persist();
      await server.gracefullyShutdown(false);
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

export async function cleanup(context: ServerContext, log: (m: string) => void, now = Date.now()): Promise<number> {
  let removed = 0;
  for (const [code, room] of [...context.rooms]) {
    if (room.core.expiresAt().getTime() >= now || room.core.room.seats.some((s) => s.connected)) continue;
    context.rooms.delete(code);
    await room.disconnect();
    context.store.delete(code);
    removed++;
  }
  if (removed) log(`removed ${removed} expired rooms`);
  return removed;
}

// Started directly (not imported by tests).
const isMain = process.argv[1] && /server[\\/]index\.(ts|js)$|dist-server[\\/]index\.js$/.test(process.argv[1]);
if (isMain) {
  const running = await startServer({
    port: Number(process.env.PORT ?? 2567),
    host: process.env.HOST ?? '127.0.0.1',
    roomsDir: process.env.ROSADA_ROOMS_DIR ?? '.rooms',
    testMode: process.env.ROSADA_TEST === '1',
  });
  const stop = () => void running.stop().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
