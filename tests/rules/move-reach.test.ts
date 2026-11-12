// 006 US4 (FR-008, research R-09, guarantees 19 and 20): every square the active hero can reach this Move, each with
// a shortest path built from the same step rule as moveStep.
import { describe, expect, it } from 'vitest';
import { act } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';
import { apply, legalMoveSquares, moveReach, type GameState } from '../../src/rules/index.ts';
import { chebyshev, squareName } from '../../src/rules/board.ts';

const names = (s: GameState) => moveReach(s).map((r) => squareName(r.to)).sort();

describe('US4 – Move reach (B-16)', () => {
  it('every square within the Movement left, each with a shortest path; empty outside the Move phase', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const reach = moveReach(s);
    const h = s.heroes.find((x) => x.id === 'H1')!;
    expect(reach.length).toBeGreaterThan(30);
    for (const r of reach) {
      expect(r.cost).toBe(chebyshev(h.pos, r.to));
      expect(r.path).toHaveLength(r.cost);
      expect(r.path.at(-1)).toEqual(r.to);
      expect(r.cost).toBeLessThanOrEqual(s.turn.movementLeft);
    }
    expect(moveReach(board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'lead' }))).toEqual([]);
  });

  it('a square with an enemy unit or a King can be passed but not ended on', () => {
    const s = board({ d3: 'n', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const at = (n: string) => moveReach(s).find((r) => squareName(r.to) === n)!;
    expect(at('d3').canEnd).toBe(false);
    expect(at('e1').canEnd).toBe(false); // the Light King
    expect(at('d4').canEnd).toBe(true);
  });

  it('ties: straight before diagonal', () => {
    const s = board({ h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const r = moveReach(s).find((x) => squareName(x.to) === 'd3')!;
    expect(r.path.map(squareName)).toEqual(['d2', 'd3']);
  });

  it('ties: fewest squares with a visible enemy square token (a Bear Trap)', () => {
    const trap = { kind: 'bearTrap', source: { abilityId: 'scout.bearTraps', heroId: 'H2' as const }, target: { square: sq('d2') }, expires: { at: 'removed' as const }, data: {} };
    const s = board({ h7: 'p' }, { heroes: { H1: 'd1' }, effects: [trap], phase: 'move' });
    const r = moveReach(s).find((x) => squareName(x.to) === 'd3')!;
    expect(r.path.map(squareName)).not.toContain('d2');
    expect(r.cost).toBe(2);
  });

  it('legalMoveSquares is the first step of the reach', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    expect(legalMoveSquares(s).map(squareName).sort()).toEqual(moveReach(s).filter((r) => r.cost === 1).map((r) => squareName(r.to)).sort());
  });

  it('guarantee 19: every path is accepted step by step by moveStep, costs its cost and ends on its square', () => {
    const positions = [
      board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' }),
      board({ d3: 'n', c2: 'P', h7: 'p' }, { heroes: { H1: 'c0' }, phase: 'move' }),
      board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'e2' }, phase: 'move' }),
    ];
    for (const s of positions) {
      for (const r of moveReach(s)) {
        let st = s;
        for (const p of r.path) {
          const step = apply(st, { type: 'moveStep', to: p });
          expect(step.ok, `${squareName(r.to)} via ${r.path.map(squareName)}`).toBe(true);
          if (!step.ok) break;
          st = step.state;
        }
        expect(st.heroes.find((x) => x.id === st.activeHeroId)!.pos).toEqual(r.to);
        expect(s.turn.movementLeft - st.turn.movementLeft).toBe(r.cost);
      }
    }
  });

  it('guarantee 20: moveReach never changes the state and gives the same result each time', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const before = JSON.stringify(s);
    expect(names(s)).toEqual(names(s));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('after a step, the reach shrinks with the Movement left', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    s = act(s, { type: 'moveStep', to: sq('d2') }).state;
    expect(moveReach(s).every((r) => r.cost <= s.turn.movementLeft)).toBe(true);
  });
});
