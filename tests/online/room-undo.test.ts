// 005 FR-030: undo online belongs to the seat that made the last action, within the 001 undo limits.
import { describe, expect, it } from 'vitest';
import { stateCheck } from '../../src/online/check.ts';
import { legalActions } from '../../src/rules/index.ts';
import { actor, pickAll, startedRoom } from './helpers.ts';

describe('US2 undo online', () => {
  it('the acting seat undoes its own last action; everyone gets the same state back', () => {
    const core = startedRoom();
    pickAll(core);
    while (core.state.phase !== 'move') expect(core.act(actor(core), { type: 'endPhase' }).ok).toBe(true);
    const check = stateCheck(core.state);
    const by = actor(core);
    const step = legalActions(core.state).find((a) => a.type === 'moveStep')!;
    expect(core.act(by, step).ok).toBe(true);
    const others = core.room.seats.filter((s) => s.id !== by);
    for (const s of others) expect(core.undo(s.id)).toMatchObject({ ok: false, code: 'CANNOT_UNDO' });
    const r = core.undo(by);
    expect(r.ok).toBe(true);
    expect(stateCheck(core.state)).toBe(check);
    if (r.ok) expect(r.value).toEqual({ seq: core.seq, check });
  });

  it('server setup actions and phase changes cannot be undone by a player', () => {
    const core = startedRoom();
    pickAll(core);
    // The last action is the server's startGame.
    for (const s of core.room.seats) expect(core.canUndoBy(s.id)).toBe(false);
  });

  it('a pick can be undone by its seat until the next pick', () => {
    const core = startedRoom();
    expect(core.act('P1', { type: 'pickHero', side: 'light', heroDefinitionId: 'monk' }).ok).toBe(true);
    expect(core.canUndoBy('P1')).toBe(true);
    expect(core.act('P2', { type: 'pickHero', side: 'dark', heroDefinitionId: 'scout' }).ok).toBe(true);
    expect(core.undo('P1')).toMatchObject({ ok: false, code: 'CANNOT_UNDO' });
  });
});
