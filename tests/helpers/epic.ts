// 006: a game with the named heroes, run to its first Epic destiny choice (Draft or Mirror).
import { expect } from 'vitest';
import { act } from './game.ts';
import { createGame, createSetup, legalActions, type EpicDestiny, type GameState } from '../../src/rules/index.ts';

/** Draft: four ids in pick order (L, D, D, L). Mirror: two ids, Light's pick then Dark's pick. */
export function toEpicChoice(ids = ['cavalier', 'scout', 'magus', 'monk'], mode: 'draft' | 'mirror' = 'draft'): GameState {
  let s = createSetup({ mode, playerCount: 4 });
  if (mode === 'draft') {
    const order = ['light', 'dark', 'dark', 'light'] as const;
    ids.forEach((id, i) => { s = act(s, { type: 'pickHero', side: order[i], heroDefinitionId: id }).state; });
  } else {
    s = act(s, { type: 'pickHero', side: 'light', heroDefinitionId: ids[0] }).state;
    s = act(s, { type: 'pickHero', side: 'dark', heroDefinitionId: ids[1] }).state;
  }
  for (const a of [
    { type: 'setTurnOrder', side: 'light', first: 0 }, { type: 'setTurnOrder', side: 'dark', first: 1 },
    { type: 'setStartFile', pickIndex: 0, file: 'c' }, { type: 'setStartFile', pickIndex: 1, file: 'c' },
  ] as const) s = act(s, a).state;
  let g = createGame(s.setup);
  g = { ...g, epicPending: true, destiny: { ...g.destiny, well: { ...g.destiny.well, initialRemaining: 0, depleted: true, depletedBy: 'H1' } } };
  for (let i = 0; i < 40 && g.pendingDecision?.type !== 'epicDestiny'; i++) {
    const legal = legalActions(g);
    const pick = legal.find((a) => a.type === 'decide') ?? legal.find((a) => a.type === 'announceLead')
      ?? legal.find((a) => a.type === 'submitRoll') ?? legal.find((a) => a.type === 'endPhase');
    g = act(g, pick!).state;
  }
  expect(g.pendingDecision?.type).toBe('epicDestiny');
  return g;
}

export const chooseDestiny = (s: GameState, destiny: EpicDestiny): GameState =>
  act(s, { type: 'decide', decision: { type: 'destiny', destiny } }).state;
