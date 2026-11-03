// Tavern shop, shown only while the shop is open (FR-060).
import type { HudModel } from '../../game/hud-model.ts';
import { t } from '../../i18n/strings.ts';
import { button, el } from '../dom.ts';

export function renderTavern(m: HudModel, onBuy: (item: 'drink' | 'meal') => void): HTMLElement | null {
  if (!m.shopOpen) return null;
  return el('div', { class: 'row panel', 'data-testid': 'tavern' },
    el('strong', {}, '🍺'),
    button(t('action.drink'), () => onBuy('drink'), { testid: 'buy-drink', disabled: !m.can.buyDrink }),
    button(t('action.meal'), () => onBuy('meal'), { testid: 'buy-meal', disabled: !m.can.buyMeal }),
  );
}
