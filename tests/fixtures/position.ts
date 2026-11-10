// Readable test positions (research R-13). A 10-line diagram, top line y = 9, left column x = 0:
// `K Q R B N P` Light, `k q r b n p` Dark, `1`–`4` heroes H1–H4, `.` empty. Square names: `e4`, `c0`, `<3` (x = 0),
// `>5` (x = 9), taverns `<0` `>0` `<9` `>9`.
import { act, newGame } from '../helpers/game.ts';
import { DATA } from '../../src/rules/data.ts';
import type { Effect } from '../../src/rules/model/state.ts';
import type { UnitTag } from '../../src/rules/model/unit.ts';
import {
  apply, type EpicDestiny, type FavorId, type GameState, type HeroId, type Phase, type RangeType, type Side, type UnitType,
} from '../../src/rules/index.ts';
import { parseSquare, squareName } from '../../src/rules/board.ts';

export interface PositionOptions {
  heroes?: Partial<Record<HeroId, string>>;
  ranges?: Partial<Record<HeroId, RangeType>>;
  health?: Partial<Record<HeroId, number>>;
  pools?: Partial<Record<HeroId, number>>;
  common?: Partial<Record<Side, number>>;
  peaceTreaty?: 'peace' | 'war' | 'removed';
  revenge?: Partial<Record<Side, number>>;
  wellRemaining?: number;
  active?: HeroId;
  /** Movement penalties waiting for each hero's next Beginning of Turn (e.g. King's Banishment). */
  movementPenalty?: Partial<Record<HeroId, number>>;
  /** Squares of units that count as already Led (no castling with them). */
  led?: string[];
  /** Advance with endPhase until this phase (default: the first resting phase, usually `move`). */
  phase?: Phase;
  // 003
  /** `epic`: Epic health, War token removed, Well depleted; destinies from `epic` (default resolute). */
  stage?: 'starting' | 'epic';
  epic?: Partial<Record<HeroId, EpicDestiny>>;
  /** Completed Royal Favors per side, in track order (repeat `tidesOfDestiny` for several Tides). */
  royalFavors?: Partial<Record<Side, FavorId[]>>;
  kingsForces?: Partial<Record<Side, number>>;
  /** Heroes that are Hero Units, with their types (`['knight']`, `['rook', 'knight']`). */
  heroUnits?: Partial<Record<HeroId, UnitType[]>>;
  /** Squares whose units are auxiliary. */
  auxiliary?: string[];
  // 004
  /** Named hero per hero slot (`cavalier`, `monk`, `scout`, `magus`); stats come from heroes.json. */
  heroDefs?: Partial<Record<HeroId, string>>;
  /** Uses left per hero and ability id. */
  uses?: Partial<Record<HeroId, Record<string, number>>>;
  /** Effects placed before the game resumes (ids are assigned). */
  effects?: Omit<Effect, 'id'>[];
  /** Tags per unit square (`{ d4: ['undead'] }`). */
  tags?: Record<string, UnitTag[]>;
}

const TYPES: Record<string, UnitType> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

export const sq = parseSquare;
export const name = squareName;

export function position(diagram: string, opts: PositionOptions = {}): GameState {
  const rows = diagram.split('\n').map((l) => l.replace(/\s+/g, '')).filter((l) => l.length > 0);
  if (rows.length !== 10 || rows.some((r) => r.length !== 10)) throw new Error('Diagram must be 10 lines of 10 squares');
  let s = act(newGame(), { type: 'setEnforcement', mode: 'sandbox' }).state;
  s = structuredClone(s);
  s.units = [];
  s.graveyard = [];
  const heroPos: Partial<Record<HeroId, { x: number; y: number }>> = {};
  rows.forEach((row, i) => {
    const y = 9 - i;
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if ('1234'.includes(ch)) {
        heroPos[`H${ch}` as HeroId] = { x, y };
        return;
      }
      const type = TYPES[ch.toLowerCase()];
      if (!type) throw new Error(`Unknown diagram character ${ch}`);
      const side: Side = ch === ch.toUpperCase() ? 'light' : 'dark';
      const id = `${side === 'light' ? 'L' : 'D'}-${ch.toUpperCase()}@${squareName({ x, y })}`;
      s.units.push({ id, side, type, originalType: type, kind: 'main', pos: { x, y }, hasBeenLed: false, promoted: false, enPassantTarget: null });
    });
  });
  for (const [id, square] of Object.entries(opts.heroes ?? {})) heroPos[id as HeroId] = parseSquare(square!);
  for (const h of s.heroes) {
    const range = opts.ranges?.[h.id];
    if (range) {
      const def = DATA.heroes.find((d) => d.rangeType === range)!;
      Object.assign(h, {
        rangeType: def.rangeType, movement: def.movement, range: def.range, maxHealth: def.maxHealth,
        health: def.maxHealth, healthBarId: def.healthBar, definitionId: def.id,
      });
    }
    const named = opts.heroDefs?.[h.id];
    if (named) {
      const def = DATA.heroes.find((d) => d.id === named)!;
      Object.assign(h, {
        rangeType: def.rangeType, movement: def.movement, range: def.range, maxHealth: def.maxHealth,
        health: def.maxHealth, healthBarId: def.healthBar, definitionId: def.id, heroUnitType: def.heroUnitType, art: def.art,
      });
    }
    if (heroPos[h.id]) h.pos = heroPos[h.id]!;
    if (opts.stage === 'epic') {
      const def = DATA.heroes.find((d) => d.id === h.definitionId)!;
      h.maxHealth = def.epicMaxHealth;
      h.health = def.epicMaxHealth;
      h.epic = { destiny: opts.epic?.[h.id] ?? 'resolute' };
      const form = def.forms?.[h.epic.destiny];
      if (form) {
        h.form = form.id;
        if (form.stats?.movement) h.movement = form.stats.movement;
      }
    }
    if (opts.uses?.[h.id]) s.abilityState[h.id] = { uses: { ...opts.uses[h.id] }, usedThisTurn: [] };
    if (opts.health?.[h.id] !== undefined) h.health = opts.health[h.id]!;
    if (opts.pools?.[h.id] !== undefined) h.pool = opts.pools[h.id]!;
    if (opts.movementPenalty?.[h.id] !== undefined) h.status.movementPenaltyNextTurn = opts.movementPenalty[h.id]!;
  }
  for (const u of s.units) if (opts.led?.includes(squareName(u.pos))) u.hasBeenLed = true;
  for (const u of s.units) if (opts.auxiliary?.includes(squareName(u.pos))) u.kind = 'auxiliary';
  for (const u of s.units) {
    const tags = opts.tags?.[squareName(u.pos)];
    if (tags) u.tags = [...tags];
  }
  for (const e of opts.effects ?? []) s.effects.push({ ...structuredClone(e), id: s.nextEffectId++ });
  if (opts.stage === 'epic') {
    s.stage = 'epic';
    s.tokens.peaceTreaty = 'removed';
    s.destiny.well.initialRemaining = 0;
    s.destiny.well.depleted = true;
  }
  for (const side of ['light', 'dark'] as const) {
    const rec = s.royalFavors[side];
    for (const id of opts.royalFavors?.[side] ?? []) {
      const def = DATA.favors.favors.find((f) => f.id === id)!;
      rec.track.push(id);
      if (id === 'tidesOfDestiny') {
        rec.tides += 1;
        rec.status[id].progress = rec.tides;
        rec.status[id].done = rec.tides >= (def.repeat ?? 1);
      } else rec.status[id] = { progress: def.target ?? 1, done: true };
    }
    if (opts.kingsForces?.[side] !== undefined) rec.kingsForces = opts.kingsForces[side]!;
  }
  for (const [id, types] of Object.entries(opts.heroUnits ?? {})) {
    const h = s.heroes.find((x) => x.id === id)!;
    const [type, ...extra] = types!;
    s.units.push({
      id: `HU-${h.id}`, side: h.side, type, originalType: type, kind: 'hero', heroId: h.id,
      ...(extra.length ? { extraTypes: extra } : {}), pos: { ...h.pos }, hasBeenLed: true, promoted: false, enPassantTarget: null,
    });
    h.heroUnitId = `HU-${h.id}`;
  }
  if (opts.common) Object.assign(s.destiny.common, opts.common);
  if (opts.revenge) Object.assign(s.tokens.revenge, opts.revenge);
  if (opts.peaceTreaty) s.tokens.peaceTreaty = opts.peaceTreaty;
  if (opts.wellRemaining !== undefined) s.destiny.well.initialRemaining = opts.wellRemaining;
  if (opts.active) {
    s.activeHeroId = opts.active;
    s.turnNumber = s.heroes.find((h) => h.id === opts.active)!.turnOrder;
  }
  s.log = [];
  const r = apply(s, { type: 'setEnforcement', mode: 'rules' });
  if (!r.ok) throw new Error(`Fixture position is not legal: ${r.error.problems?.map((p) => p.message).join('; ') ?? r.error.message}`);
  s = r.state;
  if (opts.phase) s = toPhase(s, opts.phase);
  return s;
}

/** Build the diagram from a square → piece map, e.g. `{ e1: 'K', e8: 'k', c0: '1' }`. */
export function diagramOf(pieces: Record<string, string>): string {
  const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => '.'));
  for (const [square, ch] of Object.entries(pieces)) {
    const p = parseSquare(square);
    grid[9 - p.y][p.x] = ch;
  }
  return grid.map((r) => r.join('')).join('\n');
}

/** Position from a square → piece map (Kings default to e1 / e8 unless given). */
export function board(pieces: Record<string, string>, opts: PositionOptions = {}): GameState {
  const hasKing = (k: string) => Object.values(pieces).includes(k);
  const all = { ...(hasKing('K') ? {} : { e1: 'K' }), ...(hasKing('k') ? {} : { e8: 'k' }), ...pieces };
  return position(diagramOf(all), opts);
}

/** Press End phase until the given phase is reached. */
export function toPhase(state: GameState, phase: Phase): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.phase !== phase && s.status === 'playing'; i++) s = act(s, { type: 'endPhase' }).state;
  if (s.phase !== phase) throw new Error(`Could not reach ${phase} (at ${s.phase})`);
  return s;
}

export function unitOn(state: GameState, square: string) {
  const p = parseSquare(square);
  return state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
}

/** The standard starting units as a square → piece map. */
export const START: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const back = 'RNBQKBNR';
  [...'abcdefgh'].forEach((f, i) => {
    out[`${f}1`] = back[i];
    out[`${f}2`] = 'P';
    out[`${f}7`] = 'p';
    out[`${f}8`] = back[i].toLowerCase();
  });
  return out;
})();

/** Empty 10×10 board with both Kings on their starting squares. */
export const EMPTY_WITH_KINGS = `
..........
.....k....
..........
..........
..........
..........
..........
..........
.....K....
..........`;
