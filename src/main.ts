// Wires game ↔ table ↔ physics ↔ ui: input → `apply` → table sync + animations + HUD (T058, T073).
import { GameSession, type SessionLike } from './game/session.ts';
import { flashesFor } from './game/flash-model.ts';
import { highlights, hudModel } from './game/hud-model.ts';
import { FlashLayer } from './ui/hud/flashes.ts';
import { toFixture } from './game/fixture.ts';
import { hasString, t } from './i18n/strings.ts';
import type { OnlineSession } from './net/online-session.ts';
import { throwDie, throwDieTo } from './physics/roll.ts';
import { createDiceWorld, type DiceWorld } from './physics/world.ts';
import {
  abilityOffers, createGame, createSetup, RULES, parseSquare, positionWarnings, squareName, taverns, validatePosition, wouldCheckOwnKing,
  type AbilityOffer, type AbilityTarget, type Action, type Coord, type GameEvent, type GameState, type Payment, type RuleError,
} from './rules/index.ts';
import { extendPlan, type MovePlan } from './game/move-plan.ts';
import { completedChoice, nextPicks, targetPrompt } from './game/target-model.ts';
import { BoardTooltip } from './ui/hud/tooltip.ts';
import { onAssetLoaded } from './table/assets.ts';
import { EffectsView } from './table/effects.ts';
import { createBoard } from './table/board.ts';
import { SQUARE, toWorld, ZONES } from './table/coords.ts';
import { createCamera } from './table/camera.ts';
import { DiceView } from './table/dice.ts';
import { HighlightView, type Overlay } from './table/highlights.ts';
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
import { clearLocal, downloadText, exportFile, loadLocal, loadUiFlag, readSaveFile, saveLocal, saveUiFlag } from './ui/storage.ts';
import { renderInCheck } from './ui/hud/check.ts';

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
// 006 FR-035, FR-039: flashes slide to the log; the CHECK notice stands above the checked King.
const flashLayer = new FlashLayer({
  instant: import.meta.env.MODE === 'e2e',
  logRect: () => hudRoot.querySelector('[data-testid="log-panel"]')?.getBoundingClientRect() ?? null,
  kingScreen: (side) => {
    const king = state()?.units.find((u) => u.type === 'king' && u.side === side);
    if (!king) return null;
    const p = picker.screenOf(king.pos);
    return { x: p.x, y: p.y };
  },
});
const dialogs = new Dialogs(dialogRoot);
let session: SessionLike | null = null;
let selected: string | null = null;
/**
 * 006 FR-020: board targeting. An ability prompt picks its targets on the board step by step; Hero Retreat picks a
 * tavern the same way.
 */
type Targeting =
  | { kind: 'retreat'; options: Coord[] }
  | { kind: 'ability'; abilityId: string; option?: string; offer: AbilityOffer; chosen: AbilityTarget[]; length: number };
let targeting: Targeting | null = null;
/** 006 FR-021: the planned Move path, and whether a walk is running (other input waits). */
let plan: MovePlan | null = null;
let walking = false;
const tooltip = new BoardTooltip();
let held: Pick | null = null;
let carriedMoved = false;
let rolling = false;
let settingsOpen = false;
let modal = false;
let trackerOpen = false;
/** 006: the session came from the position editor; its first "rules back on" restarts at Before Turn. */
let editorSession = false;
/** 006 FR-033: the ability panel collapsed (kept in this browser; starts collapsed below 1500 px width). */
const ABILITY_PANEL_KEY = 'rosada.ui.abilities';
let abilitiesCollapsed = loadUiFlag(ABILITY_PANEL_KEY) ?? window.innerWidth < 1500;
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
  // FR-030: everyone sees an undo, with who undid what.
  const offUndone = s.onUndone((m) => {
    const name = s.room?.seats.find((x) => x.id === m.by)?.name ?? m.by;
    const what = hasString(`actionName.${m.action.type}`) ? t(`actionName.${m.action.type}`) : m.action.type;
    toasts.show(t('online.undid', { name, action: what }), { testid: 'online-undid' });
  });
  unsubscribe = () => {
    offApplied();
    offChange();
    offRefused();
    offUndone();
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
  // The die has landed by now (hot-seat rolls before submitting; online plays the server's roll first).
  if (s.status !== 'setup') flashLayer.push(flashesFor(events, s));
  if (events.some((e) => e.type === 'wellDepleted')) toasts.wellDepleted();
  if (events.some((e) => e.type === 'epicStageStarted')) toasts.show(t('log.epicStageStarted'), { testid: 'epic-notice' });
  if (events.some((e) => e.type === 'phaseChanged' || e.type === 'unitLed' || e.type === 'leadAnnounced')) selected = null;
  // 006: a plan is cleared by any change that is not its own walk; a target prompt by a phase change.
  if (!walking) plan = null;
  if (events.some((e) => e.type === 'phaseChanged')) targeting = null;
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
  flashLayer.clear();
  physics.dispose();
  const hotSeat = new GameSession(initial);
  if (actions.length) hotSeat.reset(initial, actions);
  session = hotSeat;
  editorSession = false;
  unsubscribe = session.onChange(onChange);
  selected = null;
  targeting = null;
  plan = null;
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
  // 006 FR-006: a position from the editor starts at Before Turn, so it is not a continued turn.
  editorSession = true;
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

/** An ability option's label ("One use: −4 to Lead on the next turn (1 D)"), or the plain option name. */
function optionLabel(abilityId: string, option: string, cost: number): string {
  return hasString(`option.${abilityId}.${option}`) ? t(`option.${abilityId}.${option}`, { cost }) : t(`option.${option}`);
}

/**
 * 006 FR-024: before an action that would put the player's own King in check, warn and let them Continue or Undo.
 * Undo sends nothing (spec A-12). Returns true when the action may be sent.
 */
async function ownKingOk(action: Action): Promise<boolean> {
  const s = state();
  if (!s || !wouldCheckOwnKing(s, action)) return true;
  modal = true;
  const go = await dialogs.ownCheckWarning();
  modal = false;
  render();
  return go;
}

/** Send an action after the own-King warning (Legendary Powers and other non-Lead actions). */
async function guarded(action: Action): Promise<void> {
  if (await ownKingOk(action)) dispatch(action);
}

/** Use an ability with its chosen targets: the own-King warning, then payment, then the action. */
async function finishAbility(abilityId: string, option: string | undefined, targets: AbilityTarget[], cost: number): Promise<void> {
  targeting = null;
  const action: Action = { type: 'useAbility', abilityId, targets, ...(option ? { option } : {}) };
  if (!(await ownKingOk(action))) return render();
  const pay = cost > 0 ? await payFor(cost) : undefined;
  if (cost > 0 && !pay) return render();
  dispatch({ ...action, ...(pay ? { pay } : {}) } as Action);
  render();
}

/**
 * Use a hero ability from the HUD panel. 006 FR-020: targets on the board are picked on the board (B-02); a choice
 * of options (Preaching one use or both, Breath square or Knight) comes first; targets that are not on the board keep
 * the dialog; a single choice is used at once.
 */
async function useAbilityFromPanel(abilityId: string, option?: string): Promise<void> {
  const s = state()!;
  const offers = offersOf(s, abilityId).filter((o) => option === undefined || o.option === option);
  if (!offers.length) return;
  let offer = offers[0];
  if (offers.length > 1) {
    modal = true;
    const chosen = await dialogs.choose(t(`ability.${abilityId}.name`), offers.map((o) => ({ label: optionLabel(abilityId, o.option ?? '', o.cost), value: o })));
    modal = false;
    if (!chosen) return render();
    offer = chosen;
  }
  const prompt = targetPrompt(s, offer);
  if (offer.targets.length === 1 && !offer.blocked.length) return finishAbility(abilityId, offer.option, offer.targets[0], offer.cost);
  if (prompt.fallback === 'dialog') {
    modal = true;
    const chosen = await dialogs.choose(t(`ability.${abilityId}.name`), offer.targets.map((targets) => ({ label: targetLabel(s, targets), value: targets })));
    modal = false;
    if (!chosen) return render();
    return finishAbility(abilityId, offer.option, chosen, offer.cost);
  }
  plan = null;
  selected = null;
  targeting = { kind: 'ability', abilityId, ...(offer.option ? { option: offer.option } : {}), offer, chosen: [], length: prompt.length };
  render();
}

/** A board click while an ability's target prompt is open. */
function pickTarget(t0: Extract<Targeting, { kind: 'ability' }>, coord: Coord, clientX?: number, clientY?: number): void {
  const s = state()!;
  const step = nextPicks(s, t0.offer, t0.chosen);
  const pick = step.picks.find((p) => eqC(p.coord, coord));
  if (pick) {
    t0.chosen = [...t0.chosen, pick.target];
    const done = t0.chosen.length >= t0.length ? completedChoice(t0.offer, t0.chosen) : null;
    if (done) void finishAbility(t0.abilityId, t0.option, done, t0.offer.cost);
    else render();
    return;
  }
  const blocked = step.blocked.find((b) => eqC(b.coord, coord));
  if (blocked) showBlockedReason(blocked.code, clientX, clientY);
}

/** 006 FR-026: the reason a square or target is blocked, at the pointer (or as a toast without one). */
function showBlockedReason(code: string, clientX?: number, clientY?: number): void {
  const text = errorText({ code, message: code, rule: '' });
  if (clientX !== undefined && clientY !== undefined) tooltip.show(text, clientX, clientY, 2500);
  else toasts.show(text, { error: true });
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
  // 006 FR-009: a checkmate in a legal position is pointed out first; a position with problems shows the 001 list.
  const s = state()!;
  const warnings = validatePosition(s).length ? [] : positionWarnings(s);
  if (warnings.length) {
    modal = true;
    const go = await dialogs.checkmateAlert(warnings.map((w) => w.side), editorSession);
    modal = false;
    if (!go) {
      syncPhysics(state()!);
      render();
      return;
    }
  }
  if (!dispatch({ type: 'setEnforcement', mode: 'rules', ...(editorSession ? { restart: true } : {}) })) syncPhysics(state()!);
  else editorSession = false;
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
  if (!s || s.status === 'setup' || rolling || modal || walking || !myMove()) return;
  if (s.enforcement === 'sandbox') {
    if (!held) {
      if (p.kind === 'unit' || p.kind === 'hero' || p.kind === 'graveUnit') held = p;
      render();
    } else sandboxDrop(held, p);
    return;
  }
  if (s.status !== 'playing') return;
  // A click on a piece means the piece's square (the ray may hit the side of a tall piece over a neighbouring square).
  const coord = p.kind === 'unit' ? s.units.find((u) => u.id === p.id)?.pos ?? p.coord
    : p.kind === 'hero' ? s.heroes.find((h) => h.id === p.id)?.pos ?? p.coord
    : 'coord' in p ? p.coord : null;
  const d = s.pendingDecision;
  if (d && (d.type === 'advanceSquare' || d.type === 'unconsciousTavern')) {
    if (coord && d.options.some((o) => eqC(o, coord))) dispatch({ type: 'decide', decision: { type: 'square', to: coord } });
    return;
  }
  if (targeting?.kind === 'ability') {
    // Anything that is not a pick leaves the prompt open; Esc or Cancel ends it (contracts/ui-interactions.md).
    if (coord) pickTarget(targeting, coord, pointer.x, pointer.y);
    return;
  }
  if (targeting?.kind === 'retreat' && coord) {
    if (targeting.options.some((o) => eqC(o, coord))) void doRetreat(coord);
    else {
      targeting = null;
      render();
    }
    return;
  }
  const h = highlights(s, selected);
  if (s.phase === 'move' && coord) {
    // 006 FR-021: a click plans the shortest path; a click on the plan's last square walks it; any other square
    // (or Esc) clears the plan. A double click is plan + walk.
    if (plan && eqC(plan.path[plan.path.length - 1], coord)) {
      void walk(plan.path);
      return;
    }
    plan = extendPlan(s, plan, coord);
    render();
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
    // 006 FR-025: a square only check forbids says why and announces nothing.
    const blocked = selected && coord ? h.blocked.find((b) => eqC(b.to, coord)) : undefined;
    if (blocked) {
      showBlockedReason(blocked.code, pointer.x, pointer.y);
      return;
    }
    selected = null;
    render();
  }
}

/** Wait until `done` holds (online changes arrive asynchronously), or give up after `ms`. */
function waitFor(done: () => boolean, ms = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (done()) return resolve(true);
      if (performance.now() - start > ms) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * 006 FR-021 (research R-09): walk a planned path as ordinary moveStep actions, one after another, each after the
 * previous one arrived and its move animation ended (none in e2e builds). It stops on a refused step, an open decision,
 * a wound, or a change of phase. Hot-seat and online use the same loop.
 */
async function walk(path: Coord[]): Promise<void> {
  if (walking) return;
  walking = true;
  plan = null;
  render();
  try {
    for (const to of path) {
      const before = state();
      if (!before || before.phase !== 'move' || before.pendingDecision) break;
      const h0 = activeHero(before);
      const health = h0.health;
      if (!dispatch({ type: 'moveStep', to })) break;
      const arrived = await waitFor(() => {
        const s = state();
        return !!s && (eqC(activeHero(s).pos, to) || s.phase !== 'move' || !!s.pendingDecision);
      });
      const s = state();
      if (!arrived || !s || s.pendingDecision || s.phase !== 'move' || activeHero(s).health < health) break;
      if (!isE2E) await new Promise((r) => setTimeout(r, 150));
    }
  } finally {
    walking = false;
    render();
  }
}

/** The last pointer position over the table (for tooltips on click). */
const pointer = { x: 0, y: 0 };

/** 006 FR-026: hovering a blocked Lead square or a blocked ability target shows its reason at the pointer. */
function onHover(p: Pick | null, x: number, y: number): void {
  pointer.x = x;
  pointer.y = y;
  const s = state();
  const coord = p && 'coord' in p ? p.coord : null;
  let code: string | null = null;
  if (s && coord && s.status === 'playing' && s.enforcement === 'rules') {
    if (targeting?.kind === 'ability') code = nextPicks(s, targeting.offer, targeting.chosen).blocked.find((b) => eqC(b.coord, coord))?.code ?? null;
    else if (s.phase === 'lead' && selected) code = highlights(s, selected).blocked.find((b) => eqC(b.to, coord))?.code ?? null;
  }
  if (code) tooltip.show(errorText({ code, message: code, rule: '' }), x, y);
  else if (tooltip.visible) tooltip.hide();
}

picker.listen({
  onClick: onPick,
  onHover,
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
  if (targeting?.kind === 'retreat') return t('dialog.retreatTavern');
  if (targeting?.kind === 'ability') return null; // the target prompt has its own help line
  if (s.phase === 'move') {
    // 006 FR-021: the plan's Movement left; why the Move cannot end here.
    if (plan) return t('hud.planHelp', { left: plan.left });
    return t('hud.moveHelp', { left: s.turn.movementLeft }) + (hudModel(s).can.endPhase ? '' : ` ${t('hud.cannotEndHere')}`);
  }
  if (s.phase === 'lead' && !s.turn.leadAttempted) return t('hud.selectUnit');
  return null;
}

function playerName(id: string): string {
  return state()?.setup.players.find((p) => p.id === id)?.name ?? id;
}

/** 006 FR-022: the hero card clicked once in the online picks. */
let onlinePendingPick: string | null = null;

/** 005: online picks: the seat whose pick it is chooses; the others wait (US2-AS1). */
function renderOnlinePicks(net: OnlineSession): void {
  const s = net.state;
  hudRoot.replaceChildren(toasts.root, flashLayer.root);
  hl.group.clear();
  const picks = renderPicks(s.setup, (side, choice) => dispatch({ type: 'pickHero', side, ...choice }),
    { id: onlinePendingPick, set: (id) => { onlinePendingPick = id; render(); } });
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

/** 006 FR-038: Offer draw from Settings; Settings closes. */
function offerDraw(): void {
  settingsOpen = false;
  dispatch({ type: 'offerDraw' });
  render();
}

function canOfferDraw(): boolean {
  const s = state();
  return !!s && s.enforcement === 'rules' && s.status === 'playing' && !rolling && !walking && hudModel(s, selected).can.offerDraw;
}

function render(): void {
  const s = state();
  if (online.active && online.ownsOverlay()) {
    hudRoot.replaceChildren(toasts.root, flashLayer.root);
    hl.group.clear();
    online.render();
    ts.requestRender();
    return;
  }
  const net = onlineSession();
  if (net && s?.status === 'setup') return renderOnlinePicks(net);
  if (!s || s.status === 'setup') {
    hudRoot.replaceChildren(toasts.root, flashLayer.root);
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
      offerDraw,
      canOfferDraw: canOfferDraw() && net.canAct(),
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
      offerDraw,
      canOfferDraw: canOfferDraw(),
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
  const busy = rolling || modal || walking;
  const waiting = net && !mine
    ? el('div', { class: 'panel muted', 'data-testid': 'online-not-your-turn' },
        t('online.waitingFor', { name: net.waitingFor().map((id) => net.room?.seats.find((x) => x.id === id)?.name ?? id).join(', ') }))
    : null;
  mount(hudRoot,
    net?.room ? renderOnlineBar(net.room, net.waitingFor(), online.status) : null,
    renderPhaseBar(m),
    renderSandboxBadge(s.enforcement === 'sandbox'),
    renderHeroes(m, playerName),
    // 006 FR-033 (B-17): the right-hand column: pools, the "In check" pop-ups, the docked ability panel, the log.
    el('div', { class: 'right-col', 'data-testid': 'right-col' },
      renderPools(m),
      s.enforcement === 'rules' && s.status === 'playing' ? renderInCheck(m) : null,
      s.enforcement === 'rules' && s.status === 'playing'
        ? renderAbilities(m, {
            busy, collapsed: abilitiesCollapsed,
            onToggle: () => { abilitiesCollapsed = !abilitiesCollapsed; saveUiFlag(ABILITY_PANEL_KEY, abilitiesCollapsed); render(); },
            onUse: (id, option) => void useAbilityFromPanel(id, option),
            bothUses: (id) => offersOf(s, id).filter((o) => o.option === 'one' || o.option === 'both').map((o) => ({ option: o.option!, cost: o.cost })),
          })
        : null,
      renderLog(s.log),
    ),
    s.enforcement === 'sandbox'
      ? renderSandboxEditors(s, dispatch, () => void roll(), () => void sandboxOff(), () => downloadText('position.fixture.ts', toFixture(s), 'text/plain'),
          { canUndo: session!.canUndo(), undo: () => { session!.undo(); } })
      : null,
    waiting ?? el('div', { class: 'actions' },
      renderRulePanel(lastError),
      renderHelp(helpText(s)),
      targeting?.kind === 'ability'
        ? el('div', { class: 'panel target-help', 'data-testid': 'target-help' },
            el('span', {}, t('hud.targetHelp', { ability: t(`ability.${targeting.abilityId}.name`) })),
            button(t('action.cancel'), cancelTargeting, { testid: 'target-cancel' }))
        : null,
      s.enforcement === 'rules' ? renderLeadPanel(m, rolling, () => void roll(), () => dispatch({ type: 'useRevenge' }), () => void inspiredLead()) : null,
      s.enforcement === 'rules' ? renderTavern(m, (item) => void buy(item)) : null,
      s.enforcement === 'rules' && s.status === 'playing'
        ? renderActions(m, session!.canUndo(), busy, {
            endPhase: () => dispatch({ type: 'endPhase' }),
            undo: () => { session!.undo(); },
            inspiredLead: () => void inspiredLead(),
            heroRetreat,
            // 006 FR-024: Legendary Power actions get the own-King warning too.
            becomeHeroUnit: (types) => void guarded({ type: 'becomeHeroUnit', types }),
            leaveHeroUnit: () => void guarded({ type: 'leaveHeroUnit' }),
            kingsForces: () => void guarded({ type: 'kingsForces' }),
          })
        : null,
    ),
    el('div', { class: 'tools', 'data-testid': 'tools' },
      button(t('action.settings'), () => { settingsOpen = true; render(); }, { testid: 'open-settings' }),
      button(t('action.tracker'), toggleTracker, { testid: 'open-tracker' }),
      button(t('action.resetCamera'), () => camera.reset(), { testid: 'reset-camera' }),
    ),
    toasts.root,
    flashLayer.root,
  );

  const extra: Overlay[] = [];
  if (targeting?.kind === 'retreat') extra.push({ coords: targeting.options, kind: 'decision' });
  if (targeting?.kind === 'ability') {
    const step = nextPicks(s, targeting.offer, targeting.chosen);
    extra.push({ coords: step.picks.map((p) => p.coord), kind: 'target' }, { coords: step.blocked.map((b) => b.coord), kind: 'blocked' });
  }
  if (held && s.enforcement === 'sandbox' && 'coord' in held) extra.push({ coords: [held.coord], kind: 'place' });
  // While a target prompt is open, the Move and Lead highlights step back.
  const base = highlights(s, selected);
  const shown = targeting ? { ...base, reach: [], moves: [], leads: [], blocked: [], selectable: [] } : base;
  hl.show(shown, selected, pieces, extra, plan?.path ?? []);
  ts.requestRender();
}

function cancelTargeting(): void {
  targeting = null;
  tooltip.hide();
  render();
}

function toggleTracker(): void {
  trackerOpen = !trackerOpen;
  render();
}

/**
 * 006 FR-023 (contracts/ui-interactions.md): Space ends the phase when End phase is enabled, it is this seat's move,
 * no dialog, Settings or tracker is open, no walk or roll is running, focus is not in a field and the key is not
 * held. A shown plan is dropped first.
 */
function spaceEndsPhase(e: KeyboardEvent): boolean {
  const s = state();
  if (!s || s.status !== 'playing' || s.enforcement !== 'rules' || e.repeat) return false;
  if (dialogs.open || settingsOpen || trackerOpen || modal || walking || rolling || !myMove()) return false;
  if (!hudModel(s, selected).can.endPhase) return false;
  plan = null;
  targeting = null;
  dispatch({ type: 'endPhase' });
  return true;
}

// `A` opens and closes the Royal Favor tracker (research R-10); Space ends the phase; Esc clears a plan or a prompt.
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'a' || e.key === 'A') {
    if (state() && state()!.status !== 'setup') toggleTracker();
  } else if (e.key === 'Escape') {
    if (trackerOpen) toggleTracker();
    else if (targeting) cancelTargeting();
    else if (plan) {
      plan = null;
      render();
    }
  } else if (e.key === ' ' || e.code === 'Space') {
    if (tag === 'BUTTON') e.preventDefault(); // a focused button would otherwise be clicked by Space
    if (spaceEndsPhase(e)) e.preventDefault();
  }
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
    // 006 (contracts/ui-interactions.md): planned Move path, flashes shown so far, HUD panel rectangles, the board's
    // corners on screen and the camera's side. Filled by the tasks that build them.
    plan: (): { path: string[]; left: number } | null => (plan ? { path: plan.path.map(squareName), left: plan.left } : null),
    walking: () => walking,
    /** What a click at a screen point picks (unit, hero, square …). */
    pickAt: (x: number, y: number) => picker.pickAt(x, y),
    targeting: () => (targeting?.kind === 'ability' ? { abilityId: targeting.abilityId, chosen: targeting.chosen, length: targeting.length } : targeting),
    /** 006 tests: play on from a prepared game state (hot-seat), e.g. one with ability tokens on the board. */
    startPosition: (s: GameState) => startSession(s),
    flashes: (): { kind: string; text: string; tone: string }[] => flashLayer.shown(),
    /** 006 SC-004: the screen rectangles of the HUD panels that sit over the table. */
    panelRects: (): Record<string, { x: number; y: number; w: number; h: number }> => {
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const id of ['phase-bar', 'heroes', 'pools', 'ability-panel', 'log-panel', 'actions', 'tools', 'in-check-light', 'in-check-dark']) {
        const e = hudRoot.querySelector(`[data-testid="${id}"]`);
        if (!e) continue;
        const r = e.getBoundingClientRect();
        if (r.width && r.height) out[id] = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
      return out;
    },
    /** The four outer corners of the playing area on screen. */
    boardRect: (): { x: number; y: number }[] => {
      const rect = canvas.getBoundingClientRect();
      return [{ x: 0.5, y: 0.5 }, { x: 8.5, y: 0.5 }, { x: 8.5, y: 8.5 }, { x: 0.5, y: 8.5 }].map((c) => {
        const q = toWorld(c).project(ts.camera);
        return { x: rect.left + ((q.x + 1) / 2) * rect.width, y: rect.top + ((1 - q.y) / 2) * rect.height };
      });
    },
    viewSide: (): 'light' | 'dark' | null => camera.side(),
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
window.addEventListener('hashchange', () => {
  const code = roomCodeFromHash(location.hash);
  if (code && online.conn?.code !== code) void online.join(code);
});

render();
