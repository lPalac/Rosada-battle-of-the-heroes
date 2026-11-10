// 005 US2: playing through RoomCore (contracts/online-core-api.md G-1…G-3).
import { describe, expect, it } from 'vitest';
import { autoSetupActions } from '../../src/online/auto-setup.ts';
import { stateCheck } from '../../src/online/check.ts';
import { replay } from '../../src/game/session.ts';
import { legalActions } from '../../src/rules/index.ts';
import { seededRng } from '../helpers/rng.ts';
import { actor, pickAll, randomStep, startedRoom, testDeps } from './helpers.ts';

describe('US2 playing online', () => {
  it('US2-AS2 after the last pick the server sets turn order and starting squares and starts turn 1', () => {
    const core = startedRoom();
    pickAll(core);
    expect(core.state.status).toBe('playing');
    expect(core.room.status).toBe('playing');
    const setup = core.state.setup;
    expect(setup.turnOrder).toEqual({ light: [0, 3], dark: [1, 2] });
    expect(setup.startFiles).toEqual({ '0': 'c', '3': 'f', '1': 'c', '2': 'f' });
    const server = core.room.actors.filter((a) => a === 'server').length;
    expect(server).toBe(5); // two turn orders, two start files, startGame
    expect(autoSetupActions(core.state)).toEqual([]);
  });

  it('US2-AS3 an applied action carries seq, actor and the state check', () => {
    const core = startedRoom();
    pickAll(core);
    const by = actor(core);
    const r = core.act(by, { type: 'endPhase' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0]).toMatchObject({ seq: core.seq, by, roll: false, check: stateCheck(core.state) });
  });

  it('US2-AS5 an illegal action is refused with the rules message and nothing changes', () => {
    const core = startedRoom();
    pickAll(core);
    const before = core.seq;
    const check = stateCheck(core.state);
    const r = core.act(actor(core), { type: 'moveStep', to: { x: 0, y: 0 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rule).toBeTruthy();
    expect(core.seq).toBe(before);
    expect(stateCheck(core.state)).toBe(check);
    // Malformed fields never throw out of RoomCore.
    const bad = core.act(actor(core), { type: 'moveStep' } as never);
    expect(bad.ok).toBe(false);
    expect(core.seq).toBe(before);
  });

  it('US2 sandbox, enforcement and client rolls are not available online (FR-017, FR-020)', () => {
    const core = startedRoom();
    pickAll(core);
    const by = actor(core);
    for (const a of [{ type: 'setEnforcement', mode: 'sandbox' }, { type: 'submitRoll', value: 20 }, { type: 'sandboxSet', path: 'health', value: 1 }] as const) {
      expect(core.act(by, a as never)).toMatchObject({ ok: false, code: 'NOT_ALLOWED_ONLINE' });
    }
  });

  it('US2 random games by the owning seats replay exactly (G-1, G-3)', () => {
    for (const seed of ['a', 'b', 'c']) {
      const rng = seededRng(`online-${seed}`);
      const core = startedRoom({}, testDeps(seed));
      pickAll(core);
      for (let i = 0; i < 300 && core.state.status === 'playing'; i++) if (!randomStep(core, rng)) break;
      expect(core.room.actors.length).toBe(core.room.save.actions.length);
      expect(stateCheck(replay(core.room.save.initial, core.room.save.actions))).toBe(stateCheck(core.state));
      // (Random play can stop early: see the Move-phase dead end noted in the 005 tasks follow-ups.)
      expect(core.room.save.actions.length).toBeGreaterThan(20);
    }
  });

  it('US2-AS8 after the result a rematch keeps the seats and goes back to picking', () => {
    const core = startedRoom({ playerCount: 2 });
    pickAll(core);
    // Agree a draw to end the game quickly.
    const by = actor(core);
    expect(core.act(by, { type: 'offerDraw' }).ok).toBe(true);
    expect(core.act(actor(core), { type: 'answerDraw', accept: true }).ok).toBe(true);
    expect(core.room.status).toBe('ended');
    expect(core.act(by, { type: 'endPhase' })).toMatchObject({ ok: false, code: 'GAME_ENDED' });
    expect(core.rematch('P2')).toMatchObject({ ok: false, code: 'NOT_CREATOR' });
    expect(core.rematch('P1').ok).toBe(true);
    expect(core.room.status).toBe('setup');
    expect(core.seq).toBe(0);
    expect(core.state.setup.players.map((p) => p.name)).toEqual(['Name P1', 'Name P2']);
    expect(legalActions(core.state).some((a) => a.type === 'pickHero')).toBe(true);
  });
});
