import { describe, expect, it } from 'vitest';
import { legalActions, type FavorId, type GameState } from '../../src/rules/index.ts';
import { act, reject } from '../helpers/game.ts';
import { board, unitOn } from '../fixtures/position.ts';

const PAWNS = { a2: 'P', b2: 'P', c2: 'P', d2: 'P', a7: 'p', b7: 'p', c7: 'p', d7: 'p' };
const SEVEN: FavorId[] = ['overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury', 'destinedForGreatness', 'bloodyTheCastleGates'];
const atBeginning = (s: GameState): GameState => ({ ...structuredClone(s), phase: 'beginningOfTurn' });

describe("US4-AS6 – King's Forces", () => {
  it("US4-AS6 a token creates an auxiliary unit of the hero's type on its square at Beginning of Turn", () => {
    const s = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: { light: SEVEN }, kingsForces: { light: 1 } });
    expect(s.phase).toBe('beginningOfTurn');
    expect(legalActions(s)).toContainEqual({ type: 'kingsForces' });
    const r = act(s, { type: 'kingsForces' }).state;
    expect(unitOn(r, 'e4')).toMatchObject({ kind: 'auxiliary', type: 'knight', side: 'light' });
    expect(r.royalFavors.light.kingsForces).toBe(0);
    expect(reject(r, { type: 'kingsForces' })).toBe('NO_KINGS_FORCES');
  });

  it("US4-AS6 refused on an occupied square, where it would give check, or without a token", () => {
    const opts = { royalFavors: { light: SEVEN }, kingsForces: { light: 1 } };
    expect(reject(atBeginning(board({ ...PAWNS }, { ...opts, heroes: { H1: 'd2' } })), { type: 'kingsForces' })).toBe('CREATE_OCCUPIED');
    expect(reject(atBeginning(board({ ...PAWNS }, { ...opts, heroes: { H1: 'd6' } })), { type: 'kingsForces' })).toBe('CREATE_WOULD_CHECK');
    expect(reject(atBeginning(board({ ...PAWNS }, { ...opts, heroes: { H1: 'c0' } })), { type: 'kingsForces' })).toBe('HERO_UNIT_OFF_BATTLEFIELD');
    const none = board({ ...PAWNS }, { royalFavors: { light: SEVEN }, heroes: { H1: 'e4' } });
    expect(reject(atBeginning(none), { type: 'kingsForces' })).toBe('NO_KINGS_FORCES');
  });

  it('reaching 7 Royal Favors in play gives the token', () => {
    // Covered with the threshold test in royal-favors.test.ts; here the token is usable next Beginning of Turn.
    const s = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: { light: SEVEN }, kingsForces: { light: 1 } });
    expect(unitOn(act(s, { type: 'kingsForces' }).state, 'e4')?.id).toBe('A-L-N-1');
  });
});
