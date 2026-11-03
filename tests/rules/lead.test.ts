import { describe, expect, it } from 'vitest';
import { legalActions, legalLeadTargets, leadPreview } from '../../src/rules/index.ts';
import { act, eventsOf, reject } from '../helpers/game.ts';
import { board, name, sq, unitOn } from '../fixtures/position.ts';

describe('US2 – Lead', () => {
  it('US2-AS4 with the Peace side up a non-King Lead succeeds without a roll', () => {
    let s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead' });
    expect(leadPreview(s, 'L-P@d2')?.needsRoll).toBe(false);
    const r = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') });
    expect(eventsOf(r.events, 'rollRequested')).toHaveLength(0);
    expect(eventsOf(r.events, 'unitLed')).toHaveLength(1);
    expect(unitOn(r.state, 'd4')?.id).toBe('L-P@d2');
  });

  it('US2-AS5 at War, King not in check, a 3 totals 5: the Lead fails, the unit stays, the side gains 1 D', () => {
    let s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
    expect(s.turn.lead?.modifiers).toEqual([{ source: 'war', value: 2 }]);
    const r = act(s, { type: 'submitRoll', value: 3 });
    expect(eventsOf(r.events, 'rolled')[0]).toMatchObject({ value: 3, total: 5, success: false });
    expect(unitOn(r.state, 'd2')?.id).toBe('L-P@d2');
    expect(r.state.destiny.common.light).toBe(1);
  });

  it('US2-AS5 a total of 6 succeeds', () => {
    let s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
    expect(unitOn(act(s, { type: 'submitRoll', value: 4 }).state, 'd4')).toBeDefined();
  });

  it('US2-AS6 the turn cannot end without attempting a possible Lead', () => {
    const s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead' });
    expect(s.turn.leadPossible).toBe(true);
    expect(reject(s, { type: 'endPhase' })).toBe('MUST_ATTEMPT_LEAD');
    expect(legalActions(s).some((a) => a.type === 'endPhase')).toBe(false);
  });

  it('US2-AS6 with no unit in Range the Lead phase passes without After Lead / End of Turn abilities', () => {
    const s = board({ e1: 'K', e8: 'k', a2: 'P' }, { heroes: { H1: 'h4' }, phase: 'beforeLead' });
    const next = act(s, { type: 'endPhase' }).state;
    expect(next.activeHeroId).toBe('H2');
  });

  it('US2-AS7 a destination that leaves the own King in check is not offered', () => {
    const s = board({ e1: 'K', e2: 'B', e8: 'r', a8: 'k' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    expect(legalLeadTargets(s, 'L-B@e2')).toEqual([]);
    expect(reject(s, { type: 'announceLead', unitId: 'L-B@e2', to: sq('d3') })).toBe('LEAD_LEAVES_KING_IN_CHECK');
  });

  it('US2-AS8 a King Lead needs no roll, even at War', () => {
    const s = board({ e1: 'K', e8: 'k' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    const r = act(s, { type: 'announceLead', unitId: 'L-K@e1', to: sq('e2') });
    expect(eventsOf(r.events, 'rollRequested')).toHaveLength(0);
    expect(unitOn(r.state, 'e2')?.type).toBe('king');
  });

  it('US2-AS8 castling needs no roll', () => {
    const s = board({ e1: 'K', h1: 'R', e8: 'k' }, { heroes: { H1: 'f0' }, phase: 'lead', peaceTreaty: 'war' });
    const r = act(s, { type: 'announceLead', unitId: 'L-K@e1', to: sq('g1') });
    expect(eventsOf(r.events, 'rollRequested')).toHaveLength(0);
    expect(unitOn(r.state, 'g1')?.type).toBe('king');
    expect(unitOn(r.state, 'f1')?.type).toBe('rook');
  });

  it('adds +4 when the own King is in check (FR-032)', () => {
    const s = board({ e1: 'K', e8: 'r', a8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    expect(leadPreview(s, 'L-K@e1')?.modifiers).toContainEqual({ source: 'check', value: 4 });
  });

  it('adds the Inspired Lead bonus to the modifiers (FR-032)', () => {
    let s = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'beforeLead', peaceTreaty: 'war' });
    s = act(s, { type: 'inspiredLead', destiny: 2 }).state;
    expect(s.phase).toBe('lead'); // Before Lead has nothing left to do
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
    expect(s.turn.lead?.modifiers).toContainEqual({ source: 'inspiredLead', value: 4 });
  });

  it('a Battle destroys the enemy unit and sends it to the Graveyard (FR-005)', () => {
    const s = board({ e1: 'K', e8: 'k', d2: 'P', e3: 'n' }, { heroes: { H1: 'd1' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('e3') });
    expect(eventsOf(r.events, 'unitDestroyed')[0].unitId).toBe('D-N@e3');
    expect(r.state.graveyard.map((u) => u.id)).toEqual(['D-N@e3']);
    expect(name(unitOn(r.state, 'e3')!.pos)).toBe('e3');
  });

  it('allows one Lead per turn', () => {
    let s = board({ e1: 'K', e8: 'k', d2: 'P', c2: 'P' }, { ranges: { H1: 'long' }, heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d3') }).state;
    expect(reject(s, { type: 'announceLead', unitId: 'L-P@c2', to: sq('c3') })).toBe('LEAD_ALREADY_MADE');
    s = act(s, { type: 'submitRoll', value: 20 }).state;
    expect(s.phase).toBe('endOfTurn'); // Hero Retreat is affordable, so End of Turn waits
    expect(reject(s, { type: 'announceLead', unitId: 'L-P@c2', to: sq('c3') })).toBe('WRONG_PHASE');
  });
});
