import { describe, expect, it } from 'vitest';
import { apply, type GameState, type Unit } from '../../src/rules/index.ts';
import { act, eventsOf, hero, passTurn } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';

/** Four pawns per side on their starting squares keep *Deploy Troops* from completing in small positions. */
const PAWNS = { a2: 'P', b2: 'P', c2: 'P', d2: 'P', a7: 'p', b7: 'p', c7: 'p', d7: 'p' };
const done = (s: GameState, side: 'light' | 'dark', id: keyof GameState['royalFavors']['light']['status']) => s.royalFavors[side].status[id].done;

describe('US3 – Royal Favors', () => {
  it('US3-AS1 Bloody the Castle Gates: a Battle on the enemy’s Royal rank', () => {
    const s = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead' });
    expect(done(s, 'light', 'bloodyTheCastleGates')).toBe(false);
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') }).state;
    expect(done(r, 'light', 'bloodyTheCastleGates')).toBe(true);
    expect(r.royalFavors.light.track).toEqual(['bloodyTheCastleGates']);
  });

  it('US3-AS2 Overwhelm: one Ram is half, a second Ram completes it', () => {
    const one = act(board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0', H2: 'h3' }, phase: 'lead' }),
      { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') });
    expect(one.state.royalFavors.light.status.overwhelm).toEqual({ progress: 1, done: false });
    expect(eventsOf(one.events, 'favorProgress')).toEqual([{ type: 'favorProgress', side: 'light', id: 'overwhelm', progress: 1, target: 2 }]);
    const two = act(board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0', H2: 'h3', H4: 'h4' }, phase: 'lead' }),
      { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') }).state;
    expect(two.royalFavors.light.status.overwhelm).toEqual({ progress: 2, done: true });
  });

  it('US3-AS3 Great Incursion: 3 non-hero units in the enemy’s 4 ranks', () => {
    const s = board({ ...PAWNS, e5: 'R', f6: 'N', g8: 'B' });
    expect(done(s, 'light', 'greatIncursion')).toBe(true);
    expect(done(s, 'dark', 'greatIncursion')).toBe(false);
    const two = board({ ...PAWNS, e4: 'R', f6: 'N', g8: 'B' });
    expect(done(two, 'light', 'greatIncursion')).toBe(false);
    const heroUnit = board({ ...PAWNS, f6: 'N', g8: 'B' }, { heroes: { H1: 'e5' }, heroUnits: { H1: ['knight'] } });
    expect(done(heroUnit, 'light', 'greatIncursion')).toBe(false);
  });

  it('US3-AS4 Tactical Genius: a discovered check', () => {
    const s = board({ ...PAWNS, e3: 'R', e5: 'N' }, { heroes: { H1: 'd4' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-N@e5', to: sq('g4') });
    expect(eventsOf(r.events, 'check')).toHaveLength(1);
    expect(done(r.state, 'light', 'tacticalGenius')).toBe(true);
    const direct = act(board({ ...PAWNS, h3: 'R' }, { heroes: { H1: 'g3' }, phase: 'lead' }),
      { type: 'announceLead', unitId: 'L-R@h3', to: sq('e3') }).state;
    expect(done(direct, 'light', 'tacticalGenius')).toBe(false);
  });

  it('US3-AS5 Deploy Troops: 3 or fewer pawns on the pawn starting squares', () => {
    const s = board({ ...PAWNS }, { heroes: { H1: 'b1' }, phase: 'lead' });
    expect(done(s, 'light', 'deployTroops')).toBe(false);
    const r = act(s, { type: 'announceLead', unitId: 'L-P@b2', to: sq('b3') }).state;
    expect(done(r, 'light', 'deployTroops')).toBe(true);
    expect(done(r, 'dark', 'deployTroops')).toBe(false);
  });

  it('US3-AS6 Royal’s Fury: Battles by King or Queen count 1, 2, done at 3', () => {
    const s = board({ ...PAWNS, h1: 'Q', h5: 'n' }, { heroes: { H1: 'g1' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-Q@h1', to: sq('h5') }).state;
    expect(r.royalFavors.light.status.royalsFury).toEqual({ progress: 1, done: false });
    const k = structuredClone(board({ ...PAWNS, e1: 'K', f2: 'n' }, { heroes: { H1: 'f1' }, phase: 'lead' }));
    k.royalFavors.light.status.royalsFury.progress = 2;
    const r2 = act(k, { type: 'announceLead', unitId: 'L-K@e1', to: sq('f2') }).state;
    expect(r2.royalFavors.light.status.royalsFury).toEqual({ progress: 3, done: true });
    const rook = act(board({ ...PAWNS, h1: 'R', h5: 'n' }, { heroes: { H1: 'g1' }, phase: 'lead' }),
      { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') }).state;
    expect(rook.royalFavors.light.status.royalsFury.progress).toBe(0);
  });

  it('US3-AS7 Decimate: 7 Destroyed enemy main units in the Graveyard', () => {
    const s = structuredClone(board({ ...PAWNS }));
    const dead = (n: number): Unit => ({
      id: `D-X-${n}`, side: 'dark', type: 'pawn', originalType: 'pawn', kind: 'main', pos: { x: 1, y: 7 }, hasBeenLed: true,
      promoted: false, enPassantTarget: null,
    });
    s.graveyard = [1, 2, 3, 4, 5, 6].map(dead);
    const six = apply(s, { type: 'endPhase' });
    expect(six.ok && done(six.state, 'light', 'decimate')).toBe(false);
    s.graveyard.push(dead(7));
    const seven = apply(s, { type: 'endPhase' });
    expect(seven.ok && done(seven.state, 'light', 'decimate')).toBe(true);
  });

  it('US3-AS8 Offense is the Best Defense: an enemy unit threatened by 3 friendly units', () => {
    const s = board({ ...PAWNS, d5: 'n', h5: 'R', g8: 'B', c3: 'N' });
    expect(done(s, 'light', 'offenseIsTheBestDefense')).toBe(true);
    expect(done(s, 'dark', 'offenseIsTheBestDefense')).toBe(false);
    expect(done(board({ ...PAWNS, d5: 'n', h5: 'R', c3: 'N' }), 'light', 'offenseIsTheBestDefense')).toBe(false);
  });

  it('US3-AS9 Vanquish your Foes: an enemy hero to 0 completes it', () => {
    const s = board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0', H2: 'h3' }, health: { H2: 3 }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') }).state;
    expect(hero(r, 'H2').health).toBe(0);
    expect(done(r, 'light', 'vanquishYourFoes')).toBe(true);
  });

  it('US3-AS9 Vanquish your Foes: one Epic enemy Bloodied is half, a second different one completes it', () => {
    const lead = (heroes: Record<string, string>, health: Record<string, number>) => {
      let s = board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0', ...heroes }, health, stage: 'epic', phase: 'lead' });
      s = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') }).state;
      return act(s, { type: 'submitRoll', value: 20 }).state;
    };
    const one = lead({ H2: 'h3' }, { H2: 12 });
    expect(one.royalFavors.light.vanquishBloodied).toEqual(['H2']);
    expect(one.royalFavors.light.status.vanquishYourFoes).toEqual({ progress: 1, done: false });
    const two = lead({ H2: 'h3', H4: 'h4' }, { H2: 12, H4: 10 });
    expect(two.royalFavors.light.vanquishBloodied).toEqual(['H2', 'H4']);
    expect(done(two, 'light', 'vanquishYourFoes')).toBe(true);
  });

  it('US3-AS10 Destined for Greatness: 20+ D on the side at End of Turn', () => {
    const s = board({ ...PAWNS }, { common: { light: 14 } }); // 14 + 3 + 3 = 20
    expect(done(s, 'light', 'destinedForGreatness')).toBe(false);
    const r = passTurn(s).state;
    expect(done(r, 'light', 'destinedForGreatness')).toBe(true);
    expect(done(r, 'dark', 'destinedForGreatness')).toBe(false);
    expect(done(passTurn(board({ ...PAWNS }, { common: { light: 13 } })).state, 'light', 'destinedForGreatness')).toBe(false);
  });

  it('US3-AS11 Tides of Destiny: after depletion, a Common Pool gain on the own turn, once per turn, up to 5', () => {
    const battle = (opts: Parameters<typeof board>[1]) => {
      let s = board({ ...PAWNS, h1: 'R', h6: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead', ...opts });
      s = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h6') }).state;
      return s.phase === 'lead' && s.turn.lead?.success === null ? act(s, { type: 'submitRoll', value: 20 }).state : s;
    };
    const starting = battle({});
    expect(starting.royalFavors.light.tides).toBe(0);
    const epic = battle({ stage: 'epic' });
    expect(epic.royalFavors.light.tides).toBe(1);
    expect(epic.royalFavors.light.track).toEqual(['tidesOfDestiny']);
    expect(epic.royalFavors.dark.tides).toBe(0); // Dark gained on Light's turn
    expect(passTurn(epic).state.royalFavors.light.tidesThisTurn).toBe(false);
    const five = Array<'tidesOfDestiny'>(5).fill('tidesOfDestiny');
    const max = battle({ stage: 'epic', royalFavors: { light: five } });
    expect(max.royalFavors.light.tides).toBe(5);
    expect(max.royalFavors.light.track).toHaveLength(5);
    expect(done(max, 'light', 'tidesOfDestiny')).toBe(true);
  });

  it('US3-AS11 two Common Pool gains in one turn count once', () => {
    // A Battle (+2) that also gives check (+2).
    let s = board({ ...PAWNS, h1: 'R', h6: 'n', h8: 'k' }, { heroes: { H1: 'g0' }, phase: 'lead', stage: 'epic' });
    s = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h6') }).state;
    s = act(s, { type: 'submitRoll', value: 20 }).state;
    expect(s.destiny.common.light).toBe(4);
    expect(s.royalFavors.light.tides).toBe(1);
  });

  it('US3-AS12 each numbered Royal Favor completes only once', () => {
    const s = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead', royalFavors: { light: ['bloodyTheCastleGates'] } });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') });
    expect(r.state.royalFavors.light.track).toEqual(['bloodyTheCastleGates']);
    expect(eventsOf(r.events, 'favorCompleted')).toEqual([]);
  });

  it('US3-AS13 a completion fills the next slot, sends favorCompleted and writes the log', () => {
    const s = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead', royalFavors: { light: ['overwhelm', 'decimate'] } });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') });
    expect(eventsOf(r.events, 'favorCompleted')).toEqual([{ type: 'favorCompleted', side: 'light', id: 'bloodyTheCastleGates', slot: 3 }]);
    expect(r.state.royalFavors.light.track).toEqual(['overwhelm', 'decimate', 'bloodyTheCastleGates']);
    expect(r.state.log.some((l) => l.type === 'favorCompleted')).toBe(true);
  });

  it('edge: several completions from one action go in rulebook order', () => {
    // Battle on the Royal rank (1) whose Ram brings an enemy hero to 0 (9): the Ram happens first, the track is 1 then 9.
    const s = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0', H2: 'h5' }, health: { H2: 3 }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') }).state;
    expect(r.royalFavors.light.track).toEqual(['bloodyTheCastleGates', 'vanquishYourFoes']);
  });

  it('edge: a position Royal Favor that holds for both sides completes for each', () => {
    const s = board({ ...PAWNS, e5: 'R', f6: 'N', g8: 'B', e4: 'r', f3: 'n', g1: 'b' });
    expect(done(s, 'light', 'greatIncursion')).toBe(true);
    expect(done(s, 'dark', 'greatIncursion')).toBe(true);
  });

  it('edge: earned Royal Favors are never lost when the condition stops holding', () => {
    let s = board({ ...PAWNS, e5: 'R', f5: 'N', g8: 'B' }, { heroes: { H1: 'd5' }, phase: 'lead' });
    expect(done(s, 'light', 'greatIncursion')).toBe(true);
    s = act(s, { type: 'announceLead', unitId: 'L-R@e5', to: sq('e3') }).state;
    expect(done(s, 'light', 'greatIncursion')).toBe(true);
    expect(s.royalFavors.light.track).toEqual(['greatIncursion']);
  });

  it('Legendary Powers unlock at 6…11; reaching 7 gives a King’s Forces token', () => {
    const five = ['overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury'] as const;
    const s = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead', royalFavors: { light: [...five] } });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') });
    expect(eventsOf(r.events, 'powerUnlocked')).toEqual([{ type: 'powerUnlocked', side: 'light', power: 'heroUnit' }]);
    expect(r.state.royalFavors.light.kingsForces).toBe(0);
    const six = board({ ...PAWNS, h1: 'R', h8: 'n' }, { heroes: { H1: 'g0' }, phase: 'lead', royalFavors: { light: [...five, 'deployTroops'] } });
    const r7 = act(six, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') });
    expect(eventsOf(r7.events, 'powerUnlocked').map((e) => e.power)).toEqual(['kingsForces']);
    expect(r7.state.royalFavors.light.kingsForces).toBe(1);
  });
});
