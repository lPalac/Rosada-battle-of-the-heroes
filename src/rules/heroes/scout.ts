// Scout and its Epic forms: Scoundrel, Spy Master, Royal Assassin (Hero Rules 2_0).
import { add, adjacent8, c, chebyshev, eq, inGrid, sign } from '../board.ts';
import { isProtected, kingOf } from '../check.ts';
import { emit, fail, hero, type Ctx } from '../ctx.ts';
import { heroIsBloodied } from '../generation.ts';
import { heroEntered, queueDecision, wound } from '../heroes.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Hero } from '../model/hero.ts';
import type { GameState } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import { otherSide, type Coord } from '../model/types.ts';
import { attackSquares, enemyRoyalRank, unitAt, unitsAt } from '../paths.ts';
import {
  effectSquares, effectsOfKind, isEmpty, isOccupied, nextTurn, pushUnit, removeEffect, thisTurn,
  untilMyNextTurn,
} from '../abilities/effects.ts';
import { abilityCost } from '../abilities/engine.ts';
import { affectable, heroOf, isRoyal, onStartingSquareOfType, squareOf, startingSquares, unitOf } from '../abilities/targets.ts';
import type { AbilityCall, HeroModule, HookSrc, Hooks } from '../abilities/types.ts';
import { destroyByAbility } from '../abilities/units.ts';
import {
  abilityLead, backDir, canPushHero, leadable, leadTargets, mark, markBy, moveHeroTo, optionsOf, pickOption, srcHero, targetUnitId,
  touchesAdjacent, val,
} from './util.ts';

/** Elusive and its Epic versions: 2 wounds less from Rams, may end a Move on enemy units (units there cannot Ram). */
const elusive: Hooks = {
  allowEndOnEnemy: (_s, src, h) => src.hero!.id === h.id,
  woundTaken: (s, src, h, amount, cause) => (cause === 'ram' && src.hero!.id === h.id ? Math.max(0, amount - val(s, h, src.abilityId, 'ramReduction')) : amount),
};

const inRange = (c0: AbilityCall, p: Coord) => chebyshev(p, c0.h.pos) <= c0.h.range;
const enemyUnitsWhere = (c0: AbilityCall, pred: (u: Unit) => boolean): AbilityTarget[][] =>
  c0.s.units.filter((u) => u.side !== c0.h.side && affectable(c0.s, u, !!c0.def.flags.notRoyalty) && pred(u)).map((u) => [{ unitId: u.id }]);

/** Push a hero one square; returns whether it moved. Off the grid or into a King's square: no push. */
function pushHero(ctx: Ctx, h: Hero, dir: Coord): boolean {
  if (!canPushHero(ctx.s, h)) return false;
  const to = add(h.pos, dir);
  if (!inGrid(to) || unitsAt(ctx.s, to).some((u) => u.type === 'king')) return false;
  const from = h.pos;
  h.pos = to;
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to, reason: 'push' });
  heroEntered(ctx, h);
  return true;
}

/** Grotto pairs: one square in each wilderness column (x = 0 and x = 9, between the taverns). */
function grottoChoices(s: GameState): string[] {
  const out: string[] = [];
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) if (isEmpty(s, c(0, a)) && isEmpty(s, c(9, b))) out.push(`0,${a}|9,${b}`);
  return out;
}

/** Regicide: the enemy Queens (or Bishops, with no Queen) that were unprotected before this turn's Lead. */
function regicideTargets(c0: AbilityCall): AbilityTarget[][] {
  const enemy = otherSide(c0.h.side);
  const queens = c0.s.units.filter((u) => u.side === enemy && u.type === 'queen');
  const kind = queens.length ? 'queen' : 'bishop';
  const snap = effectsOfKind(c0.s, 'regicideWatch').find((e) => e.source.heroId === c0.h.id);
  const unprotected = (u: Unit) => (snap ? (snap.data.unprotected as string[]).includes(u.id) : !isProtected(c0.s, u));
  return c0.s.units.filter((u) => u.side === enemy && u.type === kind && chebyshev(u.pos, c0.h.pos) <= 1 && unprotected(u)).map((u) => [{ unitId: u.id }]);
}

/** Red Carpet: the Queen's Battle options with an enemy unit (not royalty). */
const redCarpetLeads = (c0: AbilityCall) =>
  leadable(c0.s, c0.h).filter((u) => u.type === 'queen').flatMap((u) => optionsOf(c0.s, u))
    .filter((o) => o.isBattle && c0.s.units.filter((u) => o.battleUnitIds.includes(u.id)).every((u) => !isRoyal(u)));

/** Counterintelligence: squares the marked unit may escape to, as if Led, not checking the King. */
function escapeSquares(s: GameState, unit: Unit): Coord[] {
  const enemyKing = kingOf(s, otherSide(unit.side));
  return optionsOf(s, { ...unit, kind: 'main' })
    .filter((o) => !o.isBattle && !isOccupied(s, o.to))
    .filter((o) => !enemyKing || !leadGivesCheck(s, unit, o.to))
    .map((o) => o.to);
}

function leadGivesCheck(s: GameState, unit: Unit, to: Coord): boolean {
  const enemyKing = kingOf(s, otherSide(unit.side))!;
  const moved = { ...unit, pos: to };
  const view = { units: s.units.map((u) => (u.id === unit.id ? moved : u)) };
  return attackSquares(view, moved).some((p) => eq(p, enemyKing.pos));
}

export const SCOUT: HeroModule = {
  impls: {
    'scout.bearTraps': {
      condition: (c0) => !unitAt(c0.s, c0.h.pos) && !effectsOfKind(c0.s, 'bearTrap').some((e) => effectSquares(e).some((q) => eq(q, c0.h.pos))),
      effect: (ctx, c0) => void mark(ctx, c0, 'bearTrap', { square: { ...c0.h.pos } }, { at: 'removed' }, { penalty: c0.v('penalty'), wounds: c0.v('wounds') }),
    },
    'scout.poisonWater': {
      targets: (c0) => enemyUnitsWhere(c0, (u) => eq(u.pos, c0.h.pos)),
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        mark(ctx, c0, 'cannotLead', { unitId: u.id }, nextTurn(ctx.s));
        mark(ctx, c0, 'leadModifier', { unitId: u.id }, { at: 'epicStage' }, { value: c0.v('penalty'), afterTurn: ctx.s.turnNumber + 1 });
      },
    },
    'scoundrel.bushwack': {
      targets: (c0) => c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && chebyshev(x.pos, c0.h.pos) <= 1).map((x) => [{ heroId: x.id }]),
      effect: (ctx, c0, t) => {
        const target = heroOf(ctx.s, t[0]);
        wound(ctx, target, c0.v('wounds'), { enemySide: c0.h.side }, 'ability');
        const dir = c(sign(target.pos.x - c0.h.pos.x), sign(target.pos.y - c0.h.pos.y));
        if (target.status.unconscious || (dir.x === 0 && dir.y === 0) || target.heroUnitId) return;
        if (pushHero(ctx, target, dir) && unitsAt(ctx.s, target.pos).some((u) => u.side === c0.h.side)) {
          wound(ctx, target, c0.v('extra'), { enemySide: c0.h.side }, 'ability');
        }
      },
    },
    'scoundrel.massConfusion': {
      targets: (c0) =>
        c0.s.units
          .filter((u) => u.side === c0.h.side && u.kind === 'main' && u.type === 'pawn' && inRange(c0, u.pos))
          .filter((u) => startingSquares(otherSide(c0.h.side), 'pawn').some((p) => eq(p, u.pos)))
          .map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => queueDecision(ctx, { type: 'promotion', unitId: unitOf(ctx.s, t[0]).id, chooserHeroId: c0.h.id }),
    },
    'scoundrel.misdirection': {
      targets: (c0) =>
        enemyUnitsWhere(c0, (u) => u.type === 'pawn' && chebyshev(u.pos, c0.h.pos) <= 1 && !onStartingSquareOfType(u))
          .filter((t) => {
            const u = unitOf(c0.s, t[0]);
            const to = add(u.pos, backDir(u));
            return inGrid(to) && !isOccupied(c0.s, to) && to.y >= 1 && to.y <= 8;
          }),
      effect: (ctx, c0, t) => {
        const u = unitOf(ctx.s, t[0]);
        pushUnit(ctx, u, backDir(u));
      },
    },
    'scoundrel.highTreason': {
      targets: (c0) => c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'queen' && inRange(c0, u.pos)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => {
        const q = unitOf(ctx.s, t[0]);
        const around = ctx.s.units.filter((u) => u.side !== c0.h.side && u.type !== 'king' && chebyshev(u.pos, q.pos) <= 1);
        destroyByAbility(ctx, c0.h, [q]);
        destroyByAbility(ctx, c0.h, around);
      },
    },
    'spyMaster.smugglersGrotto': {
      // Placed when the Epic Stage begins (an abilityChoice); this entry answers it.
      effect: () => fail('ABILITY_WRONG_TIMING', 'Placed at the Beginning of the Epic Stage', 'Hero Abilities'),
      choose: (ctx, heroId, choice) => {
        const [a, b] = choice.split('|').map((xy) => {
          const [x, y] = xy.split(',').map(Number);
          return c(x, y);
        });
        const h = hero(ctx.s, heroId);
        markBy(ctx, 'spyMaster.smugglersGrotto', h.id, 'grotto', { area: [a, b] }, { at: 'removed' }, { side: h.side });
      },
    },
    'spyMaster.evasive': {
      effect: () => fail('ABILITY_WRONG_TIMING', 'Always Active', 'Hero Abilities'),
      choose: (ctx, heroId, choice) => {
        if (choice === 'stay') return;
        const [x, y] = choice.split(',').map(Number);
        moveHeroTo(ctx, hero(ctx.s, heroId), c(x, y), 'evasive');
      },
    },
    'spyMaster.misinformation': {
      targets: (c0) => {
        const out: AbilityTarget[][] = [];
        for (const x of c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && !x.heroUnitId && inRange(c0, x.pos) && canPushHero(c0.s, x))) {
          for (const p of adjacent8(x.pos).filter((p) => isEmpty(c0.s, p))) out.push([{ heroId: x.id }, { square: p }]);
        }
        return out;
      },
      effect: (ctx, c0, t) => {
        const x = heroOf(ctx.s, t[0]);
        const to = squareOf(t[1]);
        pushHero(ctx, x, c(to.x - x.pos.x, to.y - x.pos.y));
      },
    },
    'spyMaster.infiltrate': {
      isLead: true,
      targets: (c0) =>
        c0.s.units
          .filter((u) => u.side === c0.h.side && u.type === 'pawn' && !u.tags?.includes('spy') && inRange(c0, u.pos))
          .filter((u) => !isOccupied(c0.s, c(u.pos.x, enemyRoyalRank(c0.h.side))))
          .map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => {
        // Using it again returns the previous Spy to an unoccupied starting Pawn square.
        for (const e of effectsOfKind(ctx.s, 'spy').filter((e) => e.source.heroId === c0.h.id)) {
          const old = ctx.s.units.find((u) => u.id === targetUnitId(e));
          removeEffect(ctx, e.id, 'replaced');
          if (!old) continue;
          old.tags = old.tags?.filter((x) => x !== 'spy');
          old.modifiedFrom = null;
          const home = startingSquares(old.side, 'pawn').sort((p, q) => Math.abs(p.x - old.pos.x) - Math.abs(q.x - old.pos.x)).find((p) => !isOccupied(ctx.s, p));
          if (home) old.pos = home;
        }
        const u = unitOf(ctx.s, t[0]);
        const from = u.pos;
        u.pos = c(u.pos.x, enemyRoyalRank(c0.h.side));
        u.tags = [...(u.tags ?? []), 'spy'];
        u.modifiedFrom = 'pawn';
        emit(ctx, { type: 'unitLed', unitId: u.id, from, to: u.pos, path: [u.pos] });
        mark(ctx, c0, 'spy', { unitId: u.id }, { at: 'removed' });
        ctx.s.turn.leadAttempted = true;
      },
    },
    'spyMaster.mislead': {
      targets: (c0) => enemyUnitsWhere(c0, (u) => inRange(c0, u.pos) && !onStartingSquareOfType(u)),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'cannotLead', { unitId: unitOf(ctx.s, t[0]).id }, nextTurn(ctx.s)),
    },
    'spyMaster.counterintelligence': {
      targets: (c0) => c0.s.units.filter((u) => u.side === c0.h.side && affectable(c0.s, u, true) && inRange(c0, u.pos)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'counterintelligence', { unitId: unitOf(ctx.s, t[0]).id }, untilMyNextTurn(c0.h.id)),
    },
    'royalAssassin.killOrder': {
      targets: (c0) => enemyUnitsWhere(c0, (u) => inRange(c0, u.pos)),
      effect: (ctx, c0, t) => {
        for (const e of effectsOfKind(ctx.s, 'killOrder').filter((e) => e.source.heroId === c0.h.id)) removeEffect(ctx, e.id, 'replaced');
        mark(ctx, c0, 'killOrder', { unitId: unitOf(ctx.s, t[0]).id }, { at: 'removed' }, { since: ctx.s.turnNumber });
      },
    },
    'royalAssassin.assassinateTheUnworthy': {
      simulate: true,
      targets: (c0) => {
        const king = kingOf(c0.s, c0.h.side);
        return king ? enemyUnitsWhere(c0, (u) => chebyshev(u.pos, c0.h.pos) <= 1 && chebyshev(u.pos, king.pos) <= 1) : [];
      },
      effect: (ctx, c0, t) => {
        if (!destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[0])]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
      },
    },
    'royalAssassin.reapTheWeary': {
      targets: (c0) => c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && eq(x.pos, c0.h.pos) && heroIsBloodied(c0.s, x)).map((x) => [{ heroId: x.id }]),
      effect: (ctx, c0, t) => {
        const x = heroOf(ctx.s, t[0]);
        wound(ctx, x, x.health, { enemySide: c0.h.side }, 'ability');
      },
    },
    'royalAssassin.redCarpet': {
      isLead: true,
      targets: (c0) => leadTargets(redCarpetLeads(c0)),
      effect: (ctx, c0, t) => {
        const opt = pickOption(redCarpetLeads(c0), t);
        const dir = c(sign(opt.to.x - opt.from.x), sign(opt.to.y - opt.from.y));
        mark(ctx, c0, 'redCarpet', { heroId: c0.h.id }, thisTurn(ctx.s), { dir, queen: opt.unitId });
        abilityLead(ctx, c0, unitOf(ctx.s, t[0]), opt);
      },
    },
    'royalAssassin.regicide': {
      simulate: true,
      targets: regicideTargets,
      effect: (ctx, c0, t) => {
        if (!destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[0])]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
      },
    },
  },
  passives: {
    'scout.elusive': elusive,
    'scoundrel.elusiveSabotage': {
      ...elusive,
      leadModifiers: (s, src, lead) => {
        const sc = src.hero!;
        if (lead.side === sc.side || isRoyal(lead.unit) || !eq(lead.opt.from, sc.pos)) return [];
        return [{ source: src.abilityId, value: val(s, sc, src.abilityId, 'penalty') }];
      },
    },
    'scoundrel.deviousGambit': {
      reaction: {
        cost: (s, src) => abilityCost(s, src.hero!.id, src.abilityId),
        usable: (s, src) => !s.abilityState[src.hero!.id]?.usedThisTurn.includes(src.abilityId),
        options: (s, src, opt) => {
          const sc = src.hero!;
          const attacker = s.units.find((u) => u.id === opt.unitId);
          if (!attacker || isRoyal(attacker)) return [];
          const victims = s.units.filter((u) => opt.battleUnitIds.includes(u.id));
          const hit = victims.some((v) => v.side === sc.side && chebyshev(v.pos, sc.pos) <= 1 && !isProtected(s, v));
          return hit ? [[{ unitId: attacker.id }]] : [];
        },
        apply: (ctx, src, t, opt) => {
          markBy(ctx, src.abilityId, src.hero!.id, 'deviousGambit', { heroId: src.hero!.id }, thisTurn(ctx.s), { attacker: (t[0] as { unitId: string }).unitId });
          return opt;
        },
      },
    },
    'spyMaster.evasive': {
      ...elusive,
      onRammed: (ctx, src, h) => {
        if (src.hero!.id !== h.id || h.status.unconscious) return;
        const grottos = effectsOfKind(ctx.s, 'grotto').filter((e) => e.data.side === h.side).flatMap(effectSquares);
        if (grottos.length) queueDecision(ctx, { type: 'abilityChoice', heroId: h.id, abilityId: 'spyMaster.evasive', choices: ['stay', ...grottos.map((p) => `${p.x},${p.y}`)] });
      },
    },
    'spyMaster.smugglersGrotto': {
      onEpicStage: (ctx, src) => {
        const h = src.hero!;
        const choices = grottoChoices(ctx.s);
        if (choices.length) queueDecision(ctx, { type: 'abilityChoice', heroId: h.id, abilityId: 'spyMaster.smugglersGrotto', choices });
      },
    },
    'royalAssassin.patientPreparation': {
      ...elusive,
      leadModifiers: (s, src, lead) => {
        const ra = src.hero!;
        if (lead.heroId !== ra.id || s.turn.movePath.length > 0) return [];
        return [{ source: src.abilityId, value: val(s, ra, src.abilityId, 'bonus') }];
      },
    },
    'royalAssassin.regicide': {
      // Remember which enemy Queens / Bishops were unprotected before the Lead.
      onLeadAnnounced: (ctx, src, lead) => {
        const ra = src.hero!;
        if (lead.heroId !== ra.id) return;
        const unprotected = ctx.s.units.filter((u) => u.side !== ra.side && (u.type === 'queen' || u.type === 'bishop') && !isProtected(ctx.s, u)).map((u) => u.id);
        markBy(ctx, src.abilityId, ra.id, 'regicideWatch', { none: true }, thisTurn(ctx.s), { unprotected });
      },
    },
  },
  effects: {
    bearTrap: {
      leadModifiers: (s, src, lead) => {
        const owner = srcHero(s, src);
        const sq = effectSquares(src.effect!)[0];
        if (lead.side === owner.side || !touchesAdjacent(lead.opt, sq)) return [];
        return [{ source: src.abilityId, value: Number(src.effect!.data.penalty) }];
      },
      onHeroEnters: (ctx, src, h) => {
        const owner = srcHero(ctx.s, src);
        if (h.side === owner.side || !eq(h.pos, effectSquares(src.effect!)[0])) return;
        removeEffect(ctx, src.effect!.id, 'sprung');
        wound(ctx, h, Number(src.effect!.data.wounds), { enemySide: owner.side }, 'ability');
      },
      onLeadResolved: (ctx, src, lead, success) => {
        if (success && lead.side !== srcHero(ctx.s, src).side && eq(lead.opt.to, effectSquares(src.effect!)[0])) removeEffect(ctx, src.effect!.id, 'cleared');
      },
    },
    counterintelligence: {
      filterLeads: (_s, src, unit, opts) => (unit.id === targetUnitId(src.effect) ? opts.filter((o) => !o.isBattle) : opts),
      reaction: {
        cost: () => 0,
        usable: () => true,
        options: (s, src, opt) => {
          const unit = s.units.find((u) => u.id === targetUnitId(src.effect));
          if (!unit || !opt.battleUnitIds.includes(unit.id)) return [];
          return escapeSquares(s, unit).map((p) => [{ square: p }]);
        },
        apply: (ctx, src, t, opt) => {
          const unit = ctx.s.units.find((u) => u.id === targetUnitId(src.effect))!;
          const from = unit.pos;
          unit.pos = squareOf(t[0]);
          emit(ctx, { type: 'unitLed', unitId: unit.id, from, to: unit.pos, path: [unit.pos] });
          const battleUnitIds = opt.battleUnitIds.filter((id) => id !== unit.id);
          return { ...opt, battleUnitIds, isBattle: battleUnitIds.length > 0 };
        },
      },
    },
    killOrder: {
      onTurnEnd: (ctx, src) => {
        const e = src.effect!;
        const ra = srcHero(ctx.s, src);
        if (ctx.s.activeHeroId !== ra.id || ctx.s.turnNumber <= Number(e.data.since)) return;
        const unit = ctx.s.units.find((u) => u.id === targetUnitId(e));
        if (unit && chebyshev(unit.pos, ra.pos) <= 1 && destroyByAbility(ctx, ra, [unit]).length) removeEffect(ctx, e.id, 'done');
      },
    },
    deviousGambit: {
      onLeadResolved: (ctx, src, _lead, success) => {
        const e = src.effect!;
        removeEffect(ctx, e.id, 'used');
        const attacker = ctx.s.units.find((u) => u.id === e.data.attacker);
        if (success && attacker) destroyByAbility(ctx, srcHero(ctx.s, src), [attacker]);
      },
    },
    redCarpet: {
      onLeadResolved: (ctx, src, lead, success) => {
        const e = src.effect!;
        const owner = srcHero(ctx.s, src);
        if (lead.heroId !== owner.id) return;
        removeEffect(ctx, e.id, 'used');
        if (!success) return;
        const queen = ctx.s.units.find((u) => u.id === e.data.queen);
        if (!queen) return;
        const dir = e.data.dir as Coord;
        // Continue the Battle with the next unit in the Queen's path.
        for (let p = add(queen.pos, dir); p.x >= 1 && p.x <= 8 && p.y >= 1 && p.y <= 8; p = add(p, dir)) {
          const here = unitsAt(ctx.s, p);
          if (!here.length) continue;
          const foes = here.filter((u) => u.side !== owner.side);
          if (!foes.length || foes.some(isRoyal)) return;
          if (destroyByAbility(ctx, owner, foes).length === foes.length && !unitsAt(ctx.s, p).length) {
            const from = queen.pos;
            queen.pos = p;
            emit(ctx, { type: 'unitLed', unitId: queen.id, from, to: p, path: [p] });
          }
          return;
        }
      },
    },
    grotto: {
      isTavernFor: (_s, src, h, p) => h.side === src.effect!.data.side && effectSquares(src.effect!).some((q) => eq(q, p)) && isSpyOrAlly(h, src),
      extraMoveSquares: (_s, src, h) => {
        if (h.side !== src.effect!.data.side) return [];
        const [a, b] = effectSquares(src.effect!);
        return eq(h.pos, a) ? [b] : eq(h.pos, b) ? [a] : [];
      },
    },
    spy: {},
    regicideWatch: {},
  },
};

/** The Grotto is for the Spy Master and their ally: the owner's side. */
const isSpyOrAlly = (h: Hero, src: HookSrc) => h.side === src.effect!.data.side;

