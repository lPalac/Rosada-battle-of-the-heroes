// Modal dialogs: every pendingDecision type (FR-112 context), payment split, amount pickers, confirmations,
// and the position problems list (FR-103).
import { t } from '../i18n/strings.ts';
import {
  DATA, EPIC_DESTINIES, squareName, type Action, type GameState, type Payment, type PositionProblem,
} from '../rules/index.ts';
import { epicArtStyle, heroArtKeys } from './art.ts';
import { button, el, mount } from './dom.ts';

export class Dialogs {
  constructor(private root: HTMLElement) {}

  close(): void {
    this.root.replaceChildren();
  }

  get open(): boolean {
    return this.root.childElementCount > 0;
  }

  private show(...children: (HTMLElement | string | null)[]): void {
    mount(this.root, el('div', { class: 'panel dialog col', 'data-testid': 'dialog' }, ...children));
  }

  /** Decisions that need buttons. Square choices (advance, tavern) are made on the table; the dialog only explains. */
  decision(s: GameState, dispatch: (a: Action) => void): boolean {
    const d = s.pendingDecision;
    if (!d) return false;
    if (d.type === 'promotion') {
      this.show(el('h3', {}, t('dialog.promotion')),
        el('div', { class: 'row' }, ...DATA.units.promotion.map((to) =>
          button(t(`unit.${to}`), () => dispatch({ type: 'decide', decision: { type: 'promotion', to } }), { testid: `promote-${to}` }))));
      return true;
    }
    if (d.type === 'drawOffer') {
      this.show(el('h3', {}, t('dialog.drawOffer', { side: t(`side.${d.fromSide}`) })),
        el('div', { class: 'row' },
          button(t('dialog.accept'), () => dispatch({ type: 'answerDraw', accept: true }), { kind: 'primary', testid: 'draw-accept' }),
          button(t('dialog.decline'), () => dispatch({ type: 'answerDraw', accept: false }), { testid: 'draw-decline' })));
      return true;
    }
    if (d.type === 'epicDestiny') {
      // Three Epic forms; a side never holds one Fanatic and one Dominant hero (003 FR-002).
      const h = s.heroes.find((x) => x.id === d.heroId)!;
      const art = heroArtKeys(h).epic;
      const other = s.heroes.find((x) => x.side === h.side && x.id !== h.id)?.epic?.destiny;
      this.show(el('h3', {}, t('dialog.destiny', { hero: `${h.id} · ${t(`side.${h.side}`)} ${t(`range.${h.rangeType}`)}` })),
        el('div', { class: 'muted' }, t('notice.epicStage')),
        el('div', { class: 'row destiny-cards' }, ...EPIC_DESTINIES.map((destiny) => {
          const allowed = d.options.includes(destiny);
          return el('button', {
            class: `destiny-card ${allowed ? '' : 'disabled'}`, disabled: !allowed, 'data-testid': `destiny-${destiny}`,
            onclick: () => dispatch({ type: 'decide', decision: { type: 'destiny', destiny } }),
          },
          el('div', { class: 'destiny-art', style: epicArtStyle(art, destiny) }),
          el('strong', {}, t(`destiny.${destiny}`)),
          el('div', { class: 'muted small' }, t(`destiny.${destiny}.quote`)),
          !allowed && other ? el('div', { class: 'small warn' }, t('dialog.destinyTaken', { other: t(`destiny.${other}`) })) : null);
        })));
      return true;
    }
    if (d.type === 'reaction') {
      // 004: a "During Enemy Lead" reaction of the defending hero (research R-03).
      this.show(el('h3', {}, t('dialog.reaction', { hero: d.heroId, ability: t(`ability.${d.abilityId}.name`), cost: d.cost })),
        el('div', { class: 'muted small' }, t(`ability.${d.abilityId}.text`)),
        el('div', { class: 'row' },
          ...d.options.map((targets, i) => button(t('dialog.reactionUse', { n: i + 1 }), () => dispatch({ type: 'decide', decision: { type: 'reaction', use: true, targets } }), { kind: 'primary', testid: `reaction-use-${i}` })),
          button(t('dialog.decline'), () => dispatch({ type: 'decide', decision: { type: 'reaction', use: false } }), { testid: 'reaction-decline' })));
      return true;
    }
    if (d.type === 'abilityChoice') {
      this.show(el('h3', {}, t(`ability.${d.abilityId}.name`)),
        el('div', { class: 'col choice-list' }, ...d.choices.slice(0, 64).map((choice) =>
          button(choice, () => dispatch({ type: 'decide', decision: { type: 'abilityChoice', choice } }), { testid: `choice-${choice}` }))));
      return true;
    }
    if (d.type === 'unconsciousTavern') {
      this.show(el('h3', {}, t('dialog.unconscious', { hero: d.heroId })),
        el('div', { class: 'row' }, ...d.options.map((to) =>
          button(squareName(to), () => dispatch({ type: 'decide', decision: { type: 'square', to } }), { testid: `tavern-${squareName(to)}` }))));
      return true;
    }
    return false;
  }

  /** Let the player split a cost between the hero pool and the Common Pool when more than one split works. */
  pay(cost: number, heroPool: number, common: number): Promise<Payment | null> {
    const splits: Payment[] = [];
    for (let hero = Math.max(0, cost - common); hero <= Math.min(heroPool, cost); hero++) splits.push({ hero, common: cost - hero });
    if (splits.length <= 1) return Promise.resolve(splits[0] ?? null);
    return new Promise((resolve) => {
      this.show(el('h3', {}, t('dialog.pay', { cost })),
        el('div', { class: 'col' }, ...splits.map((p) =>
          button(t('dialog.payOption', { hero: p.hero, common: p.common }), () => { this.close(); resolve(p); }, { testid: `pay-${p.hero}-${p.common}` }))),
        button(t('action.cancel'), () => { this.close(); resolve(null); }));
    });
  }

  amount(title: string, max: number, label: (n: number) => string): Promise<number | null> {
    return new Promise((resolve) => {
      this.show(el('h3', {}, title),
        el('div', { class: 'row' }, ...Array.from({ length: max }, (_, i) => i + 1).map((n) =>
          button(label(n), () => { this.close(); resolve(n); }, { testid: `amount-${n}` }))),
        button(t('action.cancel'), () => { this.close(); resolve(null); }));
    });
  }

  /** Pick one of several labelled options (ability targets). */
  choose<T>(title: string, options: { label: string; value: T }[]): Promise<T | null> {
    return new Promise((resolve) => {
      this.show(el('h3', {}, title),
        el('div', { class: 'col choice-list' }, ...options.map((o, i) =>
          button(o.label, () => { this.close(); resolve(o.value); }, { testid: `target-${i}` }))),
        button(t('action.cancel'), () => { this.close(); resolve(null); }, { testid: 'target-cancel' }));
    });
  }

  confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.show(el('div', {}, text),
        el('div', { class: 'row' },
          button(t('action.confirm'), () => { this.close(); resolve(true); }, { kind: 'primary', testid: 'confirm-yes' }),
          button(t('action.cancel'), () => { this.close(); resolve(false); }, { testid: 'confirm-no' })));
    });
  }

  problems(list: PositionProblem[]): void {
    this.show(el('h3', {}, t('dialog.problems')), el('div', { class: 'muted' }, t('dialog.problemsHelp')),
      el('ul', { class: 'problems', 'data-testid': 'problems' }, ...list.map((p) => el('li', {}, p.message))),
      button(t('action.close'), () => this.close(), { testid: 'problems-close' }));
  }

  custom(...children: (HTMLElement | string | null)[]): void {
    this.show(...children);
  }
}
