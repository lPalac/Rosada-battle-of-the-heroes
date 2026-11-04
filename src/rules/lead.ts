// Lead: choose unit → announce square → roll → place; Battle/Destroy, Destiny, Promotion, Short range advance
// (FR-030…FR-037, FR-005).
import { adjacent8, eq } from './board.ts';
import { allLegalLeads, isDiscoveredCheck, isInCheck, legalLeadsForUnit } from './check.ts';
import { activeHero, emit, fail, hero, type Ctx } from './ctx.ts';
import { DATA, RULES } from './data.ts';
import { DESTINY, gain } from './destiny.ts';
import { endGame } from './endgame.ts';
import { isForbiddenEndSquare, queueDecision, unitsInRange, wound } from './heroes.ts';
import type { Hero } from './model/hero.ts';
import type { Unit } from './model/unit.ts';
import type { GameState, LeadAttempt, Modifier } from './model/state.ts';
import { otherSide, type Coord, type UnitType } from './model/types.ts';
import { enemyRoyalRank, isPromotionSquare, type LeadOption } from './paths.ts';
import { applyRams } from './ram.ts';
import { complete, progress } from './royal-favors.ts';
import { gainRevenge, useRevengeToken } from './tokens.ts';

/** Legal Lead destinations for a unit the active hero could Lead now (in Range, check-legal). */
export function leadOptionsForActiveHero(state: GameState): LeadOption[] {
  const h = activeHero(state);
  return unitsInRange(state, h).flatMap((u) => legalLeadsForUnit(state, u)).filter((o) => !rammedByTarget(state, h, o));
}

/** A Hero Unit may not Lead itself into Battle with the unit that Rammed it on the last turn (003 FR-032). */
function rammedByTarget(state: GameState, h: Hero, o: LeadOption): boolean {
  if (o.unitId !== h.heroUnitId || !h.rammedBy || h.rammedBy.turn !== state.turnNumber - 1) return false;
  return o.battleUnitIds.includes(h.rammedBy.unitId);
}

export function legalLeadTargets(state: GameState, unitId: string): { to: Coord; isBattle: boolean; path: Coord[] }[] {
  if (state.status !== 'playing' || state.enforcement !== 'rules' || state.phase !== 'lead' || state.pendingDecision) return [];
  if (state.turn.leadAttempted) return [];
  return leadOptionsForActiveHero(state)
    .filter((o) => o.unitId === unitId)
    .map((o) => ({ to: o.to, isBattle: o.isBattle, path: o.path }));
}

/** True when the active side has no unit that could legally be Led, range ignored (draw, rule 3b). */
export function noEligibleUnits(state: GameState): boolean {
  return allLegalLeads(state, activeHero(state).side).length === 0;
}

export function computeModifiers(
  state: GameState, unitType: UnitType, kind: Unit['kind'] = 'main',
): { needsRoll: boolean; modifiers: Modifier[] } {
  const side = activeHero(state).side;
  const modifiers: Modifier[] = [];
  // War +2 only while the token shows War; it is gone from the Epic Stage on (003 FR-006).
  if (state.tokens.peaceTreaty === 'war') modifiers.push({ source: 'war', value: RULES.modifiers.war });
  if (kind === 'hero') modifiers.push({ source: 'heroUnit', value: RULES.heroUnit.selfLeadBonus });
  if (isInCheck(state, side)) modifiers.push({ source: 'check', value: RULES.modifiers.kingInCheck });
  if (state.turn.inspiredLeadBonus > 0) modifiers.push({ source: 'inspiredLead', value: state.turn.inspiredLeadBonus });
  // No roll for King Leads (Determination), while the Peace side is up, or when even a 1 would reach the
  // target, so the Lead cannot fail (FR-033, spec Q-24).
  const lowest = 1 + modifiers.reduce((a, m) => a + m.value, 0);
  const needsRoll = unitType !== 'king' && state.tokens.peaceTreaty !== 'peace' && lowest < RULES.leadTarget;
  return { needsRoll, modifiers };
}

export function leadPreview(state: GameState, unitId?: string): { needsRoll: boolean; modifiers: Modifier[]; target: number } | null {
  if (state.status !== 'playing' || state.phase !== 'lead') return null;
  const lead = state.turn.lead;
  if (lead) return { needsRoll: lead.needsRoll, modifiers: lead.modifiers, target: RULES.leadTarget };
  const unit = unitId ? state.units.find((u) => u.id === unitId) : undefined;
  const { needsRoll, modifiers } = computeModifiers(state, unit?.type ?? 'pawn', unit?.kind);
  return { needsRoll, modifiers, target: RULES.leadTarget };
}

export function announceLead(ctx: Ctx, unitId: string, to: Coord, promoteTo?: UnitType): void {
  const { s } = ctx;
  if (s.phase !== 'lead') fail('WRONG_PHASE', 'Leads happen in the Lead phase', 'Lead');
  if (s.turn.leadAttempted) fail('LEAD_ALREADY_MADE', 'Only one Lead per turn', 'Lead');
  const h = activeHero(s);
  const unit = s.units.find((u) => u.id === unitId);
  if (!unit || unit.side !== h.side) fail('NOT_FRIENDLY_UNIT', 'Choose a friendly unit', 'Lead');
  if (!unitsInRange(s, h).some((u) => u.id === unitId)) fail('OUT_OF_RANGE', 'That unit is not in Range', 'Range');
  const basic = legalLeadsForUnit({ units: s.units }, unit);
  const opt = basic.find((o) => eq(o.to, to));
  if (!opt) {
    fail(unit.type === 'king' ? 'KING_THREATENED_SQUARE' : 'LEAD_LEAVES_KING_IN_CHECK',
      unit.type === 'king' ? 'A King may not be Led into a threatened square' : 'That Lead is not legal', unit.type === 'king' ? 'Threaten' : 'Check');
  }
  if (rammedByTarget(s, h, opt)) {
    fail('RAMMED_BY_TARGET', 'A Hero Unit may not Lead itself into Battle with the unit that Rammed it last turn', 'Ram');
  }
  if (promoteTo && !DATA.units.promotion.includes(promoteTo)) fail('BAD_PROMOTION', 'Not a promotion choice', 'Promotion');
  const { needsRoll, modifiers } = computeModifiers(s, unit.type, unit.kind);
  const lead: LeadAttempt = {
    unitId, from: unit.pos, to, path: opt.path, isBattle: opt.isBattle, isCastling: opt.isCastling,
    isEnPassant: opt.isEnPassant, needsRoll, usedRevenge: false, roll: null, modifiers,
    total: null, success: null, rams: [], promoteTo: promoteTo ?? null,
  };
  s.turn.lead = lead;
  s.turn.leadAttempted = true;
  s.turn.inspiredLeadBonus = 0; // The bonus is used by this Lead (spec Q-19).
  emit(ctx, { type: 'leadAnnounced', unitId, from: unit.pos, to, needsRoll });
  if (needsRoll) emit(ctx, { type: 'rollRequested', unitId });
  else resolve(ctx, opt, true);
}

function currentOption(ctx: Ctx): LeadOption {
  const lead = ctx.s.turn.lead!;
  const unit = ctx.s.units.find((u) => u.id === lead.unitId)!;
  const opt = legalLeadsForUnit({ units: ctx.s.units }, unit).find((o) => eq(o.to, lead.to));
  if (!opt) throw new Error('Announced Lead is no longer legal');
  return opt;
}

export function awaitingRoll(state: GameState): boolean {
  const lead = state.turn.lead;
  return state.phase === 'lead' && !!lead && lead.needsRoll && lead.success === null;
}

export function submitRoll(ctx: Ctx, value: number): void {
  const { s } = ctx;
  if (!Number.isInteger(value) || value < 1 || value > RULES.die) fail('BAD_ROLL', `A roll is 1…${RULES.die}`, 'Lead');
  if (!awaitingRoll(s)) fail('NO_ROLL_NEEDED', 'No roll is needed now', 'Lead');
  const lead = s.turn.lead!;
  lead.roll = value;
  lead.total = value + lead.modifiers.reduce((a, m) => a + m.value, 0);
  const success = lead.total >= RULES.leadTarget;
  emit(ctx, { type: 'rolled', value, total: lead.total, success });
  resolve(ctx, currentOption(ctx), success);
}

export function useRevenge(ctx: Ctx): void {
  const { s } = ctx;
  const side = activeHero(s).side;
  if (!awaitingRoll(s)) fail('NO_ROLL_NEEDED', 'Revenge replaces a roll', 'Revenge');
  if (s.tokens.revenge[side] < 1) fail('NO_REVENGE_TOKEN', 'No Revenge token', 'Revenge');
  useRevengeToken(ctx, side);
  s.turn.lead!.usedRevenge = true;
  resolve(ctx, currentOption(ctx), true);
}

function resolve(ctx: Ctx, opt: LeadOption, success: boolean): void {
  const { s } = ctx;
  const lead = s.turn.lead!;
  const h = activeHero(s);
  const side = h.side;
  lead.success = success;
  if (!success) {
    emit(ctx, { type: 'leadFailed', unitId: lead.unitId });
    gain(ctx, { side }, DESTINY.failedLead, 'failedLead');
    s.turn.kingInCheckAfterLead = isInCheck(s, side);
    return;
  }
  const unit = s.units.find((u) => u.id === lead.unitId)!;
  const discovered = isDiscoveredCheck(s, opt);
  // Battle / Destroy: every enemy unit on the square (002 FR-006). Auxiliary and Hero Units leave play (003 FR-036).
  const victims = s.units.filter((u) => opt.battleUnitIds.includes(u.id));
  s.units = s.units.filter((u) => !opt.battleUnitIds.includes(u.id));
  for (const victim of victims) {
    const leftPlay = victim.kind !== 'main';
    if (!leftPlay) s.graveyard.push({ ...victim, enPassantTarget: null });
    emit(ctx, { type: 'unitDestroyed', unitId: victim.id, by: 'battle', ...(leftPlay ? { leftPlay } : {}) });
  }
  for (const victim of victims) if (victim.kind === 'hero') heroUnitDestroyed(ctx, hero(s, victim.heroId!), side);
  const destroyedKing = victims.some((v) => v.type === 'king');
  const from = unit.pos;
  unit.pos = opt.to;
  unit.hasBeenLed = true;
  if (unit.kind === 'hero') {
    const owner = hero(s, unit.heroId!);
    emit(ctx, { type: 'heroMoved', heroId: owner.id, from: owner.pos, to: opt.to, reason: 'heroUnit' });
    owner.pos = { ...opt.to };
  }
  unit.enPassantTarget = null;
  if (opt.isDoubleStep) {
    unit.enPassantTarget = opt.path[0];
    s.turn.doubleStepUnitId = unit.id;
  }
  if (opt.rook) {
    const rook = s.units.find((u) => u.id === opt.rook!.unitId)!;
    rook.pos = opt.rook.to;
    rook.hasBeenLed = true;
  }
  emit(ctx, { type: 'unitLed', unitId: unit.id, from, to: opt.to, path: opt.path });
  if (destroyedKing) {
    endGame(ctx, { kind: 'win', winner: side, by: 'kingDestroyed' });
    return;
  }
  // Ram wounds, then Destiny for the Battle, then Revenge (research R-08).
  lead.rams = applyRams(ctx, unit, opt);
  // One Battle: +2 D once to the Leading side, however many units fall; +1 D per unit lost to the other side.
  if (victims.length) {
    gain(ctx, { side }, DESTINY.destroyEnemy, 'destroyEnemy');
    for (const victim of victims) gain(ctx, { side: victim.side }, DESTINY.ownUnitLost, 'ownUnitLost');
    for (const victim of victims) if (victim.type === 'queen') gainRevenge(ctx, victim.side);
    // Royal Favors from the Battle (rulebook *Royal Favors* 1 and 6).
    if (opt.to.y === enemyRoyalRank(side)) complete(ctx, side, 'bloodyTheCastleGates');
    if (unit.kind !== 'hero' && (unit.type === 'king' || unit.type === 'queen')) progress(ctx, side, 'royalsFury', victims.length);
  }
  const enemy = otherSide(side);
  if (isInCheck(s, enemy)) {
    emit(ctx, { type: 'check', side: enemy });
    if (discovered) complete(ctx, side, 'tacticalGenius');
    if (!s.turn.checkBonusClaimed) {
      s.turn.checkBonusClaimed = true;
      gain(ctx, { side }, DESTINY.check, 'check');
    }
  }
  s.turn.kingInCheckAfterLead = isInCheck(s, side);
  // Promotion, then the Short range advance.
  if (isPromotionSquare(unit, opt.to)) {
    // The piece may be chosen up front with announceLead; otherwise a pendingDecision asks.
    if (lead.promoteTo) promote(ctx, unit.id, lead.promoteTo);
    else queueDecision(ctx, { type: 'promotion', unitId: unit.id, chooserHeroId: h.id });
  }
  // A Hero Unit Leading others stays where it is (003 FR-031).
  if (h.rangeType === 'short' && !h.status.unconscious && !h.heroUnitId) {
    const options = advanceOptions(s, opt.to, side);
    if (options.length > 0) queueDecision(ctx, { type: 'advanceSquare', heroId: h.id, options });
  }
}

/** A destroyed Hero Unit: 3 wounds, back to the starting square, no longer a Hero Unit (003 FR-031). */
function heroUnitDestroyed(ctx: Ctx, h: Hero, by: GameState['heroes'][number]['side']): void {
  h.heroUnitId = null;
  emit(ctx, { type: 'heroUnitChanged', heroId: h.id, on: false, types: [] });
  const from = h.pos;
  h.pos = { ...h.startSquare };
  emit(ctx, { type: 'heroMoved', heroId: h.id, from, to: h.pos, reason: 'heroUnitDestroyed' });
  wound(ctx, h, RULES.heroUnit.destroyedWounds, { enemySide: by });
}

/** Squares adjacent to the Led unit not occupied by a King or an enemy unit (US2-AS3). */
export function advanceOptions(state: GameState, unitPos: Coord, side: GameState['heroes'][number]['side']): Coord[] {
  return adjacent8(unitPos).filter((p) => !isForbiddenEndSquare(state, side, p));
}

export function promote(ctx: Ctx, unitId: string, to: UnitType): void {
  if (!DATA.units.promotion.includes(to)) fail('BAD_PROMOTION', 'Not a promotion choice', 'Promotion');
  const unit = ctx.s.units.find((u) => u.id === unitId)!;
  unit.type = to;
  unit.promoted = true;
  emit(ctx, { type: 'promoted', unitId, to });
}
