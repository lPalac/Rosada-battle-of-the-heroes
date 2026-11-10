// Magus and its Epic forms: Necromancer, Grand Arcanist, Chronomonger (Hero Rules 2_0).
import { c, chebyshev, eq, inGrid, isBattlefield } from '../board.ts';
import { activeHero, emit, fail, type Ctx } from '../ctx.ts';
import { heal, queueDecision, wound } from '../heroes.ts';
import { restartTurn } from '../turn.ts';
import type { AbilityTarget } from '../model/actions.ts';
import type { Effect, GameState } from '../model/state.ts';
import type { Unit } from '../model/unit.ts';
import { otherSide, type Coord, type UnitType } from '../model/types.ts';
import { attackSquares, unitAt } from '../paths.ts';
import { effectSquares, effectsOfKind, endOfMyNextTurn, isEmpty, isOccupied, removeEffect, thisTurn } from '../abilities/effects.ts';
import { affectable, heroOf, inEnemyRoyalRank, isRoyal, squareOf, startingSquares, unitOf } from '../abilities/targets.ts';
import type { AbilityCall, HeroModule, HookSrc } from '../abilities/types.ts';
import { createSpecial, destroyByAbility } from '../abilities/units.ts';
import { abilityLead, heroesAt, jumpOption, leadable, leadTargets, mark, optionsOf, pickOption, srcHero, targetUnitId, val } from './util.ts';

const enemyHeroesInRange = (c0: AbilityCall): AbilityTarget[][] =>
  c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && chebyshev(x.pos, c0.h.pos) <= c0.h.range).map((x) => [{ heroId: x.id }]);

const bonusNextLead = (ctx: Ctx, c0: AbilityCall, value: number) =>
  mark(ctx, c0, 'nextLeadBonus', { heroId: c0.h.id }, thisTurn(ctx.s), { value });

/** Souls Clash pairs: an adjacent friendly Pawn and an enemy Pawn in its file within 3 squares. */
function soulsPairs(c0: AbilityCall): AbilityTarget[][] {
  const out: AbilityTarget[][] = [];
  const d = c0.v('distance');
  for (const f of c0.s.units.filter((u) => u.side === c0.h.side && u.type === 'pawn' && chebyshev(u.pos, c0.h.pos) <= 1)) {
    for (const e of c0.s.units.filter((u) => u.side !== c0.h.side && u.type === 'pawn' && u.pos.x === f.pos.x && Math.abs(u.pos.y - f.pos.y) <= d)) {
      if (affectable(c0.s, e)) out.push([{ unitId: f.id }, { unitId: e.id }]);
    }
  }
  return out;
}

/** 2×2 areas fully in Range (Fireball); the anchor is the lower-left square. */
function fireballAreas(c0: AbilityCall): Coord[][] {
  const out: Coord[][] = [];
  const r = c0.h.range;
  for (let x = c0.h.pos.x - r; x <= c0.h.pos.x + r - 1; x++) {
    for (let y = c0.h.pos.y - r; y <= c0.h.pos.y + r - 1; y++) {
      const area = [c(x, y), c(x + 1, y), c(x, y + 1), c(x + 1, y + 1)];
      if (area.every((p) => inGrid(p) && chebyshev(p, c0.h.pos) <= r)) out.push(area);
    }
  }
  return out;
}

/** Portal pairs: two empty Battlefield squares in Range, same colour, not in the enemy's Royal Rank. */
function portalPairs(c0: AbilityCall): AbilityTarget[][] {
  const r = c0.h.range;
  const squares: Coord[] = [];
  for (let x = c0.h.pos.x - r; x <= c0.h.pos.x + r; x++) {
    for (let y = c0.h.pos.y - r; y <= c0.h.pos.y + r; y++) {
      const p = c(x, y);
      if (isBattlefield(p) && isEmpty(c0.s, p) && !inEnemyRoyalRank(c0.h.side, p)) squares.push(p);
    }
  }
  const out: AbilityTarget[][] = [];
  for (let i = 0; i < squares.length; i++) {
    for (let j = i + 1; j < squares.length; j++) {
      if ((squares[i].x + squares[i].y) % 2 === (squares[j].x + squares[j].y) % 2) out.push([{ square: squares[i] }, { square: squares[j] }]);
    }
  }
  return out;
}

/** Rapid March: a Pawn on its starting square Led 3 squares forward (no en passant against it). */
function rapidMarchOption(s: GameState, u: Unit) {
  if (u.type !== 'pawn' || u.tags?.includes('spy') || !startingSquares(u.side, 'pawn').some((p) => eq(p, u.pos))) return null;
  const f = u.side === 'light' ? 1 : -1;
  const path = [1, 2, 3].map((k) => c(u.pos.x, u.pos.y + k * f));
  if (path.some((p) => !isBattlefield(p) || unitAt(s, p))) return null;
  return jumpOption(s, u, path[2], path);
}

/** Certainty & Death: a friendly unit in Range (not a Hero Unit) with any Lead, which succeeds without a roll. */
const certaintyLeads = (c0: AbilityCall) => leadable(c0.s, c0.h).filter((u) => u.kind !== 'hero').flatMap((u) => optionsOf(c0.s, u));

/** Destroyed friendly units come back on a starting square of their type (Temporal Flux). */
function fluxReturn(ctx: Ctx, src: HookSrc, unit: Unit): void {
  const owner = srcHero(ctx.s, src);
  if (unit.side !== owner.side || isRoyal(unit) || unit.kind === 'hero') return;
  const type = (unit.modifiedFrom ?? unit.type) as UnitType;
  const free = startingSquares(unit.side, type).find((p) => !isOccupied(ctx.s, p));
  if (!free) return;
  if (unit.kind === 'main') ctx.s.graveyard = ctx.s.graveyard.filter((g) => g.id !== unit.id);
  try {
    const back = createSpecial(ctx, { side: unit.side, type, at: free, kind: unit.kind, tags: unit.tags });
    if (unit.kind === 'main') back.originalType = unit.originalType;
  } catch {
    if (unit.kind === 'main') ctx.s.graveyard.push(unit); // would give check: it stays Destroyed
  }
}

export const MAGUS: HeroModule = {
  impls: {
    'magus.futureSight': {
      effect: (ctx, c0) => {
        wound(ctx, c0.h, c0.v('wounds'), { enemySide: null }, 'self');
        bonusNextLead(ctx, c0, c0.v('bonus'));
      },
    },
    'magus.flamingBolt': {
      targets: enemyHeroesInRange,
      effect: (ctx, c0, t) => wound(ctx, heroOf(ctx.s, t[0]), c0.v('wounds'), { enemySide: c0.h.side }, 'ability'),
    },
    'magus.soulsClash': {
      simulate: true,
      targets: soulsPairs,
      effect: (ctx, c0, t) => {
        const done = destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[0])]);
        const done2 = destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[1])]);
        if (!done.length || !done2.length) fail('ABILITY_BAD_TARGET', 'Those units cannot be Destroyed now', 'Hero Abilities');
        heal(ctx, c0.h, c0.v('heal'), c0.def.id);
      },
    },
    'necromancer.bloodRitual': {
      effect: (ctx, c0) => {
        wound(ctx, c0.h, c0.v('wounds'), { enemySide: null }, 'self');
        bonusNextLead(ctx, c0, c0.v('bonus'));
      },
    },
    'necromancer.leechingTouch': {
      simulate: true,
      targets: (c0) =>
        c0.option === 'wound'
          ? c0.s.heroes.filter((x) => x.side !== c0.h.side && !x.status.unconscious && chebyshev(x.pos, c0.h.pos) <= 1).map((x) => [{ heroId: x.id }])
          : c0.s.units.filter((u) => u.side !== c0.h.side && u.kind === 'auxiliary' && chebyshev(u.pos, c0.h.pos) <= 1 && affectable(c0.s, u)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => {
        if (c0.option === 'wound') {
          wound(ctx, heroOf(ctx.s, t[0]), c0.v('wounds'), { enemySide: c0.h.side }, 'ability');
          heal(ctx, c0.h, c0.v('heal'), c0.def.id);
        } else {
          if (!destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[0])]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
          heal(ctx, c0.h, c0.v('auxHeal'), c0.def.id);
        }
      },
    },
    'necromancer.awakenTheDeathless': {
      targets: (c0) =>
        (['knight', 'bishop'] as const).flatMap((type) => startingSquares(c0.h.side, type).filter((p) => isEmpty(c0.s, p)).map((p) => [{ square: p }, { unitType: type }])),
      effect: (ctx, c0, t) => {
        const type = (t[1] as { unitType: UnitType }).unitType;
        wound(ctx, c0.h, c0.v('selfWounds'), { enemySide: null }, 'self');
        createSpecial(ctx, { side: c0.h.side, type, at: squareOf(t[0]), tags: ['undead'] });
      },
    },
    'necromancer.undeadLegions': {
      condition: (c0) => startingSquares(c0.h.side, 'pawn').some((p) => !isOccupied(c0.s, p)),
      effect: (ctx, c0) => {
        const made: Unit[] = [];
        for (const p of startingSquares(c0.h.side, 'pawn').filter((q) => !isOccupied(ctx.s, q))) {
          try {
            made.push(createSpecial(ctx, { side: c0.h.side, type: 'pawn', at: p, tags: ['undead'] }));
          } catch {
            /* a Pawn that would give check is not created (rulebook *Create*) */
          }
        }
        if (!made.length) fail('ABILITY_BAD_TARGET', 'No Pawn can be created', 'Hero Abilities');
        if (!c0.bloodied) {
          wound(ctx, c0.h, c0.v('baseWounds') + made.length, { enemySide: null }, 'self');
          return;
        }
        wound(ctx, c0.h, c0.v('baseWounds'), { enemySide: null }, 'self');
        // Bloodied: an instant Lead without Battle with one created Pawn (spec Q-48: no roll).
        const choices = made.flatMap((u) => optionsOf(ctx.s, u).filter((o) => !o.isBattle).map((o) => `${u.id}@${o.to.x},${o.to.y}`));
        if (choices.length) queueDecision(ctx, { type: 'abilityChoice', heroId: c0.h.id, abilityId: c0.def.id, choices: ['skip', ...choices] });
      },
      choose: (ctx, _heroId, choice) => {
        if (choice === 'skip') return;
        const [id, xy] = choice.split('@');
        const [x, y] = xy.split(',').map(Number);
        const unit = ctx.s.units.find((u) => u.id === id);
        if (!unit) return;
        const from = unit.pos;
        unit.pos = c(x, y);
        unit.hasBeenLed = true;
        emit(ctx, { type: 'unitLed', unitId: unit.id, from, to: unit.pos, path: [unit.pos] });
      },
    },
    'grandArcanist.magicBombardment': {
      simulate: true,
      targets: (c0) =>
        c0.option === 'wound'
          ? enemyHeroesInRange(c0)
          : c0.s.units.filter((u) => u.kind === 'auxiliary' && chebyshev(u.pos, c0.h.pos) <= 1 && affectable(c0.s, u)).map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => {
        if (c0.option === 'wound') wound(ctx, heroOf(ctx.s, t[0]), c0.v('wounds'), { enemySide: c0.h.side }, 'ability');
        else if (!destroyByAbility(ctx, c0.h, [unitOf(ctx.s, t[0])]).length) fail('ABILITY_BAD_TARGET', 'That unit cannot be Destroyed now', 'Hero Abilities');
      },
    },
    'grandArcanist.arcaneShackles': {
      targets: (c0) =>
        c0.s.units
          .filter((u) => u.side !== c0.h.side && affectable(c0.s, u, true) && chebyshev(u.pos, c0.h.pos) <= c0.h.range)
          .filter((u) => !effectsOfKind(c0.s, 'arcaneShackles').some((e) => targetUnitId(e) === u.id))
          .map((u) => [{ unitId: u.id }]),
      effect: (ctx, c0, t) => void mark(ctx, c0, 'arcaneShackles', { unitId: unitOf(ctx.s, t[0]).id }, endOfMyNextTurn(ctx.s, c0.h.id)),
    },
    'grandArcanist.conjurePortal': {
      targets: portalPairs,
      effect: (ctx, c0, t) => {
        for (const e of effectsOfKind(ctx.s, 'portal').filter((e) => e.source.heroId === c0.h.id)) removeEffect(ctx, e.id, 'replaced');
        mark(ctx, c0, 'portal', { area: [squareOf(t[0]), squareOf(t[1])] }, { at: 'removed' });
      },
    },
    'grandArcanist.summonShadowDemon': {
      condition: (c0) => isBattlefield(c0.h.pos) && !isOccupied(c0.s, c0.h.pos),
      targets: () => (['rook', 'bishop', 'knight', 'pawn'] as const).map((unitType) => [{ unitType }]),
      effect: (ctx, c0, t) => {
        // The previous Demon vanishes (leaves play; it is not Destroyed).
        for (const e of effectsOfKind(ctx.s, 'demon').filter((e) => e.source.heroId === c0.h.id)) {
          const id = targetUnitId(e);
          ctx.s.units = ctx.s.units.filter((u) => u.id !== id);
          removeEffect(ctx, e.id, 'vanished');
        }
        const type = (t[0] as { unitType: UnitType }).unitType;
        const unit = createSpecial(ctx, { side: c0.h.side, type, at: c0.h.pos, tags: ['demon'] });
        mark(ctx, c0, 'demon', { unitId: unit.id }, { at: 'removed' });
      },
    },
    'grandArcanist.fireball': {
      targets: (c0) => fireballAreas(c0).map((a) => [{ square: a[0] }]),
      effect: (ctx, c0, t) => {
        const p = squareOf(t[0]);
        const area = [p, c(p.x + 1, p.y), c(p.x, p.y + 1), c(p.x + 1, p.y + 1)];
        mark(ctx, c0, 'fireball', { area }, { at: 'removed' }, { wounds: c0.v('wounds'), turn: ctx.s.turnNumber + 1 });
      },
    },
    'chronomonger.noTimeToLose': {
      // Passive; this entry answers its choice (keep the turn: starting square, 1 health).
      effect: () => {},
      choose: (ctx, heroId, choice) => {
        if (choice !== 'use') return;
        const s = ctx.s;
        const h = s.heroes.find((x) => x.id === heroId)!;
        const isTavernChoice = (d: { type: string; heroId?: string } | null) => d?.type === 'unconsciousTavern' && d.heroId === heroId;
        s.decisionQueue = s.decisionQueue.filter((d) => !isTavernChoice(d));
        if (isTavernChoice(s.pendingDecision)) s.pendingDecision = s.decisionQueue.shift() ?? null;
        h.status.unconscious = false;
        h.status.skipNextTurn = false;
        h.health = val(s, h, 'chronomonger.noTimeToLose', 'health');
        const from = h.pos;
        h.pos = { ...h.startSquare };
        emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: h.pos, reason: 'noTimeToLose' });
      },
    },
    'chronomonger.certaintyAndDeath': {
      isLead: true,
      targets: (c0) => leadTargets(certaintyLeads(c0)),
      effect: (ctx, c0, t) => {
        for (const e of effectsOfKind(ctx.s, 'certainty').filter((e) => e.source.heroId === c0.h.id)) e.data.doomedTurn = ctx.s.turnNumber;
        const unit = unitOf(ctx.s, t[0]);
        const opt = pickOption(certaintyLeads(c0), t);
        mark(ctx, c0, 'certainty', { unitId: unit.id }, { at: 'removed' }, { since: ctx.s.turnNumber });
        abilityLead(ctx, c0, unit, opt, { auto: true });
      },
    },
    'chronomonger.rapidMarch': {
      targets: (c0) => (leadable(c0.s, c0.h).some((u) => rapidMarchOption(c0.s, u)) ? [[]] : []),
      effect: (ctx, c0) => void mark(ctx, c0, 'rapidMarch', { heroId: c0.h.id }, thisTurn(ctx.s)),
    },
    'chronomonger.timeyWimeyShift': {
      targets: (c0) => c0.s.heroes.filter((x) => x.side === c0.h.side && x.id !== c0.h.id && !x.status.unconscious).map((x) => [{ heroId: x.id }]),
      effect: (ctx, c0, t) => {
        const ally = heroOf(ctx.s, t[0]);
        const mine = c0.h.turnOrder;
        c0.h.turnOrder = ally.turnOrder;
        ally.turnOrder = mine;
        ctx.s.activeHeroId = ally.id;
        restartTurn(ctx);
      },
    },
    'chronomonger.convergeTimelines': {
      targets: (c0) => {
        const lead = c0.s.turn.lead;
        if (!lead?.success) return [];
        const unit = c0.s.units.find((u) => u.id === lead.unitId);
        if (!unit || unit.kind === 'hero' || isRoyal(unit) || isOccupied(c0.s, lead.from)) return [];
        const enemyKing = c0.s.units.find((u) => u.type === 'king' && u.side !== c0.h.side);
        if (enemyKing && attackSquares(c0.s, unit).some((p) => eq(p, enemyKing.pos))) return [];
        return [[]];
      },
      effect: (ctx, c0) => {
        const lead = ctx.s.turn.lead!;
        const unit = ctx.s.units.find((u) => u.id === lead.unitId)!;
        const copy = createSpecial(ctx, { side: unit.side, type: unit.type, at: lead.from, tags: ['clone'] });
        mark(ctx, c0, 'converge', { none: true }, { at: 'removed' }, { a: unit.id, b: copy.id, kind: unit.kind });
      },
      choose: (ctx, _heroId, choice) => {
        const e = effectsOfKind(ctx.s, 'converge').find((x) => x.data.a === choice || x.data.b === choice);
        if (!e) return;
        const gone = e.data.a === choice ? (e.data.b as string) : (e.data.a as string);
        ctx.s.units = ctx.s.units.filter((u) => u.id !== gone);
        becomeOriginal(ctx, e, choice);
      },
    },
    'chronomonger.temporalFlux': {
      condition: (c0) => !effectsOfKind(c0.s, 'temporalFlux').some((e) => e.source.heroId === c0.h.id),
      effect: (ctx, c0) => void mark(ctx, c0, 'temporalFlux', { square: { ...c0.h.startSquare } }, endOfMyNextTurn(ctx.s, c0.h.id)),
    },
  },
  passives: {
    'necromancer.graveSacrifice': {
      generationBonus: (s, src, side) => {
        const h = src.hero!;
        if (h.side !== side || h.id !== s.activeHeroId) return 0;
        return Math.floor(s.graveyard.filter((u) => u.side === side).length / val(s, h, src.abilityId, 'per'));
      },
    },
    'necromancer.soulSyphon': {
      onDestroyed: (ctx, src, unit) => {
        const h = src.hero!;
        if (unit.kind === 'main' && chebyshev(unit.pos, h.pos) <= 1) heal(ctx, h, val(ctx.s, h, src.abilityId, 'heal'), src.abilityId);
      },
    },
    'chronomonger.noTimeToLose': {
      onUnconscious: (ctx, src, h) => {
        if (src.hero!.id !== h.id) return;
        const d = { type: 'abilityChoice' as const, heroId: h.id, abilityId: 'chronomonger.noTimeToLose', choices: ['use', 'decline'] };
        const s = ctx.s;
        // Asked before the Unconscious tavern choice.
        if (s.pendingDecision?.type === 'unconsciousTavern' && s.pendingDecision.heroId === h.id) {
          s.decisionQueue.unshift(s.pendingDecision);
          s.pendingDecision = d;
        } else queueDecision(ctx, d);
      },
    },
  },
  effects: {
    arcaneShackles: {
      filterLeads: (_s, src, unit, opts) => (unit.id === targetUnitId(src.effect) ? [] : opts.filter((o) => !o.battleUnitIds.includes(targetUnitId(src.effect) ?? ''))),
      canDestroy: (_s, src, unit, by) => !(by === 'battle' && unit.id === targetUnitId(src.effect)),
    },
    portal: {
      occupied: (_s, src, p) => effectSquares(src.effect!).some((q) => eq(q, p)),
      filterLeads: (s, src, unit, opts) => portalLeads(s, src.effect!, unit, opts),
      onHeroEnters: (ctx, src, h) => {
        const [a, b] = effectSquares(src.effect!);
        const to = eq(h.pos, a) ? b : eq(h.pos, b) ? a : null;
        if (!to) return;
        const from = h.pos;
        h.pos = { ...to };
        emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: h.pos, reason: 'portal' });
      },
    },
    demon: {
      // The Demon can only be Led into Battle.
      filterLeads: (_s, src, unit, opts) => (unit.id === targetUnitId(src.effect) ? opts.filter((o) => o.isBattle) : opts),
    },
    fireball: {
      onTurnEnd: (ctx, src) => {
        const e = src.effect!;
        if (ctx.s.turnNumber < Number(e.data.turn)) return;
        const owner = srcHero(ctx.s, src);
        const area = effectSquares(e);
        removeEffect(ctx, e.id, 'exploded');
        for (const p of area) {
          for (const x of heroesAt(ctx.s, p)) wound(ctx, x, Number(e.data.wounds), { enemySide: x.side !== owner.side ? owner.side : null }, 'ability');
        }
        destroyByAbility(ctx, owner, ctx.s.units.filter((u) => area.some((p) => eq(p, u.pos))));
        for (const other of [...ctx.s.effects]) if (effectSquares(other).some((q) => area.some((p) => eq(p, q)))) removeEffect(ctx, other.id, 'fireball');
      },
    },
    certainty: {
      noRoll: (_s, src, lead) => lead.unit.id === targetUnitId(src.effect),
      onLeadResolved: (ctx, src, lead) => {
        const e = src.effect!;
        if (lead.unit.id === targetUnitId(e) && ctx.s.turnNumber !== e.data.since) e.data.doomedTurn = ctx.s.turnNumber;
      },
      onTurnEnd: (ctx, src) => {
        const e = src.effect!;
        if (e.data.doomedTurn !== ctx.s.turnNumber) return;
        removeEffect(ctx, e.id, 'used');
        const unit = ctx.s.units.find((u) => u.id === targetUnitId(e));
        if (unit) destroyByAbility(ctx, null, [unit], otherSide(unit.side));
      },
    },
    rapidMarch: {
      filterLeads: (s, src, unit, opts) => {
        const owner = srcHero(s, src);
        if (unit.side !== owner.side || s.activeHeroId !== owner.id) return opts;
        const extra = rapidMarchOption(s, unit);
        return extra ? [...opts, extra] : opts;
      },
    },
    converge: {
      onDestroyed: (ctx, src, unit) => {
        const e = src.effect!;
        if (unit.id !== e.data.a && unit.id !== e.data.b) return;
        becomeOriginal(ctx, e, unit.id === e.data.a ? (e.data.b as string) : (e.data.a as string));
      },
      onTurnStart: (ctx, src) => {
        const e = src.effect!;
        if (activeHero(ctx.s).id !== e.source.heroId) return;
        const both = [e.data.a, e.data.b].every((id) => ctx.s.units.some((u) => u.id === id));
        if (both) queueDecision(ctx, { type: 'abilityChoice', heroId: e.source.heroId, abilityId: 'chronomonger.convergeTimelines', choices: [e.data.a as string, e.data.b as string] });
        else removeEffect(ctx, e.id, 'resolved');
      },
    },
    temporalFlux: {
      onDestroyed: (ctx, src, unit) => fluxReturn(ctx, src, unit),
    },
  },
};

/** The remaining unit of a Converge pair becomes the original (main kind, no clone tag). */
function becomeOriginal(ctx: Ctx, e: Effect, keepId: string): void {
  const keep = ctx.s.units.find((u) => u.id === keepId);
  if (keep) {
    keep.kind = e.data.kind as Unit['kind'];
    keep.tags = keep.tags?.filter((t) => t !== 'clone');
    if (!keep.tags?.length) delete keep.tags;
  }
  removeEffect(ctx, e.id, 'resolved');
}

/** Portals: a path stops on a Portal square and continues on the other one (Battle there with enemy units). */
function portalLeads(s: GameState, e: Effect, unit: Unit, opts: ReturnType<typeof optionsOf>) {
  const [a, b] = effectSquares(e);
  const out: typeof opts = [];
  for (const o of opts) {
    const i = o.path.findIndex((p) => eq(p, a) || eq(p, b));
    if (i < 0) {
      out.push(o);
      continue;
    }
    const enter = o.path[i];
    const exit = eq(enter, a) ? b : a;
    const here = s.units.filter((u) => eq(u.pos, exit) && u.id !== unit.id);
    if (here.some((u) => u.side === unit.side || u.type === 'king')) continue;
    const enemies = here.map((u) => u.id);
    const next = { ...o, to: exit, path: [...o.path.slice(0, i + 1), exit], isBattle: enemies.length > 0, battleUnitIds: enemies, isDoubleStep: false };
    if (!out.some((x) => eq(x.to, next.to))) out.push(next);
  }
  return out;
}

