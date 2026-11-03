// Sandbox value editors: health, pools, Common Pools, Revenge, Peace/War; free roll (FR-101).
import { t } from '../../i18n/strings.ts';
import type { Action, GameState } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export function renderSandboxEditors(
  s: GameState,
  dispatch: (a: Action) => void,
  onFreeRoll: () => void,
  onResume: () => void,
  onExportFixture: () => void,
): HTMLElement {
  const num = (value: number, testid: string, set: (v: number) => void) =>
    el('input', { type: 'number', value, 'data-testid': testid, onchange: (e) => set(Number((e.target as HTMLInputElement).value)) });
  return el('div', { class: 'panel col editor sandbox-editors', 'data-testid': 'sandbox-editors' },
    el('div', { class: 'row' },
      button(t('settings.sandboxOff'), onResume, { kind: 'primary', testid: 'resume-rules' }),
      button(t('sandbox.freeRoll'), onFreeRoll, { testid: 'free-roll' }),
    ),
    ...s.heroes.map((h) =>
      el('div', { class: 'row' },
        el('strong', { class: h.side }, h.id),
        el('span', { class: 'muted' }, t('sandbox.health')),
        num(h.health, `edit-health-${h.id}`, (v) => dispatch({ type: 'sandboxSet', path: 'health', target: h.id, value: v })),
        el('span', { class: 'muted' }, t('sandbox.pool')),
        num(h.pool, `edit-pool-${h.id}`, (v) => dispatch({ type: 'sandboxSet', path: 'pool', target: h.id, value: v })),
      )),
    ...(['light', 'dark'] as const).map((side) =>
      el('div', { class: 'row' },
        el('strong', { class: side }, t(`side.${side}`)),
        el('span', { class: 'muted' }, t('sandbox.common')),
        num(s.destiny.common[side], `edit-common-${side}`, (v) => dispatch({ type: 'sandboxSet', path: 'common', target: side, value: v })),
        el('span', { class: 'muted' }, t('sandbox.revenge')),
        num(s.tokens.revenge[side], `edit-revenge-${side}`, (v) => dispatch({ type: 'sandboxSet', path: 'revenge', target: side, value: v })),
      )),
    el('div', { class: 'row' },
      el('span', { class: 'muted' }, t('sandbox.peace')),
      button(s.tokens.peaceTreaty === 'peace' ? t('hud.peace') : t('hud.war'),
        () => dispatch({ type: 'sandboxSet', path: 'peaceTreaty', value: s.tokens.peaceTreaty === 'peace' ? 'war' : 'peace' }), { testid: 'edit-peace' }),
    ),
    button(t('sandbox.exportFixture'), onExportFixture, { testid: 'export-fixture' }),
  );
}
