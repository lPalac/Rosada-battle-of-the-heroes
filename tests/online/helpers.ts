// 005 test helpers: RoomCore with scripted dependencies (constitution IV: repeatable randomness).
import { createHash } from 'node:crypto';
import { RoomCore, type RoomDeps } from '../../src/online/room-core.ts';
import { actorFor } from '../../src/online/authority.ts';
import type { RoomConfig, SeatId } from '../../src/online/model.ts';
import { legalActions, type Action } from '../../src/rules/index.ts';
import { seededRng, type Rng } from '../helpers/rng.ts';

export function testDeps(seed = 'deps', rolls: number[] = []): RoomDeps & { clock: { t: number } } {
  const rng = seededRng(seed);
  const clock = { t: Date.parse('2026-11-10T10:00:00Z') };
  let n = 0;
  return {
    clock,
    randomInt: (min, max) => (min === 1 && max === 21 && rolls.length ? rolls.shift()! : rng.nextInt(min, max - 1)),
    newToken: () => `token-${seed}-${++n}-abcdefghijklmnop`,
    hashToken: (t) => createHash('sha256').update(t).digest('hex'),
    now: () => new Date(clock.t),
  };
}

export const IDS = { buildId: 'test', dataHash: 'data' };

export function newRoom(config: Partial<RoomConfig> = {}, deps = testDeps()): RoomCore {
  return RoomCore.create('ABCDEFG', { playerCount: 4, mode: 'draft', singleSide: 'light', ...config }, deps, IDS);
}

/** Every seat taken by a player named after it; returns the tokens. */
export function seatAll(core: RoomCore): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const s of core.room.seats) {
    const r = core.takeSeat(s.id, `Name ${s.id}`);
    if (!r.ok) throw new Error(r.message);
    tokens[s.id] = r.value.token;
  }
  return tokens;
}

export function startedRoom(config: Partial<RoomConfig> = {}, deps = testDeps()): RoomCore {
  const core = newRoom(config, deps);
  seatAll(core);
  const r = core.start(core.room.creatorSeat!);
  if (!r.ok) throw new Error(r.message);
  return core;
}

/** The seat that must act now (first of actorFor). */
export function actor(core: RoomCore): SeatId {
  const set = actorFor(core.room, core.state);
  const first = [...set][0];
  if (!first) throw new Error('Nobody can act');
  return first;
}

/** Make picks until play starts, each by its owning seat. */
export function pickAll(core: RoomCore, heroes = ['cavalier', 'monk', 'scout', 'magus']): void {
  let i = 0;
  while (core.state.status === 'setup') {
    const side = legalActions(core.state).find((a) => a.type === 'pickHero') as Extract<Action, { type: 'pickHero' }>;
    const pick: Action = { type: 'pickHero', side: side.side, heroDefinitionId: heroes[i++ % heroes.length] };
    const r = core.act(actor(core), pick);
    if (!r.ok) throw new Error(`${r.code} ${r.message}`);
  }
}

/** One random step by the right seat: a roll through `roll`, everything else through `act`. */
export function randomStep(core: RoomCore, rng: Rng): boolean {
  const legal = legalActions(core.state).filter((a) => a.type !== 'setEnforcement' && a.type !== 'offerDraw');
  if (!legal.length) return false;
  const a = rng.pick(legal);
  const by = actor(core);
  const r = a.type === 'submitRoll' ? core.roll(by) : core.act(by, a);
  if (!r.ok) throw new Error(`${a.type} by ${by}: ${r.code} ${r.message}`);
  return true;
}
