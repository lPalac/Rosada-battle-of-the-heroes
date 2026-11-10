// Ability engine types (004 research R-01, R-02, R-06). Effects are code by ability id; numbers are data.
import type { Ctx } from '../ctx.ts';
import type { AbilityDefinition } from '../data.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Hero } from '../model/hero.ts';
import type { Effect, GameState, Modifier } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import type { Coord, HeroId, Side } from '../model/types.ts';
import type { LeadOption } from '../paths.ts';

/** One use of an ability: the state, the user, its data and the Bloodied-aware values. */
export interface AbilityCall {
  s: GameState;
  h: Hero;
  def: AbilityDefinition;
  option?: string;
  bloodied: boolean;
  /** A value from `values`; `[normal, bloodied]` pairs resolve by Bloodied. */
  v(key: string): number;
}

export interface AbilityImpl {
  /** Extra condition beyond timing, cost, uses and Hero Unit / Unconscious checks. */
  condition?(c: AbilityCall): boolean;
  /** Every legal target choice; `[[]]` when the ability takes no target. Omitted: `[[]]`. */
  targets?(c: AbilityCall): AbilityTarget[][];
  /** Run the effect. Throwing a RuleFailure refuses the use. */
  effect(ctx: Ctx, c: AbilityCall, targets: AbilityTarget[]): void;
  /** Check each target choice by running it on a copy (abilities whose effect may still be refused). */
  simulate?: boolean;
  /** Answer an `abilityChoice` decision of this ability. */
  choose?(ctx: Ctx, heroId: HeroId, choice: string): void;
  /** The ability makes the turn's Lead (Instead of Lead / During Lead abilities that set it up themselves). */
  isLead?: boolean;
}

export interface LeadCtx {
  unit: Unit;
  opt: LeadOption;
  heroId: HeroId;
  side: Side;
}

/** Where a hook comes from: an effect in play, or a passive ability of a hero in play. */
export interface HookSrc {
  abilityId: string;
  effect?: Effect;
  hero?: Hero;
}

export type View = GameState;

/** Hook points of research R-06. Every hook is optional; with none registered the 001–003 rules are unchanged. */
export interface Hooks {
  leadModifiers?(v: View, src: HookSrc, lead: LeadCtx): Modifier[];
  /** The Lead needs no roll and succeeds (Make Peace Not War, Certainty & Death). */
  noRoll?(v: View, src: HookSrc, lead: LeadCtx): boolean;
  /** Remove, change or add Lead options of one unit (marks, portals, protection, Rapid March). */
  filterLeads?(v: View, src: HookSrc, unit: Unit, opts: LeadOption[]): LeadOption[];
  /** The announced Lead fails at once (Demoralise). */
  leadFails?(v: View, src: HookSrc, lead: LeadCtx): boolean;
  onLeadAnnounced?(ctx: Ctx, src: HookSrc, lead: LeadCtx): void;
  onLeadResolved?(ctx: Ctx, src: HookSrc, lead: LeadCtx, success: boolean): void;
  /** False: the unit cannot be Destroyed this way now. */
  canDestroy?(v: View, src: HookSrc, unit: Unit, by: 'battle' | 'ability'): boolean;
  onDestroyed?(ctx: Ctx, src: HookSrc, unit: Unit, by: 'battle' | 'ability'): void;
  /** Change wounds a hero is about to take. */
  woundTaken?(v: View, src: HookSrc, hero: Hero, amount: number, cause: WoundCause): number;
  onHeroEnters?(ctx: Ctx, src: HookSrc, hero: Hero): void;
  /** The hero may end a Move on an enemy (non-King) unit's square (Elusive). */
  allowEndOnEnemy?(v: View, src: HookSrc, hero: Hero): boolean;
  onTurnStart?(ctx: Ctx, src: HookSrc): void;
  onTurnEnd?(ctx: Ctx, src: HookSrc): void;
  onEpicStage?(ctx: Ctx, src: HookSrc): void;
  generationBonus?(v: View, src: HookSrc, side: Side): number;
  /** A token makes the square count as occupied (Portal, Religious Fervor). */
  occupied?(v: View, src: HookSrc, square: Coord): boolean;
  /** Cap on the hero's Movement this turn (Martyrdom). */
  movementCap?(v: View, src: HookSrc, hero: Hero): number | null;
  /** The hero cannot be pushed (Divine Protector). */
  pushBlocked?(v: View, src: HookSrc, hero: Hero): boolean;
  /** Extra squares the hero may step to in Move (Smuggler's Grotto). */
  extraMoveSquares?(v: View, src: HookSrc, hero: Hero): Coord[];
  /** The square is a tavern for this hero (Smuggler's Grotto). */
  isTavernFor?(v: View, src: HookSrc, hero: Hero, square: Coord): boolean;
  /** Another hero takes this hero's wounds (Divine Protector). */
  redirectWounds?(v: View, src: HookSrc, hero: Hero): Hero | null;
  /** The hero just fell Unconscious (No Time to Lose?). Only the hero's own passives are asked. */
  onUnconscious?(ctx: Ctx, src: HookSrc, hero: Hero): void;
  /** A "During Enemy Lead" reaction offered before a Battle (research R-03). */
  reaction?: {
    cost(v: View, src: HookSrc): number;
    usable(v: View, src: HookSrc): boolean;
    options(v: View, src: HookSrc, opt: LeadOption): import('../model/actions.ts').AbilityTarget[][];
    apply(ctx: Ctx, src: HookSrc, targets: import('../model/actions.ts').AbilityTarget[], opt: LeadOption): LeadOption;
  };
  /** The hero was just Rammed (Evasive). */
  onRammed?(ctx: Ctx, src: HookSrc, hero: Hero): void;
  /** Ram on this hero by this unit is skipped (Elusive: units in the hero's square). */
  noRam?(v: View, src: HookSrc, hero: Hero, unit: Unit, from: Coord): boolean;
}

export type WoundCause = 'ram' | 'ability' | 'self' | 'heroUnit' | 'other';

export interface HeroModule {
  impls: Record<string, AbilityImpl>;
  passives: Record<string, Hooks>;
  effects: Record<string, Hooks>;
}
