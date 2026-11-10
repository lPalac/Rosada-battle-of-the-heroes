// 005 US1: create and join a room (RoomCore, no network).
import { describe, expect, it } from 'vitest';
import { RoomCore } from '../../src/online/room-core.ts';
import { IDS, newRoom, seatAll, testDeps } from './helpers.ts';

describe('US1 lobby', () => {
  it('US1-AS1 a 4-player Draft room has 4 seats; the creator takes one and gets a token once', () => {
    const core = newRoom();
    expect(core.room.status).toBe('lobby');
    expect(core.room.seats.map((s) => [s.id, s.side, s.heroSlots])).toEqual([
      ['P1', 'light', [0]], ['P2', 'dark', [0]], ['P3', 'light', [1]], ['P4', 'dark', [1]],
    ]);
    const r = core.takeSeat('P1', 'Luka');
    expect(r.ok).toBe(true);
    expect(core.room.creatorSeat).toBe('P1');
    if (r.ok) {
      expect(core.seat('P1')!.tokenHash).not.toBe(r.value.token); // stored hashed only
      expect(core.seatForToken(r.value.token)).toBe('P1');
    }
    expect(core.state.setup.players[0].name).toBe('Luka');
  });

  it('US1-AS2 a second player sees the seats and takes a free one; a taken seat is refused', () => {
    const core = newRoom();
    core.takeSeat('P1', 'Luka');
    const view = core.view(null);
    expect(view.seats.filter((s) => !s.taken).map((s) => s.id)).toEqual(['P2', 'P3', 'P4']);
    expect(core.takeSeat('P1', 'Ana')).toMatchObject({ ok: false, code: 'SEAT_TAKEN' });
    expect(core.takeSeat('P2', 'Ana').ok).toBe(true);
    expect(core.takeSeat('P3', '   ')).toMatchObject({ ok: false, code: 'BAD_NAME' });
  });

  it('US1-AS3 a 3-player room: the single side has one seat with both heroes', () => {
    const light = newRoom({ playerCount: 3, singleSide: 'light' });
    expect(light.room.seats.map((s) => [s.side, s.heroSlots])).toEqual([['light', [0, 1]], ['dark', [0]], ['dark', [1]]]);
    const dark = newRoom({ playerCount: 3, singleSide: 'dark' });
    expect(dark.room.seats.map((s) => [s.side, s.heroSlots])).toEqual([['light', [0]], ['dark', [0, 1]], ['light', [1]]]);
  });

  it('US1-AS4 only the creator starts, and only when every seat is taken', () => {
    const core = newRoom({ playerCount: 2 });
    core.takeSeat('P1', 'Luka');
    expect(core.start('P1')).toMatchObject({ ok: false, code: 'SEATS_FREE' });
    core.takeSeat('P2', 'Ana');
    expect(core.start('P2')).toMatchObject({ ok: false, code: 'NOT_CREATOR' });
    expect(core.start('P1').ok).toBe(true);
    expect(core.room.status).toBe('setup');
  });

  it('US1-AS5 a full or started room lets nobody in without a seat token', () => {
    const core = newRoom({ playerCount: 2 });
    seatAll(core);
    expect(core.canEnter()).toBe(false);
    core.start('P1');
    expect(core.canEnter()).toBe(false);
    expect(core.takeSeat('P2', 'Eve')).toMatchObject({ ok: false, code: 'SEAT_TAKEN' });
    expect(core.seatForToken('not-a-real-token-xxxxxxxx')).toBeNull();
  });

  it('US1-AS6 changing and leaving seats before start frees the old seat', () => {
    const core = newRoom();
    core.takeSeat('P1', 'Luka');
    expect(core.takeSeat('P3', 'Luka', 'P1').ok).toBe(true);
    expect(core.seat('P1')!.tokenHash).toBeNull();
    expect(core.room.creatorSeat).toBe('P3');
    core.takeSeat('P2', 'Ana');
    expect(core.leaveSeat('P2').ok).toBe(true);
    expect(core.view(null).seats.find((s) => s.id === 'P2')!.taken).toBe(false);
    core.takeSeat('P1', 'Iva');
    core.takeSeat('P2', 'Ana');
    core.takeSeat('P4', 'Marko');
    expect(core.start('P3').ok).toBe(true);
    expect(core.leaveSeat('P2')).toMatchObject({ ok: false, code: 'ROOM_STARTED' });
  });

  it('a save in sandbox mode cannot become an online room (FR-017)', () => {
    const core = newRoom({ playerCount: 2 });
    const save = { ...core.room.save, initial: { ...core.room.save.initial, enforcement: 'sandbox' as const } };
    expect(() => RoomCore.create('BBBBBBB', core.room.config, testDeps(), IDS, save)).toThrow(/sandbox/);
  });
});
