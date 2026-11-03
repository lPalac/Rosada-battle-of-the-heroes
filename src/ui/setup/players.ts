// Setup step 1: number of players, names and sides (FR-080).
import { t } from '../../i18n/strings.ts';
import { defaultPlayers, type Player, type Side } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export interface PlayersDraft {
  count: 2 | 3 | 4;
  singleSide: Side;
  names: string[];
}

export function playersOf(d: PlayersDraft): Player[] {
  return defaultPlayers(d.count, d.singleSide).map((p, i) => ({ ...p, name: d.names[i]?.trim() || p.name }));
}

export function renderPlayers(d: PlayersDraft, onChange: () => void, onNext: () => void, extra: HTMLElement[] = []): HTMLElement {
  const players = playersOf(d);
  return el('div', { class: 'col' },
    el('h3', {}, t('setup.players')),
    el('div', { class: 'row' },
      el('span', {}, t('setup.playerCount')),
      ...([2, 3, 4] as const).map((n) =>
        button(String(n), () => {
          d.count = n;
          onChange();
        }, { kind: d.count === n ? 'primary' : '', testid: `players-${n}` })),
    ),
    d.count === 3
      ? el('div', { class: 'row' },
          el('span', {}, t('setup.singleSide')),
          ...(['light', 'dark'] as const).map((s) =>
            button(t(`side.${s}`), () => {
              d.singleSide = s;
              onChange();
            }, { kind: d.singleSide === s ? 'primary' : '' })),
        )
      : null,
    ...players.map((p, i) =>
      el('label', { class: 'row' },
        el('input', {
          value: d.names[i] ?? '', placeholder: t('setup.playerName', { n: i + 1 }), 'data-testid': `player-name-${i + 1}`,
          oninput: (e) => (d.names[i] = (e.target as HTMLInputElement).value),
        }),
        el('span', { class: p.side }, t('setup.playerSide', { side: t(`side.${p.side}`) })),
      )),
    el('div', { class: 'row' }, button(t('setup.next'), onNext, { kind: 'primary', testid: 'setup-next' }), ...extra),
  );
}
