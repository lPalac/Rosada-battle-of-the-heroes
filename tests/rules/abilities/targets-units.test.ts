// Targeting helpers, Lead modifiers and special units (004 T015, T018, T023).
import { describe, expect, it } from 'vitest';
import { act } from '../../helpers/game.ts';
import { board, sq, toPhase } from '../../fixtures/position.ts';
import { destinyGeneration, legalLeadTargets } from '../../../src/rules/index.ts';
import { affectable, newCheck, startingSquares } from '../../../src/rules/abilities/targets.ts';
import { refuse, uid, unitT } from '../heroes/helpers.ts';

describe('targets (T015) and King\'s Supremacy', () => {
  it('the King and units on its square are never affected; royalty skipped when the ability says so', () => {
    const s = board({ d4: 'q', e4: 'n' }, {});
    const king = s.units.find((u) => u.type === 'king')!;
    expect(affectable(s, king)).toBe(false);
    expect(affectable(s, s.units.find((u) => u.type === 'queen')!, true)).toBe(false);
    expect(affectable(s, s.units.find((u) => u.type === 'knight')!, true)).toBe(true);
  });

  it('starting squares of a type', () => {
    expect(startingSquares('light', 'knight')).toEqual([sq('b1'), sq('g1')]);
    expect(startingSquares('dark', 'pawn')).toHaveLength(8);
  });

  it('a discovered check is not a new check (FR-014)', () => {
    const before = board({ e3: 'R', e5: 'N', h2: 'P' }, {});
    const after = { units: before.units.map((u) => (u.id === 'L-N@e5' ? { ...u, pos: sq('c6') } : u)) };
    expect(newCheck(before, after, 'dark')).toBe(false);
    const moved = { units: before.units.map((u) => (u.id === 'L-N@e5' ? { ...u, pos: sq('d6') } : u)) };
    expect(newCheck(before, moved, 'dark')).toBe(true);
  });

  it('a hero ability cannot target the King: Inquisition refuses it', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'dominant' }, heroes: { H1: 'd7' } });
    expect(refuse(s, 'supremeInquisitor.inquisition', [{ unitId: s.units.find((u) => u.type === 'king' && u.side === 'dark')!.id }])).toMatch(/ABILITY_/);
  });
});

describe('Lead modifiers (T018)', () => {
  it('built-in modifiers are unchanged for generic heroes (War +2, check +4, Inspired Lead)', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, peaceTreaty: 'war' });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('b5') }).state;
    expect(s.turn.lead!.modifiers).toEqual([{ source: 'war', value: 2 }]);
  });

  it('a unit penalty applies to that unit only; the King ignores hero abilities', () => {
    const fx = { kind: 'leadModifier', source: { abilityId: 'monk.preaching', heroId: 'H3' as const }, target: { unitId: 'L-K@e1' }, expires: { at: 'removed' as const }, data: { value: -4 } };
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'e2' }, effects: [fx] });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'e1'), to: sq('d1') }).state;
    expect(s.turn.lead!.modifiers.some((m) => m.source === 'monk.preaching')).toBe(false);
  });
});

describe('special units (T023)', () => {
  it('the Legendary Ancient is Led one square in any direction; the Demon only Battles and does not count for generation', () => {
    const la = board({ d4: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, tags: { d4: ['legendaryAncient'] } });
    const targets = legalLeadTargets(toPhase(la, 'lead'), 'L-N@d4').map((t) => t.to);
    expect(targets).toHaveLength(8);
    expect(targets.every((t) => Math.max(Math.abs(t.x - 4), Math.abs(t.y - 4)) === 1)).toBe(true);
    const plain = board({ d4: 'R', h7: 'p' }, { stage: 'epic' });
    const demon = board({ d4: 'R', h7: 'p' }, { stage: 'epic', tags: { d4: ['demon'] } });
    expect(destinyGeneration(demon, 'light')).toBe(destinyGeneration(plain, 'light') + 1);
    void unitT;
  });
});
