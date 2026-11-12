// HUD ability panel (004 T060, US5-AS6): the active hero's abilities with Symbol Legend icons, cost normal / Bloodied,
// timing, uses left and "usable now". A usable ability is used with one click; a choice of targets opens a dialog.
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

export function renderAbilities(m: HudModel, busy: boolean, onUse: (abilityId: string) => void): HTMLElement | null {
  const hero = m.heroes.find((h) => h.active);
  if (!hero || !hero.abilities.length) return null;
  const statusOf = (id: string) => m.abilityStatus.find((s) => s.abilityId === id);
  return el('div', { class: 'panel abilities col', 'data-testid': 'ability-panel' },
    el('strong', {}, hero.name),
    ...hero.abilities.map((a) => {
      const status = statusOf(a.id);
      // A row without a Use button gives its reason on hover and keyboard focus (tooltip).
      const why = status && !status.usable && !(a.usableNow && a.kind === 'action') ? statusText(status) : '';
      return el('div', {
        class: `ability-row${a.usableNow ? ' usable' : ''}${why ? ' has-status' : ''}`, 'data-testid': `ability-${a.id}`, title: t(a.textKey),
        ...(why ? { tabindex: '0', 'aria-describedby': `ability-${a.id}-status` } : {}),
      },
        el('div', { class: 'row' }, ...a.icons.map(icon),
          el('span', { class: 'ability-name' }, t(a.nameKey)),
          el('span', { class: 'muted small', 'data-testid': `ability-${a.id}-cost` }, a.costText),
          a.printedCost ? el('span', { class: 'badge', title: t('ability.corrected') }, `≠ ${a.printedCost[0]}/${a.printedCost[1]}`) : null),
        el('div', { class: 'muted small' }, a.timings.length ? a.timings.map((x) => t(`timing.${x}`)).join(' / ') : t('timing.always')),
        a.usableNow && a.kind === 'action'
          ? button(t('ability.use'), () => onUse(a.id), { testid: `use-${a.id}`, disabled: busy })
          : null,
        why ? el('div', { class: 'ability-status', role: 'tooltip', id: `ability-${a.id}-status`, 'data-testid': `ability-${a.id}-status` }, why) : null);
    }),
  );
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
