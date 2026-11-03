// Result screen: winner or draw reason, summary, New game / Rematch / Continue in sandbox (FR-090, FR-091).
import { t } from '../i18n/strings.ts';
import type { GameResult } from '../rules/index.ts';
import { button, el } from './dom.ts';

export interface ResultHandlers {
  newGame(): void;
  rematch(): void;
  sandbox(): void;
}

export function renderResult(r: GameResult, h: ResultHandlers): HTMLElement {
  const title = r.kind === 'win'
    ? t('result.win', { side: t(`side.${r.winner}`), by: t(`result.by.${r.by}`) })
    : t('result.draw', { by: t(`result.by.${r.by}`) });
  return el('div', { class: 'panel dialog col', 'data-testid': 'result' },
    el('h2', { 'data-testid': 'result-title' }, title),
    el('div', { class: 'muted' }, t('result.summary', { turns: r.summary.turnsPlayed, light: r.summary.destroyed.light, dark: r.summary.destroyed.dark })),
    el('div', { class: 'row' },
      button(t('result.newGame'), h.newGame, { testid: 'result-new' }),
      button(t('result.rematch'), h.rematch, { kind: 'primary', testid: 'result-rematch' }),
      button(t('result.sandbox'), h.sandbox, { testid: 'result-sandbox' }),
    ),
  );
}
