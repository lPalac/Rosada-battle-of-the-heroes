import { describe, expect, it } from 'vitest';
import { createUnit } from '../../src/rules/create.ts';
import { RuleFailure, type Ctx } from '../../src/rules/ctx.ts';
import { isInCheck, validatePosition } from '../../src/rules/index.ts';
import { act, eventsOf } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';

const PAWNS = { a2: 'P', b2: 'P', c2: 'P', d2: 'P', a7: 'p', b7: 'p', c7: 'p', d7: 'p' };

function tryCreate(s: ReturnType<typeof board>, at: string, type: 'rook' | 'knight' | 'pawn' = 'rook') {
  const ctx: Ctx = { s: structuredClone(s), events: [] };
  try {
    createUnit(ctx, { side: 'light', type, at: sq(at) });
    return { ok: true as const, ctx };
  } catch (e) {
    if (e instanceof RuleFailure) return { ok: false as const, code: e.error.code };
    throw e;
  }
}

describe('US5 – Auxiliary units and Create', () => {
  it('US5-AS1 a unit is never created where it would give check', () => {
    const s = board({ ...PAWNS });
    expect(tryCreate(s, 'e5')).toEqual({ ok: false, code: 'CREATE_WOULD_CHECK' });
    expect(tryCreate(s, 'd2')).toEqual({ ok: false, code: 'CREATE_OCCUPIED' });
    const made = tryCreate(s, 'f5');
    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.ctx.s.units.find((u) => u.id === 'A-L-R-1')).toMatchObject({ kind: 'auxiliary', type: 'rook', pos: sq('f5') });
      expect(eventsOf(made.ctx.events, 'unitCreated')).toHaveLength(1);
    }
  });

  it('US5-AS2 an auxiliary pawn on the enemy royal rank is not Promoted', () => {
    const s = board({ ...PAWNS, f7: 'P' }, { heroes: { H1: 'f6' }, auxiliary: ['f7'], phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-P@f7', to: sq('f8') }).state;
    expect(unitOn(r, 'f8')).toMatchObject({ type: 'pawn', promoted: false, kind: 'auxiliary' });
    expect([r.pendingDecision, ...r.decisionQueue].some((d) => d?.type === 'promotion')).toBe(false);
    expect(validatePosition(r)).toEqual([]);
  });

  it('US5-AS3 a destroyed auxiliary unit leaves play; Destiny as for any unit', () => {
    const s = board({ ...PAWNS, h1: 'R', h5: 'n' }, { heroes: { H1: 'g0' }, auxiliary: ['h5'], phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h5') });
    expect(r.state.graveyard).toEqual([]);
    expect(eventsOf(r.events, 'unitDestroyed')).toEqual([{ type: 'unitDestroyed', unitId: 'D-N@h5', by: 'battle', leftPlay: true }]);
    expect(r.state.destiny.common).toEqual({ light: 2, dark: 1 });
  });

  it('US5-AS4 auxiliary units Lead, Battle, threaten and give check like their type', () => {
    const s = board({ ...PAWNS, h1: 'R' }, { heroes: { H1: 'g0' }, auxiliary: ['h1'], phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark' }]);
    expect(isInCheck(r.state, 'dark')).toBe(true);
  });
});
