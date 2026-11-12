// 006 US6 (FR-035, FR-039, research R-10): short notices ("flashes") built from the events of one action. Engine-free.
// The DOM layer (ui/hud/flashes.ts) shows them for 1 s and slides them to the log; the "CHECK" notice is drawn above
// the checked King instead.
import { t } from '../i18n/strings.ts';
import { DATA, heroAbilityIds, type GameEvent, type GameState, type HeroId, type Phase, type Side } from '../rules/index.ts';
import { abilityNameOf, reasonLabel } from './labels.ts';

export type FlashKind = 'check' | 'wound' | 'heal' | 'destiny' | 'roll' | 'ability' | 'destroyed' | 'leadFailed' | 'skipped';

export interface Flash {
  kind: FlashKind;
  textKey: string;
  params: Record<string, string | number>;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  /** The side whose colour the flash carries (for `check`: the checked King's side). */
  side: Side | null;
}

/** Start-of-turn phases are announced only for a hero with an ability timed in them (decided 2026-11-11, Q-77). */
const START_PHASES: Phase[] = ['beforeTurn', 'beginningOfTurn', 'beforeMove'];

function heroLabel(state: GameState, id: HeroId): string {
  const h = state.heroes.find((x) => x.id === id);
  if (!h) return id;
  const def = DATA.heroes.find((d) => d.id === h.definitionId);
  if (!def?.forms) return id;
  const form = h.form ? Object.values(def.forms).find((f) => f.id === h.form) : undefined;
  return form?.name ?? def.name;
}

function hasAbilityIn(state: GameState, heroId: HeroId, phase: Phase): boolean {
  const h = state.heroes.find((x) => x.id === heroId);
  if (!h) return false;
  return heroAbilityIds(h).some((id) => DATA.abilities.find((a) => a.id === id)?.timings.includes(phase as never));
}

const make = (kind: FlashKind, textKey: string, params: Record<string, string | number>, tone: Flash['tone'], side: Side | null = null): Flash =>
  ({ kind, textKey, params, text: t(textKey, params), tone, side });

export function flashesFor(events: readonly GameEvent[], state: GameState): Flash[] {
  const out: Flash[] = [];
  const rolled = events.some((e) => e.type === 'rolled');
  // Phases the game passed by itself: every phase entered in this action except the last one (where play rests).
  const phases = events.filter((e): e is Extract<GameEvent, { type: 'phaseChanged' }> => e.type === 'phaseChanged');
  const passed = new Set(phases.slice(0, -1));
  // Destiny summed per pool and reason.
  const destiny = new Map<string, { side: Side; heroId?: HeroId; reason: string; delta: number }>();
  for (const e of events) {
    switch (e.type) {
      case 'heroWounded':
        out.push(make('wound', 'flash.wound', { hero: heroLabel(state, e.heroId), n: e.amount }, 'bad', state.heroes.find((h) => h.id === e.heroId)?.side ?? null));
        break;
      case 'heroHealed':
        if (e.amount > 0) out.push(make('heal', 'flash.heal', { hero: heroLabel(state, e.heroId), n: e.amount, reason: reasonLabel(e.reason) }, 'good'));
        break;
      case 'unitDestroyed': {
        const u = state.graveyard.find((x) => x.id === e.unitId);
        out.push(make('destroyed', 'flash.destroyed', { unit: u ? t(`unit.${u.type}`) : e.unitId }, 'neutral', u?.side ?? null));
        break;
      }
      case 'abilityUsed':
        out.push(make('ability', 'flash.ability', { hero: heroLabel(state, e.heroId), ability: abilityNameOf(e.ability) ?? reasonLabel(e.ability) }, 'neutral'));
        break;
      case 'rolled':
        out.push(e.total === null
          ? make('roll', 'flash.rollFree', { value: e.value }, 'neutral')
          : make('roll', e.success ? 'flash.rollSuccess' : 'flash.rollFail', { value: e.value, total: e.total }, e.success ? 'good' : 'bad'));
        break;
      case 'leadFailed':
        if (!rolled) out.push(make('leadFailed', 'flash.leadFailed', {}, 'bad'));
        break;
      case 'check':
        out.push(make('check', 'check.flash', {}, 'bad', e.side));
        break;
      case 'destinyChanged': {
        if (e.reason === 'epicSplit') break;
        const key = `${e.pool}|${e.side}|${e.heroId ?? ''}|${e.reason}`;
        const d = destiny.get(key) ?? { side: e.side, ...(e.heroId ? { heroId: e.heroId } : {}), reason: e.reason, delta: 0 };
        d.delta += e.delta;
        destiny.set(key, d);
        break;
      }
      case 'phaseChanged': {
        if (!passed.has(e)) break;
        if (START_PHASES.includes(e.phase) && !hasAbilityIn(state, e.heroId, e.phase)) break;
        const lead = e.phase === 'lead';
        out.push(make('skipped', lead ? 'flash.skippedLead' : 'flash.skipped', { phase: t(`phase.${e.phase}`) }, 'neutral'));
        break;
      }
      default:
        break;
    }
  }
  for (const d of destiny.values()) {
    if (d.delta === 0) continue;
    const owner = d.heroId ? heroLabel(state, d.heroId) : t(`side.${d.side}`);
    const n = d.delta > 0 ? `+${d.delta}` : `−${Math.abs(d.delta)}`;
    out.push(make('destiny', 'flash.destiny', { n, owner, reason: reasonLabel(d.reason) }, d.delta > 0 ? 'good' : 'neutral', d.side));
  }
  return out;
}
