// 005 research R-03: which seat may act now. The rules core decides what is legal; this decides who may send it.
import { awaitingRoll, nextPicker, picksComplete, sidePicks, type GameState, type HeroId, type Side } from '../rules/index.ts';
import type { Actor, Room, Seat, SeatId } from './model.ts';

/** The seat whose player controls a hero (`hero.playerId` is the seat id, data-model Seat). */
export function seatOfHero(state: GameState, heroId: HeroId): SeatId | null {
  const h = state.heroes.find((x) => x.id === heroId);
  return (h?.playerId as SeatId | undefined) ?? null;
}

function seatsOfSide(seats: readonly Seat[], side: Side): Seat[] {
  return seats.filter((s) => s.side === side);
}

/** The seat on `side` that controls hero slot `slot` (0 or 1). */
export function seatForSlot(seats: readonly Seat[], side: Side, slot: number): SeatId | null {
  return seatsOfSide(seats, side).find((s) => s.heroSlots.includes(slot))?.id ?? null;
}

/** Seats allowed to send the next action (empty: nobody, e.g. setup steps the server makes, or the game ended). */
export function actorFor(room: Pick<Room, 'seats'>, state: GameState): Set<SeatId> {
  const out = new Set<SeatId>();
  const add = (id: SeatId | null) => id && out.add(id);
  if (state.status === 'setup') {
    const setup = state.setup;
    const side = nextPicker(setup);
    if (!side || picksComplete(setup)) return out;
    // Draft: the side's n-th pick is hero slot n. Mirror: pick n fills slot n of both sides (Light picks slot 0, Dark slot 1).
    const slot = setup.mode === 'mirror' ? setup.picks.length / 2 : sidePicks(setup, side).length;
    add(seatForSlot(room.seats, side, slot));
    return out;
  }
  if (state.status === 'ended' || state.enforcement !== 'rules') return out;
  const d = state.pendingDecision;
  if (d) {
    if (d.type === 'drawOffer') {
      const other: Side = d.fromSide === 'light' ? 'dark' : 'light';
      for (const s of seatsOfSide(room.seats, other)) out.add(s.id);
    } else if (d.type === 'promotion') add(seatOfHero(state, d.chooserHeroId));
    else add(seatOfHero(state, d.heroId));
    return out;
  }
  add(seatOfHero(state, state.activeHeroId));
  return out;
}

/** True when the next step waits for a decision (not the active hero's normal play). */
export function isDecision(state: GameState): boolean {
  return state.status !== 'setup' && !!state.pendingDecision;
}

/** The roll button belongs to the active seat while the rules wait for a roll and nothing else is pending. */
export function canRoll(room: Pick<Room, 'seats'>, state: GameState, seat: SeatId): boolean {
  return state.status === 'playing' && !state.pendingDecision && awaitingRoll(state) && actorFor(room, state).has(seat);
}

/** Undo belongs to the seat that made the last action (FR-030); the 001 undo limits are checked by RoomCore. */
export function lastActor(room: Pick<Room, 'actors'>): Actor | null {
  return room.actors.length ? room.actors[room.actors.length - 1] : null;
}
