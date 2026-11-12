// 006 US6 (FR-034, FR-036, FR-037): Movement and Range badges with the Symbol Legend icons, the green / red health bar
// with the numbers inside (B-18), and the Hero Unit icons (B-21).
import type { HeroCard } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import type { UnitType } from '../../rules/index.ts';
import { imageUrl } from '../art.ts';
import { el } from '../dom.ts';

function badge(icon: string, text: string, testid?: string): HTMLElement {
  const url = imageUrl(`legend.${icon}`);
  return el('span', { class: 'badge stat-badge', ...(testid ? { 'data-testid': testid } : {}), title: t(`legend.${icon}`) },
    url ? el('img', { class: 'badge-icon', src: url, alt: '' }) : null,
    el('span', {}, text));
}

export function movementBadge(left: number, total: number, testid?: string): HTMLElement {
  return badge('movement', t('hud.move', { left, total }), testid);
}

export function rangeBadge(range: number, testid?: string): HTMLElement {
  return badge('range', t('hud.rangeBadge', { range }), testid);
}

/** Green for the health left, red for the health lost, "6/8" inside, readable on both colours. */
export function healthBar(health: number, max: number, testid?: string): HTMLElement {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * health) / max)) : 0;
  return el('div', {
    class: 'health-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(health),
    'aria-label': t('hud.healthAria', { health, max }), ...(testid ? { 'data-testid': testid } : {}),
  },
    el('div', { class: 'health-fill', style: `width:${pct}%` }),
    el('span', { class: 'health-text' }, `${health}/${max}`));
}

const GLYPH: Partial<Record<UnitType, string>> = { rook: '♜', knight: '♞', bishop: '♝', queen: '♛', pawn: '♟' };

/** The unit types a hero becomes as a Hero Unit: dimmed until the side has the Hero Unit power. */
export function heroUnitIcons(h: HeroCard, testid?: string): HTMLElement {
  const { types, unlocked } = h.heroUnitIcons;
  return el('span', {
    class: `hero-unit-icons${unlocked ? '' : ' dim'}`, 'data-unlocked': String(unlocked), ...(testid ? { 'data-testid': testid } : {}),
    title: t('hud.heroUnitIcon', { types: types.map((x) => t(`unit.${x}`)).join(', ') }),
  },
    ...types.map((type) => {
      const url = imageUrl(`token.ring.${type}`);
      return url ? el('img', { class: 'hero-unit-icon', src: url, alt: t(`unit.${type}`) }) : el('span', { class: 'hero-unit-glyph' }, GLYPH[type] ?? '?');
    }));
}
