// A scripted game into the Epic Stage (003 T049): the Well runs out on turn 1, destinies, Common Pool split,
// Epic health, generation at every End of Turn, Tides of Destiny and Destined for Greatness. The ledger below was
// worked out by hand from the rulebook before running the game.
import { describe, expect, it } from 'vitest';
import { destinyGeneration, type Action, type GameState } from '../../src/rules/index.ts';
import { act } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';

/** End phases (and take the first offered advance square) until the Active Hero token passes. */
function finish(s: GameState): GameState {
  const turn = s.turnNumber;
  for (let i = 0; i < 12 && s.turnNumber === turn && s.status === 'playing'; i++) {
    const d = s.pendingDecision;
    if (d?.type === 'epicDestiny') break;
    s = act(s, d?.type === 'advanceSquare' ? { type: 'decide', decision: { type: 'square', to: d.options[0] } } : { type: 'endPhase' }).state;
  }
  return s;
}

function toLead(s: GameState): GameState {
  for (let i = 0; i < 6 && s.phase !== 'lead'; i++) s = act(s, { type: 'endPhase' }).state;
  expect(s.phase).toBe('lead');
  return s;
}

const lead = (s: GameState, unitId: string, to: string, roll?: number): GameState => {
  s = act(toLead(s), { type: 'announceLead', unitId, to: sq(to) }).state;
  return roll === undefined ? s : act(s, { type: 'submitRoll', value: roll }).state;
};

const row = (s: GameState) => ({
  well: s.destiny.well.initialRemaining, common: { ...s.destiny.common },
  pools: s.heroes.map((h) => h.pool), health: s.heroes.map((h) => h.health),
  track: { light: [...s.royalFavors.light.track], dark: [...s.royalFavors.dark.track] },
});

describe('scripted game 03 – into the Epic Stage', () => {
  it('matches the hand-kept ledger turn by turn', () => {
    let s = board({ a1: 'R', h1: 'R', e1: 'K', e8: 'k', a6: 'n', h6: 'n' }, { heroes: { H1: 'b0' }, wellRemaining: 2 });
    // Start: no pawns on either side → Deploy Troops for both at once.
    expect(row(s).track).toEqual({ light: ['deployTroops'], dark: ['deployTroops'] });

    // 1 · H1 Rook a1×a6 (Peace, no roll): +2 Light empties the Well; Dark +1 for its Knight. War. H1 advances.
    s = finish(lead(s, 'L-R@a1', 'a6'));
    expect(row(s)).toMatchObject({ well: 0, common: { light: 2, dark: 1 }, pools: [3, 3, 3, 3], health: [10, 10, 8, 8] });
    expect([s.epicPending, s.stage, s.destiny.well.depletedBy]).toEqual([true, 'starting', 'H1']);

    // Before Turn 2: destinies H2, H3, H4, then H1 (who emptied the Well).
    const picks: Action[] = (['fanatic', 'resolute', 'resolute', 'dominant'] as const).map((destiny) => ({ type: 'decide', decision: { type: 'destiny', destiny } }));
    expect(s.pendingDecision).toMatchObject({ type: 'epicDestiny', heroId: 'H2' });
    for (const a of picks) s = act(s, a).state;
    // Manifest to Light; Light 2 → 1 + 1, Dark 1 stays; +10 / +8 health; War token removed.
    expect(row(s)).toMatchObject({
      common: { light: 0, dark: 1 }, pools: [4, 3, 4, 3], health: [20, 20, 16, 16],
      track: { light: ['deployTroops', 'manifestEpicDestiny'], dark: ['deployTroops'] },
    });
    expect([s.stage, s.tokens.peaceTreaty]).toEqual(['epic', 'removed']);

    // 2 · H2 (c9) has no unit in Range. End of Turn: Dark has only K + N → generation 1 + 4 = 5 → H2 8.
    expect(destinyGeneration(s, 'dark')).toBe(5);
    s = finish(s);
    expect(row(s)).toMatchObject({ common: { light: 0, dark: 1 }, pools: [4, 8, 4, 3] });

    // 3 · H3 Rook h1×h6 needs a roll now (no War bonus): 6. Light +2 → Tides 1; Dark +1. Generation 1 + 4 → H3 9.
    s = finish(lead(s, 'L-R@h1', 'h6', 6));
    expect(row(s)).toMatchObject({
      common: { light: 2, dark: 2 }, pools: [4, 8, 9, 3],
      track: { light: ['deployTroops', 'manifestEpicDestiny', 'tidesOfDestiny'], dark: ['deployTroops'] },
    });

    // 4 · H4 Leads the King e8–d8 (no roll). Dark has only its King: generation 1 + 5 = 6 → H4 9. Dark total 19.
    s = finish(lead(s, 'D-K@e8', 'd8'));
    expect(row(s)).toMatchObject({ common: { light: 2, dark: 2 }, pools: [4, 8, 9, 9] });
    expect(s.royalFavors.dark.status.destinedForGreatness.done).toBe(false);

    // 5 · H1 Rook a6–a8 (roll 6) checks the King: +2 → Tides 2. Generation 5 → H1 9. Light 4 + 9 + 9 = 22 ≥ 20.
    s = finish(lead(s, 'L-R@a1', 'a8', 6));
    expect(row(s)).toMatchObject({
      common: { light: 4, dark: 2 }, pools: [9, 8, 9, 9],
      track: { light: ['deployTroops', 'manifestEpicDestiny', 'tidesOfDestiny', 'tidesOfDestiny', 'destinedForGreatness'], dark: ['deployTroops'] },
    });

    // 6 · H2 Leads the King out of check d8–d7. Generation 6 → H2 14. Dark 2 + 14 + 9 = 25 ≥ 20.
    s = finish(lead(s, 'D-K@e8', 'd7'));
    expect(row(s)).toMatchObject({
      common: { light: 4, dark: 2 }, pools: [9, 14, 9, 9],
      track: { light: ['deployTroops', 'manifestEpicDestiny', 'tidesOfDestiny', 'tidesOfDestiny', 'destinedForGreatness'], dark: ['deployTroops', 'destinedForGreatness'] },
    });
    expect(s.status).toBe('playing');
  });
});
