// Sandbox: rules off, free placement and editing, validation and resume (FR-100…FR-104).
import { eq, inGrid, isBattlefield, squareName } from './board.ts';
import { clone, emit, fail, hero, RuleFailure, type Ctx } from './ctx.ts';
import { FAVORS, heroDefinition, RULES } from './data.ts';
import type { PendingDecision, PositionProblem, SandboxPath } from './model/actions.ts';
import { legalLeadsForUnit } from './check.ts';
import { isForbiddenEndSquare } from './heroes.ts';
import { leadOptionsForActiveHero } from './lead.ts';
import type { GameState } from './model/state.ts';
import { EPIC_DESTINIES, type Coord, type EpicDestiny, type FavorId, type HeroId, type Side, type UnitType } from './model/types.ts';
import { enemyRoyalRank } from './paths.ts';
import { freshTurnFlags, startFirstTurn } from './turn.ts';
import type { Hero } from './model/hero.ts';

/** Set a named hero's Epic form and the form's Movement (004 T066). */
function setForm(h: Hero, formId: string | null): void {
  const def = heroDefinition(h.definitionId);
  h.form = formId;
  const form = Object.values(def.forms ?? {}).find((f) => f.id === formId);
  h.movement = form?.stats?.movement ?? def.movement;
}

function sideName(side: Side): string {
  return side === 'light' ? 'Light' : 'Dark';
}

/** Position checks used when switching sandbox → rules (FR-103). */
export function validatePosition(state: GameState): PositionProblem[] {
  const problems: PositionProblem[] = [];
  for (const u of state.units) {
    if (!isBattlefield(u.pos)) {
      problems.push({ code: 'UNIT_OFF_BATTLEFIELD', message: `${u.id} is not on the Battlefield or in a Graveyard`, where: u.pos });
    }
    if (u.type === 'pawn' && u.kind === 'main' && u.originalType === 'pawn' && !u.promoted && u.pos.y === enemyRoyalRank(u.side)) {
      problems.push({ code: 'UNPROMOTED_PAWN', message: `${u.id} stands unpromoted on the enemy royal rank`, where: u.pos });
    }
  }
  // Squares with several units (002 FR-004, FR-010): friendly sharing up to the maximum is fine; hero figures don't count.
  const bySquare = new Map<string, GameState['units']>();
  for (const u of state.units) {
    const k = `${u.pos.x},${u.pos.y}`;
    bySquare.set(k, [...(bySquare.get(k) ?? []), u]);
  }
  for (const units of bySquare.values()) {
    const where = units[0].pos;
    const ids = [...units].sort((a, b) => (a.side === b.side ? a.id.localeCompare(b.id) : a.side === 'light' ? -1 : 1))
      .map((u) => u.id).join(', ');
    if (units.some((u) => u.type === 'king')) continue; // reported below as KING_SHARES
    if (units.some((u) => u.side === 'light') && units.some((u) => u.side === 'dark')) {
      problems.push({ code: 'OPPOSING_UNITS_SHARE', message: `Light and Dark units share ${squareName(where)} (${ids})`, where });
    }
    const heroUnit = units.find((u) => u.kind === 'hero');
    if (heroUnit && units.length > 1) {
      problems.push({ code: 'HERO_UNIT_SHARES', message: `Hero Unit ${heroUnit.id} shares ${squareName(where)} (${ids})`, where });
    }
    if (units.length > RULES.maxUnitsPerSquare) {
      problems.push({ code: 'TOO_MANY_UNITS', message: `${units.length} units on ${squareName(where)} (max ${RULES.maxUnitsPerSquare})`, where });
    }
  }
  for (const side of ['light', 'dark'] as const) {
    const kings = state.units.filter((u) => u.side === side && u.type === 'king');
    if (kings.length !== 1) problems.push({ code: 'KING_COUNT', message: `${sideName(side)} needs exactly one King` });
    for (const k of kings) {
      // King's Majesty: nothing shares the King's square, units or heroes.
      const others = [
        ...state.units.filter((u) => u.id !== k.id && eq(u.pos, k.pos)).map((u) => u.id),
        ...state.heroes.filter((h) => eq(h.pos, k.pos)).map((h) => h.id),
      ];
      if (others.length) {
        problems.push({ code: 'KING_SHARES', message: `${sideName(side)} King shares ${squareName(k.pos)} (${others.join(', ')})`, where: k.pos });
      }
    }
    if (state.destiny.common[side] < 0) problems.push({ code: 'NEGATIVE_POOL', message: `${sideName(side)} Common Pool is negative` });
    const r = state.tokens.revenge[side];
    if (r < 0 || r > RULES.revengeMax) problems.push({ code: 'REVENGE_COUNT', message: `${sideName(side)} holds ${r} Revenge tokens (max ${RULES.revengeMax})` });
  }
  for (const h of state.heroes) {
    if (!inGrid(h.pos)) problems.push({ code: 'HERO_OFF_BOARD', message: `${h.id} is not on the board` });
    if (h.health < 0 || h.health > h.maxHealth) problems.push({ code: 'BAD_HEALTH', message: `${h.id} health ${h.health} is outside 0…${h.maxHealth}` });
    if (h.pool < 0) problems.push({ code: 'NEGATIVE_POOL', message: `${h.id} pool is negative` });
  }
  return problems;
}

export function setEnforcement(ctx: Ctx, mode: 'rules' | 'sandbox', restart = false): void {
  const { s } = ctx;
  if (s.status === 'setup') fail('NOT_PLAYING', 'Start the game first', 'Sandbox');
  if (s.enforcement === mode) fail('ALREADY_IN_MODE', `Already in ${mode} mode`, 'Sandbox');
  if (mode === 'sandbox') {
    // 006 FR-006: keep the turn as it was, so turning rules back on can continue it.
    s.sandboxResume = s.status === 'playing'
      ? {
          turnNumber: s.turnNumber, activeHeroId: s.activeHeroId, phase: s.phase, turn: clone(s.turn),
          pendingDecision: clone(s.pendingDecision), decisionQueue: clone(s.decisionQueue),
        }
      : null;
    s.enforcement = 'sandbox';
    emit(ctx, { type: 'enforcementChanged', mode });
    return;
  }
  const problems = validatePosition(s);
  if (problems.length > 0) {
    throw new RuleFailure({ code: 'POSITION_INVALID', message: 'The position is not legal', rule: 'Sandbox', problems });
  }
  // Resume (FR-104): sandbox-moved units count as Led, en passant chances are gone.
  for (const u of s.units) {
    if (s.sandboxMoved.includes(u.id)) u.hasBeenLed = true;
    u.enPassantTarget = null;
  }
  s.sandboxMoved = [];
  s.status = 'playing';
  s.result = null;
  s.enforcement = 'rules';
  const resume = s.sandboxResume;
  s.sandboxResume = null;
  emit(ctx, { type: 'enforcementChanged', mode });
  if (!restart && resume && resume.turnNumber === s.turnNumber && resume.activeHeroId === s.activeHeroId) {
    continueTurn(ctx, resume);
    return;
  }
  // `restart` (position editor, test positions) or no matching resume point: play restarts at Before Turn (001).
  s.pendingDecision = null;
  s.decisionQueue = [];
  s.turn = freshTurnFlags();
  startFirstTurn(ctx);
}

/**
 * 006 FR-006 (data-model.md): put the saved turn back, then check what the sandbox may have changed: an announced
 * Lead whose unit moved, or that is no longer legal, is cancelled (its Inspired Lead bonus goes back); square
 * decisions keep only the squares still allowed; whether a Lead is possible is computed again. The turn's record of
 * "King in check at the end of the Lead" is kept as it was (Basic Rules *Check*).
 */
function continueTurn(ctx: Ctx, resume: NonNullable<GameState['sandboxResume']>): void {
  const { s } = ctx;
  s.phase = resume.phase;
  s.turn = resume.turn;
  s.pendingDecision = resume.pendingDecision;
  s.decisionQueue = resume.decisionQueue;
  const lead = s.turn.lead;
  if (lead && lead.success === null && !leadStillStands(s, lead)) {
    const bonus = lead.modifiers.filter((m) => m.source === 'inspiredLead').reduce((a, m) => a + m.value, 0);
    s.turn.lead = null;
    s.turn.leadAttempted = false;
    s.turn.inspiredLeadBonus += bonus;
  }
  const keep = (d: PendingDecision): PendingDecision | null => {
    if (d.type === 'advanceSquare' || d.type === 'unconsciousTavern') {
      const h = hero(s, d.heroId);
      const options = d.options.filter((p) => !isForbiddenEndSquare(s, h.side, p, h));
      return options.length ? { ...d, options } : null;
    }
    if (d.type === 'promotion') return s.units.some((u) => u.id === d.unitId && u.type === 'pawn') ? d : null;
    return d;
  };
  const decisions = [s.pendingDecision, ...s.decisionQueue].filter((d): d is PendingDecision => !!d).map(keep).filter((d): d is PendingDecision => !!d);
  s.pendingDecision = decisions.shift() ?? null;
  s.decisionQueue = decisions;
  if (s.phase === 'lead' && !s.turn.leadAttempted) s.turn.leadPossible = leadOptionsForActiveHero(s).length > 0;
}

/** The announced Lead's unit is still where the Lead began and the Lead is still legal. */
function leadStillStands(s: GameState, lead: NonNullable<GameState['turn']['lead']>): boolean {
  const unit = s.units.find((u) => u.id === lead.unitId);
  if (!unit || !eq(unit.pos, lead.from)) return false;
  if (lead.ability) return true; // an ability's own Lead (its path is the ability's)
  return legalLeadsForUnit(s, unit).some((o) => eq(o.to, lead.to));
}

/** In sandbox a piece may lie on the table beside the board: squares −6…15 (002 research R-05). */
export function onTable(p: Coord): boolean {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= -6 && p.x <= 15 && p.y >= -6 && p.y <= 15;
}

function requireSandbox(ctx: Ctx): void {
  if (ctx.s.enforcement !== 'sandbox') fail('NOT_IN_SANDBOX', 'Only in sandbox mode', 'Sandbox');
}

export function sandboxPlace(ctx: Ctx, target: { unitId?: string; heroId?: string }, to: Coord | 'graveyard'): void {
  requireSandbox(ctx);
  const { s } = ctx;
  if (target.heroId) {
    if (to === 'graveyard') fail('BAD_SQUARE', 'Heroes do not go to the Graveyard', 'Sandbox');
    if (!onTable(to)) fail('BAD_SQUARE', 'Off the table', 'Sandbox');
    const h = hero(s, target.heroId as HeroId);
    const from = h.pos;
    h.pos = to;
    const hu = h.heroUnitId ? s.units.find((u) => u.id === h.heroUnitId) : undefined;
    if (hu) hu.pos = { ...to }; // A Hero Unit and its hero move together.
    emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason: 'sandbox' });
    return;
  }
  const id = target.unitId;
  if (!id) fail('NO_TARGET', 'Choose a unit or hero', 'Sandbox');
  const onBoard = s.units.find((u) => u.id === id);
  const inGrave = s.graveyard.find((u) => u.id === id);
  if (!onBoard && !inGrave) fail('UNKNOWN_UNIT', 'Unknown unit', 'Sandbox');
  if (onBoard?.kind === 'hero') {
    const h = hero(s, onBoard.heroId!);
    if (to === 'graveyard') {
      s.units = s.units.filter((u) => u.id !== id);
      h.heroUnitId = null;
    } else {
      if (!onTable(to)) fail('BAD_SQUARE', 'Off the table', 'Sandbox');
      onBoard.pos = to;
      h.pos = { ...to };
    }
    emit(ctx, { type: 'sandboxEdited', what: 'place', target: id, value: to });
    return;
  }
  if (to === 'graveyard') {
    if (!onBoard) return;
    s.units = s.units.filter((u) => u.id !== id);
    if (onBoard.kind === 'main') s.graveyard.push(onBoard); // Auxiliary units leave play.
  } else {
    if (!onTable(to)) fail('BAD_SQUARE', 'Off the table', 'Sandbox');
    if (inGrave) {
      s.graveyard = s.graveyard.filter((u) => u.id !== id);
      s.units.push({ ...inGrave, pos: to });
    } else onBoard!.pos = to;
  }
  if (!s.sandboxMoved.includes(id)) s.sandboxMoved.push(id);
  emit(ctx, { type: 'sandboxEdited', what: 'place', target: id, value: to });
}

export function sandboxSet(
  ctx: Ctx,
  path: SandboxPath,
  target: string | undefined,
  value: number | string,
): void {
  requireSandbox(ctx);
  const { s } = ctx;
  const num = Number(value);
  switch (path) {
    case 'health':
    case 'pool': {
      const h = hero(s, target as HeroId);
      if (!Number.isFinite(num)) fail('BAD_VALUE', 'Enter a number', 'Sandbox');
      if (path === 'health') {
        h.health = num;
        h.status.unconscious = num === 0 ? h.status.unconscious : false;
      } else h.pool = num;
      break;
    }
    case 'common':
    case 'revenge': {
      if (target !== 'light' && target !== 'dark') fail('BAD_TARGET', 'Choose Light or Dark', 'Sandbox');
      if (!Number.isFinite(num)) fail('BAD_VALUE', 'Enter a number', 'Sandbox');
      if (path === 'common') s.destiny.common[target] = num;
      else s.tokens.revenge[target] = num;
      break;
    }
    case 'peaceTreaty':
      if (value !== 'peace' && value !== 'war' && value !== 'removed') fail('BAD_VALUE', 'peace, war or removed', 'Sandbox');
      s.tokens.peaceTreaty = value;
      break;
    case 'stage':
      setStage(ctx, value);
      break;
    case 'destiny': {
      const h = hero(s, target as HeroId);
      if (value === '') h.epic = null;
      else if (EPIC_DESTINIES.includes(value as EpicDestiny)) h.epic = { destiny: value as EpicDestiny };
      else fail('BAD_VALUE', 'fanatic, resolute, dominant or empty', 'Sandbox');
      // 004: a named hero takes the Epic form of the destiny (and its Movement).
      setForm(h, h.epic ? heroDefinition(h.definitionId).forms?.[h.epic.destiny]?.id ?? null : null);
      break;
    }
    case 'form': {
      // value: an Epic form id of the hero, or '' for the Starting Hero.
      const h = hero(s, target as HeroId);
      const forms = Object.values(heroDefinition(h.definitionId).forms ?? {});
      if (value !== '' && !forms.some((f) => f.id === value)) fail('BAD_VALUE', 'One of the hero’s Epic forms, or empty', 'Sandbox');
      setForm(h, value === '' ? null : String(value));
      break;
    }
    case 'uses': {
      // target "H1:monk.preaching"; value: uses left.
      const [heroId, abilityId] = (target ?? '').split(':');
      const h = hero(s, heroId as HeroId);
      if (!Number.isInteger(num) || num < 0) fail('BAD_VALUE', 'Enter a whole number', 'Sandbox');
      (s.abilityState[h.id] ??= { uses: {}, usedThisTurn: [] }).uses[abilityId] = num;
      break;
    }
    case 'removeEffect': {
      if (!s.effects.some((e) => e.id === num)) fail('BAD_VALUE', 'No such effect', 'Sandbox');
      s.effects = s.effects.filter((e) => e.id !== num);
      break;
    }
    case 'favor': {
      // target "light:overwhelm"; value: a progress number, "done" or "open".
      const [side, id] = (target ?? '').split(':') as [Side, FavorId];
      const def = FAVORS.favors.find((f) => f.id === id);
      if ((side !== 'light' && side !== 'dark') || !def) fail('BAD_TARGET', 'side:favorId', 'Sandbox');
      setFavor(s, side, def.id, value);
      break;
    }
    case 'kingsForces': {
      if (target !== 'light' && target !== 'dark') fail('BAD_TARGET', 'Choose Light or Dark', 'Sandbox');
      if (!Number.isInteger(num) || num < 0) fail('BAD_VALUE', 'Enter a whole number', 'Sandbox');
      s.royalFavors[target].kingsForces = num;
      break;
    }
    case 'heroUnit': {
      // value: "" to stop, or types like "knight" / "rook" / "rook,knight".
      const h = hero(s, target as HeroId);
      s.units = s.units.filter((u) => u.id !== h.heroUnitId);
      h.heroUnitId = null;
      const types = String(value).split(',').map((t) => t.trim()).filter(Boolean) as UnitType[];
      if (types.length) {
        const [type, ...extra] = types;
        const id = `HU-${h.id}`;
        s.units.push({
          id, side: h.side, type, originalType: type, kind: 'hero', heroId: h.id, ...(extra.length ? { extraTypes: extra } : {}),
          pos: { ...h.pos }, hasBeenLed: true, promoted: false, enPassantTarget: null,
        });
        h.heroUnitId = id;
      }
      break;
    }
    case 'well': {
      // Initial Destiny left in the Well; 0 means depleted (quickstart step 2).
      if (!Number.isInteger(num) || num < 0 || num > RULES.destiny.wellInitial) fail('BAD_VALUE', `0…${RULES.destiny.wellInitial}`, 'Sandbox');
      s.destiny.well.initialRemaining = num;
      s.destiny.well.depleted = num === 0;
      break;
    }
    default:
      fail('BAD_PATH', `Unknown sandbox value ${path}`, 'Sandbox');
  }
  emit(ctx, { type: 'sandboxEdited', what: path, target, value });
}

/** A roll by hand in sandbox: shown and logged, applied to nothing (US6-AS4). */
export function freeRoll(ctx: Ctx, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > RULES.die) fail('BAD_ROLL', `A roll is 1…${RULES.die}`, 'Sandbox');
  emit(ctx, { type: 'rolled', value, total: null, success: null });
}

/** Stage edit: Epic applies the Epic health (and removes the War token); Starting reverts both. */
function setStage(ctx: Ctx, value: number | string): void {
  const { s } = ctx;
  if (value !== 'starting' && value !== 'epic') fail('BAD_VALUE', 'starting or epic', 'Sandbox');
  if (s.stage === value) return;
  for (const h of s.heroes) {
    const def = heroDefinition(h.definitionId);
    const rise = def.epicMaxHealth - def.maxHealth;
    const sign = value === 'epic' ? 1 : -1;
    h.maxHealth += sign * rise;
    h.health = Math.max(0, Math.min(h.maxHealth, h.health + sign * rise));
    if (value === 'epic') h.epic ??= { destiny: 'resolute' };
    else h.epic = null;
  }
  s.stage = value;
  s.epicPending = false;
  if (value === 'epic') {
    s.tokens.peaceTreaty = 'removed';
    s.destiny.well.depleted = true;
    s.destiny.well.initialRemaining = 0;
  } else if (s.tokens.peaceTreaty === 'removed') s.tokens.peaceTreaty = 'war';
}

/** Set a Royal Favor's progress / done; the track is rebuilt in rulebook order with Tides entries. */
function setFavor(s: GameState, side: Side, id: FavorId, value: number | string): void {
  const rec = s.royalFavors[side];
  const def = FAVORS.favors.find((f) => f.id === id)!;
  const st = rec.status[id];
  if (id === 'tidesOfDestiny') {
    const n = value === 'done' ? def.repeat ?? 1 : value === 'open' ? 0 : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > (def.repeat ?? 1)) fail('BAD_VALUE', `0…${def.repeat}`, 'Sandbox');
    rec.tides = n;
    st.progress = n;
    st.done = n >= (def.repeat ?? 1);
  } else if (value === 'done' || value === 'open') {
    st.done = value === 'done';
    st.progress = st.done ? def.target ?? 1 : 0;
  } else {
    const n = Number(value);
    const target = def.target ?? 1;
    if (!Number.isInteger(n) || n < 0 || n > target) fail('BAD_VALUE', `0…${target}`, 'Sandbox');
    st.progress = n;
    st.done = n >= target;
  }
  // Keep the track's existing order for entries still done; append newly done ones in rulebook order.
  const count = (f: FavorId) => (f === 'tidesOfDestiny' ? rec.tides : rec.status[f].done ? 1 : 0);
  const kept: FavorId[] = [];
  const seen = new Map<FavorId, number>();
  for (const f of rec.track) {
    const n = (seen.get(f) ?? 0) + 1;
    if (n <= count(f)) {
      kept.push(f);
      seen.set(f, n);
    }
  }
  for (const f of [...FAVORS.favors].sort((a, b) => a.order - b.order)) {
    for (let n = seen.get(f.id) ?? 0; n < count(f.id); n++) kept.push(f.id);
  }
  rec.track = kept;
}
