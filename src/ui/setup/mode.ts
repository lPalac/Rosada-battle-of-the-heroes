// Setup step 2: Draft or Mirror hero selection (FR-081).
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderMode(onPick: (mode: 'draft' | 'mirror') => void): HTMLElement {
  return el('div', { class: 'col' },
    el('h3', {}, t('setup.mode')),
    el('div', { class: 'choice' },
      ...(['draft', 'mirror'] as const).map((m) =>
        el('button', { class: 'card', 'data-testid': `mode-${m}`, onclick: () => onPick(m) },
          el('h3', {}, t(`setup.mode.${m}`)),
          el('div', { class: 'muted' }, t(`setup.mode.${m}Help`)),
        )),
    ),
  );
}
