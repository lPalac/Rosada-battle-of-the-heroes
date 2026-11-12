// Royal Favor tracker modal: both sides, every Royal Favor with status and requirement, the track, Powers and
// what the next Power needs (US3-AS14, research R-10). Built from favorModel, like the track on the table.
import { favorModel, type SharedTrack, type SideFavors } from '../game/favor-model.ts';
import { t } from '../i18n/strings.ts';
import type { GameState } from '../rules/index.ts';
import { button, el } from './dom.ts';

function statusText(f: SideFavors['favors'][number]): string {
  if (f.status === 'done') return `✓ ${t('tracker.done')}`;
  if (f.status === 'half') return f.kind === 'half' ? `½ ${t('tracker.half', { n: f.progress, target: f.target })}` : t('tracker.count', { n: f.progress, target: f.target });
  return t('tracker.open');
}

function sideColumn(m: SideFavors): HTMLElement {
  return el('div', { class: `tracker-side col ${m.side}`, 'data-testid': `tracker-${m.side}` },
    el('h3', { class: m.side }, t(`side.${m.side}`)),
    el('div', { class: 'muted', 'data-testid': `tracker-${m.side}-count` }, t('tracker.track', { n: m.track.length })),
    el('ul', { class: 'tracker-list' },
      ...m.favors.map((f) => el('li', { class: `favor ${f.status}`, 'data-testid': `favor-${m.side}-${f.id}`, 'data-status': f.status },
        el('div', { class: 'row favor-head' }, el('strong', {}, `${f.order}. ${t(f.nameKey)}`), el('span', { class: 'status' }, statusText(f))),
        el('div', { class: 'muted small' }, t(f.requirementKey))))),
    el('h4', {}, t('tracker.powers')),
    el('ul', { class: 'tracker-powers' },
      ...m.powers.map((p) => el('li', { class: p.unlocked ? 'unlocked' : 'locked', 'data-testid': `power-${m.side}-${p.id}` },
        el('strong', {}, `${p.threshold} · ${t(p.nameKey)} ${p.unlocked ? '✓' : ''}`),
        el('div', { class: 'muted small' }, t(p.textKey))))),
    el('div', { class: 'tracker-next', 'data-testid': `tracker-${m.side}-next` },
      m.next ? t('tracker.next', { n: m.next.needed, power: t(m.next.nameKey) }) : t('tracker.allPowers')),
  );
}

/** 006 FR-041: the same shared track as on the table: slots 1…11, both markers, the Power names at 6…11. */
function sharedRow(m: SharedTrack): HTMLElement {
  return el('div', { class: 'tracker-shared-wrap col' },
    el('strong', {}, t('track.shared')),
    el('div', { class: 'tracker-shared', 'data-testid': 'tracker-shared', 'data-light': String(m.light), 'data-dark': String(m.dark) },
      ...Array.from({ length: m.slots }, (_, i) => {
        const power = m.powers.find((p) => p.threshold === i + 1);
        return el('div', { class: `slot${power ? ' power' : ''}`, title: power ? t(power.nameKey) : '' },
          el('span', { class: 'n' }, String(i + 1)),
          el('span', { class: 'markers' },
            m.light === i + 1 ? el('span', { class: 'marker light', 'data-testid': 'shared-marker-light' }) : null,
            m.dark === i + 1 ? el('span', { class: 'marker dark', 'data-testid': 'shared-marker-dark' }) : null),
          power ? el('span', { class: 'power-name' }, t(power.nameKey)) : null);
      })));
}

export function renderTracker(s: GameState, close: () => void): HTMLElement {
  const m = favorModel(s);
  return el('div', { class: 'panel dialog tracker col', 'data-testid': 'tracker' },
    el('div', { class: 'row' }, el('h2', {}, t('tracker.title')), button(t('tracker.close'), close, { testid: 'tracker-close' })),
    sharedRow(m.shared),
    el('div', { class: 'tracker-cols' }, sideColumn(m.light), sideColumn(m.dark)),
  );
}
