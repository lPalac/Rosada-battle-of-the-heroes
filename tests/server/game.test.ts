// 005 US2 / US3 / SC-004 over the wire: a game played by the owning clients, server rolls, and a fuzz test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorFor } from '../../src/online/authority.ts';
import { stateCheck } from '../../src/online/check.ts';
import type { SeatId } from '../../src/online/model.ts';
import { replay } from '../../src/game/session.ts';
import { legalActions, type Action } from '../../src/rules/index.ts';
import { seededRng, type Rng } from '../helpers/rng.ts';
import { create, join, sit, testServer, until, type Player, type TestServer } from './harness.ts';

let srv: TestServer;
beforeAll(async () => {
  srv = await testServer();
});
afterAll(async () => {
  await srv.close();
});

const HEROES = ['cavalier', 'monk', 'scout', 'magus'];

async function table(count: 2 | 4): Promise<{ players: Record<string, Player>; all: Player[]; code: string }> {
  const a = await create(srv.url, { playerCount: count, name: 'P1' });
  const players: Record<string, Player> = { P1: a };
  for (const seat of (count === 2 ? ['P2'] : ['P2', 'P3', 'P4']) as SeatId[]) {
    const p = await join(srv.url, a.conn.code);
    await sit(p, seat, seat);
    players[seat] = p;
  }
  const all = Object.values(players);
  await until(() => a.session.room!.seats.every((s) => s.taken));
  a.session.start();
  await until(() => all.every((p) => p.session.room?.status === 'setup'));
  return { players, all, code: a.conn.code };
}

const serverCore = (code: string) => srv.context.rooms.get(code)!.core;

async function settled(all: Player[], code: string): Promise<void> {
  await until(() => all.every((p) => !p.session.loading && p.session.seq === serverCore(code).seq), 5000, 'clients in step');
}

/** One step by the seat that may act: a random legal action (rolls through the server). */
async function step(
  t: { players: Record<string, Player>; all: Player[]; code: string }, rng: Rng, heroIndex: { i: number },
  choose: (legal: Action[], rng: Rng) => Action = (legal, r) => r.pick(legal),
): Promise<boolean> {
  const any = t.all[0].session;
  const s = any.state;
  let legal = legalActions(s).filter((a) => a.type !== 'setEnforcement' && a.type !== 'offerDraw');
  if (s.status === 'setup') legal = legal.filter((a) => a.type === 'pickHero' && a.heroDefinitionId === HEROES[heroIndex.i % 4]);
  if (!legal.length && s.status === 'playing') {
    // A random walk can spend the last Movement point on a square the Move may not end on (an enemy unit or a King);
    // End phase is then disabled (001). A player undoes the step; so does the random player (006).
    const mover = Object.values(t.players).find((p) => p.session.canUndo());
    if (!mover) return false;
    const before = serverCore(t.code).seq;
    mover.session.undo();
    await until(() => serverCore(t.code).seq < before, 5000, 'undo');
    await settled(t.all, t.code);
    return true;
  }
  if (!legal.length) return false;
  const seat = [...actorFor(any.room!, s)][0];
  const p = t.players[seat];
  const before = serverCore(t.code).seq;
  const refusedBefore = p.refused.length;
  const a: Action = choose(legal, rng);
  if (a.type === 'pickHero') heroIndex.i++;
  p.session.dispatch(a);
  await until(() => serverCore(t.code).seq > before || p.refused.length > refusedBefore, 5000, `step ${a.type}`);
  expect(p.refused.slice(refusedBefore)).toEqual([]);
  await settled(t.all, t.code);
  return true;
}

/** Head for a Lead that needs a roll: announce Leads, else end phases. */
const leadsFirst = (legal: Action[], rng: Rng): Action =>
  rng.pick(legal.filter((a) => a.type === 'submitRoll').length ? legal.filter((a) => a.type === 'submitRoll')
    : legal.filter((a) => a.type === 'announceLead').length ? legal.filter((a) => a.type === 'announceLead')
    : legal.filter((a) => a.type === 'endPhase' || a.type === 'pickHero' || a.type === 'decide').length
      ? legal.filter((a) => a.type === 'endPhase' || a.type === 'pickHero' || a.type === 'decide') : legal);

describe('US2 a game over the server', () => {
  it('US2-AS1…AS3 picks by seat, auto setup, play by the owning clients; every client matches the server', async () => {
    const t = await table(4);
    const rng = seededRng('wire-game');
    const heroIndex = { i: 0 };
    for (let i = 0; i < 120; i++) if (!(await step(t, rng, heroIndex))) break;
    const core = serverCore(t.code);
    expect(core.state.status).toBe('playing');
    expect(core.seq).toBeGreaterThan(30);
    for (const p of t.all) {
      expect(p.session.resyncs).toBe(0);
      expect(stateCheck(p.session.state)).toBe(stateCheck(core.state));
      expect(p.session.actions).toEqual(core.room.save.actions);
    }
    // Server rolls happened and look like any submitRoll in the log.
    expect(core.room.save.actions.some((a) => a.type === 'submitRoll')).toBe(true);
    for (const p of t.all) await p.conn.leave();
  }, 60_000);

  it('US2-AS4 / US3-AS2 out-of-turn actions and client roll values are refused', async () => {
    const t = await table(2);
    const s = t.all[0].session;
    const picker = [...actorFor(s.room!, s.state)][0];
    const other = picker === 'P1' ? 'P2' : 'P1';
    t.players[other].session.dispatch({ type: 'pickHero', side: 'dark', heroDefinitionId: 'monk' });
    await until(() => t.players[other].refused.length > 0);
    expect(t.players[other].refused[0]).toMatchObject({ code: 'NOT_YOUR_TURN' });
    t.players[picker].conn.send({ t: 'act', action: { type: 'submitRoll', value: 20 }, clientSeq: 99 });
    await until(() => t.players[picker].refused.length > 0);
    expect(t.players[picker].refused[0]).toMatchObject({ code: 'NOT_ALLOWED_ONLINE', clientSeq: 99 });
    for (const p of t.all) await p.conn.leave();
  });

  it('US3-AS1 a forced server roll reaches every client as the same value', async () => {
    const t = await table(2);
    const rng = seededRng('wire-roll');
    const heroIndex = { i: 0 };
    const rolls: number[][] = t.all.map(() => []);
    t.all.forEach((p, i) => p.session.onApplied((info, a) => info.roll && a.type === 'submitRoll' && rolls[i].push(a.value)));
    for (let i = 0; i < 400 && rolls[0].length === 0; i++) {
      const s = t.all[0].session;
      if (s.state.status === 'playing' && s.awaitingRoll && !s.state.pendingDecision) {
        const seat = [...actorFor(s.room!, s.state)][0];
        t.players[seat].conn.send({ t: 'forceNextRoll', value: 17 });
      }
      if (!(await step(t, rng, heroIndex, leadsFirst))) break;
    }
    expect(rolls[0][0]).toBe(17);
    expect(rolls[1][0]).toBe(17);
    for (const p of t.all) await p.conn.leave();
  }, 60_000);
});

describe('SC-004 fuzz', () => {
  it('random, illegal, out-of-turn and malformed messages never get an illegal action in', async () => {
    const t = await table(2);
    const rng = seededRng('fuzz');
    const garbage: unknown[] = [null, 5, 'x', [], { action: 'x' }, { action: { type: 'moveStep' } }, { clientSeq: -1 }, { seat: 'P9' }, { action: { type: 'x'.repeat(5000) }, clientSeq: 1 }];
    const types = ['act', 'roll', 'undo', 'takeSeat', 'leaveSeat', 'start', 'releaseSeat', 'rematch', 'nope', 'forceNextRoll'];
    let sent = 0;
    for (let round = 0; round < 60; round++) {
      // A legitimate step now and then keeps the game moving.
      await step(t, rng, { i: round });
      for (let k = 0; k < 25; k++) {
        const p = rng.pick(t.all);
        const s = p.session.state;
        const legal = legalActions(s);
        const kind = rng.nextInt(0, 3);
        if (kind === 0 && legal.length) p.conn.send({ t: 'act', action: rng.pick(legal), clientSeq: k }); // maybe out of turn
        else if (kind === 1) p.conn.send({ t: 'act', action: { type: 'moveStep', to: { x: rng.nextInt(-3, 12), y: rng.nextInt(-3, 12) } }, clientSeq: k });
        else if (kind === 2) p.conn.send({ t: 'roll', clientSeq: k });
        else {
          // Raw garbage through the SDK, bypassing the typed send.
          const raw = (p.conn as unknown as { send: (m: unknown) => void });
          raw.send({ t: rng.pick(types), ...(rng.pick(garbage) as object) });
        }
        sent++;
      }
      await new Promise((r) => setTimeout(r, 60)); // stay under the rate limit
      await settled(t.all, t.code);
    }
    expect(sent).toBeGreaterThan(1000);
    const core = serverCore(t.code);
    // The log replays cleanly and equals what every client applied.
    expect(stateCheck(replay(core.room.save.initial, core.room.save.actions))).toBe(stateCheck(core.state));
    for (const p of t.all) {
      expect(p.session.resyncs).toBe(0);
      expect(stateCheck(p.session.state)).toBe(stateCheck(core.state));
    }
    // Every logged player action was made by the seat allowed at that moment.
    let s = core.room.save.initial;
    core.room.save.actions.forEach((a, i) => {
      const by = core.room.actors[i];
      if (by !== 'server') expect(actorFor(core.room, s).has(by), `${a.type} by ${by}`).toBe(true);
      s = replay(s, [a]);
    });
    for (const p of t.all) await p.conn.leave();
  }, 120_000);
});
