// 006 US7 (FR-040, B-13): the side the default camera looks from. Online it is the local seat's side on every turn
// (a 3-player seat holding both heroes of a side sees that side); in hot-seat it follows the active hero. Engine-free.
import type { GameState, Side } from '../rules/index.ts';

export function viewSide(state: GameState, seat: { side: Side } | null): Side {
  if (seat) return seat.side;
  return state.heroes.find((h) => h.id === state.activeHeroId)?.side ?? 'light';
}
