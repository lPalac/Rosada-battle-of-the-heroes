// US7 scenarios against the headless rules core and HUD model (constitution IV); the browser half is
// tests/e2e/turn.spec.ts.
import { describe, expect, it } from 'vitest';
import { highlights, hudModel } from '../../src/game/hud-model.ts';
import { act } from '../helpers/game.ts';
import { board, name, sq } from '../fixtures/position.ts';

describe('US7 – what the 3D table and HUD show', () => {
  it('US7-AS1 selecting a unit gives its legal destination squares, Battles marked', () => {
    const s = board({ b1: 'N', c3: 'p' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const none = highlights(s, null);
    expect(none.selectable).toEqual(['L-N@b1']);
    expect(none.leads).toEqual([]);
    const h = highlights(s, 'L-N@b1');
    expect(h.leads.map((l) => [name(l.to), l.isBattle]).sort()).toEqual([['a3', false], ['c3', true], ['d2', false]]);
  });

  it('US7-AS1 in the Move phase the adjacent squares are highlighted', () => {
    const s = board({}, { heroes: { H1: 'e0' } });
    expect(highlights(s, null).moves.map(name).sort()).toEqual(['d0', 'd1', 'e1', 'f0', 'f1'].sort());
  });

  it('US7-AS2 a roll shows the modifiers, target, the face, the total and success/fail', () => {
    let s = board({ d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
    const before = hudModel(s).lead!;
    expect(before).toMatchObject({ needsRoll: true, awaitingRoll: true, modifierTotal: 2, target: 6, roll: null });
    s = act(s, { type: 'submitRoll', value: 5 }).state;
    // Long range would show the result in the Lead phase; a Short range hero now chooses the advance square.
    expect(s.turn.lead).toMatchObject({ roll: 5, total: 7, success: true });
    expect(hudModel(s).decision?.type).toBe('advanceSquare');
  });

  it('US7-AS3 the HUD model has the Active Hero, phase, health, Movement and Range', () => {
    const s = board({}, { heroes: { H1: 'e0' } });
    const m = hudModel(s);
    expect(m.activeHeroId).toBe('H1');
    expect(m.phase).toBe('move');
    expect(m.phases.find((p) => p.current)?.id).toBe('move');
    expect(m.heroes.find((h) => h.active)).toMatchObject({ id: 'H1', health: 10, maxHealth: 10, movementLeft: 5, range: 1 });
    const after = act(s, { type: 'moveStep', to: sq('e1') }).state;
    expect(hudModel(after).heroes[0].movementLeft).toBe(4);
  });
});
