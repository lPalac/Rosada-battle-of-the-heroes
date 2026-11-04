import { describe, expect, it } from 'vitest';
import { destinyGeneration } from '../../src/rules/index.ts';
import { act, eventsOf, hero, passTurn } from '../helpers/game.ts';
import { board, sq, START } from '../fixtures/position.ts';

const without = (...squares: string[]) => Object.fromEntries(Object.entries(START).filter(([k]) => !squares.includes(k)));

describe('US2 – Hero Destiny Generation', () => {
  it('US2-AS1 generation is 1 when the Epic Stage starts with every unit type on the board', () => {
    const s = board(START, { stage: 'epic' });
    expect(destinyGeneration(s, 'light')).toBe(1);
    expect(destinyGeneration(s, 'dark')).toBe(1);
  });

  it('US2-AS2 no Queen and no Knight → 3', () => {
    const s = board(without('d1', 'b1', 'g1'), { stage: 'epic' });
    expect(destinyGeneration(s, 'light')).toBe(3);
    expect(destinyGeneration(s, 'dark')).toBe(1);
  });

  it('US2-AS3 losing the last Bishop → 4; a Knight back by Promotion → 3', () => {
    // No Queen, Knights or Bishops; a pawn on b7 about to promote, another pawn keeps the Pawn type.
    let s = board({ a1: 'R', h1: 'R', a2: 'P', b7: 'P', e1: 'K', e8: 'k' }, { heroes: { H1: 'b6' }, stage: 'epic', phase: 'lead' });
    expect(destinyGeneration(s, 'light')).toBe(4);
    s = act(s, { type: 'announceLead', unitId: 'L-P@b7', to: sq('b8'), promoteTo: 'knight' }).state;
    s = act(s, { type: 'submitRoll', value: 20 }).state;
    expect(destinyGeneration(s, 'light')).toBe(3);
  });

  it('US2-AS4 an auxiliary pawn on the enemy royal rank adds 1 while it is there', () => {
    const army = { a1: 'R', b1: 'N', c1: 'B', d1: 'Q', a2: 'P' };
    expect(destinyGeneration(board(army, { stage: 'epic' }), 'light')).toBe(1);
    expect(destinyGeneration(board({ ...army, c8: 'P' }, { stage: 'epic', auxiliary: ['c8'] }), 'light')).toBe(2);
    expect(destinyGeneration(board({ ...army, c7: 'P' }, { stage: 'epic', auxiliary: ['c7'] }), 'light')).toBe(1);
  });

  it('US2-AS5 at End of Turn the hero gains its generation into its own pool', () => {
    const s = board(without('d1', 'b1', 'g1'), { stage: 'epic' });
    const before = hero(s, 'H1').pool;
    const r = passTurn(s);
    const gains = eventsOf(r.events, 'destinyChanged').filter((e) => e.reason === 'destinyGeneration');
    expect(gains).toEqual([{ type: 'destinyChanged', pool: 'hero', side: 'light', heroId: 'H1', delta: 3, reason: 'destinyGeneration' }]);
    expect(hero(r.state, 'H1').pool).toBe(before + 3);
  });

  it('US2-AS6 no generation in the Starting Stage', () => {
    const s = board(without('d1', 'b1', 'g1'));
    expect(destinyGeneration(s, 'light')).toBe(0);
    const r = passTurn(s);
    expect(eventsOf(r.events, 'destinyChanged').filter((e) => e.reason === 'destinyGeneration')).toEqual([]);
  });

  it('Hero Units do not count for their type; auxiliary units do (clarified)', () => {
    const army = { a1: 'R', c1: 'B', d1: 'Q', a2: 'P' }; // no Knight
    expect(destinyGeneration(board(army, { stage: 'epic' }), 'light')).toBe(2);
    expect(destinyGeneration(board(army, { stage: 'epic', heroes: { H1: 'b3' }, heroUnits: { H1: ['knight'] } }), 'light')).toBe(2);
    expect(destinyGeneration(board({ ...army, b1: 'N' }, { stage: 'epic', auxiliary: ['b1'] }), 'light')).toBe(1);
  });
});
