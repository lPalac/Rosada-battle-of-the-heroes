// 006 US4 (FR-021, research R-09): the planned Move path (UI state only): extend, what is left, what is reachable next.
import { describe, expect, it } from 'vitest';
import { board, sq } from '../fixtures/position.ts';
import { extendPlan, planLeft, type MovePlan } from '../../src/game/move-plan.ts';
import { squareName } from '../../src/rules/board.ts';
import type { GameState } from '../../src/rules/index.ts';

const path = (p: MovePlan | null) => p?.path.map(squareName) ?? null;
const start = (): GameState => board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });

describe('US4 – the Move plan (B-16)', () => {
  it('US4-AS4 a click on a reachable square plans the shortest path; what is left shrinks the reach', () => {
    const s = start();
    const p = extendPlan(s, null, sq('d3'))!;
    expect(path(p)).toEqual(['d2', 'd3']);
    expect(planLeft(p)).toBe(s.turn.movementLeft - 2);
    expect(p.reach.every((r) => r.cost <= planLeft(p))).toBe(true);
    expect(p.reach.some((r) => squareName(r.to) === 'd6')).toBe(true);
    expect(p.reach.some((r) => squareName(r.to) === 'd7')).toBe(false); // 5 − 2 = 3 squares from d3
  });

  it('US4-AS5 further clicks grow the path through them in order', () => {
    const s = start();
    let p = extendPlan(s, null, sq('d3'))!;
    p = extendPlan(s, p, sq('f3'))!;
    expect(path(p)).toEqual(['d2', 'd3', 'e3', 'f3']);
    expect(planLeft(p)).toBe(1);
  });

  it('US4-AS8 a square that cannot be reached clears the plan', () => {
    const s = start();
    const p = extendPlan(s, null, sq('d3'))!;
    expect(extendPlan(s, p, sq('h8'))).toBeNull();
    expect(extendPlan(s, null, sq('h8'))).toBeNull();
  });

  it('the plan is never longer than the Movement left', () => {
    const s = start();
    let p: MovePlan | null = extendPlan(s, null, sq('d4'))!;
    p = extendPlan(s, p, sq('d6'));
    expect(p && p.path.length).toBe(5);
    expect(extendPlan(s, p, sq('d7'))).toBeNull();
  });
});
