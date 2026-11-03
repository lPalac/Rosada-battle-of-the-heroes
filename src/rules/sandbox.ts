// Sandbox: rules off, free placement and editing, validation and resume (FR-100…FR-104).
import { eq, inGrid, isBattlefield, squareName } from './board.ts';
import { emit, fail, hero, RuleFailure, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import type { PositionProblem } from './model/actions.ts';
import type { GameState } from './model/state.ts';
import type { Coord, HeroId, Side } from './model/types.ts';
import { enemyRoyalRank } from './paths.ts';
import { freshTurnFlags, startFirstTurn } from './turn.ts';

function sideName(side: Side): string {
  return side === 'light' ? 'Light' : 'Dark';
}

/** Position checks used when switching sandbox → rules (FR-103). */
export function validatePosition(state: GameState): PositionProblem[] {
  const problems: PositionProblem[] = [];
  const seen = new Map<string, string>();
  for (const u of state.units) {
    const k = `${u.pos.x},${u.pos.y}`;
    if (seen.has(k)) problems.push({ code: 'TWO_UNITS', message: `Two units on ${squareName(u.pos)}`, where: u.pos });
    seen.set(k, u.id);
    if (!isBattlefield(u.pos)) problems.push({ code: 'UNIT_OFF_BATTLEFIELD', message: `${u.id} is not on the Battlefield`, where: u.pos });
    if (u.type === 'pawn' && u.originalType === 'pawn' && !u.promoted && u.pos.y === enemyRoyalRank(u.side)) {
      problems.push({ code: 'UNPROMOTED_PAWN', message: `${u.id} stands unpromoted on the enemy royal rank`, where: u.pos });
    }
  }
  for (const side of ['light', 'dark'] as const) {
    const kings = state.units.filter((u) => u.side === side && u.type === 'king');
    if (kings.length !== 1) problems.push({ code: 'KING_COUNT', message: `${sideName(side)} needs exactly one King` });
    for (const k of kings) {
      const sharing = state.units.some((u) => u.id !== k.id && eq(u.pos, k.pos)) || state.heroes.some((h) => eq(h.pos, k.pos));
      if (sharing) problems.push({ code: 'KING_SHARES', message: `${sideName(side)} King shares a square`, where: k.pos });
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

export function setEnforcement(ctx: Ctx, mode: 'rules' | 'sandbox'): void {
  const { s } = ctx;
  if (s.status === 'setup') fail('NOT_PLAYING', 'Start the game first', 'Sandbox');
  if (s.enforcement === mode) fail('ALREADY_IN_MODE', `Already in ${mode} mode`, 'Sandbox');
  if (mode === 'sandbox') {
    s.enforcement = 'sandbox';
    emit(ctx, { type: 'enforcementChanged', mode });
    return;
  }
  const problems = validatePosition(s);
  if (problems.length > 0) {
    throw new RuleFailure({ code: 'POSITION_INVALID', message: 'The position is not legal', rule: 'Sandbox', problems });
  }
  // Resume (FR-104): sandbox-moved units count as Led, en passant chances are gone, play restarts at Before Turn.
  for (const u of s.units) {
    if (s.sandboxMoved.includes(u.id)) u.hasBeenLed = true;
    u.enPassantTarget = null;
  }
  s.sandboxMoved = [];
  s.pendingDecision = null;
  s.decisionQueue = [];
  s.status = 'playing';
  s.result = null;
  s.enforcement = 'rules';
  s.turn = freshTurnFlags();
  emit(ctx, { type: 'enforcementChanged', mode });
  startFirstTurn(ctx);
}

function requireSandbox(ctx: Ctx): void {
  if (ctx.s.enforcement !== 'sandbox') fail('NOT_IN_SANDBOX', 'Only in sandbox mode', 'Sandbox');
}

export function sandboxPlace(ctx: Ctx, target: { unitId?: string; heroId?: string }, to: Coord | 'graveyard'): void {
  requireSandbox(ctx);
  const { s } = ctx;
  if (target.heroId) {
    if (to === 'graveyard' || !inGrid(to)) fail('BAD_SQUARE', 'Heroes stay on the board', 'Sandbox');
    const h = hero(s, target.heroId as HeroId);
    const from = h.pos;
    h.pos = to;
    emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason: 'sandbox' });
    return;
  }
  const id = target.unitId;
  if (!id) fail('NO_TARGET', 'Choose a unit or hero', 'Sandbox');
  const onBoard = s.units.find((u) => u.id === id);
  const inGrave = s.graveyard.find((u) => u.id === id);
  if (!onBoard && !inGrave) fail('UNKNOWN_UNIT', 'Unknown unit', 'Sandbox');
  if (to === 'graveyard') {
    if (!onBoard) return;
    s.units = s.units.filter((u) => u.id !== id);
    s.graveyard.push(onBoard);
  } else {
    if (!inGrid(to)) fail('BAD_SQUARE', 'Off the board', 'Sandbox');
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
  path: 'health' | 'pool' | 'common' | 'revenge' | 'peaceTreaty',
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
      if (value !== 'peace' && value !== 'war') fail('BAD_VALUE', 'peace or war', 'Sandbox');
      s.tokens.peaceTreaty = value;
      break;
  }
  emit(ctx, { type: 'sandboxEdited', what: path, target, value });
}

/** A roll by hand in sandbox: shown and logged, applied to nothing (US6-AS4). */
export function freeRoll(ctx: Ctx, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > RULES.die) fail('BAD_ROLL', `A roll is 1…${RULES.die}`, 'Sandbox');
  emit(ctx, { type: 'rolled', value, total: null, success: null });
}
