// Destiny Well (∞ after depletion), Common Pools, Peace/War and Revenge (FR-072, research R-09).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { el } from '../dom.ts';

export function renderPools(m: HudModel): HTMLElement {
  const line = (label: string, value: string | number, cls = '', testid?: string) =>
    el('div', { class: 'line' }, el('span', { class: cls }, label), el('strong', { 'data-testid': testid }, String(value)));
  return el('div', { class: 'panel pools', 'data-testid': 'pools' },
    line(t('hud.well'), m.well.depleted ? t('hud.wellInfinite') : m.well.remaining, '', 'well'),
    line(t('hud.common', { side: t('side.light') }), m.common.light, 'light', 'common-light'),
    line(t('hud.common', { side: t('side.dark') }), m.common.dark, 'dark', 'common-dark'),
    el('div', { class: 'line' },
      el('span', {}, t('hud.peace')),
      el('strong', { class: `token ${m.peaceTreaty}`, 'data-testid': 'peace-treaty' }, m.peaceTreaty === 'peace' ? t('hud.peace') : t('hud.war'))),
    el('div', { class: 'muted' },
      t('hud.revenge', { side: t('side.light'), n: m.revenge.light }), ' · ', t('hud.revenge', { side: t('side.dark'), n: m.revenge.dark })),
  );
}
