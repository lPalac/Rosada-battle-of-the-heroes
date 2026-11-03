// Text log of every action, roll and Destiny change in the current game (FR-112).
import { formatLogEntry } from '../game/log.ts';
import { t } from '../i18n/strings.ts';
import type { LogEntry } from '../rules/index.ts';
import { el } from './dom.ts';

export function renderLog(log: LogEntry[]): HTMLElement {
  const items = log
    .map((e) => ({ e, text: formatLogEntry(e) }))
    .filter((x) => x.text !== null)
    .slice(-150)
    .map(({ e, text }) => el('li', { class: e.type === 'turnStarted' ? 'turn' : '' }, text!));
  const list = el('ol', { 'data-testid': 'log' }, ...items);
  queueMicrotask(() => (list.scrollTop = list.scrollHeight));
  return el('div', { class: 'panel log' }, el('strong', {}, t('hud.log')), list);
}
