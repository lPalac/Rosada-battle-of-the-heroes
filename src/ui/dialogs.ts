// Modal dialogs: every pendingDecision type (FR-112 context), payment split, amount pickers, confirmations,
// and the position problems list (FR-103).
import { hasString, t } from '../i18n/strings.ts';
import {
  DATA, EPIC_DESTINIES, otherSide, squareName, type Action, type GameState, type Payment, type PositionProblem, type Side,
} from '../rules/index.ts';
import { epicArtStyle, imageUrl } from './art.ts';
import { destinyChoiceModel } from '../game/destiny-model.ts';
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
      // 006 US3 (FR-010, FR-011): the choosing hero by name, side and player, its own three forms by name and portrait,
      // and the choices made so far. A side never holds one Fanatic and one Dominant hero (003 FR-002).
      const m = destinyChoiceModel(s)!;
      const h = s.heroes.find((x) => x.id === m.heroId)!;
      const player = s.setup.players.find((p) => p.id === m.playerId)?.name ?? m.playerId;
      const heroLabel = m.named
        ? `${m.heroName} (${t(`side.${m.side}`)})`
        : `${h.id} · ${t(`side.${h.side}`)} ${t(`range.${h.rangeType}`)}`;
      const twins = m.appliesTo.length > 1
        ? el('div', { class: 'small', 'data-testid': 'destiny-applies' },
            t('dialog.destinyBoth', { heroes: m.appliesTo.map((x) => `${x.heroName} (${t(`side.${x.side}`)})`).join(t('dialog.and')) }))
        : null;
      this.show(
        el('h3', { 'data-testid': 'destiny-hero' }, t('dialog.destiny', { hero: heroLabel })),
        el('div', { class: 'row muted' },
          el('span', { 'data-testid': 'destiny-step' }, t('dialog.destinyStep', { n: m.step, of: m.of })),
          el('span', {}, t('dialog.destinyPlayer', { player }))),
        twins,
        el('div', { class: 'muted' }, t('notice.epicStage')),
        el('div', { class: 'row destiny-cards' }, ...m.cards.map((c) => {
          const art = c.columns
            ? el('div', { class: 'destiny-art', style: epicArtStyle(c.portraitKey, c.destiny) })
            : el('img', { class: 'destiny-art destiny-portrait', src: imageUrl(c.portraitKey) ?? '', alt: c.formName ?? '' });
          return el('button', {
            class: `destiny-card ${c.allowed ? '' : 'disabled'}`, disabled: !c.allowed, 'data-testid': `destiny-${c.destiny}`,
            onclick: () => dispatch({ type: 'decide', decision: { type: 'destiny', destiny: c.destiny } }),
          },
          art,
          c.formName ? el('strong', { 'data-testid': `destiny-${c.destiny}-form` }, c.formName) : null,
          el(c.formName ? 'span' : 'strong', {}, t(`destiny.${c.destiny}`)),
          hasString(`destiny.${c.destiny}.quote`) ? el('div', { class: 'muted small' }, t(`destiny.${c.destiny}.quote`)) : null,
          !c.allowed && c.blockedBy ? el('div', { class: 'small warn' }, t('dialog.destinyTaken', { other: t(`destiny.${c.blockedBy}`) })) : null);
        })),
        m.chosen.length
          ? el('div', { class: 'small', 'data-testid': 'destiny-chosen' },
              t('dialog.destinyChosen', { list: m.chosen.map((x) => `${x.heroName}: ${x.formName ?? t(`destiny.${x.destiny}`)}`).join(', ') }))
          : null);
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

  /**
   * 006 FR-009: a checkmate in the position, before rules come back on. Resolves true for "Continue the game", false for
   * "Back to sandbox" (also Esc). `atOnce`: play restarts at Before Turn (position editor), so the game ends at once.
   */
  checkmateAlert(sides: Side[], atOnce: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (go: boolean) => {
        window.removeEventListener('keydown', onKey, true);
        this.close();
        resolve(go);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        done(false);
      };
      window.addEventListener('keydown', onKey, true);
      const name = (side: Side) => t(`side.${side}`);
      const text = sides.length === 1
        ? t(atOnce ? 'dialog.checkmate.oneAtOnce' : 'dialog.checkmate.one', { side: name(sides[0]), winner: name(otherSide(sides[0])) })
        : t('dialog.checkmate.both');
      this.show(el('div', { class: 'col', 'data-testid': 'checkmate-alert' },
        el('h3', {}, t('dialog.checkmate.title')),
        el('div', {}, text),
        el('div', { class: 'row' },
          button(t('dialog.checkmate.continue'), () => done(true), { kind: 'primary', testid: 'checkmate-continue' }),
          button(t('dialog.checkmate.back'), () => done(false), { testid: 'checkmate-back' }))));
    });
  }

  /**
   * 006 FR-024 (spec A-12): this action would put the player's own King in check. True for "Continue"; false for
   * "Undo" (also Esc): nothing is sent and nothing is paid.
   */
  ownCheckWarning(): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (go: boolean) => {
        window.removeEventListener('keydown', onKey, true);
        this.close();
        resolve(go);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        done(false);
      };
      window.addEventListener('keydown', onKey, true);
      this.show(el('div', { class: 'col', 'data-testid': 'own-check-warning' },
        el('h3', {}, t('dialog.ownCheck.title')),
        el('div', {}, t('dialog.ownCheck.text')),
        el('div', { class: 'row' },
          button(t('dialog.ownCheck.continue'), () => done(true), { kind: 'primary', testid: 'own-check-continue' }),
          button(t('dialog.ownCheck.undo'), () => done(false), { testid: 'own-check-undo' }))));
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
