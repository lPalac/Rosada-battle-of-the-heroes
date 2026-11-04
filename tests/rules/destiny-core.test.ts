import { describe, expect, it } from 'vitest';
import type { Ctx } from '../../src/rules/ctx.ts';
import { gain, resilientPointsPassed, spend } from '../../src/rules/destiny.ts';
import { newGame } from '../helpers/game.ts';

function ctxOf(): Ctx {
  return { s: structuredClone(newGame()), events: [] };
}

describe('Destiny core (research R-09, FR-070, FR-072)', () => {
  it('counts the Well down and flips Peace to War on the first gain only', () => {
    const ctx = ctxOf();
    expect(ctx.s.tokens.peaceTreaty).toBe('peace');
    gain(ctx, { side: 'light' }, 2, 'test');
    expect(ctx.s.destiny.well.initialRemaining).toBe(14);
    expect(ctx.s.destiny.common.light).toBe(2);
    expect(ctx.s.tokens.peaceTreaty).toBe('war');
    gain(ctx, { side: 'dark' }, 1, 'test');
    expect(ctx.events.filter((e) => e.type === 'tokenChanged')).toHaveLength(1);
  });

  it('depletes the Well and takes the overflow anyway (FAQ 11)', () => {
    const ctx = ctxOf();
    ctx.s.destiny.well.initialRemaining = 1;
    gain(ctx, { side: 'light' }, 3, 'test');
    expect(ctx.s.destiny.well).toMatchObject({ initialRemaining: 0, depleted: true });
    expect(ctx.s.destiny.common.light).toBe(3);
    expect(ctx.events.filter((e) => e.type === 'wellDepleted')).toHaveLength(1);
    gain(ctx, { side: 'light' }, 2, 'test');
    expect(ctx.events.filter((e) => e.type === 'wellDepleted')).toHaveLength(1);
  });

  it('spends from the hero pool first, then the Common Pool; Well unchanged', () => {
    const ctx = ctxOf();
    ctx.s.destiny.common.light = 2;
    const h = ctx.s.heroes[0];
    spend(ctx, h, 4, 'test');
    expect(h.pool).toBe(0);
    expect(ctx.s.destiny.common.light).toBe(1);
    expect(ctx.s.destiny.well.initialRemaining).toBe(16);
  });

  it('honours an explicit split and rejects too little Destiny', () => {
    const ctx = ctxOf();
    ctx.s.destiny.common.light = 2;
    const h = ctx.s.heroes[0];
    spend(ctx, h, 2, 'test', { hero: 0, common: 2 });
    expect(h.pool).toBe(3);
    expect(() => spend(ctx, h, 4, 'test')).toThrow(/Not enough Destiny/);
  });

  it('counts Resilient Destiny points passed (FR-054)', () => {
    expect(resilientPointsPassed('bar-20', 10, 7)).toBe(1); // passes 8
    expect(resilientPointsPassed('bar-16', 8, 3)).toBe(2); // passes 6 and 4
    expect(resilientPointsPassed('bar-16', 16, 13)).toBe(1); // passes 14
    expect(resilientPointsPassed('bar-16', 8, 8)).toBe(0);
  });
});
