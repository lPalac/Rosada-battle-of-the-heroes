// 001's general abilities. Inspired Lead and Hero Retreat keep their 001 actions (`inspiredLead`, `heroRetreat`) as
// the implementation; they are listed in abilities.json for the HUD and sheets (004 T014).
import { heroRetreat, inspiredLead } from '../abilities.ts';
import { squareOf } from '../abilities/targets.ts';
import type { HeroModule } from '../abilities/types.ts';

export const GENERAL: HeroModule = {
  impls: {
    'general.inspiredLead': { effect: (ctx) => inspiredLead(ctx, 1) },
    'general.heroRetreat': { effect: (ctx, _c, t) => heroRetreat(ctx, squareOf(t[0])) },
  },
  passives: {},
  effects: {},
};
