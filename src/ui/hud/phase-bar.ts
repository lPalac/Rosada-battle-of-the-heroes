// Turn, Active Hero and current phase, always visible (FR-010, US7-AS3).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderPhaseBar(m: HudModel): HTMLElement {
  const active = m.heroes.find((h) => h.active);
  return el('div', { class: 'topbar panel', 'data-testid': 'phase-bar' },
    el('strong', { 'data-testid': 'turn-number' }, t('hud.turn', { n: m.turnNumber })),
    active
      ? el('span', { class: `active-hero ${active.side}`, 'data-testid': 'active-hero' },
          t('hud.activeHero', { hero: active.id, side: t(`side.${active.side}`), range: t(`range.${active.rangeType}`) }))
      : null,
    el('div', { class: 'phases' },
      ...m.phases.map((p) => el('span', { class: `phase ${p.current ? 'current' : ''}`, 'data-testid': p.current ? 'current-phase' : undefined }, t(`phase.${p.id}`))),
    ),
  );
}
