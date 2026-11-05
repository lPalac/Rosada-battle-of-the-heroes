// "During Enemy Lead" reactions (004 research R-03, T022): before a Battle's units are Destroyed, the defending
// heroes are asked in turn (Paragon of Honor, Devious Gambit, Counterintelligence). The Lead waits on a
// pendingDecision and resumes with the answers, so undo and replay work as for every decision.
import { activeHero, fail, hero, type Ctx } from '../ctx.ts';
import { available, spend } from '../destiny.ts';
import { queueDecision } from '../heroes.ts';
import type { AbilityTarget, Payment } from '../model/actions.ts';
import type { LeadOption } from '../paths.ts';
import { hookSources } from './hooks.ts';
import type { HookSrc } from './types.ts';

const keyOf = (src: HookSrc): string => `${src.abilityId}|${src.effect ? `e${src.effect.id}` : src.hero!.id}`;
const ownerOf = (src: HookSrc) => (src.effect ? src.effect.source.heroId : src.hero!.id);

/** Ask the next unanswered reaction, or apply all answers and return the (possibly changed) Battle. */
export function collectReactions(ctx: Ctx, opt: LeadOption): 'waiting' | LeadOption {
  const { s } = ctx;
  const lead = s.turn.lead!;
  if (!opt.battleUnitIds.length) return opt;
  lead.reactions ??= [];
  const attacker = activeHero(s);
  const sources = hookSources(s, 'reaction');
  for (const { hooks, src } of sources) {
    const owner = hero(s, ownerOf(src));
    if (owner.side === attacker.side || owner.status.unconscious) continue;
    const key = keyOf(src);
    if (lead.reactions.some((r) => r.key === key)) continue;
    const cost = hooks.reaction.cost(s, src);
    if (available(ctx, owner) < cost || !hooks.reaction.usable(s, src)) continue;
    const options = hooks.reaction.options(s, src, opt);
    if (!options.length) continue;
    queueDecision(ctx, { type: 'reaction', heroId: owner.id, abilityId: src.abilityId, key, at: 'battle', cost, options });
    return 'waiting';
  }
  let out = opt;
  for (const r of lead.reactions) {
    if (!r.use) continue;
    const found = sources.find(({ src }) => keyOf(src) === r.key);
    if (found) out = found.hooks.reaction.apply(ctx, found.src, (r.targets ?? []) as AbilityTarget[], out);
  }
  return out;
}

/** Answer a reaction decision: pay, record, and let the Lead continue. */
export function answerReaction(ctx: Ctx, use: boolean, targets: AbilityTarget[] = [], pay?: Payment): void {
  const { s } = ctx;
  const d = s.pendingDecision;
  if (!d || d.type !== 'reaction') fail('NO_DECISION', 'Nothing to decide', 'Decisions');
  if (use) {
    if (!d.options.some((o) => JSON.stringify(o) === JSON.stringify(targets))) fail('ABILITY_BAD_TARGET', 'Not a legal target', 'Hero Abilities');
    spend(ctx, hero(s, d.heroId), d.cost, d.abilityId, pay);
    const st = (s.abilityState[d.heroId] ??= { uses: {}, usedThisTurn: [] });
    st.usedThisTurn.push(d.abilityId);
  }
  s.turn.lead!.reactions!.push({ abilityId: d.abilityId, heroId: d.heroId, key: d.key, use, targets });
}
