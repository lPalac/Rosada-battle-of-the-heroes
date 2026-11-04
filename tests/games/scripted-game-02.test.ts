// A second scripted game with Rams, Unconscious, taverns, a failed roll and a check (T106).
import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/rules/index.ts';
import { board, sq } from '../fixtures/position.ts';
import ledger from './scripted-game-02.ledger.json';
import { playScripted, type Ledger } from './scripted.ts';

const end: Action = { type: 'endPhase' };
const step = (s: string): Action => ({ type: 'moveStep', to: sq(s) });

describe('scripted game 02 – Rams, Unconscious and taverns', () => {
  it('matches the hand-kept ledger after every turn and ends in an agreed draw', () => {
    const start = board(
      { e1: 'K', a1: 'R', e8: 'k', h8: 'r' },
      { heroes: { H1: 'b0', H2: 'a4', H3: '<0', H4: 'a3' }, health: { H3: 5, H4: 2 } },
    );
    const turns: Action[][] = [
      // 1 · H1 Leads the Rook a1–a5 (Peace, no roll): H4 (2 → 0, Unconscious) and H2 (10 → 7) are Rammed to a6.
      [end, end, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a5') },
        { type: 'decide', decision: { type: 'square', to: sq('>9') } }, // H4 carried to a Dark tavern
        { type: 'decide', decision: { type: 'square', to: sq('b4') } }, // H1 advances
        end],
      // 2 · H2 walks into the Dark tavern, buys a Meal (2 D) and heals to 10. No unit in Range.
      [step('<7'), step('<8'), step('<9'), { type: 'buy', item: 'meal' }, end, end],
      // 3 · H3 starts in a tavern (Movement 2), buys a Drink. No unit in Range, no free Meal.
      [{ type: 'buy', item: 'drink' }, end, end],
      // 4 · H4 is Unconscious: its turn is skipped (no actions).
      [],
      // 5 · H1 Leads the Rook a5–a8 at War and rolls 2: total 4, fails, Light +1 D.
      [end, end, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a8') }, { type: 'submitRoll', value: 2 }, end],
      // 6 · H2 leaves the tavern; nothing in Range.
      [step('a8'), end, end],
      // 7 · H3 stays in the tavern; nothing in Range.
      [end, end],
      // 8 · H4 recovers to 4, Leads the Rook h8–h1 (roll 10) and checks: Dark +2 D. Free Meal in its tavern: 7.
      [end, end, { type: 'announceLead', unitId: 'D-R@h8', to: sq('h1') }, { type: 'submitRoll', value: 10 }, end],
      // 9 · Light offers a draw; Dark accepts.
      [{ type: 'offerDraw' }, { type: 'answerDraw', accept: true }],
    ];
    const s = playScripted(start, turns, ledger as Ledger);
    expect(s.log.filter((l) => l.type === 'turnSkipped').map((l) => l.data.heroId)).toEqual(['H4']);
    expect(s.log.filter((l) => l.type === 'heroRecovered').map((l) => l.data.heroId)).toEqual(['H4']);
  });
});
