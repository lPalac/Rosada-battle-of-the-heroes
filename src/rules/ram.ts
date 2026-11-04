// Ram, push, Knight push-back, King's Banishment (FR-041, FR-050, FR-052, FR-053, research R-10).
import { add, eq, inGrid } from './board.ts';
import { emit, type Ctx } from './ctx.ts';
import { RULES } from './data.ts';
import { wound } from './heroes.ts';
import type { Hero } from './model/hero.ts';
import type { RamOutcome } from './model/state.ts';
import type { Unit } from './model/unit.ts';
import type { Coord } from './model/types.ts';
import type { LeadOption } from './paths.ts';
import { unitsAt } from './paths.ts';
import { progress } from './royal-favors.ts';

/** Landing is blocked by a King (King's Majesty) or the edge of the 10×10 grid → starting square. */
function resolveLanding(ctx: Ctx, h: Hero, landing: Coord): { pos: Coord; sentToStart: boolean } {
  const kingThere = unitsAt(ctx.s, landing).some((u) => u.type === 'king');
  if (!inGrid(landing) || kingThere) return { pos: h.startSquare, sentToStart: true };
  return { pos: landing, sentToStart: false }; // Landing on a non-King unit is allowed (spec Q-17 default).
}

/**
 * Called after the Led unit is placed and Battles are resolved. Every enemy hero on an interacted square is
 * Rammed: pushed to one square past the unit's end square, along the path's last step, and takes 3 wounds.
 * A King's Lead Banishes instead and pushes friendly heroes one square in the direction the King is Led.
 */
export function applyRams(ctx: Ctx, unit: Unit, opt: LeadOption): RamOutcome[] {
  const { s } = ctx;
  const outcomes: RamOutcome[] = [];
  const beyondEnd = add(opt.to, opt.pushDir);
  const isKing = unit.type === 'king';
  const hit = new Set<string>();
  for (const sq of opt.path) {
    for (const h of s.heroes) {
      // Hero Units are never Rammed or pushed (003 FR-031a).
      if (!eq(h.pos, sq) || hit.has(h.id) || h.status.unconscious || h.heroUnitId) continue;
      hit.add(h.id);
      if (h.side !== unit.side) {
        let landing: { pos: Coord; sentToStart: boolean };
        if (isKing) {
          landing = { pos: h.startSquare, sentToStart: true };
          h.status.movementPenaltyNextTurn += RULES.banishmentMovementPenalty;
        } else {
          landing = resolveLanding(ctx, h, beyondEnd);
        }
        const from = h.pos;
        h.pos = landing.pos;
        h.rammedBy = { unitId: unit.id, turn: s.turnNumber };
        outcomes.push({ heroId: h.id, landing: landing.pos, sentToStart: landing.sentToStart, wounds: RULES.ramWounds, friendly: false });
        emit(ctx, { type: 'heroRammed', heroId: h.id, byUnitId: unit.id, landing: landing.pos, sentToStart: landing.sentToStart });
        progress(ctx, unit.side, 'overwhelm', 1);
        emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: landing.pos, reason: 'ram' });
      } else if (isKing) {
        // King's Banishment: friendly heroes are pushed one square in the direction the King is Led (spec Q-18).
        const landing = resolveLanding(ctx, h, add(h.pos, opt.pushDir));
        const pushedOntoKing = eq(landing.pos, opt.to);
        const final = pushedOntoKing ? { pos: h.startSquare, sentToStart: true } : landing;
        const from = h.pos;
        h.pos = final.pos;
        outcomes.push({ heroId: h.id, landing: final.pos, sentToStart: final.sentToStart, wounds: 0, friendly: true });
        emit(ctx, { type: 'heroPushed', heroId: h.id, byUnitId: unit.id, landing: final.pos, sentToStart: final.sentToStart });
        emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: final.pos, reason: 'push' });
      }
    }
  }
  // Wounds after all pushes, in path order (research R-08: Battle → Ram wounds → Destiny).
  for (const o of outcomes) {
    if (o.friendly) continue;
    const h = s.heroes.find((x) => x.id === o.heroId)!;
    wound(ctx, h, o.wounds, { enemySide: unit.side });
  }
  return outcomes;
}
