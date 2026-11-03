// Toasts: notices (Well depleted, research R-09) and rejected actions with their rule (FR-202).
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export class Toasts {
  readonly root = el('div', { class: 'toasts', 'data-testid': 'toasts' });

  show(text: string, opts: { error?: boolean; rule?: string; ms?: number; testid?: string } = {}): void {
    const node = el('div', { class: `toast ${opts.error ? 'error' : ''}`, 'data-testid': opts.testid ?? 'toast' },
      text, opts.rule ? el('div', { class: 'rule', 'data-testid': 'rule-panel' }, t('rule.panel', { rule: opts.rule })) : null);
    this.root.append(node);
    setTimeout(() => node.remove(), opts.ms ?? 4500);
  }

  wellDepleted(): void {
    this.show(t('notice.wellDepleted'), { ms: 9000, testid: 'notice-well' });
  }
}
