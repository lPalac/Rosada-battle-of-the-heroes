// 006: the HUD model's highlights (US4) and later its HUD fields (US5, US6). New file; earlier HUD model tests stay
// in tests/rules/bloodied.test.ts.
import { describe, expect, it } from 'vitest';
import { board } from '../fixtures/position.ts';
import { highlights } from '../../src/game/hud-model.ts';
import { squareName } from '../../src/rules/board.ts';

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
