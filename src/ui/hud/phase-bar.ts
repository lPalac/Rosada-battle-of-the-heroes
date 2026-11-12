// Turn, Active Hero and current phase, always visible (FR-010, US7-AS3). 006 B-20: a named hero by name
// ("H1 · Cavalier (Light)"), its Movement and Range as badges; the generic test heroes keep their text.
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';
import { movementBadge, rangeBadge } from './badges.ts';

export function renderPhaseBar(m: HudModel): HTMLElement {
  const active = m.heroes.find((h) => h.active);
  return el('div', { class: 'topbar panel', 'data-testid': 'phase-bar' },
    el('strong', { 'data-testid': 'turn-number' }, t('hud.turn', { n: m.turnNumber })),
    active
      ? el('span', { class: `active-hero ${active.side}`, 'data-testid': 'active-hero' },
          active.name
            ? t('hud.activeNamed', { hero: active.id, name: active.name, side: t(`side.${active.side}`) })
            : t('hud.activeHero', { hero: active.id, side: t(`side.${active.side}`), range: t(`range.${active.rangeType}`) }))
      : null,
    active ? movementBadge(active.movementLeft ?? active.movement, active.movement, 'active-movement') : null,
    active ? rangeBadge(active.range, 'active-range') : null,
    el('div', { class: 'phases' },
      ...m.phases.map((p) => el('span', { class: `phase ${p.current ? 'current' : ''}`, 'data-testid': p.current ? 'current-phase' : undefined }, t(`phase.${p.id}`))),
    ),
  );
}
