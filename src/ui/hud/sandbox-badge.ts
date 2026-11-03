// Permanent sandbox indicator (FR-102, US6-AS3).
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderSandboxBadge(on: boolean): HTMLElement | null {
  return on ? el('div', { class: 'sandbox-badge', 'data-testid': 'sandbox-badge' }, t('hud.sandbox')) : null;
}
