// 005 US1 over the wire: create, join by code, seats, start, version check.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JoinError } from '../../src/net/client.ts';
import { create, join, sit, testServer, until, type TestServer } from './harness.ts';

let srv: TestServer;
beforeAll(async () => {
  srv = await testServer();
});
afterAll(async () => {
  await srv.close();
});

describe('US1 rooms on the server', () => {
  it('US1-AS1…AS4 four players create, join by code, sit and start', async () => {
    const a = await create(srv.url, { playerCount: 4, name: 'Luka' });
    const code = a.conn.code;
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/);
    expect(a.session.mySeat).toBe('P1');
    expect(a.tokens).toHaveLength(1);
    const others = await Promise.all([join(srv.url, code), join(srv.url, code), join(srv.url, code)]);
    await sit(others[0], 'P2', 'Ana');
    await sit(others[1], 'P3', 'Iva');
    await sit(others[2], 'P4', 'Marko');
    for (const p of [a, ...others]) {
      await until(() => p.session.room!.seats.every((s) => s.taken && s.connected), 5000, 'all seats');
      expect(p.session.room!.seats.map((s) => s.name)).toEqual(['Luka', 'Ana', 'Iva', 'Marko']);
    }
    others[0].session.start(); // not the creator
    await until(() => others[0].refused.length > 0);
    expect(others[0].refused[0].code).toBe('NOT_CREATOR');
    a.session.start();
    for (const p of [a, ...others]) await until(() => p.session.room!.status === 'setup', 5000, 'setup');
    for (const p of [a, ...others]) await p.conn.leave();
  });

  it('US1-AS5 unknown code, full room and old version are refused with a reason', async () => {
    await expect(join(srv.url, 'ZZZZZZZ')).rejects.toMatchObject({ reason: 'ROOM_NOT_FOUND' });
    const a = await create(srv.url, { playerCount: 2 });
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    const err = await join(srv.url, a.conn.code).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JoinError);
    expect((err as JoinError).reason).toBe('ROOM_FULL');
    await expect(join(srv.url, a.conn.code, { buildId: 'old' })).rejects.toMatchObject({ reason: 'VERSION_MISMATCH' });
    await a.conn.leave();
    await b.conn.leave();
  });

  it('US1-AS6 leaving a seat in the lobby shows to the others', async () => {
    const a = await create(srv.url, { playerCount: 3, singleSide: 'dark' });
    expect(a.session.room!.seats.map((s) => [s.side, s.heroSlots])).toEqual([['light', [0]], ['dark', [0, 1]], ['light', [1]]]);
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    await until(() => a.session.room!.seats[1].taken);
    b.session.leaveSeat();
    await until(() => !a.session.room!.seats[1].taken, 5000, 'seat freed');
    await a.conn.leave();
    await b.conn.leave();
  });

  it('GET /api/health reports the build and room count', async () => {
    const res = await fetch(`${srv.url}/api/health`);
    const body = (await res.json()) as { ok: boolean; buildId: string; rooms: number };
    expect(body.ok).toBe(true);
    expect(body.buildId).toBe(srv.context.buildId);
    expect(body.rooms).toBeGreaterThan(0);
  });
});
