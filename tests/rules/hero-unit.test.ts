import { describe, expect, it } from 'vitest';
import { attackSquares } from '../../src/rules/paths.ts';
import {
  apply, heroUnitOptions, isInCheck, legalActions, legalLeadTargets, leadPreview, type FavorId, type GameState,
} from '../../src/rules/index.ts';
import { act, eventsOf, hero, reject } from '../helpers/game.ts';
import { board, name, sq, toPhase, unitOn } from '../fixtures/position.ts';

const PAWNS = { a2: 'P', b2: 'P', c2: 'P', d2: 'P', a7: 'p', b7: 'p', c7: 'p', d7: 'p' };
const FAVORS: FavorId[] = [
  'overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury', 'destinedForGreatness',
  'bloodyTheCastleGates', 'offenseIsTheBestDefense', 'vanquishYourFoes', 'manifestEpicDestiny', 'tidesOfDestiny',
];
const favors = (n: number) => ({ light: FAVORS.slice(0, n) });
const targets = (s: GameState, unitId: string) => legalLeadTargets(s, unitId).map((t) => name(t.to)).sort();
/** Put a position back at Beginning of Turn to try a refused power (no rest happens when nothing is allowed). */
const atBeginning = (s: GameState): GameState => ({ ...structuredClone(s), phase: 'beginningOfTurn' });

describe('US4 – Legendary Powers and Hero Units', () => {
  it('US4-AS1 with 6 Royal Favors a Short range hero becomes a Knight, a Long range hero a Bishop', () => {
    const s = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(6) });
    expect(s.phase).toBe('beginningOfTurn');
    expect(legalActions(s)).toContainEqual({ type: 'becomeHeroUnit', types: ['knight'] });
    const r = act(s, { type: 'becomeHeroUnit', types: ['knight'] });
    expect(unitOn(r.state, 'e4')).toMatchObject({ id: 'HU-H1', kind: 'hero', type: 'knight', heroId: 'H1', side: 'light' });
    expect(hero(r.state, 'H1').heroUnitId).toBe('HU-H1');
    expect(eventsOf(r.events, 'heroUnitChanged')).toEqual([{ type: 'heroUnitChanged', heroId: 'H1', on: true, types: ['knight'] }]);
    const long = board({ ...PAWNS }, { heroes: { H3: 'f4' }, royalFavors: favors(6), active: 'H3' });
    expect(heroUnitOptions(long, 'H3')).toEqual([['bishop']]);
  });

  it('US4-AS1 below 6 Royal Favors the power is locked', () => {
    const s = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(5) });
    expect(s.phase).toBe('move');
    expect(reject(s, { type: 'becomeHeroUnit', types: ['knight'] })).toBe('POWER_LOCKED');
  });

  it('US4-AS2 refused on an occupied square, off the Battlefield, where it would check, or in the path of a check', () => {
    const opts = { royalFavors: favors(6) };
    const code = (s: GameState) => reject(atBeginning(s), { type: 'becomeHeroUnit', types: ['knight'] });
    expect(code(board({ ...PAWNS }, { ...opts, heroes: { H1: 'd2' } }))).toBe('HERO_UNIT_OCCUPIED');
    expect(code(board({ ...PAWNS }, { ...opts, heroes: { H1: 'c0' } }))).toBe('HERO_UNIT_OFF_BATTLEFIELD');
    expect(code(board({ ...PAWNS }, { ...opts, heroes: { H1: 'd6' } }))).toBe('HERO_UNIT_WOULD_CHECK');
    expect(code(board({ ...PAWNS, e7: 'r', a8: 'k' }, { ...opts, heroes: { H1: 'e4' } }))).toBe('HERO_UNIT_IN_CHECK_PATH');
  });

  it('US4-AS3 only at Beginning of Turn; a Hero Unit skips Move, has Range 2 and Leads itself with +4', () => {
    let s = board({ ...PAWNS, c3: 'P', h4: 'R' }, { heroes: { H1: 'e4' }, royalFavors: favors(6), stage: 'epic' });
    s = act(s, { type: 'becomeHeroUnit', types: ['knight'] }).state;
    expect(reject(s, { type: 'becomeHeroUnit', types: ['knight'] })).toBe('ALREADY_HERO_UNIT');
    s = act(s, { type: 'endPhase' }).state;
    expect(s.phase).not.toBe('move');
    s = toPhase(s, 'lead');
    const ids = new Set(legalActions(s).flatMap((a) => (a.type === 'announceLead' ? [a.unitId] : [])));
    expect(ids.has('L-P@c3')).toBe(true); // distance 2
    expect(ids.has('L-R@h4')).toBe(false); // distance 3
    expect(ids.has('HU-H1')).toBe(true);
    expect(leadPreview(s, 'HU-H1')).toMatchObject({ needsRoll: true, modifiers: [{ source: 'heroUnit', value: 4 }] });
    s = act(s, { type: 'announceLead', unitId: 'HU-H1', to: sq('f6') }).state;
    s = act(s, { type: 'submitRoll', value: 2 }).state; // 2 + 4 = 6
    expect(unitOn(s, 'f6')?.id).toBe('HU-H1');
    expect(name(hero(s, 'H1').pos)).toBe('f6');
  });

  it('US4-AS3 a Hero Unit Leading another unit stays where it is', () => {
    let s = board({ ...PAWNS, c3: 'P' }, { heroes: { H1: 'e4' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@c3', to: sq('c4') }).state;
    expect(name(hero(s, 'H1').pos)).toBe('e4');
    expect(s.pendingDecision).toBeNull(); // no Short range advance
  });

  it('US4-AS3 a Hero Unit Led by a friendly hero gets +4', () => {
    const s = board({ ...PAWNS }, {
      heroes: { H1: 'e4', H3: 'f3' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, active: 'H3', stage: 'epic', phase: 'lead',
    });
    expect(targets(s, 'HU-H1').length).toBeGreaterThan(0);
    expect(leadPreview(s, 'HU-H1')?.modifiers).toEqual([{ source: 'heroUnit', value: 4 }]);
  });

  it('US4-AS4 a destroyed Hero Unit: 3 wounds, starting square, no longer a Hero Unit, not in the Graveyard', () => {
    const s = board({ ...PAWNS, e7: 'r', a8: 'k', h1: 'K' }, {
      heroes: { H1: 'e4', H2: 'd8' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, active: 'H2', phase: 'lead',
    });
    const r = act(s, { type: 'announceLead', unitId: 'D-R@e7', to: sq('e4') });
    const h1 = hero(r.state, 'H1');
    expect(r.state.units.some((u) => u.id === 'HU-H1')).toBe(false);
    expect(r.state.graveyard).toEqual([]);
    expect([h1.health, h1.heroUnitId, name(h1.pos)]).toEqual([7, null, 'c0']);
    expect(eventsOf(r.events, 'heroRammed')).toEqual([]);
    expect(r.state.destiny.common.dark).toBe(2 + 1); // Battle + wounding an enemy hero
  });

  it('US4-AS5 a Hero Unit may not Lead itself into Battle with the unit that Rammed it last turn', () => {
    const base = board({ ...PAWNS, f6: 'r' }, { heroes: { H1: 'e4' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    const rammed = (turnsAgo: number) => {
      const s = structuredClone(base);
      hero(s, 'H1').rammedBy = { unitId: 'D-R@f6', turn: s.turnNumber - turnsAgo };
      return s;
    };
    expect(targets(rammed(1), 'HU-H1')).not.toContain('f6');
    expect(reject(rammed(1), { type: 'announceLead', unitId: 'HU-H1', to: sq('f6') })).toBe('RAMMED_BY_TARGET');
    expect(targets(rammed(2), 'HU-H1')).toContain('f6');
  });

  it('US4-AS7 with 8 Royal Favors a hero may become a Rook (Advanced Warfare)', () => {
    expect(heroUnitOptions(board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(7) }), 'H1')).toEqual([['knight']]);
    const s = board({ ...PAWNS }, { heroes: { H1: 'f4' }, royalFavors: favors(8) });
    expect(heroUnitOptions(s, 'H1')).toEqual([['knight'], ['rook']]);
    expect(unitOn(act(s, { type: 'becomeHeroUnit', types: ['rook'] }).state, 'f4')?.type).toBe('rook');
  });

  it('US4-AS8 with 9 Royal Favors a Hero Unit’s Range is 4 (Far Reach)', () => {
    const s = board({ ...PAWNS, a4: 'R' }, { heroes: { H1: 'e4' }, royalFavors: favors(9), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    expect(legalActions(s).some((a) => a.type === 'announceLead' && a.unitId === 'L-R@a4')).toBe(true);
  });

  it('US4-AS9 with 10 Royal Favors a hero may change at End of Turn (Swift Change)', () => {
    const nine = toPhase(board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(9), heroUnits: { H1: ['knight'] } }), 'lead');
    expect(apply(nine, { type: 'endPhase' }).ok).toBe(false); // a Lead is possible; End of Turn would pass by itself
    const ten = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(10), heroUnits: { H1: ['knight'] } });
    expect(legalActions(ten)).toContainEqual({ type: 'leaveHeroUnit' });
    let s = act(toPhase(ten, 'lead'), { type: 'announceLead', unitId: 'HU-H1', to: sq('c5') }).state;
    expect(s.phase).toBe('endOfTurn');
    expect(legalActions(s)).toContainEqual({ type: 'leaveHeroUnit' });
    s = act(s, { type: 'leaveHeroUnit' }).state;
    expect(hero(s, 'H1').heroUnitId).toBeNull();
    expect(reject(s, { type: 'becomeHeroUnit', types: ['knight'] })).toBe('WRONG_PHASE'); // once per phase
  });

  it('US4-AS10 with 11 Royal Favors: Rook and own type at once, either path per Lead, threatens with both', () => {
    let s = board({ ...PAWNS }, { heroes: { H1: 'f4' }, royalFavors: favors(11) });
    expect(heroUnitOptions(s, 'H1')).toEqual([['knight'], ['rook'], ['rook', 'knight']]);
    s = act(s, { type: 'becomeHeroUnit', types: ['rook', 'knight'] }).state;
    const unit = unitOn(s, 'f4')!;
    expect(unit).toMatchObject({ type: 'rook', extraTypes: ['knight'] });
    const attacked = attackSquares(s, unit).map(name);
    expect(attacked).toEqual(expect.arrayContaining(['f3', 'f5', 'a4', 'h4', 'e6', 'g6', 'd3']));
    s = toPhase(s, 'lead');
    expect(targets(s, 'HU-H1')).toEqual(expect.arrayContaining(['f5', 'h4', 'e6', 'g2']));
  });

  it('US4-AS11 a Hero Unit counts as a unit: it blocks paths, blocks check and gives check', () => {
    const s = board({ ...PAWNS, e7: 'r', a8: 'k' }, { heroes: { H1: 'e4' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    expect(isInCheck(s, 'light')).toBe(false);
    const dark = board({ ...PAWNS, e7: 'r', a8: 'k' }, { heroes: { H1: 'e4', H2: 'd8' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, active: 'H2', phase: 'lead' });
    expect(targets(dark, 'D-R@e7')).not.toContain('e3');
    let g = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    const r = act(g, { type: 'announceLead', unitId: 'HU-H1', to: sq('f6') });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['HU-H1'] }]);
    g = r.state;
    expect(isInCheck(g, 'dark')).toBe(true);
  });

  it('a Hero Unit is never Rammed or pushed', () => {
    const s = board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0', H2: 'h3' }, royalFavors: { dark: FAVORS.slice(0, 6) }, heroUnits: { H2: ['knight'] }, phase: 'lead' });
    expect(targets(s, 'L-R@h1')).toContain('h3'); // ending on it is a Battle
    expect(targets(s, 'L-R@h1')).not.toContain('h4'); // the path stops at the Hero Unit
  });
});

describe('spec Q-37 default', () => {
  it('a Hero Unit’s hero placed elsewhere by a rule (Retreat, Unconscious) stops being a Hero Unit', async () => {
    const { placeHero } = await import('../../src/rules/heroes.ts');
    const s = board({ ...PAWNS }, { heroes: { H1: 'e4' }, royalFavors: favors(6), heroUnits: { H1: ['knight'] }, phase: 'lead' });
    const ctx = { s: structuredClone(s), events: [] };
    placeHero(ctx, ctx.s.heroes[0], sq('<0'), 'heroRetreat');
    expect(ctx.s.heroes[0].heroUnitId).toBeNull();
    expect(ctx.s.units.some((u) => u.id === 'HU-H1')).toBe(false);
  });
});
