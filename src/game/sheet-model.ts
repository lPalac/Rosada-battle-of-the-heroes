// What each hero sheet and the HUD ability panel show (004 T057, research R-12), from the state only. Engine-free.
import { t } from '../i18n/strings.ts';
import {
  abilityCost, abilityOffers, DATA, heroAbilityIds, healthBarOf, isBloodied, usesLeft, type GameState, type HeroId,
} from '../rules/index.ts';

export interface AbilityRow {
  id: string;
  nameKey: string;
  textKey: string;
  kind: 'passive' | 'action' | 'reaction';
  timings: string[];
  icons: string[];
  /** [normal, bloodied] from the data (Hero Rules 2_0), or null for limited / free abilities. */
  cost: [number, number] | null;
  /** Cost to pay now (Bloodied-aware). */
  costNow: number;
  /** What the TTS sheet prints, when it differs from the data: shown as a corrected badge (FR-001a). */
  printedCost: [number, number] | null;
  uses: number | null;
  usesLeft: number | null;
  /** 006 FR-002: cost and uses as one text: "1 D · 1 of 1 left", "3/4 D", "2 of 2 left", or "". */
  costText: string;
  usableNow: boolean;
  options: string[];
}

function costTextOf(cost: [number, number] | null, uses: number | null, usesLeft: number | null): string {
  const d = cost ? (cost[0] === cost[1] ? `${cost[0]} D` : `${cost[0]}/${cost[1]} D`) : '';
  const u = uses !== null ? t('ability.usesLeft', { n: usesLeft ?? 0, of: uses }) : '';
  return d && u ? t('ability.costAndUses', { cost: d, uses: u }) : d || u;
}

export interface SheetModel {
  heroId: HeroId;
  definitionId: string;
  /** Hero or Epic form name (English). */
  name: string;
  formId: string | null;
  /** Asset key of the sheet image; `sheet.hero` means the canvas-drawn sheet (Cultist, generic heroes). */
  sheetKey: string;
  portraitKey: string;
  canvasSheet: boolean;
  health: number;
  maxHealth: number;
  /** Health bar image: 16 or 20. */
  bar: 16 | 20;
  bloodied: boolean;
  pool: number;
  turnOrder: number;
  active: boolean;
  abilities: AbilityRow[];
  /** Marks on the hero (effect kinds). */
  marks: string[];
}

export function sheetModel(state: GameState, heroId: HeroId): SheetModel {
  const h = state.heroes.find((x) => x.id === heroId)!;
  const def = DATA.heroes.find((d) => d.id === h.definitionId);
  const form = h.form && def?.forms ? Object.values(def.forms).find((f) => f.id === h.form) : undefined;
  const sheetKey = form?.sheet ?? def?.sheet ?? 'sheet.hero';
  const offers = state.status === 'playing' ? abilityOffers(state) : [];
  const abilities = heroAbilityIds(h).map((id): AbilityRow => {
    const a = DATA.abilities.find((x) => x.id === id)!;
    const cost: [number, number] | null = a.cost ? [a.cost.normal, a.cost.bloodied] : null;
    const printed = a.sheet?.printedCost ?? null;
    return {
      id, nameKey: a.name, textKey: a.text, kind: a.kind, timings: a.timings, icons: a.icons, cost,
      costNow: abilityCost(state, h.id, id), printedCost: printed && cost && (printed[0] !== cost[0] || printed[1] !== cost[1]) ? printed : null,
      uses: a.uses, usesLeft: usesLeft(state, h.id, id), costText: costTextOf(cost, a.uses, usesLeft(state, h.id, id)), usableNow: offers.some((o) => o.heroId === h.id && o.abilityId === id), options: a.options ?? [],
    };
  });
  return {
    heroId: h.id, definitionId: h.definitionId, name: form?.name ?? def?.name ?? h.definitionId, formId: h.form ?? null,
    sheetKey, portraitKey: form?.portrait ?? def?.portrait ?? 'portrait.short', canvasSheet: sheetKey === 'sheet.hero',
    health: h.health, maxHealth: h.maxHealth, bar: healthBarOf(h.healthBarId).max === 16 ? 16 : 20, bloodied: isBloodied(state, h.id),
    pool: h.pool, turnOrder: h.turnOrder, active: h.id === state.activeHeroId, abilities,
    marks: state.effects.filter((e) => 'heroId' in e.target && e.target.heroId === h.id).map((e) => e.kind),
  };
}
