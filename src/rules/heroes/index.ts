// Ability id → effect table, passive hooks and effect-kind hooks of every hero module (004 research R-02).
import type { HeroModule } from '../abilities/types.ts';
import { CAVALIER } from './cavalier.ts';
import { GENERAL } from './general.ts';
import { MAGUS } from './magus.ts';
import { MONK } from './monk.ts';
import { SCOUT } from './scout.ts';
import { SHARED } from './shared.ts';

let registry: HeroModule | null = null;

/** Built on first use, so modules that import each other in a cycle are all initialised by then. */
export function REGISTRY(): HeroModule {
  if (!registry) {
    const mods = [GENERAL, SHARED, CAVALIER, MONK, SCOUT, MAGUS];
    registry = { impls: {}, passives: {}, effects: {} };
    for (const m of mods) {
      Object.assign(registry.impls, m.impls);
      Object.assign(registry.passives, m.passives);
      Object.assign(registry.effects, m.effects);
    }
  }
  return registry;
}
