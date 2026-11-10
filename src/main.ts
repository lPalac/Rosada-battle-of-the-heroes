// Wires game ↔ table ↔ physics ↔ ui: input → `apply` → table sync + animations + HUD (T058, T073).
import { GameSession, type SessionLike } from './game/session.ts';
import { highlights, hudModel } from './game/hud-model.ts';
import { toFixture } from './game/fixture.ts';
import { t } from './i18n/strings.ts';
import type { OnlineSession } from './net/online-session.ts';
import { throwDie, throwDieTo } from './physics/roll.ts';
import { createDiceWorld, type DiceWorld } from './physics/world.ts';
import {
  createGame, createSetup, RULES, parseSquare, squareName, taverns,
  type Action, type Coord, type GameEvent, type GameState, type Payment, type RuleError,
} from './rules/index.ts';
import { onAssetLoaded } from './table/assets.ts';
import { EffectsView } from './table/effects.ts';
import { createBoard } from './table/board.ts';
import { SQUARE, toWorld, ZONES } from './table/coords.ts';
import { createCamera } from './table/camera.ts';
import { DiceView } from './table/dice.ts';
import { HighlightView } from './table/highlights.ts';
import { Picker, type Pick } from './table/picking.ts';
import { PiecesView } from './table/pieces.ts';
import { createScene } from './table/scene.ts';
import { createRoom } from './table/room.ts';
import { SheetsView } from './table/sheets.ts';
import { createStrip } from './table/strip.ts';
import { TracksView } from './table/tracks.ts';
import { renderTracker } from './ui/tracker.ts';
import assetsJson from './data/assets.json';
import { Dialogs } from './ui/dialogs.ts';
import { button, el, mount } from './ui/dom.ts';
import { renderActions, renderHelp } from './ui/hud/actions.ts';
import { offersOf, renderAbilities, targetLabel } from './ui/hud/abilities.ts';
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
import { SandboxPhysics } from './ui/sandbox-physics.ts';
import { SetupWizard } from './ui/setup/index.ts';
import { renderPicks } from './ui/setup/picks.ts';
import { OnlineController, roomCodeFromHash } from './ui/online/controller.ts';
import { renderOnlineBar } from './ui/online/screens.ts';
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
// 003 table: room and wooden slab, Graveyard / Well strip, hero sheets, Royal Favor tracks and medallions (US7).
const room = createRoom(ts.scene);
const strip = createStrip();
const sheets = new SheetsView(() => ts.requestRender());
onAssetLoaded(() => ts.requestRender());
const tracks = new TracksView();
const effectsView = new EffectsView(() => ts.requestRender());
ts.scene.add(strip, sheets.group, tracks.group, effectsView.group);
function syncTable(s: GameState): void {
  if (s.status === 'setup') return;
  sheets.sync(s);
  tracks.sync(s);
  effectsView.sync(s);
  ts.requestRender();
}
const picker = new Picker(ts.camera, canvas, () => [pieces.group, boardView.group]);

// --- ui ---
const toasts = new Toasts();
const dialogs = new Dialogs(dialogRoot);
let session: SessionLike | null = null;
let selected: string | null = null;
let targeting: { kind: 'retreat'; options: Coord[] } | null = null;
let held: Pick | null = null;
let carriedMoved = false;
let rolling = false;
let settingsOpen = false;
let modal = false;
let trackerOpen = false;
let lastError: RuleError | null = null;
let forcedRoll: number | null = null;
let diceWorld: DiceWorld | null = null;
let unsubscribe: (() => void) | null = null;

const state = (): GameState | null => session?.state ?? null;
const isE2E = import.meta.env.MODE === 'e2e';
const physics = new SandboxPhysics(ts, pieces, (a) => dispatch(a), state, (on) => (camera.controls.enabled = on));

/** Sandbox physics follows the mode: a world while rules are off, none while they are on (002 FR-020, FR-027). */
function syncPhysics(s: GameState): void {
  if (s.status !== 'setup' && s.enforcement === 'sandbox') {
    physics.ensure(s);
    physics.syncFromState(s);
  } else if (physics.ready) {
    physics.dispose();
    pieces.sync(s, [], false);
  }
}

function showError(e: RuleError): void {
  lastError = e;
  if (e.code === 'POSITION_INVALID' && e.problems) dialogs.problems(e.problems);
  else toasts.show(errorText(e), { error: true, rule: e.rule });
  render();
}

function dispatch(action: Action): boolean {
  if (!session) return false;
  const r = session.dispatch(action);
  // Online the action goes to the server; the change arrives as an `applied` message (005 R-13).
  if (!r.ok && r.error.code === 'SENT') {
    lastError = null;
    return true;
  }
  if (!r.ok) {
    showError(r.error);
    return false;
  }
  lastError = null;
  return true;
}

// --- online (005) ---
const online = new OnlineController(overlay, {
  attach: (s) => attachOnline(s),
  detach: () => {
    unsubscribe?.();
    unsubscribe = null;
    session = null;
    wizard.reset();
    render();
  },
  render: () => render(),
  toast: (msg, error) => toasts.show(msg, { error }),
});
/** The local seat may act now (always true in hot-seat). */
const myMove = (): boolean => !onlineSession() || onlineSession()!.canAct();
const onlineSession = (): OnlineSession | null => (online.active ? online.session : null);

/** Server rolls are animated before the result shows (FR-022); changes are handled one after another. */
function attachOnline(s: OnlineSession): void {
  unsubscribe?.();
  physics.dispose();
  session = s;
  selected = null;
  targeting = null;
  held = null;
  let pendingRoll: number | null = null;
  let chain = Promise.resolve();
  const offApplied = s.onApplied((info, a) => {
    if (info.roll && a.type === 'submitRoll') pendingRoll = a.value;
  });
  const offChange = s.onChange((st, events) => {
    const value = pendingRoll;
    pendingRoll = null;
    chain = chain.then(async () => {
      if (value !== null) await playServerRoll(value);
      onChange(st, events);
    });
  });
  const offRefused = s.onRefused((r) => showError({ code: r.code, message: r.message, rule: r.rule ?? 'Online' }));
  unsubscribe = () => {
    offApplied();
    offChange();
    offRefused();
  };
  if (s.state.status !== 'setup') pieces.sync(s.state, [], false);
  syncTable(s.state);
  render();
}

async function playServerRoll(value: number): Promise<void> {
  rolling = true;
  render();
  try {
    if (isE2E) dice.show(value);
    else {
      diceWorld ??= await createDiceWorld();
      await dice.play(throwDieTo(diceWorld, value).frames);
    }
  } finally {
    rolling = false;
  }
}

function onChange(s: GameState, events: GameEvent[]): void {
  if (events.some((e) => e.type === 'wellDepleted')) toasts.wellDepleted();
  if (events.some((e) => e.type === 'epicStageStarted')) toasts.show(t('log.epicStageStarted'), { testid: 'epic-notice' });
  if (events.some((e) => e.type === 'phaseChanged' || e.type === 'unitLed' || e.type === 'leadAnnounced')) selected = null;
  if (s.status === 'playing') {
    const active = s.heroes.find((h) => h.id === s.activeHeroId);
    if (active) camera.setSide(active.side);
  }
  // Online games are kept by the server (FR-044); only hot-seat games go to local storage.
  if (session && s.status !== 'setup' && !onlineSession()) saveLocal(session.initial, session.actions);
  if (s.status !== 'setup') pieces.sync(s, events);
  syncTable(s);
  syncPhysics(s);
  render();
}

function startSession(initial: GameState, actions: Action[] = []): void {
  unsubscribe?.();
  physics.dispose();
  const hotSeat = new GameSession(initial);
  if (actions.length) hotSeat.reset(initial, actions);
  session = hotSeat;
  unsubscribe = session.onChange(onChange);
  selected = null;
  targeting = null;
  held = null;
  if (session.state.status !== 'setup') pieces.sync(session.state, [], false);
  syncTable(session.state);
  syncPhysics(session.state);
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
      button(t('online.play'), () => online.openMenu(), { testid: 'play-online', kind: 'primary' }),
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

/** 004: use a hero ability from the HUD panel; several target choices open a dialog (T060). */
async function useAbilityFromPanel(abilityId: string): Promise<void> {
  const s = state()!;
  const choices = offersOf(s, abilityId).flatMap((o) => o.targets.map((targets) => ({ option: o.option, targets, cost: o.cost })));
  if (!choices.length) return;
  let pick = choices[0];
  if (choices.length > 1) {
    modal = true;
    const chosen = await dialogs.choose(t(`ability.${abilityId}.name`), choices.map((c) => ({
      label: (c.option ? `${t(`option.${c.option}`)}: ` : '') + targetLabel(s, c.targets), value: c,
    })));
    modal = false;
    if (!chosen) return render();
    pick = chosen;
  }
  const pay = pick.cost > 0 ? await payFor(pick.cost) : undefined;
  if (pick.cost > 0 && !pay) return;
  dispatch({ type: 'useAbility', abilityId, targets: pick.targets, ...(pick.option ? { option: pick.option } : {}), ...(pay ? { pay } : {}) });
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
  const net = onlineSession();
  if (net) {
    // The server picks the value; every screen plays the die when it arrives (FR-020, FR-021).
    net.roll();
    return;
  }
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

/** Rules back on: let pieces come to rest, record where they are, stand them up, then check (002 FR-026). */
async function sandboxOff(): Promise<void> {
  settingsOpen = false;
  held = null;
  if (physics.ready) {
    toasts.show(t('sandbox.settling'), { ms: 1500 });
    await physics.settle(3000);
    physics.dispose();
    pieces.sync(state()!, [], false);
  }
  if (!dispatch({ type: 'setEnforcement', mode: 'rules' })) syncPhysics(state()!);
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
  if (!s || s.status === 'setup' || rolling || modal || !myMove()) return;
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

picker.listen({
  onClick: onPick,
  onDrag: (a, b) => { if (state()?.enforcement === 'sandbox') sandboxDrop(a, b); },
  carry: {
    start: (p) => { carriedMoved = false; return physics.startCarry(p); },
    move: (point) => { carriedMoved = true; physics.moveCarry(point); },
    end: () => {
      physics.endCarry();
      if (carriedMoved) held = null; // a real carry replaces click-to-place; a plain click keeps it working
    },
  },
}, () => state()?.enforcement === 'sandbox' && !modal);

// --- rendering ---
function helpText(s: GameState): string | null {
  if (s.enforcement === 'sandbox') {
    if (held) return `${t('hud.chooseSquare')} (${'id' in held ? held.id : ''})`;
    return physics.ready ? t('sandbox.physicsHelp') : t('sandbox.help');
  }
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

/** 005: online picks: the seat whose pick it is chooses; the others wait (US2-AS1). */
function renderOnlinePicks(net: OnlineSession): void {
  const s = net.state;
  hudRoot.replaceChildren(toasts.root);
  hl.group.clear();
  const picks = renderPicks(s.setup, (side, choice) => dispatch({ type: 'pickHero', side, ...choice }));
  if (net.canAct()) {
    mount(overlay, el('div', { class: 'panel setup', 'data-testid': 'setup' }, el('h2', {}, t('online.yourTurn')), picks,
      el('div', { class: 'muted' }, t('online.autoSetup'))));
  } else {
    const names = net.waitingFor().map((id) => net.room?.seats.find((x) => x.id === id)?.name ?? id).join(', ');
    picks.querySelectorAll('button').forEach((b) => b.setAttribute('disabled', ''));
    mount(overlay, online.waitingPanel(names, picks));
  }
  ts.requestRender();
}

function render(): void {
  const s = state();
  if (online.active && online.ownsOverlay()) {
    hudRoot.replaceChildren(toasts.root);
    hl.group.clear();
    online.render();
    ts.requestRender();
    return;
  }
  const net = onlineSession();
  if (net && s?.status === 'setup') return renderOnlinePicks(net);
  if (!s || s.status === 'setup') {
    hudRoot.replaceChildren(toasts.root);
    hl.group.clear();
    wizard.render();
    ts.requestRender();
    return;
  }
  // Overlay: result screen, settings, or nothing.
  if (s.status === 'ended' && s.enforcement === 'rules') {
    mount(overlay, net
      ? renderResult(s.result!, {
          newGame: () => void online.leave(),
          // Online the room creator starts the rematch with the same seats (US2-AS8).
          rematch: () => net.rematch(),
          sandbox: null,
        })
      : renderResult(s.result!, {
          newGame: () => { clearLocal(); session = null; wizard.reset(); render(); },
          rematch: () => startSession(createGame(s.setup)),
          sandbox: () => dispatch({ type: 'setEnforcement', mode: 'sandbox' }),
        }));
  } else if (settingsOpen && net) {
    mount(overlay, renderSettings(false, {
      online: true,
      sandboxOn: () => {},
      sandboxOff: () => {},
      save: () => {},
      exportFile: () => exportFile(net.initial, net.actions),
      importFile: () => {},
      newGame: () => { settingsOpen = false; void online.leave(); },
      close: () => { settingsOpen = false; render(); },
    }));
  } else if (settingsOpen) {
    mount(overlay, renderSettings(s.enforcement === 'sandbox', {
      sandboxOn: () => void sandboxOn(),
      sandboxOff: () => void sandboxOff(),
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
  } else if (trackerOpen) {
    mount(overlay, renderTracker(s, () => { trackerOpen = false; render(); }));
  } else overlay.replaceChildren();

  const mine = myMove();
  if (!modal) {
    // Online, a decision dialog opens only for the player who owns it (US2-AS6).
    if (s.enforcement === 'rules' && !(mine && dialogs.decision(s, dispatch)) && !lastErrorProblemsOpen()) dialogs.close();
  }

  const m = hudModel(s, selected);
  const busy = rolling || modal;
  const waiting = net && !mine
    ? el('div', { class: 'panel muted', 'data-testid': 'online-not-your-turn' },
        t('online.waitingFor', { name: net.waitingFor().map((id) => net.room?.seats.find((x) => x.id === id)?.name ?? id).join(', ') }))
    : null;
  mount(hudRoot,
    net?.room ? renderOnlineBar(net.room, net.waitingFor(), online.status) : null,
    renderPhaseBar(m),
    renderSandboxBadge(s.enforcement === 'sandbox'),
    renderHeroes(m, playerName),
    renderPools(m),
    s.enforcement === 'sandbox'
      ? renderSandboxEditors(s, dispatch, () => void roll(), () => void sandboxOff(), () => downloadText('position.fixture.ts', toFixture(s), 'text/plain'),
          { canUndo: session!.canUndo(), undo: () => { session!.undo(); } })
      : null,
    waiting ?? el('div', { class: 'actions' },
      renderRulePanel(lastError),
      renderHelp(helpText(s)),
      s.enforcement === 'rules' ? renderLeadPanel(m, rolling, () => void roll(), () => dispatch({ type: 'useRevenge' })) : null,
      s.enforcement === 'rules' ? renderTavern(m, (item) => void buy(item)) : null,
      s.enforcement === 'rules' && s.status === 'playing' ? renderAbilities(m, busy, (id) => void useAbilityFromPanel(id)) : null,
      s.enforcement === 'rules' && s.status === 'playing'
        ? renderActions(m, session!.canUndo(), busy, {
            endPhase: () => dispatch({ type: 'endPhase' }),
            undo: () => { session!.undo(); },
            offerDraw: () => dispatch({ type: 'offerDraw' }),
            inspiredLead: () => void inspiredLead(),
            heroRetreat,
            becomeHeroUnit: (types) => dispatch({ type: 'becomeHeroUnit', types }),
            leaveHeroUnit: () => dispatch({ type: 'leaveHeroUnit' }),
            kingsForces: () => dispatch({ type: 'kingsForces' }),
          })
        : null,
    ),
    renderLog(s.log),
    el('div', { class: 'tools' },
      button(t('action.settings'), () => { settingsOpen = true; render(); }, { testid: 'open-settings' }),
      button(t('action.tracker'), toggleTracker, { testid: 'open-tracker' }),
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

function toggleTracker(): void {
  trackerOpen = !trackerOpen;
  render();
}

// `A` opens and closes the Royal Favor tracker (research R-10).
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'a' || e.key === 'A') {
    if (state() && state()!.status !== 'setup') toggleTracker();
  } else if (e.key === 'Escape' && trackerOpen) toggleTracker();
});

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
    squareSize: () => SQUARE,
    selected: () => selected,
    unitScreenOf: (id: string) => {
      const obj = pieces.unitObject(id) ?? pieces.heroObject(id);
      if (!obj) return null;
      const p = obj.position.clone().setY(0.3).project(ts.camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
    physicsReady: () => physics.ready,
    pieceWorld: (id: string) => {
      const obj = pieces.unitObject(id) ?? pieces.heroObject(id);
      return obj ? { x: obj.position.x, y: obj.position.y, z: obj.position.z } : null;
    },
    squareWorld: (square: string) => {
      const p = toWorld(parseSquare(square));
      return { x: p.x, z: p.z };
    },
    graveyardScreen: (side: 'light' | 'dark') => {
      const p = ZONES.graveyard[side].clone().setY(0).project(ts.camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
    /** Largest distance between a board piece's mesh and where the state puts it (rules mode: should be ~0). */
    maxPieceOffset: () => {
      const s = state();
      if (!s) return 0;
      let worst = 0;
      for (const u of s.units) worst = Math.max(worst, pieces.unitObject(u.id)!.position.distanceTo(pieces.unitTarget(s, u, null)));
      for (const h of s.heroes) worst = Math.max(worst, pieces.heroObject(h.id)!.position.distanceTo(pieces.heroTarget(s, h)));
      return worst;
    },
    /** Largest tilt of any unit or upright hero, in degrees. */
    /** 003 US7: which table elements exist and what the sheets, tracks and medallions show. */
    heroDefinitions: () => state()?.heroes.map((h) => h.definitionId) ?? [],
    tableElements: () => ({
      tableTop: !!room.tableTop.parent,
      roomFloor: !!room.floor.parent,
      boardBorder: !!boardView.border.parent,
      strip: !!strip.parent,
      sheets: sheets.list(),
      tracks: tracks.trackList(),
      medallions: tracks.medallionList(),
      assets: assetsJson,
      // 004 US6: what each unit shows (TTS model or placeholder), and the TTS table pieces.
      pieceAssets: Object.fromEntries((state()?.units ?? []).map((u) => [u.id, pieces.unitObject(u.id)?.userData.assetKind ?? 'placeholder'])),
      sky: !!room.group.userData.sky,
      effectTokens: effectsView.list(),
      ttsTable: !!room.tableTop.userData.tts,
      ttsStrip: !!strip.userData.tts,
    }),
    sheetScreen: (heroId: string) => {
      const mesh = sheets.meshOf(heroId);
      if (!mesh) return null;
      const p = mesh.position.clone().project(ts.camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
    maxPieceTilt: () => {
      let worst = 0;
      for (const { obj } of pieces.allPieces()) {
        const up = obj.up.clone().set(0, 1, 0).applyQuaternion(obj.quaternion);
        worst = Math.max(worst, (Math.acos(Math.min(1, up.y)) * 180) / Math.PI);
      }
      return worst;
    },
    forceNextRoll: (n: number) => {
      if (!isE2E) throw new Error('forceNextRoll is only available in e2e builds');
      // Online the server rolls: ask the test-mode server to use this value next (005 T039).
      if (onlineSession()) online.conn?.send({ t: 'forceNextRoll', value: n });
      else forcedRoll = n;
    },
    /** 005: the online view of this window (seat, room, whether it may act). */
    online: () => {
      const net = onlineSession();
      return net ? { seat: net.mySeat, room: net.room, canAct: net.canAct(), seq: net.seq, resyncs: net.resyncs, status: online.status } : null;
    },
  };
}

// 005: a room link (`#/room/<code>`) joins that room, with the stored seat token if this browser has one (US4-AS1).
const linkedRoom = roomCodeFromHash(location.hash);
if (linkedRoom) void online.join(linkedRoom);

render();
