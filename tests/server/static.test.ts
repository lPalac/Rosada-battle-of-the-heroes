// 005 T061 / FR-074: one Node process serves the site, /ws and /api (the Render test deployment, research R-14).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../../server/index.ts';
import { GameServer } from '../../src/net/client.ts';
import { OnlineSession } from '../../src/net/online-session.ts';
import { VERSION } from './harness.ts';

let srv: RunningServer;
let site: string;
let rooms: string;

/** Raw GET (fetch would normalise `..` away). */
function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: srv.port, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  site = mkdtempSync(join(tmpdir(), 'rosada-site-'));
  rooms = mkdtempSync(join(tmpdir(), 'rosada-rooms-'));
  mkdirSync(join(site, 'assets'));
  writeFileSync(join(site, 'index.html'), '<!doctype html><title>Rošada</title>');
  writeFileSync(join(site, 'assets', 'main-abc123.js'), 'console.log("game");'.repeat(50));
  writeFileSync(join(tmpdir(), 'rosada-secret.txt'), 'secret');
  srv = await startServer({ port: 0, roomsDir: rooms, staticDir: site, log: () => {} });
});

afterAll(async () => {
  await srv.stop();
  rmSync(site, { recursive: true, force: true });
  rmSync(rooms, { recursive: true, force: true });
});

describe('FR-074 the game server serves the site', () => {
  it('serves index.html (no-cache) and hashed assets (cached for a year, gzip)', async () => {
    const index = await get('/');
    expect(index.status).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.body.toString()).toContain('Rošada');
    const js = await get('/assets/main-abc123.js', { 'accept-encoding': 'gzip' });
    expect(js.status).toBe(200);
    expect(js.headers['cache-control']).toContain('immutable');
    expect(js.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(js.body).toString()).toContain('console.log');
  });

  it('falls back to index.html for app routes, 404 for missing files, never leaves the site folder', async () => {
    expect((await get('/some/route')).body.toString()).toContain('Rošada');
    expect((await get('/missing.png')).status).toBe(404);
    expect((await get('/../rosada-secret.txt')).body.toString()).not.toContain('secret');
    expect((await get('/%2e%2e/rosada-secret.txt')).body.toString()).not.toContain('secret');
  });

  it('still answers /api/health and rooms under /ws on the same port', async () => {
    const health = await get('/api/health');
    expect(JSON.parse(health.body.toString())).toMatchObject({ ok: true });
    const conn = await new GameServer({ hostname: '127.0.0.1', port: srv.port, secure: false, pathname: '/ws' })
      .create({ name: 'Luka', playerCount: 2, mode: 'draft', ...VERSION });
    const session = new OnlineSession(conn);
    await session.ready();
    expect(session.mySeat).toBe('P1');
    await conn.leave();
  });
});
