// 005 US2: who may act (research R-03).
import { describe, expect, it } from 'vitest';
import { actorFor, seatOfHero } from '../../src/online/authority.ts';
import { RoomCore } from '../../src/online/room-core.ts';
import { toSaveFile } from '../../src/game/save.ts';
import type { GameState } from '../../src/rules/index.ts';
import { board } from '../fixtures/position.ts';
import { IDS, actor, pickAll, seatAll, startedRoom, testDeps } from './helpers.ts';

const who = (core: RoomCore) => [...actorFor(core.room, core.state)].sort();

/** A 4-player room around a test position: H1/H3 Light (P1/P3), H2/H4 Dark (P2/P4). */
export function roomAt(state: GameState): RoomCore {
  const core = RoomCore.create('CCCCCCC', { playerCount: 4, mode: 'draft', singleSide: 'light' }, testDeps(), IDS, toSaveFile(state, []));
  seatAll(core);
  const r = core.start(core.room.creatorSeat!);
  if (!r.ok) throw new Error(r.message);
  return core;
}

function pickAllRecording(core: RoomCore): string[] {
  const heroes = ['cavalier', 'monk', 'scout', 'magus'];
  const order: string[] = [];
  let i = 0;
  while (core.state.status === 'setup') {
    const by = actor(core);
    order.push(by);
    const side = core.room.seats.find((s) => s.id === by)!.side;
    const r = core.act(by, { type: 'pickHero', side, heroDefinitionId: heroes[i++] });
    if (!r.ok) throw new Error(r.message);
  }
  return order;
}

describe('US2 authority', () => {
  it('US2-AS1 Draft picks go L, D, D, L to the seat owning that hero slot', () => {
    expect(pickAllRecording(startedRoom())).toEqual(['P1', 'P2', 'P4', 'P3']);
  });

  it('US2-AS1 Mirror: Light seat 1 picks hero 1 for both sides, Dark seat 2 picks hero 2', () => {
    const core = startedRoom({ mode: 'mirror' });
    expect(who(core)).toEqual(['P1']);
    expect(core.act('P1', { type: 'pickHero', side: 'light', heroDefinitionId: 'scout' }).ok).toBe(true);
    expect(who(core)).toEqual(['P4']);
  });

  it('US2-AS1 3 players: the single seat picks for both of its heroes', () => {
    expect(pickAllRecording(startedRoom({ playerCount: 3, singleSide: 'light' }))).toEqual(['P1', 'P2', 'P3', 'P1']);
  });

  it('US2-AS1 a pick by the wrong seat is refused', () => {
    const core = startedRoom();
    expect(core.act('P2', { type: 'pickHero', side: 'light', heroDefinitionId: 'monk' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
  });

  it('US2-AS4 in play only the active hero’s seat may act', () => {
    const core = startedRoom();
    pickAll(core);
    const mine = seatOfHero(core.state, core.state.activeHeroId);
    expect(who(core)).toEqual([mine]);
    for (const s of core.room.seats) {
      if (s.id === mine) continue;
      expect(core.act(s.id, { type: 'endPhase' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    }
  });

  it('US2-AS6 a decision belongs to the seat of the hero that owns it', () => {
    const s = board({}, {});
    expect(who(roomAt({ ...s, pendingDecision: { type: 'promotion', unitId: 'x', chooserHeroId: 'H2' } }))).toEqual(['P2']);
    expect(who(roomAt({ ...s, pendingDecision: { type: 'epicDestiny', heroId: 'H3', options: ['fanatic'], appliesTo: ['H3'] } }))).toEqual(['P3']);
    // 006 FR-012: a Mirror choice applies to the twin too, but belongs to the chooser's seat only.
    expect(who(roomAt({ ...s, pendingDecision: { type: 'epicDestiny', heroId: 'H2', options: ['fanatic'], appliesTo: ['H2', 'H1'] } }))).toEqual(['P2']);
    expect(who(roomAt({ ...s, pendingDecision: { type: 'unconsciousTavern', heroId: 'H4', options: [] } }))).toEqual(['P4']);
    const reaction = roomAt({ ...s, pendingDecision: { type: 'abilityChoice', heroId: 'H2', abilityId: 'x', choices: ['a'] } });
    expect(who(reaction)).toEqual(['P2']);
    expect(reaction.act('P1', { type: 'decide', decision: { type: 'abilityChoice', choice: 'a' } })).toMatchObject({ ok: false, code: 'NOT_YOUR_DECISION' });
  });

  it('US2-AS7 a draw offer is answered by any seat of the other side', () => {
    const core = roomAt(board({}, {}));
    const by = actor(core);
    expect(core.act(by, { type: 'offerDraw' }).ok).toBe(true);
    expect(who(core)).toEqual(['P2', 'P4']);
    expect(core.act('P4', { type: 'answerDraw', accept: false }).ok).toBe(true);
    expect(who(core)).toEqual([by]);
  });
});
