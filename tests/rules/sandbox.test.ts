import { describe, expect, it } from 'vitest';
import { apply, legalLeadTargets } from '../../src/rules/index.ts';
import { act, eventsOf, hero, reject, run } from '../helpers/game.ts';
import { board, name, sq, toPhase, unitOn } from '../fixtures/position.ts';

describe('US6 – Sandbox mode', () => {
  it('US6-AS1 with rules off, anything can be placed anywhere and counters edited', () => {
    let s = board({ d2: 'P' }, { heroes: { H1: 'd1' } });
    s = act(s, { type: 'setEnforcement', mode: 'sandbox' }).state;
    expect(s.enforcement).toBe('sandbox');
    expect(reject(s, { type: 'moveStep', to: sq('d0') })).toBe('SANDBOX_MODE');
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-K@e1' }, to: sq('d2') }, // King onto an occupied square
      { type: 'sandboxPlace', target: { heroId: 'H2' }, to: sq('e5') },
      { type: 'sandboxPlace', target: { unitId: 'D-K@e8' }, to: 'graveyard' },
      { type: 'sandboxPlace', target: { unitId: 'D-K@e8' }, to: sq('e7') },
      { type: 'sandboxSet', path: 'health', target: 'H1', value: 3 },
      { type: 'sandboxSet', path: 'pool', target: 'H1', value: 9 },
      { type: 'sandboxSet', path: 'common', target: 'dark', value: 4 },
      { type: 'sandboxSet', path: 'revenge', target: 'light', value: 1 },
      { type: 'sandboxSet', path: 'peaceTreaty', value: 'war' },
    ]).state;
    expect(s.units.filter((u) => name(u.pos) === 'd2')).toHaveLength(2);
    expect(name(hero(s, 'H2').pos)).toBe('e5');
    expect(unitOn(s, 'e7')?.id).toBe('D-K@e8');
    expect(hero(s, 'H1')).toMatchObject({ health: 3, pool: 9 });
    expect(s.destiny.common.dark).toBe(4);
    expect(s.tokens).toEqual({ peaceTreaty: 'war', revenge: { light: 1, dark: 0 } });
    expect(s.log.some((l) => l.type === 'enforcementChanged')).toBe(true);
  });

  it('US6-AS2 after the game ends, Continue in sandbox keeps the final position editable', () => {
    let s = board({ a1: 'K', b3: 'q', e8: 'k' }, { heroes: { H1: 'c0' }, phase: 'beforeLead' });
    s = act(s, { type: 'endPhase' }).state;
    expect(s.status).toBe('ended');
    const units = s.units.length;
    s = act(s, { type: 'setEnforcement', mode: 'sandbox' }).state;
    expect(s.units).toHaveLength(units);
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'D-Q@b3' }, to: sq('h5') }).state;
    expect(unitOn(s, 'h5')?.type).toBe('queen');
  });

  it('US6-AS3 no win or draw is declared automatically in sandbox', () => {
    let s = act(board({ a8: 'k', b6: 'K', h1: 'R' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h8') }, // mate on the board
      { type: 'sandboxPlace', target: { unitId: 'D-K@a8' }, to: 'graveyard' },
    ]).state;
    expect(s.status).toBe('playing');
    expect(s.result).toBeNull();
  });

  it('US6-AS4 a roll by hand is shown but not applied', () => {
    const s = act(board({ d2: 'P' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    const r = act(s, { type: 'submitRoll', value: 17 });
    expect(eventsOf(r.events, 'rolled')).toEqual([{ type: 'rolled', value: 17, total: null, success: null }]);
    expect(r.state.units).toEqual(s.units);
  });

  it('US6-AS5 a legal position resumes at Before Turn of the active hero (checkmate is checked first)', () => {
    let s = act(board({ d2: 'P' }, { heroes: { H1: 'd1' } }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = act(s, { type: 'setEnforcement', mode: 'rules' }).state;
    expect(s.enforcement).toBe('rules');
    expect(s.activeHeroId).toBe('H1');
    expect(s.phase).toBe('move');
    const turnStarted = s.log.filter((l) => l.type === 'phaseChanged').slice(-4).map((l) => l.data.phase);
    expect(turnStarted).toEqual(['beforeTurn', 'beginningOfTurn', 'beforeMove', 'move']);
    // A mate set up by hand is detected on resume.
    let m = act(board({ a8: 'k', b6: 'K', h1: 'R' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    m = act(m, { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h8') }).state;
    m = act(m, { type: 'setEnforcement', mode: 'rules' }).state;
    expect(m.result).toMatchObject({ kind: 'win', winner: 'light', by: 'checkmate' });
  });

  it('US6-AS6 an illegal position lists every problem and stays in sandbox (quickstart step 6)', () => {
    let s = act(board({ b1: 'N' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-N@b1' }, to: sq('e1') }).state;
    s = act(s, { type: 'sandboxSet', path: 'revenge', target: 'dark', value: 3 }).state;
    const r = apply(s, { type: 'setEnforcement', mode: 'rules' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('POSITION_INVALID');
    expect(r.error.problems?.map((p) => p.message)).toEqual(
      expect.arrayContaining(['Light King shares e1 (L-N@b1)', 'Dark holds 3 Revenge tokens (max 2)']),
    );
    expect(s.enforcement).toBe('sandbox');
  });

  it('FR-103 also catches units off the Battlefield, a missing King, unpromoted pawns, bad health and pools', () => {
    let s = act(board({ a2: 'P' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-P@a2' }, to: sq('a8') },
      { type: 'sandboxPlace', target: { unitId: 'D-K@e8' }, to: 'graveyard' },
      { type: 'sandboxSet', path: 'health', target: 'H1', value: 11 },
      { type: 'sandboxSet', path: 'pool', target: 'H2', value: -1 },
    ]).state;
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-K@e1' }, to: sq('e0') }).state;
    const r = apply(s, { type: 'setEnforcement', mode: 'rules' });
    const codes = r.ok ? [] : r.error.problems!.map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(['UNIT_OFF_BATTLEFIELD', 'KING_COUNT', 'UNPROMOTED_PAWN', 'BAD_HEALTH', 'NEGATIVE_POOL']));
  });

  it('FR-104 units moved in sandbox count as Led (no castling) and en passant chances are cleared', () => {
    let s = act(board({ e1: 'K', h1: 'R' }, { heroes: { H1: 'e0' } }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h2') },
      { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h1') },
      { type: 'setEnforcement', mode: 'rules' },
    ]).state;
    expect(s.units.find((u) => u.id === 'L-R@h1')?.hasBeenLed).toBe(true);
    s = toPhase(s, 'lead');
    expect(legalLeadTargets(s, 'L-K@e1').map((t) => name(t.to))).not.toContain('g1');
    expect(s.units.every((u) => u.enPassantTarget === null)).toBe(true);
  });
});

describe('002 – pieces on the table beside the board (research R-05)', () => {
  it('sandboxPlace accepts table squares off the 10×10 grid and rejects anything off the table', () => {
    let s = act(board({ a2: 'P' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-P@a2' }, to: { x: -3, y: 4 } }).state;
    expect(s.units.find((u) => u.id === 'L-P@a2')?.pos).toEqual({ x: -3, y: 4 });
    s = act(s, { type: 'sandboxPlace', target: { heroId: 'H2' }, to: { x: 12, y: 9 } }).state;
    expect(hero(s, 'H2').pos).toEqual({ x: 12, y: 9 });
    expect(reject(s, { type: 'sandboxPlace', target: { unitId: 'L-P@a2' }, to: { x: 40, y: 0 } })).toBe('BAD_SQUARE');
    expect(reject(s, { type: 'sandboxPlace', target: { heroId: 'H2' }, to: 'graveyard' })).toBe('BAD_SQUARE');
  });
});

describe('002 US3 – resume rules from a physical sandbox position', () => {
  it('US3-AS2 a unit neither on the Battlefield nor in a Graveyard blocks resuming; a hero off the grid too', () => {
    let s = act(board({ c1: 'B' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: { x: 14, y: 4 } },
      { type: 'sandboxPlace', target: { heroId: 'H4' }, to: { x: -3, y: 2 } },
    ]).state;
    const r = apply(s, { type: 'setEnforcement', mode: 'rules' });
    expect(r.ok).toBe(false);
    const messages = r.ok ? [] : r.error.problems!.map((p) => p.message);
    expect(messages).toContain('L-B@c1 is not on the Battlefield or in a Graveyard');
    expect(messages).toContain('H4 is not on the board');
    // The Outskirts are not the Battlefield either.
    const t = act(act(board({ c1: 'B' }), { type: 'setEnforcement', mode: 'sandbox' }).state,
      { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: sq('c0') }).state;
    expect(apply(t, { type: 'setEnforcement', mode: 'rules' }).ok).toBe(false);
  });

  it('US3-AS3 a unit dropped into a Graveyard zone goes to the Graveyard; US3-AS4 and back onto a square', () => {
    let s = act(board({ c1: 'B' }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: 'graveyard' }).state;
    expect(s.graveyard.map((u) => u.id)).toEqual(['L-B@c1']);
    expect(s.units.some((u) => u.id === 'L-B@c1')).toBe(false);
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: sq('d3') }).state;
    expect(s.units.find((u) => u.id === 'L-B@c1')?.pos).toEqual(sq('d3'));
    expect(s.graveyard).toEqual([]);
  });

  it('US3-AS5 once the problems are fixed, play resumes at Before Turn and moved units count as Led', () => {
    let s = act(board({ c1: 'B', h1: 'R' }, { heroes: { H1: 'e0' } }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: { x: 14, y: 4 } }).state;
    expect(apply(s, { type: 'setEnforcement', mode: 'rules' }).ok).toBe(false);
    s = run(s, [
      { type: 'sandboxPlace', target: { unitId: 'L-B@c1' }, to: 'graveyard' },
      { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h2') },
      { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h1') },
      { type: 'setEnforcement', mode: 'rules' },
    ]).state;
    expect(s.phase).toBe('move');
    expect(s.units.find((u) => u.id === 'L-R@h1')?.hasBeenLed).toBe(true);
  });
});

describe('003 – sandbox values for the Epic Stage, Royal Favors and Hero Units (FR-050, T047)', () => {
  it('edits stage, destiny, Royal Favors, King’s Forces and Hero Units; the position check covers Hero Units', () => {
    let s = act(board({ a2: 'P', b2: 'P', c2: 'P', d2: 'P' }, { heroes: { H1: 'e4' } }), { type: 'setEnforcement', mode: 'sandbox' }).state;
    s = run(s, [
      { type: 'sandboxSet', path: 'stage', value: 'epic' },
      { type: 'sandboxSet', path: 'destiny', target: 'H1', value: 'fanatic' },
      { type: 'sandboxSet', path: 'favor', target: 'light:overwhelm', value: 1 },
      { type: 'sandboxSet', path: 'favor', target: 'light:decimate', value: 'done' },
      { type: 'sandboxSet', path: 'favor', target: 'light:tidesOfDestiny', value: 2 },
      { type: 'sandboxSet', path: 'kingsForces', target: 'light', value: 2 },
      { type: 'sandboxSet', path: 'heroUnit', target: 'H1', value: 'rook,knight' },
    ]).state;
    expect(s.stage).toBe('epic');
    expect(hero(s, 'H1')).toMatchObject({ maxHealth: 20, health: 20, epic: { destiny: 'fanatic' }, heroUnitId: 'HU-H1' });
    expect(s.tokens.peaceTreaty).toBe('removed');
    expect(s.royalFavors.light.status.overwhelm).toEqual({ progress: 1, done: false });
    expect(s.royalFavors.light.track).toEqual(['decimate', 'tidesOfDestiny', 'tidesOfDestiny']);
    expect(s.royalFavors.light.kingsForces).toBe(2);
    expect(unitOn(s, 'e4')).toMatchObject({ kind: 'hero', type: 'rook', extraTypes: ['knight'] });
    // Moving the Hero Unit moves its hero; a Hero Unit may not share a square.
    s = act(s, { type: 'sandboxPlace', target: { unitId: 'HU-H1' }, to: sq('d2') }).state;
    expect(name(hero(s, 'H1').pos)).toBe('d2');
    const r = apply(s, { type: 'setEnforcement', mode: 'rules' });
    expect(r.ok ? [] : r.error.problems?.map((p) => p.code)).toContain('HERO_UNIT_SHARES');
    s = act(s, { type: 'sandboxPlace', target: { heroId: 'H1' }, to: sq('e5') }).state;
    expect(unitOn(s, 'e5')?.id).toBe('HU-H1');
    expect(act(s, { type: 'setEnforcement', mode: 'rules' }).state.enforcement).toBe('rules');
  });
});
