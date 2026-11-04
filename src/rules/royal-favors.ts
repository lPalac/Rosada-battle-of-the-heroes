// Royal Favors: per-side record, completion, track, Legendary Powers and King's Forces tokens (research R-05).
// Event checks are called where the event happens (Battle, Ram, wounds, Destiny gains); position checks run after
// every action for both sides (clarified). Earned progress is never lost.
import { attackSquares, enemyRoyalRank } from './paths.ts';
import { emit, type Ctx } from './ctx.ts';
import { DATA, FAVORS, RULES } from './data.ts';
import type { GameState, RoyalFavorRecord } from './model/state.ts';
import { otherSide, type FavorId, type PowerId, type Side } from './model/types.ts';

export function emptyFavorRecord(): RoyalFavorRecord {
  const status = Object.fromEntries(FAVORS.favors.map((f) => [f.id, { progress: 0, done: false }])) as RoyalFavorRecord['status'];
  return { status, vanquishBloodied: [], tides: 0, tidesThisTurn: false, track: [], kingsForces: 0 };
}

const def = (id: FavorId) => FAVORS.favors.find((f) => f.id === id)!;

/** Completions waiting to be placed on the track, in rulebook order, at the end of the current step. */
interface FavorCtx extends Ctx {
  favorQueue?: { side: Side; id: FavorId }[];
}

/** Mark a Royal Favor done now; its track slot is filled by `flushFavors` (several at once go in rulebook order). */
export function complete(ctx: Ctx, side: Side, id: FavorId): void {
  const rec = ctx.s.royalFavors[side];
  const st = rec.status[id];
  if (id === 'tidesOfDestiny') {
    if (rec.tides >= (def(id).repeat ?? 1) || rec.tidesThisTurn) return;
    rec.tides += 1;
    rec.tidesThisTurn = true;
    st.progress = rec.tides;
    st.done = rec.tides >= (def(id).repeat ?? 1);
  } else {
    if (st.done) return;
    st.done = true;
    st.progress = def(id).target ?? 1;
  }
  const fc = ctx as FavorCtx;
  (fc.favorQueue ??= []).push({ side, id });
}

/** Half / count progress; completes at the target (Overwhelm, Vanquish your Foes, Royal's Fury). */
export function progress(ctx: Ctx, side: Side, id: FavorId, amount: number): void {
  const st = ctx.s.royalFavors[side].status[id];
  if (st.done || amount <= 0) return;
  const target = def(id).target ?? 1;
  const next = Math.min(target, st.progress + amount);
  if (next >= target) return complete(ctx, side, id);
  st.progress = next;
  emit(ctx, { type: 'favorProgress', side, id, progress: next, target });
}

/** Place queued completions on the track; unlock Powers at the thresholds; King's Forces gives a token. */
export function flushFavors(ctx: Ctx): void {
  const fc = ctx as FavorCtx;
  const queue = fc.favorQueue;
  if (!queue?.length) return;
  fc.favorQueue = [];
  queue.sort((a, b) => def(a.id).order - def(b.id).order);
  for (const { side, id } of queue) {
    const rec = ctx.s.royalFavors[side];
    rec.track.push(id);
    emit(ctx, { type: 'favorCompleted', side, id, slot: rec.track.length });
    for (const p of FAVORS.powers) {
      if (p.threshold !== rec.track.length) continue;
      if (p.id === 'kingsForces') rec.kingsForces += 1;
      emit(ctx, { type: 'powerUnlocked', side, power: p.id });
    }
  }
}

export function unlockedPowers(state: Pick<GameState, 'royalFavors'>, side: Side): PowerId[] {
  const n = state.royalFavors[side].track.length;
  return FAVORS.powers.filter((p) => p.threshold <= n).map((p) => p.id);
}

export function hasPower(state: Pick<GameState, 'royalFavors'>, side: Side, power: PowerId): boolean {
  return unlockedPowers(state, side).includes(power);
}

/** Position-based Royal Favors, checked after every action for both sides (FR-020a). */
export function checkState(ctx: Ctx): void {
  const { s } = ctx;
  if (s.status !== 'playing' || s.enforcement !== 'rules') return;
  const F = RULES.favors;
  for (const side of ['light', 'dark'] as const) {
    const st = s.royalFavors[side].status;
    const enemy = otherSide(side);
    const mine = s.units.filter((u) => u.side === side);
    if (!st.greatIncursion.done) {
      // The 4 ranks on the enemy's side: 5–8 for Light, 1–4 for Dark.
      const royal = enemyRoyalRank(side);
      const inEnemyHalf = (y: number) => Math.abs(y - royal) < F.greatIncursionRanks;
      if (mine.filter((u) => u.kind !== 'hero' && inEnemyHalf(u.pos.y)).length >= F.greatIncursionUnits) complete(ctx, side, 'greatIncursion');
    }
    if (!st.deployTroops.done) {
      const rank = DATA.units.start[side].pawnRank;
      const onStart = mine.filter((u) => u.type === 'pawn' && u.pos.y === rank && u.pos.x >= 1 && u.pos.x <= 8).length;
      if (onStart <= F.deployTroopsMax) complete(ctx, side, 'deployTroops');
    }
    if (!st.decimate.done) {
      if (s.graveyard.filter((u) => u.side === enemy && u.kind === 'main').length >= F.decimate) complete(ctx, side, 'decimate');
    }
    if (!st.offenseIsTheBestDefense.done) {
      const threats = new Map<string, number>();
      for (const u of mine) for (const p of attackSquares(s, u)) threats.set(`${p.x},${p.y}`, (threats.get(`${p.x},${p.y}`) ?? 0) + 1);
      const hit = s.units.some((u) => u.side === enemy && (threats.get(`${u.pos.x},${u.pos.y}`) ?? 0) >= F.offenseAttackers);
      if (hit) complete(ctx, side, 'offenseIsTheBestDefense');
    }
  }
}

/** *Destined for Greatness*: Common Pool + both Hero Pools at the side's End of Turn (spec A-02). */
export function checkEndOfTurn(ctx: Ctx, side: Side): void {
  const { s } = ctx;
  const total = s.destiny.common[side] + s.heroes.filter((h) => h.side === side).reduce((a, h) => a + h.pool, 0);
  if (total >= RULES.favors.destinedForGreatness) complete(ctx, side, 'destinedForGreatness');
}
