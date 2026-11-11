// 005 US4 over the wire: rejoin with a seat token, and rooms surviving a server restart (FR-040, FR-044).
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoomStore } from '../../server/store.ts';
import { stateCheck } from '../../src/online/check.ts';
import { create, join, sit, testServer, until } from './harness.ts';

describe('US4 reconnect and resume', () => {
  it('room files are written atomically and read back', () => {
    const dir = mkdtempSync(joinPath(tmpdir(), 'rosada-store-'));
    const store = new RoomStore(dir);
    const file = { format: 'rosada-room', version: 1, room: { code: 'ABCDEFG' } } as never;
    store.save(file);
    expect(readdirSync(dir)).toEqual(['ABCDEFG.json']);
    expect(store.load('ABCDEFG')).toEqual(file);
    expect(store.codes()).toEqual(['ABCDEFG']);
    expect(() => store.load('../etc')).not.toThrow();
    expect(store.load('../etc')).toBeNull();
    store.delete('ABCDEFG');
    expect(store.codes()).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('US4-AS1 / US4-AS2 a player who leaves is shown away and comes back to the seat with the token', async () => {
    const srv = await testServer();
    const a = await create(srv.url, { playerCount: 2 });
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    const token = b.tokens[0].token;
    await until(() => a.session.room!.seats[1].connected);
    await b.conn.leave();
    await until(() => !a.session.room!.seats[1].connected, 5000, 'away');
    const back = await join(srv.url, a.conn.code, { seatToken: token });
    expect(back.session.mySeat).toBe('P2');
    await until(() => a.session.room!.seats[1].connected, 5000, 'back');
    // Without the token the full room stays closed.
    await expect(join(srv.url, a.conn.code)).rejects.toMatchObject({ reason: 'ROOM_FULL' });
    await a.conn.leave();
    await back.conn.leave();
    await srv.close();
  });

  it('US4-AS3 the creator releases an away seat and someone new takes it', async () => {
    const srv = await testServer();
    const a = await create(srv.url, { playerCount: 2 });
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    a.session.start();
    await until(() => a.session.room!.status === 'setup');
    await b.conn.leave();
    await until(() => !a.session.room!.seats[1].connected);
    await expect(join(srv.url, a.conn.code)).rejects.toMatchObject({ reason: 'ROOM_STARTED' });
    a.session.release('P2');
    await until(() => !a.session.room!.seats[1].taken, 5000, 'released');
    const c = await join(srv.url, a.conn.code);
    await sit(c, 'P2', 'Iva');
    expect(c.session.room!.seats[1].name).toBe('Iva');
    await a.conn.leave();
    await c.conn.leave();
    await srv.close();
  });

  it('US4-AS5 rooms in progress come back after a server restart', async () => {
    const srv = await testServer();
    const a = await create(srv.url, { playerCount: 2, name: 'Luka' });
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    a.session.start();
    await until(() => a.session.room!.status === 'setup');
    a.session.dispatch({ type: 'pickHero', side: 'light', heroDefinitionId: 'monk' });
    await until(() => b.session.seq === 1);
    const code = a.conn.code;
    const tokens = { a: a.tokens[0].token, b: b.tokens[0].token };
    const check = stateCheck(b.session.state);
    const fileText = readFileSync(joinPath(srv.dir, `${code}.json`), 'utf8');
    expect(fileText).not.toContain(tokens.a);
    await srv.close(true);

    const again = await testServer(srv.dir);
    const a2 = await join(again.url, code, { seatToken: tokens.a });
    const b2 = await join(again.url, code, { seatToken: tokens.b });
    expect([a2.session.mySeat, b2.session.mySeat]).toEqual(['P1', 'P2']);
    expect(a2.session.seq).toBe(1);
    expect(stateCheck(a2.session.state)).toBe(check);
    b2.session.dispatch({ type: 'pickHero', side: 'dark', heroDefinitionId: 'scout' });
    await until(() => a2.session.seq === 2, 5000, 'play continues');
    await a2.conn.leave();
    await b2.conn.leave();
    await again.close();
  }, 30_000);

  it('006 R-04: a room file that no longer replays is skipped at start and the server keeps running', async () => {
    const srv = await testServer();
    const a = await create(srv.url, { playerCount: 2 });
    const b = await join(srv.url, a.conn.code);
    await sit(b, 'P2', 'Ana');
    a.session.start();
    await until(() => a.session.room!.status === 'setup');
    a.session.dispatch({ type: 'pickHero', side: 'light', heroDefinitionId: 'monk' });
    await until(() => b.session.seq === 1);
    const code = a.conn.code;
    const token = a.tokens[0].token;
    await srv.close(true);
    // A log made under other rules: the next action is not legal any more.
    const path = joinPath(srv.dir, `${code}.json`);
    const file = JSON.parse(readFileSync(path, 'utf8'));
    file.room.save.actions.push({ type: 'pickHero', side: 'light', heroDefinitionId: 'monk' });
    file.room.actors.push('P1');
    writeFileSync(path, JSON.stringify(file));

    const again = await testServer(srv.dir);
    const health = await (await fetch(`${again.url.replace(/^ws/, 'http')}/api/health`)).json();
    expect(health).toMatchObject({ ok: true, rooms: 0 });
    await expect(join(again.url, code, { seatToken: token })).rejects.toBeTruthy();
    await again.close();
  }, 30_000);
});
