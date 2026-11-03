// Wires game ↔ table ↔ physics ↔ ui: input → `apply` → table sync + animations + HUD (T058, T073).
import { GameSession } from './game/session.ts';
import { highlights, hudModel } from './game/hud-model.ts';
import { toFixture } from './game/fixture.ts';
import { t } from './i18n/strings.ts';
import { throwDie } from './physics/roll.ts';
import { createDiceWorld, type DiceWorld } from './physics/world.ts';
import {
  createGame, createSetup, RULES, parseSquare, squareName, taverns,
  type Action, type Coord, type GameEvent, type GameState, type Payment, type RuleError,
} from './rules/index.ts';
import { createBoard } from './table/board.ts';
import { createCamera } from './table/camera.ts';
import { DiceView } from './table/dice.ts';
import { HighlightView } from './table/highlights.ts';
import { Picker, type Pick } from './table/picking.ts';
import { PiecesView } from './table/pieces.ts';
import { createScene } from './table/scene.ts';
import { Dialogs } from './ui/dialogs.ts';
import { button, el, mount } from './ui/dom.ts';
import { renderActions, renderHelp } from './ui/hud/actions.ts';
import { renderHeroes } from './ui/hud/heroes.ts';
import { Toasts } from './ui/hud/notice.ts';
import { renderPhaseBar } from './ui/hud/phase-bar.ts';
import { renderPools } from './ui/hud/pools.ts';
import { renderLeadPanel } from './ui/hud/roll.ts';
import { errorText, renderRulePanel } from './ui/hud/rule-panel.ts';
import { renderSandboxBadge } from './ui/hud/sandbox-badge.ts';
import { renderSandboxEditors } from './ui/hud/sandbox-editors.ts';
import { renderTavern } from './ui/hud/tavern.ts';
import { renderLog } from './ui/log.ts';
import { renderResult } from './ui/result.ts';
import { renderSettings } from './ui/settings.ts';
import { SetupWizard } from './ui/setup/index.ts';
import { clearLocal, downloadText, exportFile, loadLocal, readSaveFile, saveLocal } from './ui/storage.ts';

const canvas = document.getElementById('table') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const dialogRoot = el('div', { id: 'dialogs' });
document.body.append(dialogRoot);

// --- table ---
const ts = createScene(canvas);
const camera = createCamera(ts, canvas);
const boardView = createBoard();
const pieces = new PiecesView(ts);
const hl = new HighlightView();
const dice = new DiceView(ts);
ts.scene.add(boardView.group, pieces.group, hl.group, dice.group);
const picker = new Picker(ts.camera, canvas, () => [pieces.group, boardView.group]);

// --- ui ---
const toasts = new Toasts();
const dialogs = new Dialogs(dialogRoot);
let session: GameSession | null = null;
let selected: string | null = null;
let targeting: { kind: 'retreat'; options: Coord[] } | null = null;
let held: Pick | null = null;
let rolling = false;
let settingsOpen = false;
let modal = false;
let lastError: RuleError | null = null;
let forcedRoll: number | null = null;
let diceWorld: DiceWorld | null = null;
let unsubscribe: (() => void) | null = null;

const state = (): GameState | null => session?.state ?? null;
const isE2E = import.meta.env.MODE === 'e2e';

function showError(e: RuleError): void {
  lastError = e;
  if (e.code === 'POSITION_INVALID' && e.problems) dialogs.problems(e.problems);
  else toasts.show(errorText(e), { error: true, rule: e.rule });
  render();
}

function dispatch(action: Action): boolean {
  if (!session) return false;
  const r = session.dispatch(action);
  if (!r.ok) {
    showError(r.error);
    return false;
  }
  lastError = null;
  return true;
}

function onChange(s: GameState, events: GameEvent[]): void {
  if (events.some((e) => e.type === 'wellDepleted')) toasts.wellDepleted();
  if (events.some((e) => e.type === 'phaseChanged' || e.type === 'unitLed' || e.type === 'leadAnnounced')) selected = null;
  if (s.status === 'playing') {
    const active = s.heroes.find((h) => h.id === s.activeHeroId);
    if (active) camera.setSide(active.side);
  }
  if (session && s.status !== 'setup') saveLocal(session.initial, session.actions);
  if (s.status !== 'setup') pieces.sync(s, events);
  render();
}

function startSession(initial: GameState, actions: Action[] = []): void {
  unsubscribe?.();
  session = new GameSession(initial);
  if (actions.length) session.reset(initial, actions);
  unsubscribe = session.onChange(onChange);
  selected = null;
  targeting = null;
  held = null;
  if (session.state.status !== 'setup') pieces.sync(session.state, [], false);
  render();
}

// --- setup ---
const wizard = new SetupWizard(overlay, {
  begin: (s) => startSession(s),
  dispatch,
  state,
  startExtras: () => {
    const saved = loadLocal();
    return [
      saved ? button(t('setup.resume'), () => startSession(saved.initial, saved.actions), { testid: 'resume-saved' }) : null,
      button(t('settings.import'), () => importInput.click(), { testid: 'setup-import' }),
      button(t('setup.positionEditor'), openPositionEditor, { testid: 'position-editor' }),
    ].filter(Boolean) as HTMLElement[];
  },
});

const importInput = el('input', {
  type: 'file', accept: '.json,application/json', style: 'display:none',
  onchange: async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const save = await readSaveFile(f);
      settingsOpen = false;
      startSession(save.initial, save.actions);
    } catch (err) {
      toasts.show(String((err as Error).message), { error: true });
    }
  },
});
document.body.append(importInput);

/** Board-position editor (FR-204): a fresh game straight into sandbox. */
function openPositionEditor(): void {
  let s = createSetup({ mode: 'draft', playerCount: 2 });
  const steps: Action[] = [
    { type: 'pickHero', side: 'light', rangeType: 'short' }, { type: 'pickHero', side: 'dark', rangeType: 'short' },
    { type: 'pickHero', side: 'dark', rangeType: 'long' }, { type: 'pickHero', side: 'light', rangeType: 'long' },
    { type: 'setTurnOrder', side: 'light', first: 0 }, { type: 'setTurnOrder', side: 'dark', first: 1 },
    { type: 'setStartFile', pickIndex: 0, file: 'c' }, { type: 'setStartFile', pickIndex: 1, file: 'c' },
  ];
  startSession(s);
  for (const a of steps) dispatch(a);
  s = state()!;
  startSession(createGame(s.setup));
  dispatch({ type: 'setEnforcement', mode: 'sandbox' });
}

// --- player actions ---
function activeHero(s: GameState) {
  return s.heroes.find((h) => h.id === s.activeHeroId)!;
}

async function payFor(cost: number): Promise<Payment | null> {
  const s = state()!;
  const h = activeHero(s);
  modal = true;
  try {
    return await dialogs.pay(cost, h.pool, s.destiny.common[h.side]);
  } finally {
    modal = false;
    render();
  }
}

async function buy(item: 'drink' | 'meal'): Promise<void> {
  const pay = await payFor(RULES.tavern[item].cost);
  if (pay) dispatch({ type: 'buy', item, pay });
}

async function inspiredLead(): Promise<void> {
  const max = hudModel(state()!).can.inspiredLeadMax;
  modal = true;
  const n = await dialogs.amount(t('dialog.inspired'), max, (x) => t('action.inspiredLeadAmount', { n: x, bonus: x * RULES.modifiers.inspiredLeadPerDestiny }));
  modal = false;
  if (!n) return render();
  const pay = await payFor(n);
  if (pay) dispatch({ type: 'inspiredLead', destiny: n, pay });
}

function heroRetreat(): void {
  const s = state()!;
  targeting = { kind: 'retreat', options: taverns(activeHero(s).side) };
  toasts.show(t('dialog.retreatTavern'));
  render();
}

async function doRetreat(tavern: Coord): Promise<void> {
  targeting = null;
  const pay = await payFor(RULES.abilities.heroRetreat.cost);
  if (pay) dispatch({ type: 'heroRetreat', tavern, pay });
}

async function roll(): Promise<void> {
  if (rolling) return;
  rolling = true;
  render();
  let value: number;
  try {
    if (forcedRoll !== null) {
      value = forcedRoll;
      forcedRoll = null;
      dice.show(value);
    } else {
      diceWorld ??= await createDiceWorld();
      const r = throwDie(diceWorld);
      await dice.play(r.frames);
      value = r.value;
    }
  } finally {
    rolling = false;
  }
  const s = state()!;
  dispatch({ type: 'submitRoll', value });
  if (s.enforcement === 'sandbox') toasts.show(t('sandbox.freeRollResult', { value }), { testid: 'free-roll-result' });
  render();
}

async function sandboxOn(): Promise<void> {
  modal = true;
  const ok = await dialogs.confirm(t('settings.sandboxConfirm'));
  modal = false;
  settingsOpen = false;
  if (ok) dispatch({ type: 'setEnforcement', mode: 'sandbox' });
  render();
}

function sandboxOff(): void {
  settingsOpen = false;
  held = null;
  dispatch({ type: 'setEnforcement', mode: 'rules' });
  render();
}

const eqC = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

function sandboxDrop(from: Pick, to: Pick): void {
  const target = from.kind === 'hero' ? { heroId: from.id } : 'id' in from ? { unitId: from.id } : null;
  if (!target) return;
  if (to.kind === 'graveyard') {
    if (target.unitId) dispatch({ type: 'sandboxPlace', target, to: 'graveyard' });
  } else if ('coord' in to) dispatch({ type: 'sandboxPlace', target, to: to.coord });
  held = null;
  render();
}

function onPick(p: Pick): void {
  const s = state();
  if (!s || s.status === 'setup' || rolling || modal) return;
  if (s.enforcement === 'sandbox') {
    if (!held) {
      if (p.kind === 'unit' || p.kind === 'hero' || p.kind === 'graveUnit') held = p;
      render();
    } else sandboxDrop(held, p);
    return;
  }
  if (s.status !== 'playing') return;
  const coord = 'coord' in p ? p.coord : null;
  const d = s.pendingDecision;
  if (d && (d.type === 'advanceSquare' || d.type === 'unconsciousTavern')) {
    if (coord && d.options.some((o) => eqC(o, coord))) dispatch({ type: 'decide', decision: { type: 'square', to: coord } });
    return;
  }
  if (targeting && coord) {
    if (targeting.options.some((o) => eqC(o, coord))) void doRetreat(coord);
    else {
      targeting = null;
      render();
    }
    return;
  }
  const h = highlights(s, selected);
  if (s.phase === 'move' && coord && h.moves.some((m) => eqC(m, coord))) {
    dispatch({ type: 'moveStep', to: coord });
    return;
  }
  if (s.phase === 'lead') {
    if (p.kind === 'unit' && h.selectable.includes(p.id) && p.id !== selected) {
      selected = p.id;
      render();
      return;
    }
    if (selected && coord && h.leads.some((l) => eqC(l.to, coord))) {
      dispatch({ type: 'announceLead', unitId: selected, to: coord });
      return;
    }
    selected = null;
    render();
  }
}

picker.listen({ onClick: onPick, onDrag: (a, b) => { if (state()?.enforcement === 'sandbox') sandboxDrop(a, b); } },
  () => state()?.enforcement === 'sandbox');

// --- rendering ---
function helpText(s: GameState): string | null {
  if (s.enforcement === 'sandbox') return held ? `${t('hud.chooseSquare')} (${'id' in held ? held.id : ''})` : t('sandbox.help');
  const d = s.pendingDecision;
  if (d && (d.type === 'advanceSquare')) return t('dialog.advance');
  if (d && d.type === 'unconsciousTavern') return t('hud.chooseSquare');
  if (targeting) return t('dialog.retreatTavern');
  if (s.phase === 'move') return t('hud.moveHelp', { left: s.turn.movementLeft });
  if (s.phase === 'lead' && !s.turn.leadAttempted) return t('hud.selectUnit');
  return null;
}

function playerName(id: string): string {
  return state()?.setup.players.find((p) => p.id === id)?.name ?? id;
}

function render(): void {
  const s = state();
  if (!s || s.status === 'setup') {
    hudRoot.replaceChildren(toasts.root);
    hl.group.clear();
    wizard.render();
    ts.requestRender();
    return;
  }
  // Overlay: result screen, settings, or nothing.
  if (s.status === 'ended' && s.enforcement === 'rules') {
    mount(overlay, renderResult(s.result!, {
      newGame: () => { clearLocal(); session = null; wizard.reset(); render(); },
      rematch: () => startSession(createGame(s.setup)),
      sandbox: () => dispatch({ type: 'setEnforcement', mode: 'sandbox' }),
    }));
  } else if (settingsOpen) {
    mount(overlay, renderSettings(s.enforcement === 'sandbox', {
      sandboxOn: () => void sandboxOn(),
      sandboxOff,
      save: () => { saveLocal(session!.initial, session!.actions); toasts.show(t('settings.saved')); },
      exportFile: () => exportFile(session!.initial, session!.actions),
      importFile: async (f) => {
        try {
          const save = await readSaveFile(f);
          settingsOpen = false;
          startSession(save.initial, save.actions);
        } catch (err) {
          toasts.show(String((err as Error).message), { error: true });
        }
      },
      newGame: () => { settingsOpen = false; clearLocal(); session = null; wizard.reset(); render(); },
      close: () => { settingsOpen = false; render(); },
    }));
  } else overlay.replaceChildren();

  if (!modal) {
    if (s.enforcement === 'rules' && !dialogs.decision(s, dispatch) && !lastErrorProblemsOpen()) dialogs.close();
  }

  const m = hudModel(s, selected);
  const busy = rolling || modal;
  mount(hudRoot,
    renderPhaseBar(m),
    renderSandboxBadge(s.enforcement === 'sandbox'),
    renderHeroes(m, playerName),
    renderPools(m),
    s.enforcement === 'sandbox'
      ? renderSandboxEditors(s, dispatch, () => void roll(), sandboxOff, () => downloadText('position.fixture.ts', toFixture(s), 'text/plain'))
      : null,
    el('div', { class: 'actions' },
      renderRulePanel(lastError),
      renderHelp(helpText(s)),
      s.enforcement === 'rules' ? renderLeadPanel(m, rolling, () => void roll(), () => dispatch({ type: 'useRevenge' })) : null,
      s.enforcement === 'rules' ? renderTavern(m, (item) => void buy(item)) : null,
      s.enforcement === 'rules' && s.status === 'playing'
        ? renderActions(m, session!.canUndo(), busy, {
            endPhase: () => dispatch({ type: 'endPhase' }),
            undo: () => { session!.undo(); },
            offerDraw: () => dispatch({ type: 'offerDraw' }),
            inspiredLead: () => void inspiredLead(),
            heroRetreat,
          })
        : null,
    ),
    renderLog(s.log),
    el('div', { class: 'tools' },
      button(t('action.settings'), () => { settingsOpen = true; render(); }, { testid: 'open-settings' }),
      button(t('action.resetCamera'), () => camera.reset(), { testid: 'reset-camera' }),
    ),
    toasts.root,
  );

  const extra = targeting
    ? { coords: targeting.options, kind: 'decision' as const }
    : held && s.enforcement === 'sandbox' && 'coord' in held ? { coords: [held.coord], kind: 'place' as const } : null;
  hl.show(highlights(s, selected), selected, pieces, extra);
  ts.requestRender();
}

function lastErrorProblemsOpen(): boolean {
  return dialogs.open && !!dialogRoot.querySelector('[data-testid="problems"]');
}

// --- test hook (dev and e2e builds) ---
if (import.meta.env.DEV || isE2E) {
  (window as unknown as { __rosada: unknown }).__rosada = {
    state: () => state(),
    dispatch: (a: Action) => dispatch(a),
    actions: () => session?.actions ?? [],
    screenOf: (square: string) => picker.screenOf(parseSquare(square)),
    highlighted: () => hl.current.map((h) => ({ kind: h.kind, square: squareName(h.coord) })),
    frames: () => ts.frames,
    forceNextRoll: (n: number) => {
      if (!isE2E) throw new Error('forceNextRoll is only available in e2e builds');
      forcedRoll = n;
    },
  };
}

render();
