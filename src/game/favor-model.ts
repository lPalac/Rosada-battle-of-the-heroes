// The Royal Favor tracker view, from the state only (US3-AS14, research R-10). Feeds both the tracker modal and the
// track on the table, so they always agree. Engine-free.
import { FAVORS, unlockedPowers, type FavorId, type GameState, type PowerId, type Side } from '../rules/index.ts';

export type FavorStatusView = 'done' | 'half' | 'open';

export interface FavorRow {
  id: FavorId;
  order: number;
  nameKey: string;
  requirementKey: string;
  kind: 'once' | 'half' | 'count';
  status: FavorStatusView;
  progress: number;
  /** Progress needed: 1 for once, target for half/count, repeat for Tides. */
  target: number;
}

export interface PowerRow {
  id: PowerId;
  nameKey: string;
  textKey: string;
  threshold: number;
  unlocked: boolean;
}

export interface SideFavors {
  side: Side;
  favors: FavorRow[];
  /** Completion order, one entry per filled slot. */
  track: FavorId[];
  slots: number;
  powers: PowerRow[];
  /** The next Power and how many more Royal Favors it needs; null when all are unlocked. */
  next: { power: PowerId; nameKey: string; needed: number } | null;
  kingsForces: number;
  tides: number;
}

/** 006 FR-041: the one shared track on the table and in the menu: slots 1…11, both sides' counts (capped at 11). */
export interface SharedTrack {
  slots: number;
  light: number;
  dark: number;
  powers: { threshold: number; id: PowerId; nameKey: string }[];
}

export interface FavorModel {
  light: SideFavors;
  dark: SideFavors;
  shared: SharedTrack;
}

export const SHARED_SLOTS = 11;

/** Slots on a track: every numbered Royal Favor once, Tides up to its repeat count. */
export const TRACK_SLOTS = FAVORS.favors.reduce((a, f) => a + (f.repeat ?? 1), 0);

function sideModel(state: GameState, side: Side): SideFavors {
  const rec = state.royalFavors[side];
  const favors = [...FAVORS.favors].sort((a, b) => a.order - b.order).map((f): FavorRow => {
    const st = rec.status[f.id];
    const target = f.repeat ?? f.target ?? 1;
    const progress = f.id === 'tidesOfDestiny' ? rec.tides : st.done ? target : st.progress;
    const status: FavorStatusView = st.done ? 'done' : progress > 0 ? 'half' : 'open';
    return {
      id: f.id, order: f.order, nameKey: `favor.${f.id}.name`, requirementKey: `favor.${f.id}.requirement`,
      kind: f.kind, status, progress, target,
    };
  });
  const unlocked = unlockedPowers(state, side);
  const powers = FAVORS.powers.map((p): PowerRow => ({
    id: p.id, nameKey: `power.${p.id}.name`, textKey: `power.${p.id}.text`, threshold: p.threshold, unlocked: unlocked.includes(p.id),
  }));
  const nextPower = powers.find((p) => !p.unlocked);
  return {
    side, favors, track: [...rec.track], slots: TRACK_SLOTS, powers,
    next: nextPower ? { power: nextPower.id, nameKey: nextPower.nameKey, needed: nextPower.threshold - rec.track.length } : null,
    kingsForces: rec.kingsForces, tides: rec.tides,
  };
}

export function favorModel(state: GameState): FavorModel {
  const light = sideModel(state, 'light');
  const dark = sideModel(state, 'dark');
  const shared: SharedTrack = {
    slots: SHARED_SLOTS,
    light: Math.min(SHARED_SLOTS, light.track.length),
    dark: Math.min(SHARED_SLOTS, dark.track.length),
    powers: FAVORS.powers.map((p) => ({ threshold: p.threshold, id: p.id, nameKey: `power.${p.id}.name` })),
  };
  return { light, dark, shared };
}
