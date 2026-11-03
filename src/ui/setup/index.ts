// Setup wizard: players → mode → picks → turn order and start squares per side → summary (US1).
import { t } from '../../i18n/strings.ts';
import { createSetup, picksComplete, sidePicks, type Action, type GameState, type Side } from '../../rules/index.ts';
import { el, mount } from '../dom.ts';
import { renderMode } from './mode.ts';
import { renderOrder, type OrderChoice } from './order.ts';
import { playersOf, renderPlayers, type PlayersDraft } from './players.ts';
import { renderPicks } from './picks.ts';
import { renderSummary } from './summary.ts';

export interface SetupHost {
  /** Start a new setup state (after players and mode are known). */
  begin(state: GameState): void;
  dispatch(action: Action): boolean;
  state(): GameState | null;
  /** Extra buttons on the first screen (resume, import). */
  startExtras(): HTMLElement[];
}

export class SetupWizard {
  private step: 'players' | 'mode' | 'game' = 'players';
  private draft: PlayersDraft = { count: 4, singleSide: 'light', names: [] };
  private orders: Partial<Record<Side, OrderChoice>> = {};
  private orderDone: Record<Side, boolean> = { light: false, dark: false };

  constructor(private root: HTMLElement, private host: SetupHost) {}

  reset(): void {
    this.step = 'players';
    this.orders = {};
    this.orderDone = { light: false, dark: false };
  }

  private stepLabels(active: number): HTMLElement {
    const labels = [t('setup.players'), t('setup.mode'), t('setup.pick', { side: '' }).trim(), t('setup.order'), t('setup.summary')];
    return el('div', { class: 'steps' }, ...labels.map((l, i) => el('span', { class: i === active ? 'on' : '' }, l)));
  }

  render(): void {
    const state = this.host.state();
    let body: HTMLElement;
    let index = 0;
    if (this.step === 'players') {
      body = renderPlayers(this.draft, () => this.render(), () => { this.step = 'mode'; this.render(); }, this.host.startExtras());
    } else if (this.step === 'mode') {
      index = 1;
      body = renderMode((mode) => {
        this.host.begin(createSetup({ mode, playerCount: this.draft.count, players: playersOf(this.draft) }));
        this.step = 'game';
        this.render();
      });
    } else if (state && !picksComplete(state.setup)) {
      index = 2;
      body = renderPicks(state.setup, (side, rangeType) => {
        this.host.dispatch({ type: 'pickHero', side, rangeType });
        this.render();
      });
    } else if (state && (!this.orderDone.light || !this.orderDone.dark)) {
      index = 3;
      const side: Side = this.orderDone.light ? 'dark' : 'light';
      const picks = sidePicks(state.setup, side);
      // Suggestion: the side's first pick plays first and starts behind the c-file Bishop.
      const choice = (this.orders[side] ??= { first: picks[0].pickIndex, cFile: picks[0].pickIndex });
      body = renderOrder(state.setup, side, choice, () => this.render(), () => {
        this.host.dispatch({ type: 'setTurnOrder', side, first: choice.first });
        this.host.dispatch({ type: 'setStartFile', pickIndex: choice.cFile, file: 'c' });
        this.orderDone[side] = true;
        this.render();
      });
    } else if (state) {
      index = 4;
      body = renderSummary(state.setup, () => this.host.dispatch({ type: 'startGame' }), () => {
        this.orderDone = { light: false, dark: false };
        this.render();
      });
    } else {
      this.step = 'players';
      return this.render();
    }
    mount(this.root, el('div', { class: 'panel setup', 'data-testid': 'setup' }, el('h2', {}, t('app.title')), this.stepLabels(index), body));
  }
}
