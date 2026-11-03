// Runs a scripted game turn by turn and compares the pools after every turn with a hand-kept ledger. A row is the
// state once the next hero waits for a choice, so it includes that hero's automatic Before/Beginning of Turn steps
// (SC-001, SC-003 prep).
import { expect } from 'vitest';
import type { Action, GameState, HeroId } from '../../src/rules/index.ts';
import { act } from '../helpers/game.ts';

export interface LedgerTurn {
  turn: number;
  well: number;
  common: { light: number; dark: number };
  pools: Record<HeroId, number>;
  health?: Record<HeroId, number>;
  peaceTreaty: 'peace' | 'war';
}

export interface Ledger {
  turns: LedgerTurn[];
  result: Record<string, unknown> & { turnsPlayed: number };
}

const pools = (s: GameState) => Object.fromEntries(s.heroes.map((h) => [h.id, h.pool]));
const health = (s: GameState) => Object.fromEntries(s.heroes.map((h) => [h.id, h.health]));

/** `turns[i]` holds the actions of turn i + 1; the last entry may end the game. */
export function playScripted(start: GameState, turns: Action[][], ledger: Ledger): GameState {
  let s = start;
  turns.forEach((actions, i) => {
    const turn = i + 1;
    // A skipped turn (Unconscious hero) passes during the previous hand-off: it has no actions.
    if (actions.length === 0) expect(s.turnNumber, `turn ${turn} was skipped`).toBeGreaterThan(turn);
    else expect(s.turnNumber, `turn ${turn} starts`).toBe(turn);
    for (const a of actions) s = act(s, a).state;
    const row = ledger.turns.find((r) => r.turn === turn);
    if (!row) return;
    const got = {
      turn, well: s.destiny.well.initialRemaining, common: s.destiny.common, pools: pools(s),
      ...(row.health ? { health: health(s) } : {}), peaceTreaty: s.tokens.peaceTreaty,
    };
    expect(got, `ledger after turn ${turn}`).toEqual(row);
    expect(s.turnNumber, `turn ${turn} has ended`).toBeGreaterThan(turn);
  });
  const { turnsPlayed, ...rest } = ledger.result;
  expect(s.result).toMatchObject({ ...rest, summary: { turnsPlayed } });
  return s;
}
