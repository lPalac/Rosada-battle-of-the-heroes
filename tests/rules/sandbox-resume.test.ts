// 006 US2 (FR-006, research R-06): turning rules back on continues the turn where it was; `restart` begins at Before
// Turn as in 001. The Check rule about the end of the Lead survives the trip (guarantee 23b).
import { describe, expect, it } from 'vitest';
import { act, reject } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import { abilityOffers, apply, type Action, type GameState } from '../../src/rules/index.ts';

const toSandbox = (s: GameState) => act(s, { type: 'setEnforcement', mode: 'sandbox' }).state;
const toRules = (s: GameState, restart = false) => act(s, { type: 'setEnforcement', mode: 'rules', ...(restart ? { restart: true } : {}) });
const trip = (s: GameState) => toRules(toSandbox(s)).state;
const id = (s: GameState, square: string) => unitOn(s, square)!.id;
const strip = (s: GameState) => {
  const { log: _log, sandboxMoved: _m, ...rest } = s;
  return rest;
};

describe('US2 – the sandbox keeps the turn (B-06)', () => {
  it('US2-AS3 the Lead phase with 2 Movement left survives a trip: same hero, phase, Movement, a Lead can still be made', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    for (const to of ['d2', 'c2', 'b2']) s = act(s, { type: 'moveStep', to: sq(to) }).state;
    s = act(s, { type: 'endPhase' }).state;
    if (s.phase !== 'lead') s = act(s, { type: 'endPhase' }).state;
    expect([s.phase, s.turn.movementLeft]).toEqual(['lead', 2]);
    const back = trip(s);
    expect([back.activeHeroId, back.phase, back.turn.movementLeft, back.turn.leadPossible]).toEqual([s.activeHeroId, 'lead', 2, true]);
    expect(act(back, { type: 'announceLead', unitId: id(back, 'c3'), to: sq('b5') }).state.turn.lead).not.toBeNull();
  });

  it('guarantee 22: a trip with no edit gives the same state, except the log', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'lead' });
    expect(strip(trip(s))).toEqual(strip(s));
  });

  it('US2-AS4 a resolved Lead stays resolved: no second Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const d = s.pendingDecision;
    if (d?.type === 'advanceSquare') s = act(s, { type: 'decide', decision: { type: 'square', to: d.options[0] } }).state;
    const phase = s.phase;
    const back = trip(s);
    expect(back.phase).toBe(phase);
    expect(back.turn.lead).toEqual(s.turn.lead);
    expect(reject(back, { type: 'announceLead', unitId: id(back, 'b5'), to: sq('a7') })).toMatch(/LEAD_ALREADY_MADE|WRONG_PHASE/);
  });

  it('US2-AS5 an announced Lead whose unit was moved in sandbox is cancelled; its Inspired Lead bonus goes back', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'beforeLead' });
    s = act(s, { type: 'inspiredLead', destiny: 1 }).state;
    if (s.phase === 'beforeLead') s = act(s, { type: 'endPhase' }).state; // after paying it passes by itself
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    expect(s.turn.lead?.modifiers).toContainEqual({ source: 'inspiredLead', value: 2 });
    expect(s.turn.inspiredLeadBonus).toBe(0);
    let box = toSandbox(s);
    // Moved to b3, still in the hero's range: a new Lead can be announced.
    box = act(box, { type: 'sandboxPlace', target: { unitId: id(box, 'c3') }, to: sq('b3') }).state;
    const back = toRules(box).state;
    expect([back.phase, back.turn.lead, back.turn.leadAttempted, back.turn.inspiredLeadBonus]).toEqual(['lead', null, false, 2]);
    expect(back.turn.abilitiesUsed).toContain('inspiredLead');
  });

  it('an announced Lead whose unit did not move keeps waiting for its roll', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const back = trip(s);
    expect(back.turn.lead).toEqual(s.turn.lead);
    expect(act(back, { type: 'submitRoll', value: 20 }).state.turn.lead?.success).toBe(true);
  });

  it('a square decision gets fresh options: a square that became forbidden is dropped', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: id(s, 'c3'), to: sq('b5') }).state;
    const d = s.pendingDecision;
    expect(d?.type).toBe('advanceSquare');
    const options = (d as { options: { x: number; y: number }[] }).options;
    let box = toSandbox(s);
    box = act(box, { type: 'sandboxPlace', target: { unitId: id(box, 'h7') }, to: options[0] }).state;
    const back = toRules(box).state;
    const left = (back.pendingDecision as { options: { x: number; y: number }[] }).options;
    expect(left).toHaveLength(options.length - 1);
    expect(left).not.toContainEqual(options[0]);
  });

  it('US2-AS6 an illegal position still fails with the problem list and rules stay off', () => {
    let box = toSandbox(board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, phase: 'lead' }));
    box = act(box, { type: 'sandboxPlace', target: { unitId: id(box, 'c3') }, to: sq('e1') }).state; // onto the King
    const r = apply(box, { type: 'setEnforcement', mode: 'rules' });
    expect(r.ok ? '' : r.error.code).toBe('POSITION_INVALID');
  });

  it('US2-AS7 / guarantee 25 restart: true begins at Before Turn as in 001', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    s = act(s, { type: 'moveStep', to: sq('d2') }).state;
    const r = toRules(toSandbox(s), true);
    expect(r.events.some((e) => e.type === 'turnStarted' && e.heroId === 'H1')).toBe(true);
    expect(r.state.turn.movementLeft).toBe(5);
    expect(r.state.sandboxResume).toBeNull();
  });

  it('the resume point is only used for the same turn and hero, and is cleared on the way back', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'move' });
    const box = toSandbox(s);
    expect(box.sandboxResume).toMatchObject({ turnNumber: s.turnNumber, activeHeroId: 'H1', phase: 'move' });
    expect(toRules(box).state.sandboxResume).toBeNull();
  });

  it('US2-AS10 with the own King in check, a failed Lead after the trip blocks After Lead and End of Turn abilities, as without the trip', () => {
    // The Dark Rook on e5 checks the Light King on e1; the Knight c4→e3 would block. No War bonus (token removed).
    const s = board({ c4: 'N', e5: 'r', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' }, peaceTreaty: 'removed', phase: 'lead' });
    const play = (start: GameState) => {
      const a = act(start, { type: 'announceLead', unitId: id(start, 'c4'), to: sq('e3') });
      expect(a.state.turn.lead?.needsRoll).toBe(true);
      return act(a.state, { type: 'submitRoll', value: 1 });
    };
    const plain = play(s);
    const tripped = play(trip(s));
    const kinds = (r: { events: { type: string }[] }) => r.events.map((e) => e.type).filter((t) => t !== 'enforcementChanged');
    expect(kinds(tripped)).toEqual(kinds(plain));
    expect(tripped.events.some((e) => e.type === 'abilityUsed')).toBe(false);
    expect(tripped.state.activeHeroId).toBe(plain.state.activeHeroId);
  });

  it('guarantee 23b: a turn resumed with "King in check after the Lead" already set keeps it, and its abilities stay blocked', () => {
    const base = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' } });
    const s: GameState = { ...base, phase: 'afterLead', turn: { ...base.turn, leadAttempted: true, leadPossible: true, kingInCheckAfterLead: true } };
    expect(abilityOffers(s).some((o) => o.abilityId === 'cavalier.warhorse')).toBe(false);
    const box = toSandbox(s);
    expect(box.sandboxResume?.turn.kingInCheckAfterLead).toBe(true);
    // Back in rules, After Lead (blocked) and End of Turn pass by themselves; Warhorse is never offered.
    const r = toRules(box);
    expect(r.state.phase === 'afterLead').toBe(false);
    expect(r.events.some((e) => e.type === 'abilityUsed')).toBe(false);
    expect(r.events.some((e) => e.type === 'phaseChanged' && e.phase === 'endOfTurn')).toBe(true);
  });

  it('online and saves: the resume point is part of the state, so a replay gives the same game', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'd1' }, phase: 'lead' });
    const actions: Action[] = [{ type: 'setEnforcement', mode: 'sandbox' }, { type: 'setEnforcement', mode: 'rules' }];
    let a = s;
    for (const x of actions) a = act(a, x).state;
    let b = s;
    for (const x of actions) b = act(b, x).state;
    expect(strip(a)).toEqual(strip(b));
  });
});
