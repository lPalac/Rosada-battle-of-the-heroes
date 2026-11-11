// Setup flow: Draft/Mirror picks, per-side turn order and start squares (FR-080…FR-083, rulebook *Setup*),
// then the starting position (rulebook *Setup*, FR-002).
import { c, heroStartSquares } from './board.ts';
import { emit, fail, type Ctx } from './ctx.ts';
import { DATA, heroDefinition, heroDefinitionFor, type HeroDefinition, type StaticData } from './data.ts';
import type { Hero } from './model/hero.ts';
import type { GameState, Pick, Player, SetupChoices } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import type { HeroId, RangeType, Side, UnitType } from './model/types.ts';
import { emptyFavorRecord } from './royal-favors.ts';
import { freshTurnFlags } from './turn.ts';

/** 2: 003 fields (stage, Royal Favors, Hero Units). 3: 006 (sandbox resume point, Move start, per-side check
 * Destiny, Epic `appliesTo`; Starting abilities cost Destiny). Older saves are migrated on load. */
export const STATE_VERSION = 3;

const LETTER: Record<UnitType, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
const FILES = 'abcdefgh';

export interface SetupOptions {
  mode: 'draft' | 'mirror';
  playerCount: 2 | 3 | 4;
  players?: Player[];
  /** For 3 players: the side with one player (default Light). */
  singleSide?: Side;
}

export function defaultPlayers(count: 2 | 3 | 4, singleSide: Side = 'light'): Player[] {
  const sides: Side[] =
    count === 2 ? ['light', 'dark'] :
    count === 4 ? ['light', 'dark', 'light', 'dark'] :
    singleSide === 'light' ? ['light', 'dark', 'dark'] : ['light', 'dark', 'light'];
  return sides.map((side, i) => ({ id: `P${i + 1}`, name: `Player ${i + 1}`, side }));
}

function emptyBoardState(setup: SetupChoices): GameState {
  return {
    version: STATE_VERSION, setup, status: 'setup', enforcement: 'rules', turnNumber: 0, activeHeroId: 'H1',
    phase: 'beforeTurn', turn: freshTurnFlags(), units: [], graveyard: [], heroes: [],
    destiny: { well: { initialRemaining: DATA.rules.destiny.wellInitial, depleted: false, depletedBy: null }, common: { light: 0, dark: 0 }, entries: [] },
    tokens: { peaceTreaty: 'peace', revenge: { light: 0, dark: 0 } },
    stage: 'starting', epicPending: false, royalFavors: { light: emptyFavorRecord(), dark: emptyFavorRecord() },
    pendingDecision: null, decisionQueue: [], result: null, sandboxMoved: [], sandboxResume: null, log: [],
    effects: [], abilityState: {}, nextEffectId: 1,
  };
}

export function createSetup(options: SetupOptions): GameState {
  const players = options.players ?? defaultPlayers(options.playerCount, options.singleSide);
  if (players.length !== options.playerCount) throw new Error('Player list does not match the player count');
  for (const side of ['light', 'dark'] as const) {
    const n = players.filter((p) => p.side === side).length;
    if (n < 1 || n > 2) throw new Error('Each side needs one or two players');
  }
  return emptyBoardState({
    mode: options.mode, playerCount: options.playerCount, players, picks: [],
    turnOrder: { light: null, dark: null }, startFiles: {},
  });
}

/** Whose pick is next: Draft L, D, D, L; Mirror L (hero 1 for both), D (hero 2 for both) (FR-081). */
export function nextPicker(setup: SetupChoices): Side | null {
  if (setup.mode === 'draft') return (['light', 'dark', 'dark', 'light'] as Side[])[setup.picks.length] ?? null;
  return (['light', 'light', 'dark', 'dark'] as Side[])[setup.picks.length] ?? null;
}

export function picksComplete(setup: SetupChoices): boolean {
  return setup.picks.length === 4;
}

function requireSetup(ctx: Ctx): SetupChoices {
  if (ctx.s.status !== 'setup') fail('NOT_IN_SETUP', 'The game has already started', 'Setup');
  return ctx.s.setup;
}

/** Named heroes offered in setup (spec Q-42: the generic heroes are not). */
export function selectableHeroes(): HeroDefinition[] {
  return DATA.heroes.filter((h) => h.selectable);
}

/** Named heroes still free for a pick: Draft offers each hero once, Mirror any (spec Q-41). */
export function pickableHeroes(setup: SetupChoices): HeroDefinition[] {
  return selectableHeroes().filter((h) => setup.mode === 'mirror' || !setup.picks.some((p) => p.heroDefinitionId === h.id));
}

export function pickHero(ctx: Ctx, side: Side, rangeType?: RangeType, heroDefinitionId?: string): void {
  const setup = requireSetup(ctx);
  const picker = nextPicker(setup);
  if (!picker) fail('PICKS_DONE', 'All heroes are picked', 'Setup');
  if (picker !== side) fail('NOT_YOUR_PICK', `It is ${picker}'s pick`, 'Setup');
  let defId: string | undefined;
  if (heroDefinitionId) {
    if (!DATA.heroes.some((h) => h.id === heroDefinitionId)) fail('UNKNOWN_HERO', 'Unknown hero', 'Setup');
    if (setup.mode === 'draft' && setup.picks.some((p) => p.heroDefinitionId === heroDefinitionId)) {
      fail('HERO_TAKEN', 'In Draft each hero can be picked once', 'Setup');
    }
    defId = heroDefinitionId;
    rangeType = heroDefinition(heroDefinitionId).rangeType;
  }
  if (!rangeType) fail('UNKNOWN_HERO', 'Pick a hero', 'Setup');
  const extra = defId ? { heroDefinitionId: defId } : {};
  if (setup.mode === 'mirror') {
    // One pick fills the same hero slot for both sides.
    setup.picks.push({ side: 'light', rangeType, pickIndex: setup.picks.length, ...extra });
    setup.picks.push({ side: 'dark', rangeType, pickIndex: setup.picks.length, ...extra });
  } else {
    setup.picks.push({ side, rangeType, pickIndex: setup.picks.length, ...extra });
  }
  emit(ctx, { type: 'setupChanged' });
}

export function sidePicks(setup: SetupChoices, side: Side): Pick[] {
  return setup.picks.filter((p) => p.side === side);
}

/** Light decides first which of its heroes plays first, then Dark (FR-082). */
export function setTurnOrder(ctx: Ctx, side: Side, first: number): void {
  const setup = requireSetup(ctx);
  if (!picksComplete(setup)) fail('PICKS_NOT_DONE', 'Pick all heroes first', 'Setup');
  if (side === 'dark' && !setup.turnOrder.light) fail('LIGHT_FIRST', 'Light decides its turn order first', 'Turn Order');
  const mine = sidePicks(setup, side);
  if (!mine.some((p) => p.pickIndex === first)) fail('NOT_YOUR_HERO', 'Choose one of your side’s heroes', 'Turn Order');
  setup.turnOrder[side] = [first, mine.find((p) => p.pickIndex !== first)!.pickIndex];
  emit(ctx, { type: 'setupChanged' });
}

/** Each side chooses which hero starts behind which Bishop; the other hero takes the other file (FR-083). */
export function setStartFile(ctx: Ctx, pickIndex: number, file: 'c' | 'f'): void {
  const setup = requireSetup(ctx);
  if (!picksComplete(setup)) fail('PICKS_NOT_DONE', 'Pick all heroes first', 'Setup');
  const pick = setup.picks.find((p) => p.pickIndex === pickIndex);
  if (!pick) fail('UNKNOWN_HERO', 'Unknown hero', 'Setup');
  const other = sidePicks(setup, pick.side).find((p) => p.pickIndex !== pickIndex)!;
  setup.startFiles[String(pickIndex)] = file;
  setup.startFiles[String(other.pickIndex)] = file === 'c' ? 'f' : 'c';
  emit(ctx, { type: 'setupChanged' });
}

export function setupReady(setup: SetupChoices): boolean {
  return (
    picksComplete(setup) && !!setup.turnOrder.light && !!setup.turnOrder.dark &&
    setup.picks.every((p) => setup.startFiles[String(p.pickIndex)])
  );
}

/** Player controlling a hero slot: a side's single player controls both heroes (FR-080). */
function playerFor(setup: SetupChoices, pick: Pick): Player {
  const players = setup.players.filter((p) => p.side === pick.side);
  const slot = sidePicks(setup, pick.side).findIndex((p) => p.pickIndex === pick.pickIndex);
  return players[Math.min(slot, players.length - 1)];
}

function startingUnits(data: StaticData): Unit[] {
  const units: Unit[] = [];
  for (const side of ['light', 'dark'] as const) {
    const start = data.units.start[side];
    const s = side === 'light' ? 'L' : 'D';
    start.order.forEach((type, i) => {
      units.push(newUnit(`${s}-${LETTER[type]}-${FILES[i]}`, side, type, c(i + 1, start.rank)));
      units.push(newUnit(`${s}-P-${FILES[i]}`, side, 'pawn', c(i + 1, start.pawnRank)));
    });
  }
  return units;
}

function newUnit(id: string, side: Side, type: UnitType, pos: Unit['pos']): Unit {
  return { id, side, type, originalType: type, kind: 'main', pos, hasBeenLed: false, promoted: false, enPassantTarget: null };
}

/** Starting position from completed setup choices (US1-AS4). Turn 1 starts at *Before Turn*. */
export function createGameState(setup: SetupChoices, data: StaticData = DATA): GameState {
  if (!setupReady(setup)) throw new Error('Setup is not complete');
  const state = emptyBoardState(JSON.parse(JSON.stringify(setup)) as SetupChoices);
  state.units = startingUnits(data);
  const heroes: Hero[] = [];
  for (const side of ['light', 'dark'] as const) {
    const order = setup.turnOrder[side]!;
    const starts = heroStartSquares(side);
    order.forEach((pickIndex, i) => {
      const pick = setup.picks.find((p) => p.pickIndex === pickIndex)!;
      const turnOrder = side === 'light' ? 1 + 2 * i : 2 + 2 * i;
      const def = pick.heroDefinitionId ? heroDefinition(pick.heroDefinitionId) : heroDefinitionFor(pick.rangeType);
      const startSquare = setup.startFiles[String(pickIndex)] === 'c' ? starts[0] : starts[1];
      heroes.push({
        id: `H${turnOrder}` as HeroId, side, turnOrder, playerId: playerFor(setup, pick).id, definitionId: def.id,
        rangeType: def.rangeType, movement: def.movement, range: def.range, maxHealth: def.maxHealth,
        health: def.maxHealth, healthBarId: def.healthBar, pos: { ...startSquare }, startSquare: { ...startSquare },
        pool: data.rules.destiny.heroPoolStart,
        status: { unconscious: false, skipNextTurn: false, recoverAtBeginningOfTurn: false, movementPenaltyNextTurn: 0 },
        rammedBy: null, art: def.art, epic: null, heroUnitId: null, heroUnitType: def.heroUnitType, form: null,
      });
    });
  }
  state.heroes = heroes.sort((a, b) => a.turnOrder - b.turnOrder);
  state.status = 'playing';
  state.turnNumber = 1;
  state.activeHeroId = 'H1';
  return state;
}
