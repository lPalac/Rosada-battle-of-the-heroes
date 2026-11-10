// Setup step 3: hero picks in Draft or Mirror order (FR-081). 004: the named heroes as cards with portrait, range and
// Hero Unit type; in Draft a picked hero is disabled (FR-003). The generic heroes are only offered with `?generic` in
// the URL (tests, spec Q-42).
import { t } from '../../i18n/strings.ts';
import { DATA, nextPicker, pickableHeroes, RANGE_TYPES, type RangeType, type SetupChoices, type Side } from '../../rules/index.ts';
import { imageUrl } from '../art.ts';
import { el } from '../dom.ts';

export function heroStats(rangeType: RangeType): string {
  const def = DATA.heroes.find((h) => h.rangeType === rangeType)!;
  return t('setup.heroStats', { movement: def.movement, range: def.range, health: def.maxHealth });
}

export interface PickChoice {
  rangeType?: RangeType;
  heroDefinitionId?: string;
}

const genericAllowed = (): boolean => typeof location !== 'undefined' && new URLSearchParams(location.search).has('generic');

function pickLabel(p: SetupChoices['picks'][number]): string {
  return p.heroDefinitionId ? t(`hero.${p.heroDefinitionId}.name`) : t(`range.${p.rangeType}`);
}

export function renderPicks(setup: SetupChoices, onPick: (side: Side, choice: PickChoice) => void): HTMLElement {
  const side = nextPicker(setup)!;
  const free = new Set(pickableHeroes(setup).map((h) => h.id));
  const named = DATA.heroes.filter((h) => h.selectable).map((def) => {
    const taken = !free.has(def.id);
    const portrait = imageUrl(def.portrait);
    return el('button', {
      class: `card hero-card${taken ? ' taken' : ''}`, 'data-testid': `pick-${def.id}`, ...(taken ? { disabled: 'true' } : {}),
      onclick: () => !taken && onPick(side, { heroDefinitionId: def.id }),
    },
      portrait ? el('img', { class: 'hero-portrait', src: portrait, alt: '' }) : el('div', { class: 'hero-portrait' }),
      el('h3', {}, t(`hero.${def.id}.name`)),
      el('div', { class: 'muted' }, `${t(`range.${def.rangeType}`)} · ${t('setup.heroUnitType')}: ${t(`unit.${def.heroUnitType}`)}`),
      el('div', { class: 'muted' }, t('setup.heroStats', { movement: def.movement, range: def.range, health: def.maxHealth })),
    );
  });
  const generic = genericAllowed()
    ? RANGE_TYPES.map((r) =>
        el('button', { class: 'card', 'data-testid': `pick-${r}`, onclick: () => onPick(side, { rangeType: r }) },
          el('h3', {}, t(`range.${r}`)),
          el('div', { class: 'muted' }, heroStats(r)),
        ))
    : [];
  return el('div', { class: 'col' },
    el('h3', { class: side }, t(setup.mode === 'mirror' ? 'setup.pickMirror' : 'setup.pick', { side: t(`side.${side}`) })),
    el('div', { class: 'choice hero-choice' }, ...named, ...generic),
    el('ol', { class: 'muted' }, ...setup.picks.map((p) => el('li', {}, `${t(`side.${p.side}`)}: ${pickLabel(p)}`))),
  );
}
