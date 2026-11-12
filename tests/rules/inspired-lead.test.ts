// 006 US5 (FR-007, research R-07, guarantee 24): Inspired Lead may be paid until the die is rolled, once per turn.
import { describe, expect, it } from 'vitest';
import { act, eventsOf, reject } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import { legalActions, type GameState } from '../../src/rules/index.ts';

const id = (s: GameState, square: string) => unitOn(s, square)!.id;
const inspiredOffered = (s: GameState) => legalActions(s).filter((a) => a.type === 'inspiredLead').map((a) => (a as { destiny: number }).destiny);
const war = (opts: object = {}) => board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead', ...opts });

describe('US5 – Inspired Lead at the roll (B-07)', () => {
  it('US5-AS2 it is legal in the Lead phase, before a Lead is announced and after, until the roll', () => {
    const s = war();
    expect(inspiredOffered(s)).toEqual([1, 2, 3]);
    const a = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    expect(a.turn.lead?.success).toBeNull();
    expect(inspiredOffered(a)).toEqual([1, 2, 3]);
  });

  it('US5-AS3 after the announcement the bonus joins the Lead\'s modifiers; the unit and square stay (guarantee 24)', () => {
    let s = war();
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const { unitId, to } = s.turn.lead!;
    s = act(s, { type: 'inspiredLead', destiny: 1 }).state;
    expect(s.turn.lead?.modifiers).toContainEqual({ source: 'inspiredLead', value: 2 });
    expect([s.turn.lead?.unitId, s.turn.lead?.to]).toEqual([unitId, to]);
    expect(s.turn.lead?.success).toBeNull(); // 1 + War 2 + 2 = 5 < 6: still needs a roll
    expect(act(s, { type: 'submitRoll', value: 1 }).state.turn.lead?.total).toBe(5);
  });

  it('US5-AS3 when the Lead can no longer fail it succeeds in the same action, without a roll', () => {
    let s = war();
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const r = act(s, { type: 'inspiredLead', destiny: 2 }); // 1 + War 2 + 4 = 7 ≥ 6
    expect(r.state.turn.lead?.success).toBe(true);
    expect(r.state.turn.lead?.needsRoll).toBe(false);
    expect(eventsOf(r.events, 'rolled')).toEqual([]);
    expect(unitOn(r.state, 'b5')?.id).toBe(id(s, 'c3'));
  });

  it('US5-AS4 refused after the roll, and after a use in Before Lead; once per turn', () => {
    let s = war();
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const rolled = act(s, { type: 'submitRoll', value: 1 }).state;
    expect(reject(rolled, { type: 'inspiredLead', destiny: 1 })).toMatch(/WRONG_PHASE|LEAD_RESOLVED/);
    expect(inspiredOffered(rolled)).toEqual([]);
    let b = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'beforeLead' });
    b = act(b, { type: 'inspiredLead', destiny: 1 }).state;
    if (b.phase === 'beforeLead') b = act(b, { type: 'endPhase' }).state;
    expect(b.phase).toBe('lead');
    expect(reject(b, { type: 'inspiredLead', destiny: 1 })).toBe('ABILITY_USED');
    expect(inspiredOffered(b)).toEqual([]);
  });

  it('guarantee 24: never turns a resolved Lead back into an open one', () => {
    let s = war();
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    s = act(s, { type: 'submitRoll', value: 20 }).state;
    expect(apply_ok(s)).toBe(false);
  });
});

function apply_ok(s: GameState): boolean {
  return legalActions(s).some((a) => a.type === 'inspiredLead');
}
