// Setup step 5: the chosen turn order and starting squares, then Start.
import { t } from '../../i18n/strings.ts';
import { heroStartSquares, squareName, type SetupChoices } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export function summaryLines(setup: SetupChoices): { n: number; text: string }[] {
  const out: { n: number; text: string }[] = [];
  for (const side of ['light', 'dark'] as const) {
    setup.turnOrder[side]?.forEach((pickIndex, i) => {
      const pick = setup.picks.find((p) => p.pickIndex === pickIndex)!;
      const n = side === 'light' ? 1 + 2 * i : 2 + 2 * i;
      const slot = setup.picks.filter((p) => p.side === side).findIndex((p) => p.pickIndex === pickIndex);
      const players = setup.players.filter((p) => p.side === side);
      const player = players[Math.min(slot, players.length - 1)].name;
      const square = squareName(heroStartSquares(side)[setup.startFiles[String(pickIndex)] === 'c' ? 0 : 1]);
      out.push({ n, text: t('setup.heroLine', { n, side: t(`side.${side}`), range: t(`range.${pick.rangeType}`), player, square }) });
    });
  }
  return out.sort((a, b) => a.n - b.n);
}

export function renderSummary(setup: SetupChoices, onStart: () => void, onBack: () => void): HTMLElement {
  return el('div', { class: 'col' },
    el('h3', {}, t('setup.summary')),
    el('ol', { 'data-testid': 'setup-summary' }, ...summaryLines(setup).map((l) => el('li', {}, l.text))),
    el('div', { class: 'row' },
      button(t('setup.back'), onBack),
      button(t('setup.start'), onStart, { kind: 'primary big', testid: 'start-game' }),
    ),
  );
}
