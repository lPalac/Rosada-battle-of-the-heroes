// The ability engine (004 research R-01, R-03): offers, validation, payment, uses, once per turn, timing windows.
// One validation path for legalActions, the UI and tests: `useAbility` is legal exactly when `abilityOffers` lists it
// (guarantee 13).
import { abilitiesBlocked } from '../abilities.ts';
import { activeHero, clone, emit, fail, hero, RuleFailure, type Ctx } from '../ctx.ts';
import { abilityDefinition, type AbilityDefinition, type Timing } from '../data.ts';
import { available, spend } from '../destiny.ts';
import { heroIsBloodied } from '../generation.ts';
import { awaitingRoll } from '../lead.ts';
import type { AbilityTarget, Payment } from '../model/actions.ts';
import type { Hero } from '../model/hero.ts';
import type { GameState } from '../model/state.ts';
import { otherSide, type HeroId } from '../model/types.ts';
import { flipToWar } from '../tokens.ts';
import { REGISTRY } from '../heroes/index.ts';
import { heroAbilityIds } from './hooks.ts';
import { newCheck } from './targets.ts';
import type { AbilityCall, AbilityImpl } from './types.ts';

export interface AbilityOffer {
  heroId: HeroId;
  abilityId: string;
  option?: string;
  cost: number;
  /** Uses left for limited abilities, else null. */
  usesLeft: number | null;
  /** Every legal target choice (`[]` inside means "no target"). */
  targets: AbilityTarget[][];
}

/** Timing windows open now for the active hero (research R-03). After Lead / End of Turn follow FR-042 blocking. */
export function openTimings(s: GameState): Timing[] {
  if (s.status !== 'playing' || s.enforcement !== 'rules' || s.pendingDecision) return [];
  switch (s.phase) {
    case 'beforeTurn': return ['beforeTurn'];
    case 'beginningOfTurn': return ['beginningOfTurn'];
    case 'beforeMove': return ['beforeMove'];
    case 'move': return ['duringMove'];
    case 'beforeLead': return ['beforeLead'];
    case 'lead': return !s.turn.leadAttempted && !awaitingRoll(s) ? ['insteadOfLead', 'duringLead'] : [];
    case 'afterLead': return abilitiesBlocked(s) ? [] : ['afterLead'];
    case 'endOfTurn': return abilitiesBlocked(s) ? [] : ['endOfTurn'];
  }
}

export function call(s: GameState, h: Hero, def: AbilityDefinition, option?: string): AbilityCall {
  const bloodied = heroIsBloodied(s, h);
  return {
    s, h, def, option, bloodied,
    v(key: string): number {
      const val = def.values[key];
      if (val === undefined) throw new Error(`${def.id}: no value ${key}`);
      return Array.isArray(val) ? val[bloodied ? 1 : 0] : val;
    },
  };
}

/** Destiny to pay now: normal or Bloodied cost (guarantee 16). */
export function abilityCost(state: GameState, heroId: HeroId, abilityId: string): number {
  const def = abilityDefinition(abilityId);
  if (!def.cost) return 0;
  return heroIsBloodied(state, hero(state, heroId)) ? def.cost.bloodied : def.cost.normal;
}

export function usesLeft(s: GameState, heroId: HeroId, abilityId: string): number | null {
  const def = abilityDefinition(abilityId);
  if (def.uses === null) return null;
  return s.abilityState[heroId]?.uses[abilityId] ?? def.uses;
}

function impl(id: string): AbilityImpl | undefined {
  return REGISTRY().impls[id];
}

/** Why the hero cannot use the ability now (ignoring targets), or null. */
function blocker(s: GameState, h: Hero, def: AbilityDefinition, timings: Timing[]): string | null {
  if (def.kind !== 'action') return 'ABILITY_WRONG_TIMING';
  const left = usesLeft(s, h.id, def.id);
  if (left !== null && left <= 0) return 'ABILITY_NO_USES';
  if (def.oncePerTurn && s.abilityState[h.id]?.usedThisTurn.includes(def.id)) return 'ABILITY_USED_THIS_TURN';
  if (def.flags.notAsHeroUnit && h.heroUnitId) return 'ABILITY_NOT_AS_HERO_UNIT';
  if (!def.timings.some((t) => timings.includes(t))) return 'ABILITY_WRONG_TIMING';
  if (h.status.unconscious) return 'ABILITY_WRONG_TIMING';
  if (available({ s, events: [] }, h) < abilityCost(s, h.id, def.id)) return 'NOT_ENOUGH_DESTINY';
  return null;
}

/** Run an ability on a copy; true when it is accepted (used for `simulate` abilities and Must not check). */
function accepted(s: GameState, h: Hero, def: AbilityDefinition, option: string | undefined, targets: AbilityTarget[]): boolean {
  const { log, ...rest } = s;
  const copy = clone(rest) as GameState;
  copy.log = [];
  try {
    runEffect({ s: copy, events: [] }, copy.heroes.find((x) => x.id === h.id)!, def, option, targets);
    return true;
  } catch (e) {
    if (e instanceof RuleFailure) return false;
    throw e;
  }
}

function runEffect(ctx: Ctx, h: Hero, def: AbilityDefinition, option: string | undefined, targets: AbilityTarget[]): void {
  const before = { units: ctx.s.units.map((u) => ({ ...u, pos: { ...u.pos } })) };
  impl(def.id)!.effect(ctx, call(ctx.s, h, def, option), targets);
  if (def.flags.mustNotCheck) {
    for (const side of [otherSide(h.side), h.side]) {
      if (newCheck(before, ctx.s, side)) fail('ABILITY_WOULD_CHECK', 'This ability must not check the King', 'Must Not Check the King');
    }
  }
}

function optionsOf(def: AbilityDefinition): (string | undefined)[] {
  return def.options?.length ? def.options : [undefined];
}

/** Every ability the active hero can use now, with its target choices (contracts/rules-api-changes.md). */
export function abilityOffers(s: GameState, opts: { first?: boolean } = {}): AbilityOffer[] {
  const timings = openTimings(s);
  if (!timings.length) return [];
  const h = activeHero(s);
  const out: AbilityOffer[] = [];
  for (const id of heroAbilityIds(h)) {
    const def = abilityDefinition(id);
    const im = impl(id);
    if (!im || blocker(s, h, def, timings)) continue;
    for (const option of optionsOf(def)) {
      const c = call(s, h, def, option);
      if (im.condition && !im.condition(c)) continue;
      let targets = im.targets ? im.targets(c) : [[]];
      if (im.simulate || def.flags.mustNotCheck) targets = targets.filter((t) => accepted(s, h, def, option, t));
      if (!targets.length) continue;
      out.push({ heroId: h.id, abilityId: id, ...(option ? { option } : {}), cost: abilityCost(s, h.id, id), usesLeft: usesLeft(s, h.id, id), targets });
      if (opts.first) return out;
    }
  }
  return out;
}

/** 006 FR-004: why an ability of the active hero is or is not usable now. */
export type AbilityStatus =
  | { abilityId: string; usable: true }
  | { abilityId: string; usable: false; reason: AbilityStatusReason; hint?: string };
export type AbilityStatusReason = 'timing' | 'noUses' | 'usedThisTurn' | 'notEnoughDestiny' | 'notAsHeroUnit' | 'noTarget' | 'wouldCheck';

const STATUS_OF_BLOCKER: Record<string, AbilityStatusReason> = {
  ABILITY_WRONG_TIMING: 'timing', ABILITY_NO_USES: 'noUses', ABILITY_USED_THIS_TURN: 'usedThisTurn',
  ABILITY_NOT_AS_HERO_UNIT: 'notAsHeroUnit', NOT_ENOUGH_DESTINY: 'notEnoughDestiny',
};

/**
 * Every action ability of the active hero, usable now or the reason it is not (contracts/rules-api-changes.md).
 * `usable` is true exactly for the abilities `abilityOffers` lists (guarantee 21). Passives and reactions have no
 * Use button and no status. Never changes the state.
 */
export function abilityStatus(s: GameState): AbilityStatus[] {
  if (s.status !== 'playing' || s.enforcement !== 'rules') return [];
  const h = activeHero(s);
  const timings = openTimings(s);
  const offered = new Set(abilityOffers(s).map((o) => o.abilityId));
  const out: AbilityStatus[] = [];
  for (const id of heroAbilityIds(h)) {
    const def = abilityDefinition(id);
    if (def.kind !== 'action' || !impl(id)) continue;
    if (offered.has(id)) {
      out.push({ abilityId: id, usable: true });
      continue;
    }
    // Outside its timing window first: that is the reason a player sees most often.
    const inWindow = def.timings.some((t) => timings.includes(t)) && !h.status.unconscious;
    const code = inWindow ? blocker(s, h, def, timings) : 'ABILITY_WRONG_TIMING';
    const reason = code ? STATUS_OF_BLOCKER[code] ?? 'timing' : 'noTarget';
    out.push({ abilityId: id, usable: false, reason, ...(reason === 'noTarget' && def.targetHint ? { hint: def.targetHint } : {}) });
  }
  return out;
}

export function hasAbilityOffer(s: GameState): boolean {
  return abilityOffers(s, { first: true }).length > 0;
}

const sameTargets = (a: AbilityTarget[], b: AbilityTarget[]): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Pay, record the use, run the effect (research R-01). */
export function useAbility(ctx: Ctx, abilityId: string, targets: AbilityTarget[] = [], option?: string, pay?: Payment): void {
  const { s } = ctx;
  let def: AbilityDefinition;
  try {
    def = abilityDefinition(abilityId);
  } catch {
    fail('ABILITY_UNKNOWN', 'Unknown ability', 'Hero Abilities');
  }
  const h = activeHero(s);
  if (!heroAbilityIds(h).includes(abilityId) || !impl(abilityId)) fail('ABILITY_UNKNOWN', 'This hero does not have that ability', 'Hero Abilities');
  const problem = blocker(s, h, def, openTimings(s));
  if (problem) fail(problem, problemText[problem], 'Hero Abilities');
  if (def.options?.length && !def.options.includes(option ?? '')) fail('ABILITY_BAD_TARGET', 'Choose one of the options', 'Hero Abilities');
  const offer = abilityOffers(s).find((o) => o.abilityId === abilityId && o.option === (def.options?.length ? option : undefined));
  if (!offer) fail('ABILITY_BAD_TARGET', 'This ability has no legal target now', 'Hero Abilities');
  if (!offer.targets.some((t) => sameTargets(t, targets))) {
    const royal = targets.some((t) => 'unitId' in t && ['king', 'queen'].includes(s.units.find((u) => u.id === t.unitId)?.type ?? ''));
    const code = royal && def.flags.notRoyalty ? 'ABILITY_ROYALTY' : def.flags.mustNotCheck && !accepted(s, h, def, option, targets) ? 'ABILITY_WOULD_CHECK' : 'ABILITY_BAD_TARGET';
    fail(code, problemText[code], 'Hero Abilities');
  }
  const cost = offer.cost;
  spend(ctx, h, cost, abilityId, pay);
  const st = (s.abilityState[h.id] ??= { uses: {}, usedThisTurn: [] });
  if (def.uses !== null) st.uses[abilityId] = (usesLeft(s, h.id, abilityId) ?? def.uses) - 1;
  st.usedThisTurn.push(abilityId);
  emit(ctx, { type: 'abilityUsed', heroId: h.id, ability: abilityId, destiny: cost, targets, ...(option ? { option } : {}) });
  // Peace Treaty: an ability affecting an enemy unit flips it to War (Basic Rules *Other tokens*).
  if (targets.some((t) => 'unitId' in t && s.units.find((u) => u.id === t.unitId)?.side !== h.side)) flipToWar(ctx);
  runEffect(ctx, h, def, option, targets);
}

const problemText: Record<string, string> = {
  ABILITY_WRONG_TIMING: 'This ability cannot be used now',
  ABILITY_NOT_AS_HERO_UNIT: 'Cannot be used while you are a Hero Unit',
  ABILITY_NO_USES: 'No uses left',
  ABILITY_USED_THIS_TURN: 'Once per turn',
  ABILITY_BAD_TARGET: 'Not a legal target',
  ABILITY_ROYALTY: 'This ability does not affect royalty',
  ABILITY_WOULD_CHECK: 'This ability must not check the King',
  NOT_ENOUGH_DESTINY: 'Not enough Destiny',
};

/** Starting uses from data for a hero (setup, Epic form change keeps used counts). */
export function initialAbilityState(): { uses: Record<string, number>; usedThisTurn: string[] } {
  return { uses: {}, usedThisTurn: [] };
}
