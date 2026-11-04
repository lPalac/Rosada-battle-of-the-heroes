// Checkmate in Before Turn, King destroyed, draws (FR-090, rulebook *Ending the Game*).
import { isCheckmate, isInCheck } from './check.ts';
import { emit, fail, activeHero, type Ctx } from './ctx.ts';
import type { GameResult } from './model/state.ts';
import { otherSide, type Side } from './model/types.ts';

type ResultCore =
  | { kind: 'win'; winner: Side; by: 'checkmate' | 'kingDestroyed' }
  | { kind: 'draw'; by: 'bothKingsInCheck' | 'noEligibleUnits' | 'agreed' };

export function endGame(ctx: Ctx, core: ResultCore): void {
  const { s } = ctx;
  const destroyed = {
    light: s.graveyard.filter((u) => u.side === 'light').length,
    dark: s.graveyard.filter((u) => u.side === 'dark').length,
  };
  const result = { ...core, summary: { turnsPlayed: s.turnNumber, destroyed } } as GameResult;
  s.status = 'ended';
  s.result = result;
  s.pendingDecision = null;
  s.decisionQueue = [];
  emit(ctx, { type: 'gameEnded', result });
}

/** Checked when a hero's *Before Turn* starts: a checkmated side loses (US3-AS1). */
export function checkmateCheck(ctx: Ctx): boolean {
  for (const side of ['light', 'dark'] as const) {
    if (isCheckmate(ctx.s, side)) {
      endGame(ctx, { kind: 'win', winner: otherSide(side), by: 'checkmate' });
      return true;
    }
  }
  return false;
}

export function bothKingsInCheck(ctx: Ctx): boolean {
  return isInCheck(ctx.s, 'light') && isInCheck(ctx.s, 'dark');
}

export function offerDraw(ctx: Ctx): void {
  const { s } = ctx;
  if (s.pendingDecision) fail('DECISION_PENDING', 'Answer the open decision first', 'Ending the Game');
  const fromSide = activeHero(s).side;
  s.pendingDecision = { type: 'drawOffer', fromSide };
  emit(ctx, { type: 'drawOffered', fromSide });
}

export function answerDraw(ctx: Ctx, accept: boolean): void {
  const { s } = ctx;
  const d = s.pendingDecision;
  if (!d || d.type !== 'drawOffer') fail('NO_DRAW_OFFER', 'No draw offer to answer', 'Ending the Game');
  s.pendingDecision = s.decisionQueue.shift() ?? null;
  if (accept) endGame(ctx, { kind: 'draw', by: 'agreed' });
  else emit(ctx, { type: 'drawDeclined', bySide: otherSide(d.fromSide) });
}
