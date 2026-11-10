// 005 research R-04 / spec Q-52: online, players only pick heroes; the server sets turn order and starting squares.
import { picksComplete, sidePicks, type Action, type GameState, type Side } from '../rules/index.ts';

/** The setup actions the server applies after the last pick: each side's first pick plays first and starts behind
 * the c-file Bishop, the other hero behind the f-file Bishop; then the game starts. Empty if not due. */
export function autoSetupActions(state: GameState): Action[] {
  if (state.status !== 'setup' || !picksComplete(state.setup)) return [];
  const setup = state.setup;
  const out: Action[] = [];
  const first = (side: Side) => sidePicks(setup, side)[0].pickIndex;
  if (!setup.turnOrder.light) out.push({ type: 'setTurnOrder', side: 'light', first: first('light') });
  if (!setup.turnOrder.dark) out.push({ type: 'setTurnOrder', side: 'dark', first: first('dark') });
  for (const side of ['light', 'dark'] as const) {
    const f = first(side);
    if (!setup.startFiles[String(f)]) out.push({ type: 'setStartFile', pickIndex: f, file: 'c' });
  }
  out.push({ type: 'startGame' });
  return out;
}
