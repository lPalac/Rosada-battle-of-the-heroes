// 005 US6: online games as 001 save files.
import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '../../src/game/save.ts';
import { stateCheck } from '../../src/online/check.ts';
import { RoomCore } from '../../src/online/room-core.ts';
import { seededRng } from '../helpers/rng.ts';
import { IDS, pickAll, randomStep, seatAll, startedRoom, testDeps } from './helpers.ts';

describe('US6 saves', () => {
  it('US6-AS1 the room’s game is a normal save file that loads in hot-seat', () => {
    const core = startedRoom();
    pickAll(core);
    const rng = seededRng('save');
    for (let i = 0; i < 30; i++) if (!randomStep(core, rng)) break;
    const save = parseSaveFile(JSON.stringify(core.room.save));
    expect(save.actions.length).toBe(core.seq);
  });

  it('US6-AS2 a room from a save has that game’s seats and continues at its position', () => {
    const core = startedRoom({ playerCount: 3, singleSide: 'dark' });
    pickAll(core);
    const rng = seededRng('save2');
    for (let i = 0; i < 20; i++) if (!randomStep(core, rng)) break;
    const next = RoomCore.create('DDDDDDD', { playerCount: 2, mode: 'draft', singleSide: 'light' }, testDeps('n'), IDS, core.room.save);
    expect(next.room.config).toEqual({ playerCount: 3, mode: 'draft', singleSide: 'dark' });
    expect(next.room.seats.map((s) => [s.id, s.side, s.heroSlots])).toEqual(core.room.seats.map((s) => [s.id, s.side, s.heroSlots]));
    seatAll(next);
    expect(next.start(next.room.creatorSeat!).ok).toBe(true);
    expect(next.room.status).toBe('playing');
    expect(stateCheck(next.state)).toBe(stateCheck(core.state));
    expect(randomStep(next, rng)).toBe(true); // play goes on from the saved position
  });

  it('US6-AS2 a save that stopped right after the picks continues with the automatic setup', () => {
    const core = startedRoom({ playerCount: 2 });
    const heroes = ['cavalier', 'monk', 'scout', 'magus'];
    const order = ['light', 'dark', 'dark', 'light'] as const;
    // Hot-seat style: the picks only.
    for (let i = 0; i < 4; i++) {
      const save = core.room.save;
      save.actions.push({ type: 'pickHero', side: order[i], heroDefinitionId: heroes[i] });
      core.room.actors.push('server');
    }
    const next = RoomCore.create('EEEEEEE', core.room.config, testDeps('m'), IDS, core.room.save);
    seatAll(next);
    const r = next.start('P1');
    expect(r.ok && r.value.map((a) => a.action.type)).toEqual(['setTurnOrder', 'setTurnOrder', 'setStartFile', 'setStartFile', 'startGame']);
    expect(next.state.status).toBe('playing');
  });

  it('US6-AS3 a save that does not replay is refused', () => {
    const core = startedRoom();
    const bad = { ...core.room.save, actions: [{ type: 'moveStep' as const, to: { x: 0, y: 0 } }] };
    expect(() => RoomCore.create('FFFFFFF', core.room.config, testDeps(), IDS, bad)).toThrow();
  });
});
