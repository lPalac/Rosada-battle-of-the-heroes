// Shared mechanisms: marks, square tokens, Modify, Push (004 US4-AS1…AS5, guarantees 14 and 17).
import { describe, expect, it } from 'vitest';
import { act, passTurn } from '../../helpers/game.ts';
import { board, sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { isCheckmate, legalLeadTargets, type Effect, type GameState } from '../../../src/rules/index.ts';
import { modifyUnit, pushUnit } from '../../../src/rules/abilities/effects.ts';
import { destinyGeneration } from '../../../src/rules/generation.ts';
import { legalLeadsForUnit, threatenedSquares } from '../../../src/rules/check.ts';
import { replay } from '../../../src/game/session.ts';
import { use, uid, unitT } from '../heroes/helpers.ts';

const fx = (kind: string, target: Effect['target'], expires: Effect['expires'], data: Record<string, unknown> = {}): Omit<Effect, 'id'> =>
  ({ kind, source: { abilityId: 'test', heroId: 'H1' }, target, expires, data });
const kinds = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);

describe('US4 shared mechanisms', () => {
  it('US4-AS1 a cannot-Lead mark removes Lead targets; checkmate counts the unit as unable to move (Q-43)', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, effects: [fx('cannotLead', { unitId: 'L-N@c3' }, { at: 'turnEnd', turn: 1 })] });
    expect(legalLeadsForUnit(s, s.units.find((u) => u.id === 'L-N@c3')!)).toEqual([]);
    // No other Lead is possible, so the Lead phase passes on its own.
    expect(toPhase(s, 'lead').turnNumber).toBeGreaterThan(1);
    void legalLeadTargets;
    // Light King on a1 checked by a Rook on a8; the only defence is the marked Rook on b2 (b2→… cannot block? use the marked Queen).
    const mate = board({ a1: 'K', c3: 'R', a8: 'r', h8: 'k', b8: 'r' }, { heroes: { H1: 'c3' }, active: 'H2', effects: [fx('cannotLead', { unitId: 'L-R@c3' }, { at: 'removed' })] });
    expect(isCheckmate(mate, 'light')).toBe(true);
    const free = board({ a1: 'K', c3: 'R', a8: 'r', h8: 'k', b8: 'r' }, { heroes: { H1: 'c3' }, active: 'H2' });
    expect(isCheckmate(free, 'light')).toBe(false);
  });

  it('US4-AS2 a square token is in the state, changes Leads and goes on its condition', () => {
    const trap = fx('bearTrap', { square: sq('e5') }, { at: 'removed' }, { penalty: -3, wounds: 4 });
    trap.source = { abilityId: 'scout.bearTraps', heroId: 'H1' };
    let e = board({ f6: 'p', a2: 'P' }, { heroDefs: { H1: 'scout' }, heroes: { H1: 'a3', H2: 'f7' }, active: 'H2', effects: [trap] });
    expect(kinds(e, 'bearTrap')).toHaveLength(1);
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('f5') }).state;
    expect(e.turn.lead!.modifiers.some((m) => m.value === -3)).toBe(true);
    let onto = board({ e6: 'p', a2: 'P' }, { heroDefs: { H1: 'scout' }, heroes: { H1: 'a3', H2: 'e7' }, active: 'H2', effects: [trap] });
    onto = toPhase(onto, 'lead');
    onto = act(onto, { type: 'announceLead', unitId: uid(onto, 'e6'), to: sq('e5') }).state;
    if (onto.turn.lead!.success === null) onto = act(onto, { type: 'submitRoll', value: 20 }).state;
    expect(kinds(onto, 'bearTrap')).toHaveLength(0);
  });

  it('US4-AS3 a Modify changes type for paths, threats and generation, then returns', () => {
    const s = board({ d4: 'N', h7: 'p' }, { stage: 'epic', heroes: { H1: 'd3' } });
    const ctx = { s: structuredClone(s), events: [] };
    const unit = ctx.s.units.find((u) => u.id === 'L-N@d4')!;
    modifyUnit(ctx, unit, 'pawn', { abilityId: 'test', heroId: 'H1' }, { at: 'turnEnd', turn: ctx.s.turnNumber });
    expect(unit.type).toBe('pawn');
    expect(threatenedSquares(ctx.s, 'light').has('5,6')).toBe(false);
    expect(destinyGeneration(ctx.s, 'light')).toBe(destinyGeneration({ ...s, units: s.units.map((u) => (u.id === unit.id ? { ...u, type: 'pawn' as const } : u)) }, 'light'));
    const after = passTurn(ctx.s).state;
    expect(after.units.find((u) => u.id === 'L-N@d4')!.type).toBe('knight');
    expect(after.units.find((u) => u.id === 'L-N@d4')!.modifiedFrom).toBeNull();
  });

  it('US4-AS4 a Push moves one unoccupied square, or not at all', () => {
    const s = board({ d4: 'p', d5: 'P', h7: 'p' }, { heroes: { H1: 'c3' } });
    const ctx = { s: structuredClone(s), events: [] };
    const pawn = ctx.s.units.find((u) => u.id === 'D-P@d4')!;
    expect(() => pushUnit(ctx, pawn, { x: 0, y: 1 })).toThrow();
    pushUnit(ctx, pawn, { x: 1, y: 0 });
    expect(pawn.pos).toEqual(sq('e4'));
  });

  it('US4-AS5 effects are logged, and replay rebuilds them (guarantee 17)', () => {
    const start = board({ c3: 'N', d4: 'p', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd3' }, phase: 'beforeMove' });
    const r = use(start, 'monk.preaching', [unitT(start, 'd4')], 'one');
    expect(r.events.some((e) => e.type === 'effectAdded')).toBe(true);
    const again = replay(start, [{ type: 'useAbility', abilityId: 'monk.preaching', targets: [unitT(start, 'd4')], option: 'one' }]);
    expect(again.effects).toEqual(r.state.effects);
    expect(again.abilityState).toEqual(r.state.abilityState);
  });

  it('expiries at each kind of end (guarantee 14)', () => {
    let s = board({ c3: 'N', h7: 'p' }, {
      heroes: { H1: 'd3' },
      effects: [
        fx('cannotBattle', { unitId: 'L-N@c3' }, { at: 'turnEnd', turn: 1 }),
        fx('cannotBattle', { unitId: 'L-N@c3' }, { at: 'turnStart', heroId: 'H2' }),
        fx('cannotBattle', { unitId: 'L-N@c3' }, { at: 'turnEnd', heroId: 'H1', count: 2 }),
        fx('cannotBattle', { unitId: 'L-N@c3' }, { at: 'epicStage' }),
      ],
    });
    s = passTurn(s).state; // end of turn 1; H2's turn starts
    expect(s.effects.map((e) => e.expires.at + (e.expires.count ?? ''))).toEqual(['turnEnd1', 'epicStage']);
    for (let i = 0; i < 4; i++) s = passTurn(s).state;
    expect(s.effects.map((e) => e.expires.at)).toEqual(['epicStage']);
  });

  it('a Destroyed target drops its effects', () => {
    let s = board({ d3: 'P', e4: 'p', a2: 'P' }, { heroes: { H1: 'c3', H2: 'f5' }, active: 'H2', effects: [fx('leadModifier', { unitId: 'L-P@d3' }, { at: 'removed' }, { value: -1 })] });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'e4'), to: sq('d3') }).state;
    if (s.turn.lead!.success === null) s = act(s, { type: 'submitRoll', value: 20 }).state;
    expect(unitOn(s, 'd3')?.side).toBe('dark');
    expect(kinds(s, 'leadModifier')).toHaveLength(0);
  });
});
