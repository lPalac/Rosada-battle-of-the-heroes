// Taverns: shop window, Drink/Meal, free Meal, Movement penalty (FR-060, FR-042).
import { eq, isTavern, tavernOwner } from './board.ts';
import { activeHero, emit, fail, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { spend } from './destiny.ts';
import type { Payment } from './model/actions.ts';
import type { Hero } from './model/hero.ts';
import { heal } from './heroes.ts';

/** Opens the shop when the active hero is (or arrives) in a tavern they have not left this turn. */
export function onHeroEntersSquare(ctx: Ctx, h: Hero): void {
  const t = ctx.s.turn;
  if (h.id !== ctx.s.activeHeroId) return;
  if (isTavern(h.pos) && !t.leftTaverns.some((p) => eq(p, h.pos))) t.tavernShopOpen = h.pos;
}

/** Leaving a tavern closes its shop for the rest of the turn. */
export function onHeroLeavesSquare(ctx: Ctx, h: Hero): void {
  const t = ctx.s.turn;
  if (h.id !== ctx.s.activeHeroId) return;
  if (isTavern(h.pos)) {
    if (!t.leftTaverns.some((p) => eq(p, h.pos))) t.leftTaverns.push(h.pos);
    if (t.tavernShopOpen && eq(t.tavernShopOpen, h.pos)) t.tavernShopOpen = null;
  }
}

/** Buying happens at the start of the turn or while pausing the Move, never later (FR-060). */
export function shopOpen(ctx: Ctx): boolean {
  const { s } = ctx;
  const h = activeHero(s);
  return (s.phase === 'move' || s.phase === 'beginningOfTurn') && !!s.turn.tavernShopOpen && eq(s.turn.tavernShopOpen, h.pos);
}

export function buy(ctx: Ctx, item: 'drink' | 'meal', pay?: Payment): void {
  if (!shopOpen(ctx)) fail('SHOP_CLOSED', 'Buying is only possible in a tavern before leaving it', 'Taverns');
  const h = activeHero(ctx.s);
  const offer = RULES.tavern[item];
  spend(ctx, h, offer.cost, item, pay);
  heal(ctx, h, offer.heal, item);
  emit(ctx, { type: 'bought', heroId: h.id, item });
}

export function inFriendlyTavern(h: Hero): boolean {
  return tavernOwner(h.pos) === h.side;
}

/** Free Meal at End of Turn in a friendly tavern, unless End of Turn abilities are blocked (FR-042). */
export function freeMeal(ctx: Ctx, h: Hero, blocked: boolean): void {
  if (blocked || !inFriendlyTavern(h) || h.status.unconscious) return;
  heal(ctx, h, RULES.tavern.meal.heal, 'freeMeal');
}
