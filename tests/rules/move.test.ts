import { describe, expect, it } from 'vitest';
import { chebyshev, legalActions, legalMoveSquares } from '../../src/rules/index.ts';
import { act, hero, reject } from '../helpers/game.ts';
import { board, name, sq, START } from '../fixtures/position.ts';

describe('US2 – Move and Range', () => {
  it('US2-AS1 Short range hero moves up to 5 adjacent squares, never ending on an enemy unit or a King', () => {
    let s = board({ e1: 'K', e8: 'k', c1: 'n', d1: 'Q' }, { heroes: { H1: 'c0' } });
    expect(s.turn.movementLeft).toBe(5);
    expect(legalMoveSquares(s).map(name).sort()).toEqual(['b0', 'b1', 'c1', 'd0', 'd1'].sort());
    s = act(s, { type: 'moveStep', to: sq('c1') }).state; // onto an enemy Knight: passing is allowed
    expect(reject(s, { type: 'endPhase' })).toBe('MOVE_ENDS_ON_UNIT');
    s = act(s, { type: 'moveStep', to: sq('d2') }).state;
    expect(reject(s, { type: 'moveStep', to: sq('f4') })).toBe('NOT_ADJACENT');
    s = act(s, { type: 'moveStep', to: sq('d3') }).state;
    s = act(s, { type: 'moveStep', to: sq('d4') }).state;
    s = act(s, { type: 'moveStep', to: sq('e5') }).state;
    expect(s.turn.movementLeft).toBe(0);
    expect(legalMoveSquares(s)).toEqual([]);
    expect(reject(s, { type: 'moveStep', to: sq('e6') })).toBe('NO_MOVEMENT_LEFT');
    expect(act(s, { type: 'endPhase' }).state.phase).toBe('beforeLead');
  });

  it('US2-AS1 a Move cannot end on a King square, even a friendly one', () => {
    let s = board({ e1: 'K', e8: 'k' }, { heroes: { H1: 'e0' } });
    s = act(s, { type: 'moveStep', to: sq('e1') }).state;
    expect(reject(s, { type: 'endPhase' })).toBe('MOVE_ENDS_ON_UNIT');
  });

  it('US2-AS2 Long range hero Leads only friendly units within 3 squares and stays put', () => {
    let s = board(START, { active: 'H3', phase: 'lead' });
    const h3 = hero(s, 'H3');
    expect(h3.rangeType).toBe('long');
    const leads = legalActions(s).filter((a) => a.type === 'announceLead');
    expect(leads.length).toBeGreaterThan(0);
    for (const a of leads) {
      const u = s.units.find((x) => x.id === (a as { unitId: string }).unitId)!;
      expect(u.side).toBe('light');
      expect(chebyshev(u.pos, h3.pos)).toBeLessThanOrEqual(3);
    }
    expect(reject(s, { type: 'announceLead', unitId: 'L-P@a2', to: sq('a3') })).toBe('OUT_OF_RANGE');
    const from = { ...h3.pos };
    s = act(s, { type: 'announceLead', unitId: 'L-P@e2', to: sq('e4') }).state;
    expect(s.pendingDecision).toBeNull();
    expect(hero(s, 'H3').pos).toEqual(from);
  });

  it('US2-AS3 Short range hero advances to a chosen square next to the Led unit, not on a King or enemy unit', () => {
    let s = board({ e1: 'K', e8: 'k', b1: 'N', d4: 'p', b4: 'P' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'L-N@b1', to: sq('c3') }).state;
    const d = s.pendingDecision;
    expect(d?.type).toBe('advanceSquare');
    const opts = (d as { options: { x: number; y: number }[] }).options.map(name).sort();
    expect(opts).toEqual(['b2', 'b3', 'b4', 'c2', 'c4', 'd2', 'd3'].sort());
    expect(opts).not.toContain('d4');
    expect(reject(s, { type: 'decide', decision: { type: 'square', to: sq('d4') } })).toBe('BAD_ANSWER');
    s = act(s, { type: 'decide', decision: { type: 'square', to: sq('d3') } }).state;
    expect(name(hero(s, 'H1').pos)).toBe('d3');
  });
});
