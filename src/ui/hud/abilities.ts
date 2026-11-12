// HUD ability panel (004 T060, US5-AS6): the active hero's abilities with Symbol Legend icons, cost normal / Bloodied,
// timing, uses left and "usable now". 006 US6 (FR-033, B-17): docked at the side between the pools and the log, with its
// own scroll; the header collapses it (remembered in this browser) and shows the hero, "n usable" and the current phase
// in a light green box. FR-004 / FR-026: a row without a Use button gives its reason on hover and keyboard focus.
// FR-017: Preaching offers one use or both as two buttons.
import type { HudModel } from '../../game/hud-model.ts';
import { hasString, t } from '../../i18n/strings.ts';
import { abilityOffers, squareName, type AbilityOffer, type AbilityStatus, type AbilityTarget, type GameState } from '../../rules/index.ts';
import { imageUrl } from '../art.ts';
import { button, el } from '../dom.ts';

function icon(key: string): HTMLElement {
  const url = imageUrl(`legend.${key}`);
  return url ? el('img', { class: 'ability-icon', src: url, alt: key, title: key }) : el('span', { class: 'ability-icon' });
}

/** 006 FR-004, FR-026: why an ability cannot be used now ("No legal target now: needs an enemy hero in range"). */
export function statusText(s: AbilityStatus): string {
  if (s.usable) return '';
  const reason = t(`status.${s.reason}`);
  return s.hint && hasString(`hint.${s.hint}`) ? `${reason}: ${t(`hint.${s.hint}`)}` : reason;
}

export interface AbilityPanelOptions {
  busy: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onUse: (abilityId: string, option?: string) => void;
  /** The options offered now for an ability with one use or both (Preaching), with their cost. */
  bothUses: (abilityId: string) => { option: string; cost: number }[];
}

export function renderAbilities(m: HudModel, o: AbilityPanelOptions): HTMLElement | null {
  const hero = m.heroes.find((h) => h.active);
  if (!hero || !hero.abilities.length) return null;
  const statusOf = (id: string) => m.abilityStatus.find((s) => s.abilityId === id);
  const usable = hero.abilities.filter((a) => a.usableNow && a.kind === 'action').length;
  const header = el('button', {
    class: 'ability-panel-header', 'data-testid': 'ability-panel-toggle', 'aria-expanded': String(!o.collapsed), onclick: o.onToggle,
  },
    el('strong', {}, hero.name || hero.id),
    el('span', { class: 'muted small', 'data-testid': 'ability-panel-usable' }, t('ability.panel.usable', { n: usable })),
    el('span', { class: 'phase-box', 'data-testid': 'ability-panel-phase' }, t(m.phaseLabelKey)),
    el('span', { class: 'chevron' }, o.collapsed ? '▸' : '▾'));
  const rows = o.collapsed ? [] : hero.abilities.map((a) => {
    const status = statusOf(a.id);
    // A row without a Use button gives its reason on hover and keyboard focus (tooltip).
    const why = status && !status.usable && !(a.usableNow && a.kind === 'action') ? statusText(status) : '';
    const both = a.usableNow && a.kind === 'action' ? o.bothUses(a.id) : [];
    return el('div', {
      class: `ability-row${a.usableNow ? ' usable' : ''}${why ? ' has-status' : ''}`, 'data-testid': `ability-${a.id}`, title: t(a.textKey),
      ...(why ? { tabindex: '0', 'aria-describedby': `ability-${a.id}-status` } : {}),
    },
      el('div', { class: 'row' }, ...a.icons.map(icon),
        el('span', { class: 'ability-name' }, t(a.nameKey)),
        el('span', { class: 'muted small', 'data-testid': `ability-${a.id}-cost` }, a.costText),
        a.printedCost ? el('span', { class: 'badge', title: t('ability.corrected') }, `≠ ${a.printedCost[0]}/${a.printedCost[1]}`) : null),
      // Compact (006 FR-033): the timing and the Use button share one line, so every ability fits without scrolling.
      el('div', { class: 'ability-foot' },
        el('span', { class: 'muted small' }, a.timings.length ? a.timings.map((x) => t(`timing.${x}`)).join(' / ') : t('timing.always')),
        both.length
          ? el('span', { class: 'ability-uses' }, ...both.map((b) => button(
              hasString(`option.${a.id}.${b.option}`) ? t(`option.${a.id}.${b.option}`, { cost: b.cost }) : t(`option.${b.option}`),
              () => o.onUse(a.id, b.option), { testid: `use-${a.id}-${b.option}`, disabled: o.busy })))
          : a.usableNow && a.kind === 'action'
            ? button(t('ability.use'), () => o.onUse(a.id), { testid: `use-${a.id}`, disabled: o.busy })
            : null),
      why ? el('div', { class: 'ability-status', role: 'tooltip', id: `ability-${a.id}-status`, 'data-testid': `ability-${a.id}-status` }, why) : null);
  });
  return el('div', { class: 'panel abilities col', 'data-testid': 'ability-panel', 'data-collapsed': String(o.collapsed) }, header, ...rows);
}

/** A readable label for a target choice. */
export function targetLabel(s: GameState, targets: AbilityTarget[]): string {
  if (!targets.length) return t('ability.noTarget');
  return targets.map((x) => {
    if ('square' in x) return squareName(x.square);
    if ('heroId' in x) return x.heroId;
    if ('unitType' in x) return t(`unit.${x.unitType}`);
    const u = s.units.find((v) => v.id === x.unitId) ?? s.graveyard.find((v) => v.id === x.unitId);
    return u ? `${t(`unit.${u.type}`)} ${squareName(u.pos)}` : x.unitId;
  }).join(' → ');
}

/** The offers of one ability (one per option). */
export const offersOf = (s: GameState, abilityId: string): AbilityOffer[] => abilityOffers(s).filter((o) => o.abilityId === abilityId);
