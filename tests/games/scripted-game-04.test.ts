// Scripted game 04 (004 T068): the four named heroes play into the Epic Stage; pools, uses, costs (one Bloodied) and
// effects are checked against a ledger kept by hand, turn by turn.
import { describe, expect, it } from 'vitest';
import { act } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import type { GameState } from '../../src/rules/index.ts';
import { settle, use } from '../rules/heroes/helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const pools = (s: GameState) => s.heroes.map((x) => x.pool);

describe('scripted game 04', () => {
  it('Cavalier, Scout, Magus and Monk into the Epic Stage', () => {
    // Light: Cavalier H1 (d3), Magus H3 (f2). Dark: Scout H2 (f7), Monk H4 (c7). One Destiny left in the Well.
    let s = board(
      { c3: 'N', e2: 'P', d5: 'p', f6: 'p', c6: 'n', h7: 'p' },
      { heroDefs: { H1: 'cavalier', H2: 'scout', H3: 'magus', H4: 'monk' }, heroes: { H1: 'd3', H2: 'f7', H3: 'f2', H4: 'c7' }, wellRemaining: 1, phase: 'beforeMove' },
    );
    // Ledger, turn 1 (H1 Cavalier): Demoralise (1 use → 0; 1 D from the Cavalier's pool, 006 FR-002).
    expect(pools(s)).toEqual([3, 3, 3, 3]);
    s = use(s, 'cavalier.demoralise').state;
    expect(s.abilityState.H1!.uses['cavalier.demoralise']).toBe(0);
    expect(pools(s)).toEqual([2, 3, 3, 3]);
    expect(s.effects.map((e) => e.kind)).toEqual(['demoralise']);
    // Lead: Knight c3 takes the Pawn on d5 (Peace side: no roll). +2 D Light common, +1 D Dark common; the Well's last
    // Destiny is taken, so the Epic Stage starts at the next Before Turn.
    s = act(s, { type: 'endPhase' }).state; // Move
    s = act(s, { type: 'endPhase' }).state; // Before Lead
    s = act(s, { type: 'announceLead', unitId: 'L-N@c3', to: sq('d5') }).state;
    s = settle(s);
    expect(unitOn(s, 'd5')?.side).toBe('light');
    expect(s.destiny.common).toEqual({ light: 2, dark: 1 });
    expect(s.destiny.well.depleted).toBe(true);
    expect(s.epicPending).toBe(true);
    // Turn 1 ends (After Lead: Warhorse not used; End of Turn).
    while (s.activeHeroId === 'H1' && !s.pendingDecision) s = act(s, { type: 'endPhase' }).state;
    // Before Turn 2: destinies in turn order from H2; H1 depleted the Well and chooses last.
    expect(s.pendingDecision).toMatchObject({ type: 'epicDestiny', heroId: 'H2' });
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'dominant' } }).state; // Scout → Royal Assassin
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'resolute' } }).state; // Magus → Grand Arcanist
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'dominant' } }).state; // Monk → Supreme Inquisitor
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'fanatic' } }).state; // Cavalier → Death Knight
    expect(s.stage).toBe('epic');
    expect(s.heroes.map((x) => x.form)).toEqual(['deathKnight', 'royalAssassin', 'grandArcanist', 'supremeInquisitor']);
    // Common Pools split: Light 2 → 1 each; Dark 1 stays (odd). Health rises (+10 short, +8 long).
    expect(pools(s)).toEqual([3, 3, 4, 3]);
    expect(s.destiny.common).toEqual({ light: 0, dark: 1 });
    expect(s.heroes.map((x) => x.maxHealth)).toEqual([20, 16, 16, 20]);
    // The Demoralise mark stays until the Cavalier's next turn.
    expect(s.effects.map((e) => e.kind)).toEqual(['demoralise']);

    // Turn 2 (H2 Royal Assassin): Kill Order on the Knight d5 in range (4 D: 3 from the pool, 1 from the Common Pool).
    while (s.phase !== 'beforeLead') s = act(s, { type: 'endPhase' }).state;
    s = act(s, { type: 'useAbility', abilityId: 'royalAssassin.killOrder', targets: [{ unitId: 'L-N@c3' }] }).state;
    expect(h(s, 'H2').pool).toBe(0);
    expect(s.destiny.common.dark).toBe(0);
    expect(s.effects.map((e) => e.kind)).toEqual(['demoralise', 'killOrder']);

    // A Bloodied Grand Arcanist (moved to f5, in range of the Scout) pays the Bloodied cost: Magic Bombardment 3/4.
    const b = { ...s, activeHeroId: 'H3' as const, phase: 'beforeMove' as const, heroes: s.heroes.map((x) => (x.id === 'H3' ? { ...x, health: 6, pool: 10, pos: sq('f5') } : x)) };
    const r = act(b, { type: 'useAbility', abilityId: 'grandArcanist.magicBombardment', option: 'wound', targets: [{ heroId: 'H2' }] });
    expect(r.events.find((e) => e.type === 'abilityUsed')).toMatchObject({ destiny: 4 });
    expect(h(r.state, 'H3').pool).toBe(6);
  });
});
