// 006: the HUD model's highlights (US4) and later its HUD fields (US5, US6). New file; earlier HUD model tests stay
// in tests/rules/bloodied.test.ts.
import { describe, expect, it } from 'vitest';
import { board } from '../fixtures/position.ts';
import { highlights, hudModel } from '../../src/game/hud-model.ts';
import { squareName } from '../../src/rules/board.ts';

describe('the Lead panel (US5)', () => {
  const panel = (s: ReturnType<typeof board>, unit: string | null) => hudModel(s, unit).lead!;
  const uid = (s: ReturnType<typeof board>, square: string) => s.units.find((u) => squareName(u.pos) === square)!.id;

  it('US5-AS1 (model) a Lead without a roll says why: Peace, the King, cannot fail, an ability', () => {
    const peace = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, phase: 'lead' });
    expect(panel(peace, uid(peace, 'c3')).auto).toBe('peace');
    const king = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'e2' }, peaceTreaty: 'war', phase: 'lead' });
    expect(panel(king, uid(king, 'e1')).auto).toBe('king');
    const sure = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead' });
    const cannotFail = { ...sure, turn: { ...sure.turn, inspiredLeadBonus: 4 } };
    expect(panel(cannotFail, uid(sure, 'c3')).auto).toBe('cannotFail');
    expect(panel(sure, uid(sure, 'c3')).auto).toBeNull();
    const fervent = board({ c3: 'N', h7: 'p' }, {
      heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead', heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'fanatic' },
    });
    const auto = panel(fervent, uid(fervent, 'c3')).auto;
    expect([null, 'ability']).toContain(auto);
  });

  it('US5-AS5 (model) modifier lines use names, never text keys', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead' });
    const withSight = { ...s, turn: { ...s.turn, inspiredLeadBonus: 2 } };
    const labels = panel(withSight, uid(s, 'c3')).modifierLabels;
    expect(labels).toEqual(['War +2', 'Inspired Lead +2']);
  });
});

describe('hero cards and warnings (US6)', () => {
  const SIX = ['overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury', 'destinedForGreatness'] as const;

  it('US6-AS6 (model) a named hero is shown by name, an Epic hero by its form; the generic test heroes keep today\'s text', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' } });
    expect(hudModel(s).heroes.find((h) => h.id === 'H1')!.name).toBe('Cavalier');
    const e = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' } });
    expect(hudModel(e).heroes.find((h) => h.id === 'H1')!.name).toBe('Dragon Lord');
    expect(hudModel(s).heroes.find((h) => h.id === 'H2')!.name).toBe('');
  });

  it('US6-AS8 (model) the Hero Unit icons: dimmed before Hero Unit, lit after; a Rook with Advanced Warfare', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier', H3: 'monk' } });
    const icons = (st: typeof s, id: string) => hudModel(st).heroes.find((h) => h.id === id)!.heroUnitIcons;
    expect(icons(s, 'H1')).toEqual({ types: ['knight'], unlocked: false });
    expect(icons(s, 'H3')).toEqual({ types: ['bishop'], unlocked: false });
    const six = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, royalFavors: { light: [...SIX] } });
    expect(icons(six, 'H1')).toEqual({ types: ['knight'], unlocked: true });
    const eight = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, royalFavors: { light: [...SIX, 'bloodyTheCastleGates', 'offenseIsTheBestDefense'] } });
    expect(icons(eight, 'H1')).toEqual({ types: ['knight', 'rook'], unlocked: true });
  });

  it('US6-AS7 (model) the squares within the active hero\'s Range in the Lead phase', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, phase: 'lead', heroDefs: { H1: 'cavalier' } });
    const range = highlights(s, null).range!.map(squareName);
    expect(range).toHaveLength(9);
    expect(range).toContain('c2');
    expect(highlights(board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, phase: 'move', heroDefs: { H1: 'cavalier' } }), null).range).toEqual([]);
    // The generic test heroes are kept as they were: no outline.
    expect(highlights(board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd3' }, phase: 'lead' }), null).range).toEqual([]);
  });

  it('US6-AS12 (model) the sides whose King is in check now', () => {
    expect(hudModel(board({ a8: 'R', h1: 'R', a1: 'K', e8: 'k' }, { heroes: { H1: 'g1' } })).inCheck).toEqual(['dark']);
    expect(hudModel(board({ c3: 'N', h7: 'p' })).inCheck).toEqual([]);
  });
});

describe('highlights (US4)', () => {
  it('US4-AS3 (model) the Move phase returns every reachable square, with "pass only" squares marked', () => {
    const s = board({ d3: 'n', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const h = highlights(s, null);
    expect(h.reach.length).toBeGreaterThan(20);
    expect(h.reach.find((r) => squareName(r.to) === 'd3')?.canEnd).toBe(false);
    expect(h.reach.find((r) => squareName(r.to) === 'd4')?.canEnd).toBe(true);
  });

  it('US4-AS13 (model) a selected pinned unit: the squares only check forbids are blocked, with their reason', () => {
    const s = board({ e1: 'K', e2: 'R', e8: 'r', a8: 'k', h7: 'p' }, { heroes: { H1: 'f1' }, phase: 'lead' });
    const pinned = s.units.find((u) => squareName(u.pos) === 'e2')!.id;
    const h = highlights(s, pinned);
    expect(h.leads.map((l) => squareName(l.to))).toContain('e5');
    expect(h.blocked.map((b) => squareName(b.to))).toContain('d2');
    expect(h.blocked.every((b) => b.code === 'LEAD_LEAVES_KING_IN_CHECK')).toBe(true);
    expect(h.blocked.some((b) => h.leads.some((l) => l.to.x === b.to.x && l.to.y === b.to.y))).toBe(false);
  });

  it('nothing is blocked without a selected unit, or outside the Lead phase', () => {
    const s = board({ e1: 'K', e2: 'R', e8: 'r', a8: 'k', h7: 'p' }, { heroes: { H1: 'f1' }, phase: 'lead' });
    expect(highlights(s, null).blocked).toEqual([]);
  });
});
