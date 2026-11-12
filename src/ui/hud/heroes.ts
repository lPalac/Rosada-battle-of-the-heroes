// Hero panels: health, Movement left, Range, Destiny pool, status (US7-AS3). 006 US6: named heroes by name (B-20),
// Movement and Range badges, the green / red health bar (B-18), the Hero Unit icons (B-21).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';
import { healthBar, heroUnitIcons, movementBadge, rangeBadge } from './badges.ts';

export function renderHeroes(m: HudModel, playerName: (id: string) => string): HTMLElement {
  return el('div', { class: 'heroes', 'data-testid': 'heroes' },
    ...m.heroes.map((h) =>
      el('div', { class: `panel hero-card ${h.active ? 'active' : ''}`, 'data-testid': `hero-${h.id}` },
        el('div', { class: `name ${h.side} row` },
          el('span', {}, `${h.id} · ${h.name ? `${h.name} (${t(`side.${h.side}`)})` : `${t(`side.${h.side}`)} ${t(`range.${h.rangeType}`)}`}`),
          heroUnitIcons(h, `hero-${h.id}-unit-icons`)),
        el('div', { class: 'muted' }, playerName(h.playerId)),
        healthBar(h.health, h.maxHealth, `hero-${h.id}-health`),
        el('div', { class: 'row muted' },
          movementBadge(h.movementLeft ?? h.movement, h.movement, `hero-${h.id}-move`),
          rangeBadge(h.range, `hero-${h.id}-range`),
          el('span', {}, t('hud.pool', { n: h.pool })),
        ),
        h.unconscious ? el('div', { class: 'muted' }, `${t('hud.unconscious')}${h.skipNextTurn ? ` – ${t('hud.skips')}` : ''}`) : null,
        h.destiny || h.bloodied || h.heroUnit || m.stage === 'epic'
          ? el('div', { class: 'row muted small' },
              h.destiny ? el('span', { 'data-testid': `hero-${h.id}-destiny` }, t('hud.epic', { destiny: t(`destiny.${h.destiny}`) })) : null,
              m.stage === 'epic' ? el('span', { 'data-testid': `hero-${h.id}-generation` }, t('hud.generation', { n: h.generation })) : null,
              h.bloodied ? el('span', { class: 'bloodied', 'data-testid': `hero-${h.id}-bloodied` }, t('hud.bloodied')) : null,
              h.heroUnit ? el('span', { 'data-testid': `hero-${h.id}-hero-unit` }, t('hud.heroUnit', { types: h.heroUnit.map((x) => t(`unit.${x}`)).join(' + ') })) : null)
          : null,
      )),
  );
}
