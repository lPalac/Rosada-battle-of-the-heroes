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
    if (r.ok) expect(r.value).toMatchObject({ seq: core.seq, check, by });
  });

  it('US2-AS9 the acting seat undoes step by step across phase changes, back to the start of its turn', () => {
    const core = startedRoom();
    pickAll(core);
    const by = actor(core);
    const start = core.seq;
    const startCheck = stateCheck(core.state);
    while (core.state.phase !== 'move') expect(core.act(by, { type: 'endPhase' }).ok).toBe(true);
    const step = legalActions(core.state).find((a) => a.type === 'moveStep')!;
    expect(core.act(by, step).ok).toBe(true);
    expect(core.seq - start).toBeGreaterThan(1);
    const undone: string[] = [];
    while (core.canUndoBy(by)) {
      const r = core.undo(by);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.by).toBe(by);
        undone.push(r.value.action.type);
      }
    }
    expect(undone[0]).toBe('moveStep');
    expect(undone).toContain('endPhase');
    expect(core.seq).toBe(start); // stops at the server's startGame
    expect(stateCheck(core.state)).toBe(startCheck);
  });

  it('server setup actions cannot be undone by a player', () => {
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
