// Iterates the hooks of effects in play and of passive abilities of heroes in play (004 research R-06).
import type { Ctx } from '../ctx.ts';
import { DATA } from '../data.ts';
import type { Hero } from '../model/hero.ts';
import type { GameState } from '../model/state.ts';
import { REGISTRY } from '../heroes/index.ts';
import type { HookSrc, Hooks } from './types.ts';

type Partial3 = Pick<GameState, 'units'> & Partial<GameState>;

/** Ability ids a hero has now: the Epic form's, else the named hero's starting abilities (spec A-02). */
export function heroAbilityIds(h: Hero): string[] {
  const def = DATA.heroes.find((d) => d.id === h.definitionId);
  if (!def) return [];
  if (h.form && def.forms) {
    const form = Object.values(def.forms).find((f) => f.id === h.form);
    if (form) return form.abilities;
  }
  return def.abilities;
}

/** Every active hook source with the given hook. Unconscious heroes' passives do not apply (spec Q-45). */
export function hookSources<K extends keyof Hooks>(v: Partial3, name: K): { hooks: Required<Pick<Hooks, K>>; src: HookSrc }[] {
  const out: { hooks: Required<Pick<Hooks, K>>; src: HookSrc }[] = [];
  const reg = REGISTRY();
  for (const effect of v.effects ?? []) {
    const hooks = reg.effects[effect.kind];
    if (hooks?.[name]) out.push({ hooks: hooks as Required<Pick<Hooks, K>>, src: { abilityId: effect.source.abilityId, effect } });
  }
  for (const hero of v.heroes ?? []) {
    if (hero.status.unconscious) continue;
    for (const id of heroAbilityIds(hero)) {
      const hooks = reg.passives[id];
      if (hooks?.[name]) out.push({ hooks: hooks as Required<Pick<Hooks, K>>, src: { abilityId: id, hero } });
    }
  }
  return out;
}

/** Run a void hook on every source (Ctx hooks). Sources are taken once, so hooks may add or remove effects. */
export function runHooks<K extends 'onTurnStart' | 'onTurnEnd' | 'onEpicStage'>(ctx: Ctx, name: K): void {
  for (const { hooks, src } of hookSources(ctx.s, name)) {
    if (src.effect && !ctx.s.effects.some((e) => e.id === src.effect!.id)) continue; // removed by an earlier hook
    (hooks[name] as (ctx: Ctx, src: HookSrc) => void)(ctx, src);
  }
}
