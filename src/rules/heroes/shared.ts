// Effect kinds shared by several heroes (004 research R-04): marks that stop Leads or Battle, protection in Battle,
// Lead modifiers on a unit, bonuses to a hero's next Lead.
import type { Effect } from '../model/state.ts';
import type { HeroModule, HookSrc } from '../abilities/types.ts';
import { removeEffect } from '../abilities/effects.ts';

const onUnit = (src: HookSrc): string | null => {
  const e = src.effect as Effect | undefined;
  return e && 'unitId' in e.target ? e.target.unitId : null;
};
const onHero = (src: HookSrc): string | null => {
  const e = src.effect as Effect | undefined;
  return e && 'heroId' in e.target ? e.target.heroId : null;
};

export const SHARED: HeroModule = {
  impls: {},
  passives: {},
  effects: {
    /** The unit cannot be Led (Preaching ×2, Poison Water, Mislead, Arcane Shackles, Martyrdom, Knightmare). */
    cannotLead: {
      filterLeads: (_v, src, unit, opts) => (unit.id === onUnit(src) ? [] : opts),
    },
    /** The unit cannot initiate Battle (Sanctimonious, Counterintelligence, Tight Formation's own Lead). */
    cannotBattle: {
      filterLeads: (_v, src, unit, opts) => (unit.id === onUnit(src) ? opts.filter((o) => !o.isBattle) : opts),
    },
    /** The unit cannot be Destroyed in Battle: no unit may initiate Battle with it (rulebook *Battle*). */
    protectedInBattle: {
      filterLeads: (_v, src, _unit, opts) => opts.filter((o) => !o.battleUnitIds.includes(onUnit(src) ?? '')),
      canDestroy: (_v, src, unit, by) => !(by === 'battle' && unit.id === onUnit(src)),
    },
    /** A Lead modifier on one unit's Leads (Preaching −4, Poison Water −3). */
    leadModifier: {
      leadModifiers: (_v, src, lead) => (lead.unit.id === onUnit(src) ? [{ source: src.abilityId, value: Number(src.effect!.data.value) }] : []),
    },
    /** A bonus to the hero's next Lead (Seek Revenge, Future Sight, Blood Ritual). Used by that Lead. */
    nextLeadBonus: {
      leadModifiers: (_v, src, lead) => (lead.heroId === onHero(src) ? [{ source: src.abilityId, value: Number(src.effect!.data.value) }] : []),
      onLeadResolved: (ctx, src, lead) => {
        if (lead.heroId === onHero(src)) removeEffect(ctx, src.effect!.id, 'used');
      },
    },
  },
};
