// Roll button and Lead preview: modifiers, target 6, the face rolled, total and success/fail (FR-032, US7-AS2).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { button, el } from '../dom.ts';

export function renderLeadPanel(m: HudModel, rolling: boolean, onRoll: () => void, onRevenge: () => void): HTMLElement | null {
  const lead = m.lead;
  if (!lead) return null;
  const mods = lead.modifiers.map((x) => t(`mod.${x.source}`, { n: x.value }));
  const preview = lead.needsRoll ? t('lead.preview', { mods: mods.length ? mods.join(' + ') : '0', target: lead.target }) : t('lead.noRoll');
  return el('div', { class: 'panel lead-panel', 'data-testid': 'lead-panel' },
    el('div', { 'data-testid': 'lead-preview' }, preview),
    lead.roll !== null
      ? el('div', { class: `result ${lead.success ? 'success' : 'fail'}`, 'data-testid': 'roll-result' },
          t('lead.result', { roll: lead.roll, total: lead.total ?? 0, outcome: t(lead.success ? 'lead.success' : 'lead.fail') }))
      : null,
    lead.awaitingRoll
      ? el('div', { class: 'row', style: 'justify-content:center' },
          button(rolling ? t('action.rolling') : t('action.roll'), onRoll, { kind: 'primary big', testid: 'roll-button', disabled: rolling }),
          m.can.useRevenge ? button(t('action.useRevenge'), onRevenge, { testid: 'use-revenge', disabled: rolling }) : null)
      : null,
  );
}
