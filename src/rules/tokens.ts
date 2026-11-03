// Peace Treaty / Declaration of War and Revenge tokens (FR-070, FR-071).
import { emit, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import type { Side } from './model/types.ts';

/** The Peace Treaty flips to War permanently on the first Destiny gain. */
export function flipToWar(ctx: Ctx): void {
  if (ctx.s.tokens.peaceTreaty === 'war') return;
  ctx.s.tokens.peaceTreaty = 'war';
  emit(ctx, { type: 'tokenChanged', token: 'peaceTreaty', value: 'war' });
}

/** A side whose Queen is destroyed gains a Revenge token, up to `revengeMax`. */
export function gainRevenge(ctx: Ctx, side: Side): void {
  const r = ctx.s.tokens.revenge;
  if (r[side] >= RULES.revengeMax) return;
  r[side] += 1;
  emit(ctx, { type: 'tokenChanged', token: 'revenge', side, value: r[side] });
}

export function useRevengeToken(ctx: Ctx, side: Side): void {
  ctx.s.tokens.revenge[side] -= 1;
  emit(ctx, { type: 'tokenChanged', token: 'revenge', side, value: ctx.s.tokens.revenge[side] });
}
