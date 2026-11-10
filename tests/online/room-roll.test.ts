// 005 US3: the server rolls (research R-05).
import { describe, expect, it } from 'vitest';
import { awaitingRoll, legalActions, type GameState } from '../../src/rules/index.ts';
import { RoomCore } from '../../src/online/room-core.ts';
import { seededRng } from '../helpers/rng.ts';
import { actor, pickAll, startedRoom, testDeps } from './helpers.ts';

/** Play random non-roll actions until a Lead waits for a roll. */
function untilRoll(core: RoomCore, seed = 'roll'): void {
  const rng = seededRng(seed);
  for (let i = 0; i < 2000 && !(awaitingRoll(core.state) && !core.state.pendingDecision); i++) {
    if (core.state.status !== 'playing') throw new Error('game ended before a roll');
    const legal = legalActions(core.state).filter((a) => a.type !== 'setEnforcement' && a.type !== 'offerDraw');
    const leads = legal.filter((a) => a.type === 'announceLead');
    const a = leads.length && rng.nextFloat() < 0.8 ? rng.pick(leads) : rng.pick(legal);
    const r = a.type === 'submitRoll' ? core.roll(actor(core)) : core.act(actor(core), a);
    if (!r.ok) throw new Error(`${a.type}: ${r.message}`);
  }
  if (!awaitingRoll(core.state)) throw new Error('no roll reached');
}

const rolled = (s: GameState) => s.log.filter((l) => l.type === 'rolled').length;

describe('US3 server dice', () => {
  it('US3-AS1 the active seat presses Roll; the server value is applied as submitRoll', () => {
    const core = startedRoom({}, testDeps('d', [17]));
    pickAll(core);
    untilRoll(core);
    const by = actor(core);
    const before = rolled(core.state);
    const r = core.roll(by);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ action: { type: 'submitRoll', value: 17 }, by, roll: true });
    expect(rolled(core.state)).toBe(before + 1);
  });

  it('US3-AS2 a roll value from a client is refused; a roll by another seat or with nothing to roll is refused', () => {
    const core = startedRoom();
    pickAll(core);
    expect(core.roll(actor(core))).toMatchObject({ ok: false, code: 'NO_ROLL' });
    untilRoll(core);
    const by = actor(core);
    expect(core.act(by, { type: 'submitRoll', value: 20 })).toMatchObject({ ok: false, code: 'NOT_ALLOWED_ONLINE' });
    const other = core.room.seats.find((s) => s.id !== by)!.id;
    expect(core.roll(other)).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
  });

  it('US3 forceNextRoll (test mode) is used once', () => {
    const core = startedRoom({}, testDeps('f', [3, 4]));
    pickAll(core);
    untilRoll(core);
    core.forceNextRoll(19);
    const r = core.roll(actor(core));
    expect(r.ok && r.value.action).toEqual({ type: 'submitRoll', value: 19 });
  });

  it('US3-AS5 Revenge before the roll is still the active player’s action', () => {
    const core = startedRoom();
    pickAll(core);
    untilRoll(core);
    const by = actor(core);
    const others = core.room.seats.filter((s) => s.id !== by);
    for (const s of others) expect(core.act(s.id, { type: 'useRevenge' }).ok).toBe(false);
  });

  it('US3-AS3 rolls drawn through RoomDeps are uniform over 1–20 (chi-square, 200,000 draws, seeded source)', () => {
    // Constitution IV: a seeded source passed in through RoomDeps, so the test is repeatable (analysis C1).
    // RoomCore.roll draws exactly `deps.randomInt(1, 21)` (US3-AS1); the server's deps use crypto.randomInt
    // (tests/server/deps.test.ts).
    const deps = testDeps('uniform');
    const counts = new Array(21).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) counts[deps.randomInt(1, 21)]++;
    expect(counts[0]).toBe(0);
    const expected = n / 20;
    const chi = counts.slice(1).reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(43.82); // 19 degrees of freedom, p = 0.001
  });
});
