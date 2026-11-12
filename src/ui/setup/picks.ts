// Setup step 3: hero picks in Draft or Mirror order (FR-081). 004: the named heroes as cards with portrait, range and
// Hero Unit type; in Draft a picked hero is disabled (FR-003). The generic heroes are only offered with `?generic` in
// the URL (tests, spec Q-42).
import { t } from '../../i18n/strings.ts';
import { DATA, nextPicker, pickableHeroes, RANGE_TYPES, type RangeType, type SetupChoices, type Side } from '../../rules/index.ts';
import { imageUrl } from '../art.ts';
import { el } from '../dom.ts';
import { movementBadge, rangeBadge } from '../hud/badges.ts';

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

/** 006 FR-022: the hero card clicked once and waiting for the confirming second click. */
export interface PendingPick {
  id: string | null;
  set(id: string | null): void;
}

export function renderPicks(setup: SetupChoices, onPick: (side: Side, choice: PickChoice) => void, pending?: PendingPick): HTMLElement {
  const side = nextPicker(setup)!;
  const free = new Set(pickableHeroes(setup).map((h) => h.id));
  const named = DATA.heroes.filter((h) => h.selectable).map((def) => {
    const taken = !free.has(def.id);
    const portrait = imageUrl(def.portrait);
    const isPending = !taken && pending?.id === def.id;
    return el('button', {
      class: `card hero-card${taken ? ' taken' : ''}${isPending ? ' pending' : ''}`, 'data-testid': `pick-${def.id}`,
      ...(taken ? { disabled: 'true' } : {}), ...(isPending ? { 'data-pending': 'true' } : {}),
      // A first click highlights the card; a second click on the same card picks it (B-12).
      onclick: () => {
        if (taken) return;
        if (!pending || pending.id === def.id) {
          pending?.set(null);
          onPick(side, { heroDefinitionId: def.id });
        } else pending.set(def.id);
      },
    },
      portrait ? el('img', { class: 'hero-portrait', src: portrait, alt: '' }) : el('div', { class: 'hero-portrait' }),
      el('h3', {}, t(`hero.${def.id}.name`)),
      // 006 Q-72 (B-20, B-21): Movement, Range and Health badges and the Hero Unit icon instead of "Short range".
      el('div', { class: 'row badges', 'data-testid': `pick-${def.id}-stats` },
        movementBadge(def.movement, def.movement), rangeBadge(def.range),
        el('span', { class: 'badge stat-badge' }, t('setup.healthBadge', { health: def.maxHealth })),
        el('span', { class: 'hero-unit-icons', title: t('hud.heroUnitIcon', { types: t(`unit.${def.heroUnitType}`) }) },
          (() => {
            const url = imageUrl(`token.ring.${def.heroUnitType}`);
            return url ? el('img', { class: 'hero-unit-icon', src: url, alt: t(`unit.${def.heroUnitType}`) }) : el('span', {}, t(`unit.${def.heroUnitType}`));
          })())),
      isPending ? el('div', { class: 'pick-confirm', 'data-testid': 'pick-confirm-hint' }, t('setup.confirmPick')) : null,
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
