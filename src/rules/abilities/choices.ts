// Choices inside an ability (004 data-model `abilityChoice`): Converge Timelines' kept copy, No Time to Lose?,
// Evasive's escape, Smuggler's Grotto placement. The ability's own `choose` runs the answer.
import { fail, type Ctx } from '../ctx.ts';
import type { PendingDecision } from '../model/actions.ts';
import { REGISTRY } from '../heroes/index.ts';

export function answerChoice(ctx: Ctx, d: Extract<PendingDecision, { type: 'abilityChoice' }>, choice: string): void {
  const im = REGISTRY().impls[d.abilityId];
  if (!im?.choose) fail('BAD_ANSWER', 'Nothing to choose', 'Hero Abilities');
  im.choose(ctx, d.heroId, choice);
}
