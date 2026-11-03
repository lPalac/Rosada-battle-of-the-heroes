import { describe, expect, it } from 'vitest';
import { act, eventsOf, hero, passTurn, run } from '../helpers/game.ts';
import { board, name, sq } from '../fixtures/position.ts';

const lead = (unitId: string, to: string) => ({ type: 'announceLead' as const, unitId, to: sq(to) });

describe('US4 – Ram and push', () => {
  it('US4-AS1 an enemy hero mid-path lands one square past the end square, takes 3 wounds, Leading side +1 D', () => {
    const s = board({ a1: 'R' }, { heroes: { H1: 'b0', H2: 'a3' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a5'));
    expect(name(hero(r.state, 'H2').pos)).toBe('a6');
    expect(hero(r.state, 'H2').health).toBe(7);
    expect(eventsOf(r.events, 'heroRammed')).toEqual([
      { type: 'heroRammed', heroId: 'H2', byUnitId: 'L-R@a1', landing: sq('a6'), sentToStart: false },
    ]);
    expect(r.state.destiny.common.light).toBe(1);
  });

  it('US4-AS2 every enemy hero on a shared square is Rammed (+1 D each); friendly heroes are not', () => {
    const s = board({ a1: 'R' }, { heroes: { H1: 'b0', H2: 'a3', H4: 'a3', H3: 'a3' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a5'));
    expect(eventsOf(r.events, 'heroRammed').map((e) => e.heroId).sort()).toEqual(['H2', 'H4']);
    expect(hero(r.state, 'H4').health).toBe(5);
    expect(name(hero(r.state, 'H3').pos)).toBe('a3');
    expect(hero(r.state, 'H3').health).toBe(8);
    expect(r.state.destiny.common.light).toBe(2);
  });

  it('US4-AS3 Knight b1→c3 Rams a hero on c3 to d3', () => {
    const s = board({ b1: 'N' }, { heroes: { H1: 'b0', H2: 'c3' }, phase: 'lead' });
    const r = act(s, lead('L-N@b1', 'c3'));
    expect(name(hero(r.state, 'H2').pos)).toBe('d3');
    expect(hero(r.state, 'H2').health).toBe(7);
  });

  it('US4-AS4 a landing square holding a King sends the hero to their starting square', () => {
    const s = board({ a1: 'R', a7: 'k', h8: 'b' }, { heroes: { H1: 'b0', H2: 'a4' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a6'));
    expect(hero(r.state, 'H2').pos).toEqual(hero(r.state, 'H2').startSquare);
    expect(eventsOf(r.events, 'heroRammed')[0].sentToStart).toBe(true);
  });

  it('US4-AS5 a push onto a square with another hero is allowed: they share', () => {
    const s = board({ a1: 'R' }, { heroes: { H1: 'b0', H2: 'a3', H4: 'a6' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a5'));
    expect(name(hero(r.state, 'H2').pos)).toBe('a6');
    expect(name(hero(r.state, 'H4').pos)).toBe('a6');
  });

  it('a push onto a square holding a non-King unit is allowed (spec Q-17 default)', () => {
    const s = board({ a1: 'R', a6: 'p' }, { heroes: { H1: 'b0', H2: 'a3' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a5'));
    expect(name(hero(r.state, 'H2').pos)).toBe('a6');
  });

  it('US4-AS6 a friendly hero in the path is not Rammed, not wounded and does not block the Lead', () => {
    const s = board({ a1: 'R' }, { heroes: { H1: 'b0', H3: 'a3' }, phase: 'lead' });
    const r = act(s, lead('L-R@a1', 'a5'));
    expect(eventsOf(r.events, 'heroRammed')).toEqual([]);
    expect(name(hero(r.state, 'H3').pos)).toBe('a3');
    expect(r.state.units.find((u) => u.id === 'L-R@a1')?.pos).toEqual(sq('a5'));
  });

  it('US4-AS7 a Rammed hero has no Lead restriction next turn in v1; the Ramming unit is recorded', () => {
    let s = act(board({ a1: 'R', a7: 'r' }, { heroes: { H1: 'b0', H2: 'a3' }, phase: 'lead' }), lead('L-R@a1', 'a5')).state;
    expect(hero(s, 'H2').rammedBy).toBe('L-R@a1');
    s = passTurn(s).state;
    expect(s.activeHeroId).toBe('H2');
    // H2 stands on a6 next to its Rook on a7 and may Lead it into Battle with the Rook that Rammed it.
    s = run(s, [{ type: 'endPhase' }, { type: 'endPhase' }]).state;
    const r = run(s, [lead('D-R@a7', 'a5'), { type: 'submitRoll', value: 15 }]).state;
    expect(r.graveyard.map((u) => u.id)).toContain('L-R@a1');
  });

  it("US4-AS8 King's Banishment: enemy hero to its starting square with −1 Movement next turn; friendly heroes pushed in the King's direction", () => {
    let s = board({ e1: 'K' }, { heroes: { H1: 'd0', H2: 'e2', H3: 'e2' }, phase: 'lead' });
    const r = act(s, lead('L-K@e1', 'e2'));
    expect(hero(r.state, 'H2').pos).toEqual(hero(r.state, 'H2').startSquare);
    expect(hero(r.state, 'H2').health).toBe(7);
    expect(name(hero(r.state, 'H3').pos)).toBe('e3');
    expect(eventsOf(r.events, 'heroPushed')[0]).toMatchObject({ heroId: 'H3', sentToStart: false });
    s = r.state;
    s = passTurn(s).state;
    expect(s.activeHeroId).toBe('H2');
    expect(s.turn.movementLeft).toBe(4);
  });

  it("King's Banishment while castling: a friendly hero pushed onto the King's end square goes to its starting square", () => {
    const s = board({ e1: 'K', h1: 'R' }, { heroes: { H1: 'e0', H3: 'f1' }, phase: 'lead' });
    const r = act(s, lead('L-K@e1', 'g1'));
    expect(hero(r.state, 'H3').pos).toEqual(hero(r.state, 'H3').startSquare);
    expect(hero(r.state, 'H3').health).toBe(8);
  });
});
