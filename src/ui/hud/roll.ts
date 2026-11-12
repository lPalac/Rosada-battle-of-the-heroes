// Roll button and Lead preview: modifiers, target 6, the face rolled, total and success/fail (FR-032, US7-AS2).
// 006 US5: a Lead without a roll says why (B-04); modifiers by name (X-01); Inspired Lead next to the Roll button (B-07).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { button, el } from '../dom.ts';

export function renderLeadPanel(
  m: HudModel, rolling: boolean, onRoll: () => void, onRevenge: () => void, onInspired: () => void = () => {},
): HTMLElement | null {
  const lead = m.lead;
  if (!lead) return null;
  const preview = lead.needsRoll
    ? el('div', { 'data-testid': 'lead-preview' }, t('lead.preview', { mods: lead.modifierLabels.length ? lead.modifierLabels.join(' + ') : '0', target: lead.target }))
    : el('div', { 'data-testid': 'lead-preview' },
        el('span', { 'data-testid': 'lead-auto' }, t(`lead.auto.${lead.auto ?? 'cannotFail'}`, { n: lead.modifierTotal })));
  return el('div', { class: 'panel lead-panel', 'data-testid': 'lead-panel' },
    preview,
    lead.roll !== null
      ? el('div', { class: `result ${lead.success ? 'success' : 'fail'}`, 'data-testid': 'roll-result' },
          t('lead.result', { roll: lead.roll, total: lead.total ?? 0, outcome: t(lead.success ? 'lead.success' : 'lead.fail') }))
      : null,
    lead.awaitingRoll
      ? el('div', { class: 'row', style: 'justify-content:center' },
          button(rolling ? t('action.rolling') : t('action.roll'), onRoll, { kind: 'primary big', testid: 'roll-button', disabled: rolling }),
          m.can.inspiredLeadMax > 0 ? button(t('action.inspiredLead'), onInspired, { testid: 'inspired-lead-roll', disabled: rolling }) : null,
          m.can.useRevenge ? button(t('action.useRevenge'), onRevenge, { testid: 'use-revenge', disabled: rolling }) : null)
      : null,
  );
}
