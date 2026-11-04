// Static data loading. JSON is imported (no `fs`), so this runs in Node and the browser.
import boardJson from '../data/board.json';
import unitsJson from '../data/units.json';
import heroesJson from '../data/heroes.json';
import healthbarsJson from '../data/healthbars.json';
import rulesJson from '../data/rules.json';
import favorsJson from '../data/royal-favors.json';
import type { FavorId, PowerId, RangeType, Side, UnitType } from './model/types.ts';

export type { FavorId, PowerId };

export interface HeroDefinition {
  id: string;
  name: string;
  rangeType: RangeType;
  movement: number;
  range: number;
  maxHealth: number;
  epicMaxHealth: number;
  healthBar: string;
  abilities: string[];
  art: string;
  heroUnitType: UnitType;
  portrait: string;
  epicArt: string;
}


export interface FavorDefinition {
  id: FavorId;
  order: number;
  kind: 'once' | 'half' | 'count';
  target?: number;
  repeat?: number;
}

export interface FavorsData {
  favors: FavorDefinition[];
  powers: { id: PowerId; threshold: number }[];
}

export interface HealthBar {
  id: string;
  max: number;
  startingMax: number;
  resilientPoints: number[];
}

export interface BoardData {
  size: number;
  battlefield: { x: [number, number]; y: [number, number] };
  kingsCourt: Record<Side, number>;
  taverns: { at: [number, number]; owner: Side }[];
  /** Index 0 = behind the c-file Bishop, 1 = behind the f-file Bishop. */
  heroStartSquares: Record<Side, [number, number][]>;
}

export interface UnitsData {
  types: Record<UnitType, { directions?: string; maxSteps?: number; jump?: boolean; royal?: boolean; special?: string }>;
  start: Record<Side, { rank: number; pawnRank: number; order: UnitType[] }>;
  promotion: UnitType[];
}

export interface RulesData {
  leadTarget: number;
  die: number;
  modifiers: { war: number; kingInCheck: number; inspiredLeadPerDestiny: number };
  ramWounds: number;
  tavern: {
    drink: { cost: number; heal: number };
    meal: { cost: number; heal: number };
    startTurnMovementPenalty: number;
  };
  maxMovementReduction: number;
  revengeMax: number;
  maxUnitsPerSquare: number;
  banishmentMovementPenalty: number;
  destiny: {
    wellInitial: number;
    heroPoolStart: number;
    check: number;
    destroyEnemy: number;
    ownUnitLost: number;
    woundEnemyHero: number;
    failedLead: number;
  };
  abilities: { heroRetreat: { cost: number } };
  heroUnit: { range: number; farReachRange: number; selfLeadBonus: number; destroyedWounds: number };
  generation: { base: number };
  favors: {
    destinedForGreatness: number;
    greatIncursionUnits: number;
    greatIncursionRanks: number;
    deployTroopsMax: number;
    decimate: number;
    offenseAttackers: number;
    royalsFury: number;
  };
}

export interface StaticData {
  board: BoardData;
  units: UnitsData;
  heroes: HeroDefinition[];
  healthbars: HealthBar[];
  rules: RulesData;
  favors: FavorsData;
}

export function loadStaticData(): StaticData {
  return {
    board: boardJson as unknown as BoardData,
    units: unitsJson as unknown as UnitsData,
    heroes: (heroesJson as unknown as { heroes: HeroDefinition[] }).heroes,
    healthbars: (healthbarsJson as unknown as { bars: HealthBar[] }).bars,
    rules: rulesJson as unknown as RulesData,
    favors: favorsJson as unknown as FavorsData,
  };
}

/** The data every rules module reads. Tunables live here, never as literals in code (constitution III). */
export const DATA: StaticData = loadStaticData();
export const RULES: RulesData = DATA.rules;
export const FAVORS: FavorsData = DATA.favors;

export function heroDefinition(id: string): HeroDefinition {
  const def = DATA.heroes.find((h) => h.id === id);
  if (!def) throw new Error(`Unknown hero definition ${id}`);
  return def;
}

export function heroDefinitionFor(rangeType: RangeType): HeroDefinition {
  const def = DATA.heroes.find((h) => h.rangeType === rangeType);
  if (!def) throw new Error(`No hero definition for range type ${rangeType}`);
  return def;
}

export function healthBar(id: string): HealthBar {
  const bar = DATA.healthbars.find((b) => b.id === id);
  if (!bar) throw new Error(`Unknown health bar ${id}`);
  return bar;
}
