import { describe, expect, it } from 'vitest';
import type { Ctx } from '../../src/rules/ctx.ts';
import { heal } from '../../src/rules/heroes.ts';
import { isBloodied } from '../../src/rules/index.ts';
import { board } from '../fixtures/position.ts';
import { hudModel } from '../../src/game/hud-model.ts';

describe('US6 – Bloodied', () => {
  it('US6-AS1 Epic heroes in the red area are Bloodied: Short ≤ 10 of 20, Long ≤ 8 of 16', () => {
    const s = board({}, { stage: 'epic', health: { H1: 10, H2: 11, H3: 8, H4: 9 } });
    expect(['H1', 'H2', 'H3', 'H4'].map((id) => isBloodied(s, id as never))).toEqual([true, false, true, false]);
    expect(hudModel(s).heroes.map((h) => h.bloodied)).toEqual([true, false, true, false]);
  });

  it('US6-AS2 Starting Heroes are never Bloodied', () => {
    const s = board({}, { health: { H1: 1, H3: 2 } });
    expect(isBloodied(s, 'H1')).toBe(false);
    expect(isBloodied(s, 'H3')).toBe(false);
  });

  it('US6-AS3 healing above the red area clears it', () => {
    const s = board({}, { stage: 'epic', health: { H1: 9 } });
    const ctx: Ctx = { s: structuredClone(s), events: [] };
    heal(ctx, ctx.s.heroes[0], 2, 'test');
    expect(isBloodied(ctx.s, 'H1')).toBe(false);
  });
});
