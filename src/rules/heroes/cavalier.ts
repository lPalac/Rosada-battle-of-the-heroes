// Cavalier and its Epic forms: Death Knight, Dragon Lord, Holy Paladin (Hero Rules 2_0).
import { c, chebyshev, eq, isBattlefield } from '../board.ts';
import { attackSquares } from '../paths.ts';
import { leadLeavesKingInCheck } from '../check.ts';
import { fail, hero } from '../ctx.ts';
import { wound } from '../heroes.ts';
import type { AbilityTarget } from '../model/actions.ts';
import { addEffect, effectsOfKind, effectsOnHero, isOccupied, modifyUnit, nextTurn, pushUnit, removeEffect, thisTurn, untilMyNextTurn } from '../abilities/effects.ts';
import { affectable, heroOf, isRoyal, onStartingSquareOfType, squareOf, startingSquares, unitOf } from '../abilities/targets.ts';
import type { AbilityCall, HeroModule } from '../abilities/types.ts';
import { createSpecial, destroyByAbility, woundUnit } from '../abilities/units.ts';
import {
  abilityLead, backDir, heroesAt, jumpOption, leadable, leadTargets, mark, moveHeroTo, optionsOf, pickOption,
  srcHero, stepSquares, targetHeroId, targetUnitId, touchesAdjacent, val,
} from './util.ts';

/** "You may move one square" (Warhorse, Pale Steed, Dragon Mount, Magnificent Stallion). */
const oneSquare = {
  targets: (c0: AbilityCall) => stepSquares(c0.s, c0.h, 1),
  effect: (ctx: import('../ctx.ts').Ctx, c0: AbilityCall, t: AbilityTarget[]) => moveHeroTo(ctx, c0.h, squareOf(t[0]), c0.def.id),
};

/** Friendly Knights in Range and their Lead options, filtered. */
function knightLeads(c0: AbilityCall, keep: (o: ReturnType<typeof optionsOf>[number]) => boolean) {
  return leadable(c0.s, c0.h).filter((u) => u.type === 'knight').flatMap((u) => optionsOf(c0.s, u)).filter(keep);
}

/** The turn's successful Lead, if any. */
const ledUnit = (c0: AbilityCall) => {
  const lead = c0.s.turn.lead;
  return lead?.success ? c0.s.units.find((u) => u.id === lead.unitId) : undefined;
};

export const CAVALIER: HeroModule = {
  impls: {
    'cavalier.warhorse': oneSquare,
    'cavalier.demoralise': {
      effect: (ctx, c0) => void mark(ctx, c0, 'demoralise', { heroId: c0.h.id }, untilMyNextTurn(c0.h.id)),
    },
    'cavalier.tightFormation': {
      isLead: true,
      targets: (c0) => leadTargets(knightLeads(c0, (o) => !o.isBattle)),
      effect: (ctx, c0, t) => {
        const opt = pickOption(knightLeads(c0, (o) => !o.isBattle), t);
        const unit = unitOf(ctx.s, t[0]);
        mark(ctx, c0, 'protectedInBattle', { unitId: unit.id }, nextTurn(ctx.s));
        abilityLead(ctx, c0, unit, opt);
      },
    },
    'deathKnight.paleSteed': oneSquare,
    'deathKnight.imNotDoneWithYou': {
      targets: (c0) => {
        const lead = c0.s.turn.lead;
        if (!lead?.success) return [];
        return (lead.destroyed ?? []).filter((d) => d.type === 'pawn' && d.side !== c0.h.side).map((d) => [{ square: d.pos }]);
      },
      effect: (ctx, c0, t) => void createSpecial(ctx, { side: c0.h.side, type: 'pawn', at: squareOf(t[0]), tags: ['undead'], shareFriendly: true }),
    },
    'deathKnight.dutyBeyondTheGrave': {
      targets: (c0) => startingSquares(c0.h.side, 'knight').filter((p) => !isOccupied(c0.s, p)).map((p) => [{ square: p }]),
      effect: (ctx, c0, t) => void createSpecial(ctx, { side: c0.h.side, type: 'knight', at: squareOf(t[0]), tags: ['undead'] }),
    },
    'deathKnight.legendaryAncient': {
      condition: (c0) => isBattlefield(c0.h.pos) && !isOccupied(c0.s, c0.h.pos),
      effect: (ctx, c0) => {
        // A previous Legendary Ancient of this hero stays; the new one is created on the hero's square.
        const unit = createSpecial(ctx, { side: c0.h.side, type: 'knight', at: c0.h.pos, tags: ['legendaryAncient'], health: c0.v('health') });
        mark(ctx, c0, 'cannotBattle', { unitId: unit.id }, thisTurn(ctx.s));
        mark(ctx, c0, 'legendaryAncient', { unitId: unit.id }, { at: 'removed' });
      },
    },
    'dragonLord.dragonMount': oneSquare,
    'dragonLord.breathOfFieryDestruction': {
      targets: (c0) => {
        if (c0.option === 'square') {
          if (c0.s.phase !== 'move') return [];
          const squares = c0.s.turn.movePath.filter((p, i, a) => a.findIndex((q) => eq(q, p)) === i);
          return squares.filter((p) => heroesAt(c0.s, p).some((x) => x.side !== c0.h.side)).map((p) => [{ square: p }]);
        }
        if (c0.s.phase !== 'lead') return [];
        return leadable(c0.s, c0.h).some((u) => u.type === 'knight' && optionsOf(c0.s, u).length) ? [[]] : [];
      },
      effect: (ctx, c0, t) => {
        if (c0.option === 'square') {
          for (const x of heroesAt(ctx.s, squareOf(t[0])).filter((x) => x.side !== c0.h.side)) wound(ctx, x, c0.v('squareWounds'), { enemySide: c0.h.side }, 'ability');
        } else mark(ctx, c0, 'breath', { heroId: c0.h.id }, thisTurn(ctx.s), { wounds: c0.v('pathWounds') });
      },
    },
    'dragonLord.draconicDescent': {
      isLead: true,
      targets: (c0) => leadTargets(descents(c0)),
      effect: (ctx, c0, t) => abilityLead(ctx, c0, unitOf(ctx.s, t[0]), pickOption(descents(c0), t)),
    },
    'dragonLord.terrifyingRoar': {
      targets: (c0) => {
        const led = ledUnit(c0);
        if (!led) return [];
        return c0.s.units
          .filter((u) => u.side !== c0.h.side && affectable(c0.s, u, true) && !onStartingSquareOfType(u) && chebyshev(u.pos, led.pos) === 1)
          .filter((u) => {
            const to = c(u.pos.x + backDir(u).x, u.pos.y + backDir(u).y);
            return isBattlefield(to) && !isOccupied(c0.s, to);
          })
          .map((u) => [{ unitId: u.id }]);
      },
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        const from = { ...u.pos };
        pushUnit(ctx, u, backDir(u));
        moveHeroTo(ctx, c0.h, from, c0.def.id);
      },
    },
    'dragonLord.greatWyrmOffering': {
      targets: (c0) =>
        c0.s.units
          .filter((u) => u.side !== c0.h.side && u.type === 'pawn' && !u.modifiedFrom && !u.tags?.length && chebyshev(u.pos, c0.h.pos) <= 1)
          .filter((u) => affectable(c0.s, u) && !onStartingSquareOfType(u))
          .map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        const at = { ...u.pos };
        if (!destroyByAbility(ctx, c0.h, [u]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
        createSpecial(ctx, { side: c0.h.side, type: 'knight', at });
      },
    },
    'holyPaladin.magnificentStallion': oneSquare,
    'holyPaladin.divineProtector': {
      targets: (c0) => c0.s.heroes.filter((x) => x.side === c0.h.side && x.id !== c0.h.id && !x.status.unconscious).map((x) => [{ heroId: x.id }]),
      effect: (ctx, c0, t) => {
        for (const e of effectsOfKind(ctx.s, 'divineProtector').filter((e) => e.source.heroId === c0.h.id)) removeEffect(ctx, e.id, 'replaced');
        mark(ctx, c0, 'divineProtector', { heroId: heroOf(ctx.s, t[0]).id }, untilMyNextTurn(c0.h.id));
      },
    },
    'holyPaladin.paragonOfHonor': {
      targets: (c0) => c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'queen').map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'paragon', { unitId: unitOf(ctx.s, t[0]).id }, untilMyNextTurn(c0.h.id), { swapCost: c0.v('swapCost') }),
    },
    'holyPaladin.crusade': {
      isLead: true,
      targets: (c0) => leadTargets(knightLeads(c0, () => true)),
      effect: (ctx, c0, t) => {
        const opt = pickOption(knightLeads(c0, () => true), t);
        const unit = unitOf(ctx.s, t[0]);
        mark(ctx, c0, 'protectedInBattle', { unitId: unit.id }, nextTurn(ctx.s));
        abilityLead(ctx, c0, unit, opt);
      },
    },
    'holyPaladin.knightAPeasant': {
      targets: (c0) => c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'pawn' && chebyshev(u.pos, c0.h.pos) <= 1 && affectable(c0.s, u)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => modifyUnit(ctx, unitOf(ctx.s, t[0]), 'knight', { abilityId: c0.def.id, heroId: c0.h.id }),
    },
    'holyPaladin.holyWrath': {
      targets: (c0) => {
        const out: AbilityTarget[][] = [];
        for (const x of c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && isBattlefield(x.pos) && chebyshev(x.pos, c0.h.pos) <= 1)) {
          const units = c0.s.units.filter((u) => u.side !== c0.h.side && affectable(c0.s, u, true) && chebyshev(u.pos, x.pos) <= 1 && chebyshev(u.pos, c0.h.pos) <= 1);
          if (!units.length) out.push([{ heroId: x.id }]);
          for (const u of units) out.push([{ heroId: x.id }, { unitId: u.id }]);
        }
        return out;
      },
      effect: (ctx, c0, t) => {
        wound(ctx, heroOf(ctx.s, t[0]), c0.v('wounds'), { enemySide: c0.h.side }, 'ability');
        if (t[1]) destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[1])]);
      },
    },
  },
  passives: {
    'deathKnight.auraOfFear': {
      leadModifiers: (s, src, lead) => {
        const dk = src.hero!;
        if (lead.side === dk.side || isRoyal(lead.unit) || !touchesAdjacent(lead.opt, dk.pos)) return [];
        return [{ source: src.abilityId, value: val(s, dk, src.abilityId, 'penalty') }];
      },
    },
    'deathKnight.seekRevenge': {
      onDestroyed: (ctx, src, unit) => {
        const dk = src.hero!;
        if (unit.side !== dk.side || chebyshev(unit.pos, dk.pos) > 1) return;
        if (effectsOnHero(ctx.s, dk.id, 'nextLeadBonus').some((e) => e.source.abilityId === src.abilityId)) return;
        addEffect(ctx, {
          kind: 'nextLeadBonus', source: { abilityId: src.abilityId, heroId: dk.id }, target: { heroId: dk.id },
          expires: { at: 'removed' }, data: { value: val(ctx.s, dk, src.abilityId, 'bonus') },
        });
      },
    },
    'holyPaladin.auraOfRadiance': {
      leadModifiers: (s, src, lead) => {
        const hp = src.hero!;
        if (lead.side !== hp.side || chebyshev(lead.opt.from, hp.pos) > 1) return [];
        return [{ source: src.abilityId, value: val(s, hp, src.abilityId, 'bonus') }];
      },
    },
  },
  effects: {
    /** Demoralise: an enemy unit that passes next to the Cavalier and leaves its range fails its Lead. */
    demoralise: {
      leadFails: (s, src, lead) => demoralised(s, src, lead),
      onLeadResolved: (ctx, src, lead, success) => {
        if (!success && demoralised(ctx.s, src, lead)) removeEffect(ctx, src.effect!.id, 'used');
      },
    },
    /** Breath of Fiery Destruction (Knight option): wounds and Destroys along the Knight's path. */
    breath: {
      onLeadResolved: (ctx, src, lead, success) => {
        const owner = srcHero(ctx.s, src);
        if (lead.heroId !== owner.id) return;
        removeEffect(ctx, src.effect!.id, 'used');
        if (!success || lead.unit.type !== 'knight') return;
        const wounds = Number(src.effect!.data.wounds);
        for (const p of lead.opt.path) {
          for (const x of heroesAt(ctx.s, p).filter((x) => x.side !== owner.side)) wound(ctx, x, wounds, { enemySide: owner.side }, 'ability');
          destroyByAbility(ctx, owner, ctx.s.units.filter((u) => u.side !== owner.side && u.kind === 'auxiliary' && eq(u.pos, p) && u.type !== 'king'));
        }
      },
    },
    /** The Legendary Ancient takes 1 wound each time it is Led. */
    legendaryAncient: {
      onLeadResolved: (ctx, src, lead, success) => {
        const id = targetUnitId(src.effect);
        if (!success || lead.unit.id !== id) return;
        const unit = ctx.s.units.find((u) => u.id === id);
        if (unit) woundUnit(ctx, unit, val(ctx.s, srcHero(ctx.s, src), src.abilityId, 'woundsPerLead'));
      },
    },
    /** Divine Protector: the marked hero is not pushed and the Paladin takes its wounds. */
    divineProtector: {
      pushBlocked: (_s, src, h) => targetHeroId(src.effect) === h.id,
      redirectWounds: (s, src, h) => (targetHeroId(src.effect) === h.id ? hero(s, src.effect!.source.heroId) : null),
    },
    /** Paragon of Honor: a protecting Knight may take the Queen's place in Battle (2 D). */
    paragon: {
      reaction: {
        cost: (_s, src) => Number(src.effect!.data.swapCost),
        usable: () => true,
        options: (s, src, opt) => {
          const queenId = targetUnitId(src.effect);
          const queen = s.units.find((u) => u.id === queenId);
          if (!queen || !opt.battleUnitIds.includes(queen.id)) return [];
          return s.units
            .filter((u) => u.side === queen.side && u.type === 'knight' && !opt.battleUnitIds.includes(u.id) && attackSquares(s, u).some((p) => eq(p, queen.pos)))
            .map((u) => [{ unitId: u.id }]);
        },
        apply: (ctx, src, t, opt) => {
          const queen = ctx.s.units.find((u) => u.id === targetUnitId(src.effect))!;
          const knight = unitOf(ctx.s, t[0]);
          const qPos = { ...queen.pos };
          queen.pos = { ...knight.pos };
          knight.pos = qPos;
          return { ...opt, battleUnitIds: opt.battleUnitIds.map((id) => (id === queen.id ? knight.id : id)) };
        },
      },
    },
  },
};

function demoralised(s: import('../model/state.ts').GameState, src: import('../abilities/types.ts').HookSrc, lead: import('../abilities/types.ts').LeadCtx): boolean {
  const cav = hero(s, targetHeroId(src.effect)!);
  if (lead.side === cav.side || isRoyal(lead.unit)) return false;
  return touchesAdjacent(lead.opt, cav.pos) && chebyshev(lead.opt.to, cav.pos) > cav.range;
}

/** Draconic Descent: a friendly Knight in Range Led 2×2 squares; no Battle with royalty. */
function descents(c0: AbilityCall) {
  const out = [];
  for (const u of leadable(c0.s, c0.h).filter((u) => u.type === 'knight')) {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const o = jumpOption(c0.s, u, c(u.pos.x + dx, u.pos.y + dy));
      if (!o) continue;
      if (c0.s.units.some((x) => o.battleUnitIds.includes(x.id) && isRoyal(x)) || leadLeavesKingInCheck(c0.s, o)) continue;
      out.push(o);
    }
  }
  return out;
}

