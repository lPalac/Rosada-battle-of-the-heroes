// 005 US4: reconnect, release and room files (G-4, G-7, Q-55, Q-56).
import { describe, expect, it } from 'vitest';
import { stateCheck } from '../../src/online/check.ts';
import { RoomCore } from '../../src/online/room-core.ts';
import { seededRng } from '../helpers/rng.ts';
import { pickAll, randomStep, newRoom, seatAll, startedRoom, testDeps } from './helpers.ts';

describe('US4 reconnect and resume', () => {
  it('US4-AS1 a stored seat token finds its seat again', () => {
    const core = newRoom();
    const tokens = seatAll(core);
    for (const [seat, token] of Object.entries(tokens)) expect(core.seatForToken(token)).toBe(seat);
  });

  it('US4-AS2 the view shows who is away', () => {
    const core = newRoom({ playerCount: 2 });
    seatAll(core);
    core.setConnected('P1', true);
    expect(core.view('P1').seats.map((s) => s.connected)).toEqual([true, false]);
  });

  it('US4-AS3 the creator releases an away seat; a connected seat or a non-creator cannot', () => {
    const core = startedRoom();
    core.setConnected('P1', true);
    core.setConnected('P2', true);
    expect(core.release('P2', 'P3')).toMatchObject({ ok: false, code: 'NOT_CREATOR' });
    expect(core.release('P1', 'P2')).toMatchObject({ ok: false, code: 'SEAT_CONNECTED' });
    expect(core.release('P1', 'P3').ok).toBe(true);
    expect(core.canEnter()).toBe(true);
    expect(core.takeSeat('P3', 'Iva').ok).toBe(true);
    expect(core.takeSeat('P3', 'Eve')).toMatchObject({ ok: false, code: 'SEAT_TAKEN' });
  });

  it('US4-AS3 when the creator is away, any seated player may release a seat (also the creator’s)', () => {
    const core = startedRoom();
    core.setConnected('P2', true);
    expect(core.release('P2', 'P1').ok).toBe(true);
    expect(core.room.creatorSeat).toBe('P2');
  });

  it('US4-AS4 rooms are kept 7 days while playing and 24 hours otherwise (Q-56)', () => {
    const deps = testDeps();
    const lobby = newRoom({}, deps);
    expect(lobby.expiresAt().getTime() - deps.now().getTime()).toBe(24 * 3600_000);
    const playing = startedRoom({}, deps);
    pickAll(playing);
    expect(playing.expiresAt().getTime() - deps.now().getTime()).toBe(168 * 3600_000);
  });

  it('US4-AS5 a room file restores the same game, seats and seq; it holds no raw tokens', () => {
    const deps = testDeps('p');
    const core = startedRoom({}, deps);
    const tokens = Object.values(core.room.seats).map((s) => s.tokenHash);
    pickAll(core);
    const rng = seededRng('persist');
    for (let i = 0; i < 40; i++) if (!randomStep(core, rng)) break;
    core.setConnected('P1', true);
    const file = core.toFile();
    const text = JSON.stringify(file);
    expect(text).not.toContain('token-p-');
    const back = RoomCore.restore(JSON.parse(text), deps);
    expect(back.seq).toBe(core.seq);
    expect(stateCheck(back.state)).toBe(stateCheck(core.state));
    expect(back.room.seats.map((s) => s.tokenHash)).toEqual(tokens);
    expect(back.room.seats.every((s) => !s.connected)).toBe(true);
    expect(back.room.status).toBe(core.room.status);
  });

  it('a damaged room file is refused', () => {
    const core = startedRoom();
    const file = core.toFile();
    file.room.actors.push('P1');
    expect(() => RoomCore.restore(file, testDeps())).toThrow();
  });
});
