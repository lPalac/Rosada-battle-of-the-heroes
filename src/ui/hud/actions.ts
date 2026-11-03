// Action buttons: End phase, Undo, Offer draw, Inspired Lead, Hero Retreat (FR-073, FR-012).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { button, el } from '../dom.ts';

export interface ActionHandlers {
  endPhase(): void;
  undo(): void;
  offerDraw(): void;
  inspiredLead(): void;
  heroRetreat(): void;
}

export function renderActions(m: HudModel, canUndo: boolean, busy: boolean, h: ActionHandlers): HTMLElement {
  return el('div', { class: 'row panel', 'data-testid': 'actions' },
    button(t('action.endPhase'), h.endPhase, { kind: 'primary', testid: 'end-phase', disabled: busy || !m.can.endPhase }),
    button(t('action.undo'), h.undo, { testid: 'undo', disabled: busy || !canUndo }),
    m.can.inspiredLeadMax > 0 ? button(t('action.inspiredLead'), h.inspiredLead, { testid: 'inspired-lead', disabled: busy }) : null,
    m.can.heroRetreat ? button(t('action.heroRetreat'), h.heroRetreat, { testid: 'hero-retreat', disabled: busy }) : null,
    button(t('action.offerDraw'), h.offerDraw, { testid: 'offer-draw', disabled: busy || !m.can.offerDraw }),
  );
}

export function renderHelp(text: string | null): HTMLElement | null {
  return text ? el('div', { class: 'help panel', 'data-testid': 'help' }, text) : null;
}
