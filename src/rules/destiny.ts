// Destiny Well, Common Pools, Hero Pools, gains, Resilient Destiny, spending (FR-054, FR-072, research R-09).
import { emit, fail, hero, type Ctx } from './ctx.ts';
import { healthBar, RULES } from './data.ts';
import type { Payment } from './model/actions.ts';
import type { Hero } from './model/hero.ts';
import type { HeroId, Side } from './model/types.ts';
import { complete } from './royal-favors.ts';
import { flipToWar } from './tokens.ts';

export type DestinyTarget = { side: Side; heroId?: HeroId };

/** Take Destiny from the Well into a pool. The Well is unlimited once the initial 16 are gone (FAQ 11). */
export function gain(ctx: Ctx, target: DestinyTarget, amount: number, reason: string): void {
  if (amount <= 0) return;
  const { s } = ctx;
  const well = s.destiny.well;
  const wasDepleted = well.depleted;
  if (!well.depleted) {
    const taken = Math.min(amount, well.initialRemaining);
    well.initialRemaining -= taken;
    if (well.initialRemaining === 0) {
      // The Epic Stage starts at the next Before Turn; the turn continues (003 FR-001).
      well.depleted = true;
      well.depletedBy = s.activeHeroId;
      if (s.stage === 'starting') s.epicPending = true;
      emit(ctx, { type: 'wellDepleted' });
    }
  }
  if (target.heroId) hero(s, target.heroId).pool += amount;
  else s.destiny.common[target.side] += amount;
  const pool = target.heroId ? 'hero' : 'common';
  s.destiny.entries.push({ turn: s.turnNumber, side: target.side, heroId: target.heroId, delta: amount, pool, reason });
  emit(ctx, { type: 'destinyChanged', pool, side: target.side, heroId: target.heroId, delta: amount, reason });
  // Tides of Destiny: after the initial 16 are gone, a Common Pool gain on the side's own turn (once per turn, ≤ 5).
  const activeSide = s.heroes.find((h) => h.id === s.activeHeroId)?.side;
  if (wasDepleted && !target.heroId && target.side === activeSide && s.status === 'playing') complete(ctx, target.side, 'tidesOfDestiny');
  flipToWar(ctx);
}

/** Total the hero can spend now: own pool plus the side's Common Pool. */
export function available(ctx: Ctx, h: Hero): number {
  return h.pool + ctx.s.destiny.common[h.side];
}

/**
 * Spend from the hero pool and/or the Common Pool. Without an explicit split the hero pool is used first.
 * Before the Well is depleted, spent Destiny leaves play; after, it returns to the (unlimited) Well.
 */
export function spend(ctx: Ctx, h: Hero, cost: number, reason: string, pay?: Payment): void {
  const { s } = ctx;
  if (cost <= 0) return;
  let fromHero: number;
  let fromCommon: number;
  if (pay) {
    if (pay.hero < 0 || pay.common < 0 || pay.hero + pay.common !== cost) {
      fail('BAD_PAYMENT', `Payment must add up to ${cost} D`, 'Destiny');
    }
    fromHero = pay.hero;
    fromCommon = pay.common;
  } else {
    fromHero = Math.min(h.pool, cost);
    fromCommon = cost - fromHero;
  }
  if (fromHero > h.pool || fromCommon > s.destiny.common[h.side]) {
    fail('NOT_ENOUGH_DESTINY', `Not enough Destiny (${cost} D needed)`, 'Destiny');
  }
  if (fromHero > 0) {
    h.pool -= fromHero;
    s.destiny.entries.push({ turn: s.turnNumber, side: h.side, heroId: h.id, delta: -fromHero, pool: 'hero', reason });
    emit(ctx, { type: 'destinyChanged', pool: 'hero', side: h.side, heroId: h.id, delta: -fromHero, reason });
  }
  if (fromCommon > 0) {
    s.destiny.common[h.side] -= fromCommon;
    s.destiny.entries.push({ turn: s.turnNumber, side: h.side, delta: -fromCommon, pool: 'common', reason });
    emit(ctx, { type: 'destinyChanged', pool: 'common', side: h.side, delta: -fromCommon, reason });
  }
}

/** Resilient Destiny: 1 D per health-bar point p with newHealth ≤ p < oldHealth (FR-054). */
export function resilientPointsPassed(barId: string, oldHealth: number, newHealth: number): number {
  return healthBar(barId).resilientPoints.filter((p) => newHealth <= p && p < oldHealth).length;
}

export const DESTINY = RULES.destiny;
