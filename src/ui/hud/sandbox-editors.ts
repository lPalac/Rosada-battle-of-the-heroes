// Sandbox value editors: health, pools, Common Pools, Revenge, Peace/War; free roll (FR-101).
import { t } from '../../i18n/strings.ts';
import { EPIC_DESTINIES, FAVORS, type Action, type GameState } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export function renderSandboxEditors(
  s: GameState,
  dispatch: (a: Action) => void,
  onFreeRoll: () => void,
  onResume: () => void,
  onExportFixture: () => void,
  history: { canUndo: boolean; undo: () => void } = { canUndo: false, undo: () => {} },
): HTMLElement {
  const num = (value: number, testid: string, set: (v: number) => void) =>
    el('input', { type: 'number', value, 'data-testid': testid, onchange: (e) => set(Number((e.target as HTMLInputElement).value)) });
  return el('div', { class: 'panel col editor sandbox-editors', 'data-testid': 'sandbox-editors' },
    el('div', { class: 'row' },
      button(t('settings.sandboxOff'), onResume, { kind: 'primary', testid: 'resume-rules' }),
      button(t('sandbox.freeRoll'), onFreeRoll, { testid: 'free-roll' }),
      button(t('action.undoSandbox'), history.undo, { testid: 'sandbox-undo', disabled: !history.canUndo }),
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
    el('div', { class: 'row' },
      el('span', { class: 'muted' }, t('sandbox.stage')),
      button(t(`sandbox.stage.${s.stage}`), () => dispatch({ type: 'sandboxSet', path: 'stage', value: s.stage === 'epic' ? 'starting' : 'epic' }), { testid: 'edit-stage' }),
    ),
    s.stage === 'epic'
      ? el('div', { class: 'row' }, ...s.heroes.map((h) =>
          el('select', {
            'data-testid': `edit-destiny-${h.id}`,
            onchange: (e) => dispatch({ type: 'sandboxSet', path: 'destiny', target: h.id, value: (e.target as HTMLSelectElement).value }),
          }, ...EPIC_DESTINIES.map((d) => el('option', { value: d, selected: h.epic?.destiny === d }, `${h.id} ${t(`destiny.${d}`)}`)))))
      : null,
    ...(['light', 'dark'] as const).map((side) =>
      el('div', { class: 'row' },
        el('strong', { class: side }, t('tracker.title')),
        el('select', {
          'data-testid': `edit-favor-${side}`,
          onchange: (e) => {
            const id = (e.target as HTMLSelectElement).value;
            if (!id) return;
            const done = s.royalFavors[side].status[id as keyof typeof s.royalFavors.light.status].done;
            dispatch({ type: 'sandboxSet', path: 'favor', target: `${side}:${id}`, value: id === 'tidesOfDestiny' ? Math.min(5, s.royalFavors[side].tides + 1) : done ? 'open' : 'done' });
          },
        }, el('option', { value: '' }, `${t(`side.${side}`)}: ${s.royalFavors[side].track.length}`),
        ...FAVORS.favors.map((f) => el('option', { value: f.id }, `${s.royalFavors[side].status[f.id].done ? '✓' : '○'} ${t(`favor.${f.id}.name`)}`))),
        el('span', { class: 'muted' }, t('action.kingsForces')),
        num(s.royalFavors[side].kingsForces, `edit-kings-forces-${side}`, (v) => dispatch({ type: 'sandboxSet', path: 'kingsForces', target: side, value: v })),
      )),
    button(t('sandbox.exportFixture'), onExportFixture, { testid: 'export-fixture' }),
  );
}
