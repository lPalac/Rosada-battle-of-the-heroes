// Setup step 3: hero picks in Draft or Mirror order. A generic pick is a range type (FR-081).
import { t } from '../../i18n/strings.ts';
import { DATA, nextPicker, RANGE_TYPES, type RangeType, type SetupChoices, type Side } from '../../rules/index.ts';
import { el } from '../dom.ts';

export function heroStats(rangeType: RangeType): string {
  const def = DATA.heroes.find((h) => h.rangeType === rangeType)!;
  return t('setup.heroStats', { movement: def.movement, range: def.range, health: def.maxHealth });
}

export function renderPicks(setup: SetupChoices, onPick: (side: Side, rangeType: RangeType) => void): HTMLElement {
  const side = nextPicker(setup)!;
  return el('div', { class: 'col' },
    el('h3', { class: side }, t(setup.mode === 'mirror' ? 'setup.pickMirror' : 'setup.pick', { side: t(`side.${side}`) })),
    el('div', { class: 'choice' },
      ...RANGE_TYPES.map((r) =>
        el('button', { class: 'card', 'data-testid': `pick-${r}`, onclick: () => onPick(side, r) },
          el('h3', {}, t(`range.${r}`)),
          el('div', { class: 'muted' }, heroStats(r)),
        )),
    ),
    el('ol', { class: 'muted' },
      ...setup.picks.map((p) => el('li', {}, `${t(`side.${p.side}`)}: ${t(`range.${p.rangeType}`)}`)),
    ),
  );
}
