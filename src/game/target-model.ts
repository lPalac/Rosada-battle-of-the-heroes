// 006 US4 (FR-020, FR-026, research R-08): ability targets as board picks, step by step. A unit or hero target is
// picked by its square; a target that is not on the board (a unit type, a unit in the Graveyard) keeps the dialog.
// Targets refused for a rule reason (check) are listed as blocked with their code. Engine-free.
import type { AbilityOffer, AbilityTarget, Coord, GameState } from '../rules/index.ts';

export interface TargetPick {
  coord: Coord;
  target: AbilityTarget;
}

export interface BlockedPick extends TargetPick {
  code: string;
}

export interface TargetPrompt {
  abilityId: string;
  option?: string;
  /** How many board picks a full choice needs. */
  length: number;
  /** `dialog` when a target cannot be picked on the board. */
  fallback: 'dialog' | null;
}

const sameTarget = (a: AbilityTarget, b: AbilityTarget) => JSON.stringify(a) === JSON.stringify(b);
const startsWith = (choice: AbilityTarget[], chosen: AbilityTarget[]) => chosen.every((t, i) => choice[i] && sameTarget(choice[i], t));

/** Where a target is on the board, or null when it is not on the board. */
export function coordOf(state: GameState, t: AbilityTarget): Coord | null {
  if ('square' in t) return t.square;
  if ('heroId' in t) return state.heroes.find((h) => h.id === t.heroId)?.pos ?? null;
  if ('unitId' in t) return state.units.find((u) => u.id === t.unitId)?.pos ?? null;
  return null;
}

export function targetPrompt(state: GameState, offer: AbilityOffer): TargetPrompt {
  const all = [...offer.targets, ...offer.blocked.map((b) => b.targets)];
  const length = Math.max(0, ...all.map((c) => c.length));
  const offBoard = all.some((c) => c.some((t) => coordOf(state, t) === null));
  return { abilityId: offer.abilityId, ...(offer.option ? { option: offer.option } : {}), length, fallback: offBoard ? 'dialog' : null };
}

/** The picks for the next step after `chosen`, and the blocked ones (a pick whose every choice is blocked). */
export function nextPicks(state: GameState, offer: AbilityOffer, chosen: AbilityTarget[]): { picks: TargetPick[]; blocked: BlockedPick[] } {
  const i = chosen.length;
  const picks: TargetPick[] = [];
  const add = <T extends TargetPick>(list: T[], item: T) => {
    if (!list.some((x) => sameTarget(x.target, item.target))) list.push(item);
  };
  for (const c of offer.targets) {
    if (!startsWith(c, chosen) || !c[i]) continue;
    const coord = coordOf(state, c[i]);
    if (coord) add(picks, { coord, target: c[i] });
  }
  const blocked: BlockedPick[] = [];
  for (const b of offer.blocked) {
    if (!startsWith(b.targets, chosen) || !b.targets[i]) continue;
    if (picks.some((p) => sameTarget(p.target, b.targets[i]))) continue; // still allowed with another later pick
    const coord = coordOf(state, b.targets[i]);
    if (coord) add(blocked, { coord, target: b.targets[i], code: b.code });
  }
  return { picks, blocked };
}

/** The full choice once every step is picked, or null. */
export function completedChoice(offer: AbilityOffer, chosen: AbilityTarget[]): AbilityTarget[] | null {
  return offer.targets.find((c) => c.length === chosen.length && startsWith(c, chosen)) ?? null;
}
