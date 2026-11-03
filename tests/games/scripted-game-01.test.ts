// A full game from setup to result with fixed choices, checked against a hand-kept ledger (T089).
import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/rules/index.ts';
import { newGame } from '../helpers/game.ts';
import ledger from './scripted-game-01.ledger.json';
import { playScripted, type Ledger } from './scripted.ts';

const at = (x: number, y: number) => ({ x, y });
const end: Action = { type: 'endPhase' };

describe('scripted game 01 – fool’s mate', () => {
  it('matches the hand-kept ledger after every turn and ends in checkmate', () => {
    const turns: Action[][] = [
      // 1 · H1 (Light short, c0) walks to f1 and Leads f2–f3; Peace: no roll.
      [{ type: 'moveStep', to: at(4, 0) }, { type: 'moveStep', to: at(5, 0) }, { type: 'moveStep', to: at(6, 1) }, end, end,
        { type: 'announceLead', unitId: 'L-P-f', to: at(6, 3) }, { type: 'decide', decision: { type: 'square', to: at(5, 3) } }, end],
      // 2 · H2 (Dark short, c9) steps to d8 and Leads e7–e5.
      [{ type: 'moveStep', to: at(4, 8) }, end, end,
        { type: 'announceLead', unitId: 'D-P-e', to: at(5, 5) }, { type: 'decide', decision: { type: 'square', to: at(5, 6) } }, end],
      // 3 · H3 (Light long, f0) Leads g2–g4 from where it stands.
      [end, end, { type: 'announceLead', unitId: 'L-P-g', to: at(7, 4) }, end],
      // 4 · H4 (Dark long, f9) Leads the Queen d8–h4: check (+2 D, War). Turn 5's Before Turn finds mate.
      [end, end, { type: 'announceLead', unitId: 'D-Q-d', to: at(8, 4) }, end],
    ];
    const s = playScripted(newGame(), turns, ledger as Ledger);
    expect(s.destiny.entries.map((e) => [e.turn, e.side, e.delta, e.reason])).toEqual([[4, 'dark', 2, 'check']]);
  });
});
