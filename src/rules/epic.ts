// The Epic Stage: destiny choice in turn order, then Manifest, Common Pool split, health, War token removed
// (FR-001…FR-006, research R-01, R-02).
import { emit, fail, hero, type Ctx } from './ctx.ts';
import { heroDefinition } from './data.ts';
import { onEpicStage } from './abilities/effects.ts';
import type { PendingDecision } from './model/actions.ts';
import type { GameState } from './model/state.ts';
import { EPIC_DESTINIES, type EpicDestiny, type HeroId } from './model/types.ts';
import { complete } from './royal-favors.ts';

/** Destinies a hero may still choose: a side never holds one Fanatic and one Dominant hero. */
export function destinyOptions(state: GameState, heroId: HeroId): EpicDestiny[] {
  const h = hero(state, heroId);
  const other = state.heroes.find((x) => x.side === h.side && x.id !== h.id);
  const taken = other?.epic?.destiny;
  return EPIC_DESTINIES.filter((d) => !(taken === 'fanatic' && d === 'dominant') && !(taken === 'dominant' && d === 'fanatic'));
}

/** Turn order from the active hero, the hero who depleted the Well last (FR-002). */
export function choiceOrder(state: GameState): HeroId[] {
  const start = hero(state, state.activeHeroId).turnOrder;
  const order = [0, 1, 2, 3].map((i) => `H${((start - 1 + i) % 4) + 1}` as HeroId);
  const last = state.destiny.well.depletedBy;
  return last ? [...order.filter((id) => id !== last), last] : order;
}

/**
 * 006 FR-012 (research R-17): a Mirror game with named heroes, where each side holds the same two different heroes.
 * The generic test heroes keep the 003 queue (one choice per hero).
 */
function mirrorPairs(s: GameState): boolean {
  if (s.setup.mode !== 'mirror') return false;
  if (!s.heroes.every((h) => heroDefinition(h.definitionId).forms)) return false;
  const ids = (side: 'light' | 'dark') => s.heroes.filter((h) => h.side === side).map((h) => h.definitionId).sort().join(',');
  const light = s.heroes.filter((h) => h.side === 'light').map((h) => h.definitionId);
  return ids('light') === ids('dark') && new Set(light).size === light.length;
}

/** The hero with the same definition on the other side. */
const twinOf = (s: GameState, id: HeroId): HeroId => {
  const h = hero(s, id);
  return s.heroes.find((x) => x.side !== h.side && x.definitionId === h.definitionId)!.id;
};

/**
 * Mirror: two choices. The first hero of the 003 choice order chooses for its class (Q-75); then the hero of the other
 * class on the other side chooses for the other class. Each choice applies to the chooser and its twin.
 */
function mirrorQueue(s: GameState): PendingDecision[] {
  const first = choiceOrder(s)[0];
  const f = hero(s, first);
  const second = s.heroes.find((x) => x.side !== f.side && x.definitionId !== f.definitionId)!.id;
  return [first, second].map((heroId) => ({ type: 'epicDestiny', heroId, options: [], appliesTo: [heroId, twinOf(s, heroId)] }));
}

/** Called on entering Before Turn (after the checkmate check): opens the destiny choice once. */
export function maybeStartEpic(ctx: Ctx): void {
  const { s } = ctx;
  if (s.status !== 'playing' || !s.epicPending || s.stage !== 'starting') return;
  if (s.pendingDecision?.type === 'epicDestiny') return;
  const queue: PendingDecision[] = mirrorPairs(s)
    ? mirrorQueue(s)
    : choiceOrder(s).map((heroId) => ({ type: 'epicDestiny', heroId, options: [], appliesTo: [heroId] }));
  const first = queue.shift()!;
  if (first.type === 'epicDestiny') first.options = destinyOptions(s, first.heroId);
  s.decisionQueue = [...queue, ...s.decisionQueue];
  if (s.pendingDecision) s.decisionQueue.unshift(first);
  else s.pendingDecision = first;
}

/**
 * Answer one destiny choice: the chooser and every hero in `appliesTo` (006: its Mirror twin) take the destiny; after
 * the last choice the Epic Stage applies.
 */
export function chooseDestiny(ctx: Ctx, heroId: HeroId, destiny: EpicDestiny, appliesTo: HeroId[] = [heroId]): void {
  const { s } = ctx;
  if (!destinyOptions(s, heroId).includes(destiny)) fail('BAD_DESTINY', 'That destiny is not allowed', 'Epic Heroes');
  for (const id of appliesTo.includes(heroId) ? appliesTo : [heroId, ...appliesTo]) {
    const h = hero(s, id);
    h.epic = { destiny };
    // 004: a named hero becomes its Epic form (Cavalier + Fanatic → Death Knight); form stats apply (Dragon Lord).
    const form = heroDefinition(h.definitionId).forms?.[destiny];
    if (form) {
      h.form = form.id;
      if (form.stats?.movement) h.movement = form.stats.movement;
    }
    emit(ctx, { type: 'destinyChosen', heroId: id, destiny });
  }
  const next = s.decisionQueue[0];
  if (next?.type === 'epicDestiny') next.options = destinyOptions(s, next.heroId);
  if (!s.heroes.every((h) => h.epic)) return;
  applyEpicStage(ctx);
}

function applyEpicStage(ctx: Ctx): void {
  const { s } = ctx;
  // 1. Manifest Epic Destiny for the depleting hero's side.
  const by = s.destiny.well.depletedBy;
  if (by) complete(ctx, hero(s, by).side, 'manifestEpicDestiny');
  // 2. Each Common Pool is split between the side's heroes; an odd 1 D stays.
  for (const side of ['light', 'dark'] as const) {
    const heroes = s.heroes.filter((h) => h.side === side);
    const share = Math.floor(s.destiny.common[side] / heroes.length);
    if (share <= 0) continue;
    for (const h of heroes) {
      h.pool += share;
      s.destiny.common[side] -= share;
      s.destiny.entries.push({ turn: s.turnNumber, side, heroId: h.id, delta: share, pool: 'hero', reason: 'epicSplit' });
      s.destiny.entries.push({ turn: s.turnNumber, side, delta: -share, pool: 'common', reason: 'epicSplit' });
      emit(ctx, { type: 'destinyChanged', pool: 'common', side, delta: -share, reason: 'epicSplit' });
      emit(ctx, { type: 'destinyChanged', pool: 'hero', side, heroId: h.id, delta: share, reason: 'epicSplit' });
    }
  }
  // 3. Health rises to the Epic maximum (+10 Short, +8 Long).
  for (const h of s.heroes) {
    const def = heroDefinition(h.definitionId);
    const rise = def.epicMaxHealth - def.maxHealth;
    h.maxHealth += rise;
    h.health += rise;
  }
  // 4. The Declaration of War token leaves the table: no more War bonus (clarified).
  s.tokens.peaceTreaty = 'removed';
  emit(ctx, { type: 'tokenChanged', token: 'peaceTreaty', value: 'removed' });
  // 5. The Epic Stage.
  s.stage = 'epic';
  s.epicPending = false;
  emit(ctx, { type: 'epicStageStarted' });
  onEpicStage(ctx);
}
