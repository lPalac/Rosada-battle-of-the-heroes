// Monk and its Epic forms: Cultist (research R-13), Saint, Supreme Inquisitor (Hero Rules 2_0).
import { c, chebyshev, eq, isBattlefield } from '../board.ts';
import { isInCheck, isProtected, unitsAfterLead } from '../check.ts';
import { activeHero, emit, fail, hero, type Ctx } from '../ctx.ts';
import { heal, wound } from '../heroes.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Unit } from '../model/unit.ts';
import { otherSide, type UnitType } from '../model/types.ts';
import { attackSquares, enemyRoyalRank, forward, unitAt } from '../paths.ts';
import { effectSquares, effectsOfKind, effectsOnUnit, endOfMyNextTurn, isEmpty, isOccupied, modifyUnit, nextTurn, removeEffect, untilMyNextTurn } from '../abilities/effects.ts';
import { affectable, heroOf, isRoyal, onStartingSquareOfType, squareOf, startingSquares, unitOf } from '../abilities/targets.ts';
import type { AbilityCall, HeroModule, HookSrc } from '../abilities/types.ts';
import { createSpecial, destroyByAbility } from '../abilities/units.ts';
import {
  abilityLead, heroesAt, heroesOnMovePath, jumpOption, leadable, leadTargets, mark, markBy, pickOption, srcHero, stepSquares, targetHeroId, targetUnitId,
  touchesAdjacent, val,
} from './util.ts';

const adjacentTo = (c0: AbilityCall, u: Unit) => chebyshev(u.pos, c0.h.pos) <= 1;
const enemyUnits = (c0: AbilityCall, pred: (u: Unit) => boolean): AbilityTarget[][] =>
  c0.s.units.filter((u) => u.side !== c0.h.side && affectable(c0.s, u, !!c0.def.flags.notRoyalty) && pred(u)).map((u) => [{ unitId: u.id }]);
/** Friendly heroes sharing the square ("while passing through that hero's square"). */
/**
 * Friendly heroes the hero passes: during the Move every friendly hero on the Move's path (the start square
 * included, also after stepping further; 006 FR-003); otherwise those on the hero's square.
 */
const heroesHere = (c0: AbilityCall): AbilityTarget[][] =>
  (c0.s.phase === 'move' ? heroesOnMovePath(c0.s) : heroesAt(c0.s, c0.h.pos))
    .filter((x) => x.side === c0.h.side && x.id !== c0.h.id).map((x) => [{ heroId: x.id }]);

/** Pilgrimage: forward through enemy-occupied squares of its file to the first unoccupied square, not the Royal Rank. */
function pilgrimages(c0: AbilityCall) {
  const out = [];
  for (const u of leadable(c0.s, c0.h).filter((x) => x.type === 'pawn')) {
    const f = forward(u.side);
    const path = [];
    let p = c(u.pos.x, u.pos.y + f);
    while (isBattlefield(p) && c0.s.units.some((x) => eq(x.pos, p) && x.side !== u.side)) {
      path.push(p);
      p = c(p.x, p.y + f);
    }
    if (!path.length || !isBattlefield(p) || unitAt(c0.s, p) || p.y === enemyRoyalRank(u.side)) continue;
    const o = jumpOption(c0.s, u, p, [...path, p]);
    if (o) out.push({ ...o, isBattle: false, battleUnitIds: [] });
  }
  return out;
}

/** Blind Faith: a friendly Pawn in Range one square forward into Battle (not with royalty). */
function blindFaiths(c0: AbilityCall) {
  return leadable(c0.s, c0.h)
    .filter((u) => u.type === 'pawn')
    .map((u) => jumpOption(c0.s, u, c(u.pos.x, u.pos.y + forward(u.side))))
    .filter((o): o is NonNullable<typeof o> => !!o && o.isBattle && c0.s.units.filter((x) => o.battleUnitIds.includes(x.id)).every((x) => !isRoyal(x)));
}

/** Sanctimonious: enemy units next to the unit that just Destroyed an enemy unit in Battle (one or two of them). */
function sanctimoniousTargets(c0: AbilityCall): AbilityTarget[][] {
  const lead = c0.s.turn.lead;
  if (!lead?.success || !(lead.destroyed ?? []).some((d) => d.side !== c0.h.side)) return [];
  const victor = c0.s.units.find((u) => u.id === lead.unitId);
  if (!victor) return [];
  const near = c0.s.units.filter((u) => u.side !== c0.h.side && affectable(c0.s, u, true) && chebyshev(u.pos, victor.pos) <= 1);
  const out: AbilityTarget[][] = near.map((u) => [{ unitId: u.id }]);
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) out.push([{ unitId: near[i].id }, { unitId: near[j].id }]);
  return out;
}

/** Make Peace Not War applies to every unit but the King (King's Supremacy). */
const peaceHolds = (u: Unit) => u.type !== 'king';

export const MONK: HeroModule = {
  impls: {
    'monk.rejuvenatingStroll': {
      targets: heroesHere,
      effect: (ctx, c0, t) => heal(ctx, heroOf(ctx.s, t[0]), c0.v('heal'), c0.def.id),
    },
    'monk.preaching': {
      targets: (c0) => enemyUnits(c0, (u) => adjacentTo(c0, u)),
      // 006 FR-017: one use (−4 to Lead on the next turn) or both uses at once (cannot be Led on the next turn).
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        mark(ctx, c0, 'leadModifier', { unitId: u.id }, nextTurn(ctx.s), { value: c0.v('penalty') });
        if (c0.option === 'both') mark(ctx, c0, 'cannotLead', { unitId: u.id }, nextTurn(ctx.s));
      },
    },
    'monk.makePeaceNotWar': {
      condition: (c0) => c0.s.tokens.peaceTreaty === 'war' && !isInCheck(c0.s, c0.h.side),
      effect: (ctx, c0) => void mark(ctx, c0, 'makePeace', { none: true }, untilMyNextTurn(c0.h.id)),
    },
    'cultist.spiritualHealing': {
      effect: (ctx, c0) => {
        const aux = ctx.s.units.filter((u) => u.side === c0.h.side && u.kind === 'auxiliary' && chebyshev(u.pos, c0.h.pos) <= 1).length;
        heal(ctx, c0.h, c0.v('heal') + aux * c0.v('perAux'), c0.def.id);
      },
    },
    'cultist.religiousFervor': {
      targets: (c0) =>
        [c0.h.pos, ...[-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => c(c0.h.pos.x + dx, c0.h.pos.y + dy)))]
          .filter((p, i, a) => a.findIndex((q) => eq(q, p)) === i)
          .filter((p) => isBattlefield(p) && !isOccupied(c0.s, p) && !effectsOfKind(c0.s, 'fervor').some((e) => effectSquares(e).some((q) => eq(q, p))))
          .map((p) => [{ square: p }]),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'fervor', { square: squareOf(t[0]) }, { at: 'removed' }, { since: ctx.s.turnNumber, step: 0, wounds: c0.v('wounds'), bloodied: c0.bloodied }),
    },
    'cultist.sacrifice': {
      targets: (c0) => c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'pawn' && affectable(c0.s, u)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'sacrifice', { unitId: unitOf(ctx.s, t[0]).id }, { at: 'removed' }, { since: ctx.s.turnNumber, wounds: c0.v('wounds'), radius: c0.v('radius') }),
    },
    'cultist.falseSalvation': {
      targets: (c0) => enemyUnits(c0, (u) => u.type === 'pawn' && adjacentTo(c0, u) && !onStartingSquareOfType(u)),
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        const at = { ...u.pos };
        if (!destroyByAbility(ctx, c0.h, [u]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
        const back = c0.bloodied ? ctx.s.graveyard.find((g) => g.side === c0.h.side && g.originalType === 'pawn') : undefined;
        if (back) {
          ctx.s.graveyard = ctx.s.graveyard.filter((g) => g.id !== back.id);
          const unit: Unit = { ...back, type: 'pawn', pos: at, enPassantTarget: null, promoted: false, hasBeenLed: true };
          ctx.s.units.push(unit);
          emit(ctx, { type: 'unitCreated', unitId: unit.id, side: unit.side, unitType: 'pawn', kind: 'main', at });
        } else createSpecial(ctx, { side: c0.h.side, type: 'pawn', at });
      },
    },
    'cultist.dreamOfIllFate': {
      targets: () => (['rook', 'bishop', 'knight', 'pawn'] as const).map((unitType) => [{ unitType }]),
      effect: (ctx, c0, t) => {
        const unitType = (t[0] as { unitType: UnitType }).unitType;
        mark(ctx, c0, 'dream', { unitType, side: otherSide(c0.h.side) }, nextTurn(ctx.s), { turn: ctx.s.turnNumber + 1, wounds: c0.v('wounds') });
      },
    },
    'saint.saintlyInspiration': {
      targets: heroesHere,
      effect: (ctx, c0, t) => heal(ctx, heroOf(ctx.s, t[0]), c0.v('heal'), c0.def.id),
    },
    'saint.sacredRite': {
      targets: (c0) => {
        const bishops = c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'bishop');
        return c0.s.heroes.filter((x) => x.side === c0.h.side && !x.status.unconscious && bishops.some((b) => chebyshev(b.pos, x.pos) <= 1)).map((x) => [{ heroId: x.id }]);
      },
      effect: (ctx, c0, t) => heal(ctx, heroOf(ctx.s, t[0]), c0.v('heal'), c0.def.id),
    },
    'saint.pilgrimage': {
      isLead: true,
      targets: (c0) => leadTargets(pilgrimages(c0)),
      effect: (ctx, c0, t) => abilityLead(ctx, c0, unitOf(ctx.s, t[0]), pickOption(pilgrimages(c0), t), { noRam: true }),
    },
    'saint.martyrdom': {
      condition: (c0) => enemyUnits(c0, (u) => adjacentTo(c0, u)).length > 0,
      effect: (ctx, c0) => {
        const units = ctx.s.units.filter((u) => u.side !== c0.h.side && affectable(ctx.s, u, true) && chebyshev(u.pos, c0.h.pos) <= 1);
        for (const u of units) mark(ctx, c0, 'cannotLead', { unitId: u.id }, nextTurn(ctx.s));
        mark(ctx, c0, 'martyrdom', { heroId: c0.h.id }, endOfMyNextTurn(ctx.s, c0.h.id), { movement: c0.v('movement') });
        wound(ctx, c0.h, c0.v('woundsPerUnit') * units.length, { enemySide: null }, 'self');
      },
    },
    'saint.wingsOfDestiny': {
      targets: (c0) => {
        const out: AbilityTarget[][] = [];
        for (const g of c0.s.graveyard.filter((u) => u.side === c0.h.side && u.kind === 'main' && !['king', 'queen'].includes(u.originalType))) {
          for (const p of startingSquares(g.side, g.originalType).filter((q) => isEmpty(c0.s, q))) out.push([{ unitId: g.id }, { square: p }]);
        }
        return out;
      },
      effect: (ctx, c0, t) => {
        const id = (t[0] as { unitId: string }).unitId;
        const g = ctx.s.graveyard.find((u) => u.id === id);
        if (!g) fail('ABILITY_BAD_TARGET', 'Not in the Graveyard', 'Hero Abilities');
        const at = squareOf(t[1]);
        ctx.s.graveyard = ctx.s.graveyard.filter((u) => u.id !== id);
        const unit: Unit = { ...g, type: g.originalType, pos: at, enPassantTarget: null, promoted: false, modifiedFrom: null };
        ctx.s.units.push(unit);
        emit(ctx, { type: 'unitCreated', unitId: unit.id, side: unit.side, unitType: unit.type, kind: 'main', at });
      },
    },
    'supremeInquisitor.unexpectedVisit': {
      condition: (c0) => c0.s.turn.movePath.length === 0,
      targets: (c0) => stepSquares(c0.s, c0.h, c0.v('squares')),
      effect: (ctx, c0, t) => {
        const to = squareOf(t[0]);
        const from = c0.h.pos;
        c0.h.pos = { ...to };
        emit(ctx, { type: 'heroMoved', heroId: c0.h.id, from, to, reason: c0.def.id });
      },
    },
    'supremeInquisitor.inquisition': {
      targets: (c0) => enemyUnits(c0, (u) => adjacentTo(c0, u) && u.type !== 'pawn' && !onStartingSquareOfType(u) && !u.tags?.length),
      effect: (ctx, c0, t) => modifyUnit(ctx, unitOf(ctx.s, t[0]), 'pawn', { abilityId: c0.def.id, heroId: c0.h.id }, endOfMyNextTurn(ctx.s, c0.h.id)),
    },
    'supremeInquisitor.sanctimonious': {
      targets: sanctimoniousTargets,
      effect: (ctx, c0, t) => {
        for (const x of t) mark(ctx, c0, 'cannotBattle', { unitId: unitOf(ctx.s, x).id }, nextTurn(ctx.s));
      },
    },
    'supremeInquisitor.blindFaith': {
      isLead: true,
      targets: (c0) => leadTargets(blindFaiths(c0)),
      effect: (ctx, c0, t) => abilityLead(ctx, c0, unitOf(ctx.s, t[0]), pickOption(blindFaiths(c0), t)),
    },
    'supremeInquisitor.dogmaticIndoctrination': {
      targets: (c0) => enemyUnits(c0, (u) => u.type === 'bishop' && adjacentTo(c0, u) && !isProtected(c0.s, u)),
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        const at = { ...u.pos };
        if (!destroyByAbility(ctx, c0.h, [u]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
        createSpecial(ctx, { side: c0.h.side, type: 'bishop', at });
      },
    },
  },
  passives: {
    'cultist.righteousMight': {
      canDestroy: (_s, src, unit, by) => !(by === 'ability' && unit.kind === 'auxiliary' && unit.side === src.hero!.side && eq(unit.pos, src.hero!.pos)),
      leadModifiers: (s, src, lead) => {
        const h = src.hero!;
        if (lead.heroId !== h.id || !lead.opt.isBattle) return [];
        const pawns = s.units.filter((u) => u.side === h.side && u.kind === 'auxiliary' && u.type === 'pawn').length;
        return pawns ? [{ source: src.abilityId, value: pawns * val(s, h, src.abilityId, 'bonusPerPawn') }] : [];
      },
    },
    'cultist.knightmare': {
      onLeadResolved: (ctx, src, lead, success) => {
        const h = src.hero!;
        if (!success || lead.heroId !== h.id || lead.unit.type !== 'knight') return;
        const knight = ctx.s.units.find((u) => u.id === lead.unit.id);
        if (!knight) return;
        const hit = ctx.s.units.filter((u) => u.side !== h.side && attackSquares(ctx.s, knight).some((p) => eq(p, u.pos)));
        if (hit.length < 2) return;
        const marks = [knight, ...hit.filter((u) => !isRoyal(u)).slice(0, 2)];
        for (const u of marks) markBy(ctx, src.abilityId, h.id, 'cannotLead', { unitId: u.id }, untilMyNextTurn(h.id));
      },
    },
    'supremeInquisitor.zealotMob': {
      onLeadAnnounced: (ctx, src, lead) => {
        const si = src.hero!;
        if (lead.side === si.side || !touchesAdjacent(lead.opt, si.pos)) return;
        wound(ctx, hero(ctx.s, lead.heroId), val(ctx.s, si, src.abilityId, 'wounds'), { enemySide: si.side }, 'ability');
      },
    },
  },
  effects: {
    makePeace: {
      noRoll: () => true,
      filterLeads: (s, _src, unit, opts) => {
        if (!peaceHolds(unit)) return opts;
        return opts.filter((o) => !o.isBattle && !isInCheck({ units: unitsAfterLead(s, o) }, otherSide(unit.side)));
      },
      // Units may not be Destroyed and heroes take no wounds, except by the King (King's Supremacy ignores the token).
      canDestroy: (s, _src, _unit, by) => by === 'battle' && kingLeading(s),
      woundTaken: (s, _src, _h, amount, cause) => (cause === 'ram' && kingLeading(s) ? amount : 0),
      onLeadResolved: (ctx, src, lead, success) => {
        if (!success || lead.unit.type !== 'king') return;
        const t = ctx.s.turn.lead;
        if ((t?.destroyed ?? []).length || (t?.rams ?? []).some((r) => !r.friendly)) removeEffect(ctx, src.effect!.id, 'kingsSupremacy');
      },
    },
    fervor: {
      occupied: (_s, src, p) => effectSquares(src.effect!).some((q) => eq(q, p)),
      onLeadResolved: (ctx, src, lead, success) => {
        const owner = srcHero(ctx.s, src);
        const sq = effectSquares(src.effect!)[0];
        if (success && lead.side !== owner.side && [lead.opt.to, ...lead.opt.path].some((p) => eq(p, sq))) removeEffect(ctx, src.effect!.id, 'cleared');
      },
      onHeroEnters: (ctx, src, h) => {
        const owner = srcHero(ctx.s, src);
        if (h.side === owner.side || !eq(h.pos, effectSquares(src.effect!)[0])) return;
        removeEffect(ctx, src.effect!.id, 'cleared');
        wound(ctx, h, Number(src.effect!.data.wounds), { enemySide: owner.side }, 'ability');
      },
      onTurnEnd: (ctx, src) => fervorStep(ctx, src),
    },
    sacrifice: {
      onTurnEnd: (ctx, src) => {
        const e = src.effect!;
        const owner = srcHero(ctx.s, src);
        if (ctx.s.activeHeroId !== owner.id || ctx.s.turnNumber <= Number(e.data.since)) return;
        removeEffect(ctx, e.id, 'done');
        const pawn = ctx.s.units.find((u) => u.id === targetUnitId(e));
        if (!pawn) return;
        const at = { ...pawn.pos };
        if (!onStartingSquareOfType(pawn)) destroyByAbility(ctx, owner, [pawn]);
        for (const x of ctx.s.heroes.filter((x) => x.side !== owner.side && !x.status.unconscious && chebyshev(x.pos, at) <= Number(e.data.radius))) {
          wound(ctx, x, Number(e.data.wounds), { enemySide: owner.side }, 'ability');
        }
      },
    },
    dream: {
      onLeadAnnounced: (ctx, src, lead) => {
        const e = src.effect!;
        const t = e.target as { unitType: UnitType; side: string };
        if (lead.side !== t.side || lead.unit.type !== t.unitType || ctx.s.turnNumber !== Number(e.data.turn)) return;
        removeEffect(ctx, e.id, 'used');
        wound(ctx, activeHero(ctx.s), Number(e.data.wounds), { enemySide: srcHero(ctx.s, src).side }, 'ability');
      },
    },
    martyrdom: {
      movementCap: (_s, src, h) => (targetHeroId(src.effect) === h.id ? Number(src.effect!.data.movement) : null),
    },
  },
};

/** Religious Fervor: at the end of the Cultist's next turn a Pawn (Bloodied: the Bishop); a turn later the Bishop. */
function fervorStep(ctx: Ctx, src: HookSrc): void {
  const e = src.effect!;
  const owner = srcHero(ctx.s, src);
  if (ctx.s.activeHeroId !== owner.id || ctx.s.turnNumber <= Number(e.data.since)) return;
  const sq = effectSquares(e)[0];
  const step = Number(e.data.step) + 1;
  e.data.step = step;
  const bloodiedAtUse = Boolean(e.data.bloodied);
  const type: UnitType = step === 1 && !bloodiedAtUse ? 'pawn' : 'bishop';
  if (unitAt(ctx.s, sq)?.side !== undefined && unitAt(ctx.s, sq)!.side !== owner.side) {
    removeEffect(ctx, e.id, 'blocked');
    return;
  }
  try {
    createSpecial(ctx, { side: owner.side, type, at: sq, shareFriendly: true });
  } catch {
    /* would give check or the square is full: nothing is created */
  }
  if (type === 'bishop') removeEffect(ctx, e.id, 'done');
}

/** The Lead being resolved is a King's. */
const kingLeading = (s: import('../model/state.ts').GameState): boolean => s.units.find((u) => u.id === s.turn.lead?.unitId)?.type === 'king';
