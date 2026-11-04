// Rule reference for the last rejected action: what blocked it and which rulebook section (FR-202).
import { hasString, t } from '../../i18n/strings.ts';
import type { RuleError } from '../../rules/index.ts';
import { el } from '../dom.ts';

export function errorText(e: RuleError): string {
  return hasString(`error.${e.code}`) ? t(`error.${e.code}`) : e.message;
}

export function renderRulePanel(e: RuleError | null): HTMLElement | null {
  if (!e) return null;
  return el('div', { class: 'panel muted', 'data-testid': 'rule-reference' },
    `${errorText(e)} — `, el('strong', {}, t('rule.panel', { rule: e.rule })));
}
