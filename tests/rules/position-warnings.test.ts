// 006 US2 (FR-009, research R-06, guarantee 26): checkmates in a sandbox position are pointed out before rules come back
// on; a warning never blocks (setEnforcement accepts the position, checkmate is ruled at the next Before Turn).
import { describe, expect, it } from 'vitest';
import { act } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';
import { apply, isCheckmate, positionWarnings, type GameState } from '../../src/rules/index.ts';

const sandbox = (s: GameState) => act(s, { type: 'setEnforcement', mode: 'sandbox' }).state;

describe('US2 – checkmate alert (B-06)', () => {
  it('US2-AS8 (rules part) a checkmated King is named; the position is still accepted', () => {
    let m = sandbox(board({ a8: 'k', b6: 'K', h1: 'R' }));
    m = act(m, { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h8') }).state;
    expect(positionWarnings(m)).toEqual([{ code: 'CHECKMATE', side: 'dark' }]);
    expect(apply(m, { type: 'setEnforcement', mode: 'rules' }).ok).toBe(true);
  });

  it('no warning without a checkmate (check alone is not one)', () => {
    let m = sandbox(board({ a8: 'k', h1: 'R' }));
    m = act(m, { type: 'sandboxPlace', target: { unitId: 'L-R@h1' }, to: sq('h8') }).state;
    expect(positionWarnings(m)).toEqual([]);
  });

  it('every checkmated side is named (one entry per checkmated King)', () => {
    const s = sandbox(board({ a1: 'K', b2: 'r', c3: 'r', h8: 'k', g7: 'R', f6: 'R' }));
    const warnings = positionWarnings(s);
    expect(warnings.map((w) => w.side).sort()).toEqual(['dark', 'light'].filter((side) => isCheckmate(s, side as 'light' | 'dark')).sort());
  });

  it('guarantee 26: CHECKMATE exactly when isCheckmate holds, and the state is not changed', () => {
    const positions = [board({ a8: 'k', b6: 'K', h8: 'R' }), board({ a8: 'k', b6: 'K', h7: 'R' }), board({ c3: 'N', h7: 'p' })];
    for (const p of positions) {
      const s = sandbox(p);
      const before = JSON.stringify(s);
      const sides = positionWarnings(s).map((w) => w.side);
      for (const side of ['light', 'dark'] as const) expect(sides.includes(side)).toBe(isCheckmate(s, side));
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});
