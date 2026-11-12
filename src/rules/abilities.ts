// General abilities: Inspired Lead and Hero Retreat (FR-073).
import { eq, tavernOwner } from './board.ts';
import { activeHero, emit, fail, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { available, spend } from './destiny.ts';
import { heal, placeHero } from './heroes.ts';
import { addLeadBonus } from './lead.ts';
import type { Payment } from './model/actions.ts';
import type { GameState } from './model/state.ts';
import type { Coord } from './model/types.ts';

/** After Lead and End of Turn abilities (and the free Meal) are blocked by a check or no possible Lead (FR-042). */
export function abilitiesBlocked(state: GameState): boolean {
  return state.turn.kingInCheckAfterLead || !state.turn.leadPossible;
}

/** 006 FR-007: Before Lead, or the Lead phase while the turn's Lead is not resolved (until the die is rolled). */
function inspiredLeadWindow(s: GameState): boolean {
  if (s.phase === 'beforeLead') return true;
  return s.phase === 'lead' && (!s.turn.lead || s.turn.lead.success === null);
}

export function canInspiredLead(ctx: Ctx): boolean {
  const { s } = ctx;
  return inspiredLeadWindow(s) && !s.turn.abilitiesUsed.includes('inspiredLead') && available(ctx, activeHero(s)) >= 1;
}

/**
 * X D → +2 per D on this turn's Lead only (spec Q-19). 006 FR-007 (decided 2026-11-11): also in the Lead phase until
 * the die is rolled. After the announcement the bonus joins the Lead's modifiers, and a Lead that can no longer fail
 * succeeds at once.
 */
export function inspiredLead(ctx: Ctx, destiny: number, pay?: Payment): void {
  const { s } = ctx;
  if (s.turn.abilitiesUsed.includes('inspiredLead')) fail('ABILITY_USED', 'Once per turn', 'Inspired Lead');
  if (!inspiredLeadWindow(s)) fail('WRONG_PHASE', 'Inspired Lead is used before the Lead is rolled', 'Inspired Lead');
  if (!Number.isInteger(destiny) || destiny < 1) fail('BAD_AMOUNT', 'Spend at least 1 D', 'Inspired Lead');
  const h = activeHero(s);
  spend(ctx, h, destiny, 'inspiredLead', pay);
  s.turn.abilitiesUsed.push('inspiredLead');
  const bonus = destiny * RULES.modifiers.inspiredLeadPerDestiny;
  emit(ctx, { type: 'abilityUsed', heroId: h.id, ability: 'inspiredLead', destiny });
  if (s.phase === 'lead' && s.turn.lead) addLeadBonus(ctx, { source: 'inspiredLead', value: bonus });
  else s.turn.inspiredLeadBonus += bonus;
}

export function canHeroRetreat(ctx: Ctx): boolean {
  const { s } = ctx;
  return (
    s.phase === 'endOfTurn' && !abilitiesBlocked(s) && !s.turn.abilitiesUsed.includes('heroRetreat') &&
    available(ctx, activeHero(s)) >= RULES.abilities.heroRetreat.cost
  );
}

/** 2 D at End of Turn: place the hero in a friendly tavern and give a free Drink. */
export function heroRetreat(ctx: Ctx, tavern: Coord, pay?: Payment): void {
  const { s } = ctx;
  if (s.phase !== 'endOfTurn') fail('WRONG_PHASE', 'Hero Retreat is used at End of Turn', 'Hero Retreat');
  if (abilitiesBlocked(s)) fail('ABILITIES_BLOCKED', 'Blocked: King in check after the Lead, or no Lead was possible', 'Check');
  if (s.turn.abilitiesUsed.includes('heroRetreat')) fail('ABILITY_USED', 'Once per turn', 'Hero Retreat');
  const h = activeHero(s);
  if (tavernOwner(tavern) !== h.side) fail('NOT_FRIENDLY_TAVERN', 'Choose a friendly tavern', 'Hero Retreat');
  spend(ctx, h, RULES.abilities.heroRetreat.cost, 'heroRetreat', pay);
  s.turn.abilitiesUsed.push('heroRetreat');
  if (!eq(h.pos, tavern)) placeHero(ctx, h, tavern, 'heroRetreat');
  heal(ctx, h, RULES.tavern.drink.heal, 'freeDrink');
  emit(ctx, { type: 'abilityUsed', heroId: h.id, ability: 'heroRetreat', destiny: RULES.abilities.heroRetreat.cost });
}
