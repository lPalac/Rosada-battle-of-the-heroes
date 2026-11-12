// 006 US6 (FR-039, B-05): an "In check" pop-up above the ability panel for each side whose King is in check, in the
// side's colour, as long as the check lasts. Hover or keyboard focus shows the Check rule about the end of the Lead.
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderInCheck(m: HudModel): HTMLElement | null {
  if (!m.inCheck.length) return null;
  return el('div', { class: 'in-check-list' },
    ...m.inCheck.map((side) =>
      el('div', { class: `panel in-check ${side}`, 'data-testid': `in-check-${side}`, tabindex: '0', role: 'status', 'aria-describedby': `in-check-rule-${side}` },
        el('strong', {}, t('check.badge', { side: t(`side.${side}`) })),
        el('div', { class: 'in-check-rule', id: `in-check-rule-${side}`, role: 'tooltip', 'data-testid': 'in-check-rule' }, t('check.rule')))));
}
