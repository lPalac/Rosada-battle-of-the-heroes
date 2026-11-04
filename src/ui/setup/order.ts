// Setup step 4: each side, Light first, chooses its turn order and which hero starts behind which Bishop
// (FR-082, FR-083). A suggestion is pre-selected and can be changed.
import { t } from '../../i18n/strings.ts';
import { sidePicks, type Pick, type SetupChoices, type Side } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export interface OrderChoice {
  first: number;
  cFile: number;
}

function playerName(setup: SetupChoices, side: Side, slot: number): string {
  const players = setup.players.filter((p) => p.side === side);
  return players[Math.min(slot, players.length - 1)].name;
}

function describe(setup: SetupChoices, p: Pick, slot: number): string {
  return `${t(`range.${p.rangeType}`)} (${playerName(setup, p.side, slot)})`;
}

export function renderOrder(setup: SetupChoices, side: Side, choice: OrderChoice, onChange: () => void, onConfirm: () => void): HTMLElement {
  const picks = sidePicks(setup, side);
  const firstTurn = side === 'light' ? 1 : 2;
  const radio = (name: string, checked: boolean, label: string, testid: string, set: () => void) =>
    el('label', { class: 'row' },
      el('input', { type: 'radio', name, checked, 'data-testid': testid, onchange: () => { set(); onChange(); } }),
      label);
  return el('div', { class: 'col' },
    el('h3', { class: side }, t('setup.order')),
    el('div', { class: 'muted' }, t('setup.orderHelp', { side: t(`side.${side}`) })),
    el('div', { class: 'choice' },
      ...picks.map((p, slot) =>
        el('div', { class: `card ${choice.first === p.pickIndex ? 'selected' : ''}` },
          el('h3', {}, describe(setup, p, slot)),
          radio(`first-${side}`, choice.first === p.pickIndex, t('setup.playsFirst', { n: firstTurn }), `first-${side}-${slot}`, () => (choice.first = p.pickIndex)),
          radio(`file-${side}`, choice.cFile === p.pickIndex, t('setup.startBehind', { file: 'c' }), `cfile-${side}-${slot}`, () => (choice.cFile = p.pickIndex)),
          el('div', { class: 'muted' },
            `${t('setup.playsFirst', { n: choice.first === p.pickIndex ? firstTurn : firstTurn + 2 })} · ${t('setup.startBehind', { file: choice.cFile === p.pickIndex ? 'c' : 'f' })}`),
        )),
    ),
    el('div', { class: 'row' }, button(t('setup.next'), onConfirm, { kind: 'primary', testid: `order-confirm-${side}` })),
  );
}
