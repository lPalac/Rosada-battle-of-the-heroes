// Hero panels: health, Movement left, Range, Destiny pool, status (US7-AS3).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderHeroes(m: HudModel, playerName: (id: string) => string): HTMLElement {
  return el('div', { class: 'heroes' },
    ...m.heroes.map((h) =>
      el('div', { class: `panel hero-card ${h.active ? 'active' : ''}`, 'data-testid': `hero-${h.id}` },
        el('div', { class: `name ${h.side}` }, `${h.id} · ${t(`side.${h.side}`)} ${t(`range.${h.rangeType}`)}`),
        el('div', { class: 'muted' }, playerName(h.playerId)),
        el('div', { class: 'bar' }, el('div', { style: `width:${(100 * h.health) / h.maxHealth}%` })),
        el('div', { class: 'row muted' },
          el('span', { 'data-testid': `hero-${h.id}-health` }, t('hud.health', { health: h.health, max: h.maxHealth })),
          el('span', { 'data-testid': h.active ? 'active-movement' : undefined },
            t('hud.movement', { left: h.movementLeft ?? h.movement, total: h.movement })),
          el('span', { 'data-testid': h.active ? 'active-range' : undefined }, t('hud.range', { range: h.range })),
          el('span', {}, t('hud.pool', { n: h.pool })),
        ),
        h.unconscious ? el('div', { class: 'muted' }, `${t('hud.unconscious')}${h.skipNextTurn ? ` – ${t('hud.skips')}` : ''}`) : null,
      )),
  );
}
