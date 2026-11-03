import { describe, expect, it } from 'vitest';
import { legalActions, legalLeadTargets } from '../../src/rules/index.ts';
import { act, run } from '../helpers/game.ts';
import { board, name, sq, toPhase } from '../fixtures/position.ts';

describe('US3 – Win or draw', () => {
  it('US3-AS1 checkmate is detected at the next Before Turn and the mating side wins', () => {
    let s = board({ a8: 'k', b6: 'K', h1: 'R' }, { heroes: { H1: 'h0' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: 'L-R@h1', to: sq('h8') }).state;
    expect(s.status).toBe('playing'); // not yet: mate is checked in Before Turn
    s = act(s, { type: 'decide', decision: { type: 'square', to: sq('g7') } }).state;
    if (s.phase === 'endOfTurn') s = act(s, { type: 'endPhase' }).state;
    expect(s.status).toBe('ended');
    expect(s.result).toMatchObject({ kind: 'win', winner: 'light', by: 'checkmate' });
  });

  it('a Lead made while the own King is in check cannot fail at War (+2 War, +4 check)', () => {
    let s = board(
      { a1: 'K', e2: 'R', e8: 'k', g8: 'n' },
      { active: 'H2', heroes: { H2: 'f9', H3: 'f0' }, phase: 'lead', peaceTreaty: 'war' },
    );
    // Only Leads that end the check are legal, so the King can stay in check only when no Lead is possible.
    expect(legalLeadTargets(s, 'D-N@g8').map((t) => name(t.to))).toEqual(['e7']);
    s = act(s, { type: 'announceLead', unitId: 'D-N@g8', to: sq('e7') }).state;
    // A Lead in check gets +2 War +4 check: a 1 still totals 7 and succeeds.
    s = act(s, { type: 'submitRoll', value: 1 }).state;
    expect(s.units.find((u) => u.id === 'D-N@g8')?.pos).toEqual(sq('e7'));
  });

  it('US3-AS2 King destroyed in Battle ends the game (King still in check after the opponent could not Lead)', () => {
    // Dark King in check and the active Dark hero has no unit in Range: no Lead possible, the King stays in check.
    let s = board(
      { a1: 'K', e2: 'R', e8: 'k', a7: 'p' },
      { active: 'H2', heroes: { H2: '<5', H3: 'f0' }, peaceTreaty: 'war' },
    );
    s = toPhase(s, 'beforeLead');
    s = act(s, { type: 'endPhase' }).state; // no Lead possible → turn passes
    expect(s.activeHeroId).toBe('H3');
    s = toPhase(s, 'lead');
    const r = run(s, [
      { type: 'announceLead', unitId: 'L-R@e2', to: sq('e8') },
      { type: 'submitRoll', value: 10 },
    ]).state;
    expect(r.result).toMatchObject({ kind: 'win', winner: 'light', by: 'kingDestroyed' });
    expect(r.result?.summary.destroyed.dark).toBe(1);
  });

  it('US3-AS3 both Kings in check at Beginning and End of the same turn → draw', () => {
    const s = board({ e1: 'K', a1: 'R', a8: 'k', e8: 'r' }, { heroes: { H1: '>4' }, phase: 'beforeLead' });
    expect(s.turn.bothKingsInCheckAtBeginning).toBe(true);
    const r = act(s, { type: 'endPhase' }).state;
    expect(r.result).toMatchObject({ kind: 'draw', by: 'bothKingsInCheck' });
  });

  it('US3-AS4 no unit that could legally be Led, range ignored → draw when the Lead phase starts', () => {
    const s = board({ a1: 'K', b3: 'q', e8: 'k' }, { heroes: { H1: 'c0' }, phase: 'beforeLead' });
    const r = act(s, { type: 'endPhase' }).state;
    expect(r.result).toMatchObject({ kind: 'draw', by: 'noEligibleUnits' });
  });

  it('US3-AS5 an accepted draw offer ends the game; a declined one lets play continue', () => {
    const s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' } });
    const offered = act(s, { type: 'offerDraw' }).state;
    expect(offered.pendingDecision).toEqual({ type: 'drawOffer', fromSide: 'light' });
    expect(legalActions(offered).map((a) => a.type)).toEqual(['answerDraw', 'answerDraw']);
    expect(act(offered, { type: 'answerDraw', accept: true }).state.result).toMatchObject({ kind: 'draw', by: 'agreed' });
    const declined = act(offered, { type: 'answerDraw', accept: false }).state;
    expect(declined.status).toBe('playing');
    expect(declined.phase).toBe('move');
  });

  it('after the end only switching to sandbox is legal (FR-090)', () => {
    const s = board({ a1: 'K', b3: 'q', e8: 'k' }, { heroes: { H1: 'c0' }, phase: 'beforeLead' });
    const r = act(s, { type: 'endPhase' }).state;
    expect(legalActions(r)).toEqual([{ type: 'setEnforcement', mode: 'sandbox' }]);
  });
});
