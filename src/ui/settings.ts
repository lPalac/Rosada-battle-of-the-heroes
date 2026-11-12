// Settings: sandbox toggle (with confirmation, FR-100), save, export/import a game file (FR-200, FR-201), new game.
// 006 FR-038: Offer draw lives here (hot-seat and online), and the last button is "Resume game".
import { t } from '../i18n/strings.ts';
import { button, el } from './dom.ts';

export interface SettingsHandlers {
  sandboxOn(): void;
  sandboxOff(): void;
  save(): void;
  exportFile(): void;
  importFile(file: File): void;
  newGame(): void;
  /** Offer a draw to the other side; Settings closes. */
  offerDraw(): void;
  /** Whether a draw may be offered now (`HudModel.can.offerDraw`). */
  canOfferDraw: boolean;
  /** Close Settings and go back to the game. */
  close(): void;
  /** 005: an online game: no sandbox, no local save or import; "new game" leaves the room. */
  online?: boolean;
}

export function renderSettings(inSandbox: boolean, h: SettingsHandlers): HTMLElement {
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', style: 'display:none', 'data-testid': 'import-file',
    onchange: (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) h.importFile(f);
    },
  });
  const offerDraw = button(t('settings.offerDraw'), h.offerDraw, { testid: 'offer-draw', disabled: !h.canOfferDraw });
  const resume = button(t('settings.resume'), h.close, { kind: 'primary', testid: 'settings-resume' });
  if (h.online) {
    return el('div', { class: 'panel dialog col', 'data-testid': 'settings' },
      el('h3', {}, t('settings.title')),
      offerDraw,
      button(t('online.download'), h.exportFile, { testid: 'settings-export' }),
      button(t('online.leave'), h.newGame, { testid: 'settings-new' }),
      resume,
    );
  }
  return el('div', { class: 'panel dialog col', 'data-testid': 'settings' },
    el('h3', {}, t('settings.title')),
    inSandbox
      ? button(t('settings.sandboxOff'), h.sandboxOff, { kind: 'primary', testid: 'settings-sandbox-off' })
      : button(t('settings.sandboxOn'), h.sandboxOn, { kind: 'danger', testid: 'settings-sandbox-on' }),
    offerDraw,
    button(t('settings.save'), h.save, { testid: 'settings-save' }),
    button(t('settings.export'), h.exportFile, { testid: 'settings-export' }),
    button(t('settings.import'), () => fileInput.click(), { testid: 'settings-import' }),
    fileInput,
    button(t('settings.newGame'), h.newGame, { testid: 'settings-new' }),
    resume,
  );
}
