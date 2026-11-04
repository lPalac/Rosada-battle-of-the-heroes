import { describe, expect, it } from 'vitest';
import { destinyGeneration, leadPreview, legalActions, type GameState } from '../../src/rules/index.ts';
import { act, eventsOf, hero, passTurn, reject } from '../helpers/game.ts';
import { board, sq, START, unitOn } from '../fixtures/position.ts';

/** H1 (Light, Short) destroys a Knight with the last 2 Destiny of the Well. */
function depleteWell(opts: Parameters<typeof board>[1] = {}) {
  const s = board({ a1: 'R', a6: 'n' }, { heroes: { H1: 'b0' }, phase: 'lead', wellRemaining: 2, ...opts });
  return act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a6') });
}

/** Answer every open destiny decision with the given choice per hero (default: first option). */
function chooseAll(state: GameState, picks: Partial<Record<string, 'fanatic' | 'resolute' | 'dominant'>> = {}) {
  let s = state;
  const order: string[] = [];
  while (s.pendingDecision?.type === 'epicDestiny') {
    const d = s.pendingDecision;
    order.push(d.heroId);
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: picks[d.heroId] ?? d.options[0] } }).state;
  }
  return { state: s, order };
}

describe('US1 – The Epic Stage begins', () => {
  it('US1-AS1 the turn that depletes the Well continues; the Epic Stage waits for the next Before Turn', () => {
    const r = depleteWell();
    expect(r.state.destiny.well).toEqual({ initialRemaining: 0, depleted: true, depletedBy: 'H1' });
    expect(r.state.epicPending).toBe(true);
    expect(r.state.stage).toBe('starting');
    expect(r.state.activeHeroId).toBe('H1');
    expect(r.state.status).toBe('playing');
  });

  it('US1-AS2 every hero chooses in turn order from the active hero, the depleting hero last', () => {
    const next = passTurn(depleteWell().state).state;
    expect(next.activeHeroId).toBe('H2');
    expect(next.phase).toBe('beforeTurn');
    expect(next.pendingDecision).toMatchObject({ type: 'epicDestiny', heroId: 'H2' });
    expect(legalActions(next).map((a) => a.type)).toEqual(['decide', 'decide', 'decide']);
    const { order } = chooseAll(next);
    expect(order).toEqual(['H2', 'H3', 'H4', 'H1']);
  });

  it('US1-AS3 a side never holds one Fanatic and one Dominant hero', () => {
    let s = passTurn(depleteWell().state).state;
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'fanatic' } }).state; // H2 (Dark)
    expect(s.pendingDecision).toMatchObject({ heroId: 'H3', options: ['fanatic', 'resolute', 'dominant'] });
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'dominant' } }).state; // H3 (Light)
    expect(s.pendingDecision).toMatchObject({ heroId: 'H4', options: ['fanatic', 'resolute'] });
    expect(reject(s, { type: 'decide', decision: { type: 'destiny', destiny: 'dominant' } })).toBe('BAD_DESTINY');
    s = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'fanatic' } }).state; // H4: same as H2 is fine
    expect(s.pendingDecision).toMatchObject({ heroId: 'H1', options: ['resolute', 'dominant'] });
  });

  it('US1-AS4 the depleting hero’s side receives Manifest Epic Destiny in its next slot', () => {
    const before = passTurn(depleteWell().state).state;
    const slots = before.royalFavors.light.track.length;
    const r = chooseAll(before).state;
    expect(r.royalFavors.light.status.manifestEpicDestiny.done).toBe(true);
    expect(r.royalFavors.light.track).toHaveLength(slots + 1);
    expect(r.royalFavors.light.track.at(-1)).toBe('manifestEpicDestiny');
    expect(r.royalFavors.dark.status.manifestEpicDestiny.done).toBe(false);
  });

  it('US1-AS5 each Common Pool is split between its heroes, 1 D stays when odd', () => {
    // Light 3 + 2 (Battle) = 5; Dark 0 + 1 (lost unit) = 1.
    const s = passTurn(depleteWell({ common: { light: 3 } }).state).state;
    expect(s.destiny.common).toEqual({ light: 5, dark: 1 });
    const pools = Object.fromEntries(s.heroes.map((h) => [h.id, h.pool]));
    const r = chooseAll(s).state;
    expect(r.destiny.common).toEqual({ light: 1, dark: 1 });
    expect(hero(r, 'H1').pool).toBe(pools.H1 + 2);
    expect(hero(r, 'H3').pool).toBe(pools.H3 + 2);
    expect(hero(r, 'H2').pool).toBe(pools.H2);
  });

  it('US1-AS6 Short 7/10 becomes 17/20; Long 8/8 becomes 16/16', () => {
    const r = chooseAll(passTurn(depleteWell({ health: { H1: 7 } }).state).state).state;
    expect([hero(r, 'H1').health, hero(r, 'H1').maxHealth]).toEqual([17, 20]);
    expect([hero(r, 'H3').health, hero(r, 'H3').maxHealth]).toEqual([16, 16]);
  });

  it('US1-AS7 the Declaration of War token is removed and the +2 ends: 5 fails, 6 succeeds', () => {
    const r = chooseAll(passTurn(depleteWell().state).state);
    expect(r.state.tokens.peaceTreaty).toBe('removed');
    expect(r.state.stage).toBe('epic');
    const lead = (roll: number) => {
      let s = board({ d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', stage: 'epic' });
      expect(leadPreview(s, 'L-P@d2')).toMatchObject({ needsRoll: true, modifiers: [] });
      s = act(s, { type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') }).state;
      return act(s, { type: 'submitRoll', value: roll }).state;
    };
    expect(unitOn(lead(5), 'd2')).toBeDefined();
    expect(unitOn(lead(6), 'd4')).toBeDefined();
  });

  it('US1-AS8 every hero has a destiny; generation starts at 1 with a full army', () => {
    const r = chooseAll(passTurn(depleteWell().state).state, { H1: 'dominant', H3: 'resolute', H2: 'fanatic', H4: 'resolute' });
    expect(r.state.heroes.map((h) => h.epic?.destiny)).toEqual(['dominant', 'fanatic', 'resolute', 'resolute']);
    expect(eventsOf(r.state.log.map((l) => l.data as never), 'epicStageStarted')).toHaveLength(1);
    expect(destinyGeneration(board(START, { stage: 'epic' }), 'light')).toBe(1);
  });

  it('edge: the Well runs out on a Lead that ends the game → no Epic Stage', () => {
    // Back-rank mate: the check bonus takes the last 2 D; the next Before Turn ends the game.
    const s = board({ a1: 'R', h8: 'k', g7: 'p', h7: 'p' }, { heroes: { H1: 'b0' }, phase: 'lead', wellRemaining: 2 });
    let r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a8') }).state;
    expect(r.epicPending).toBe(true);
    r = passTurn(r).state;
    expect(r.status).toBe('ended');
    expect(r.result).toMatchObject({ kind: 'win', winner: 'light', by: 'checkmate' });
    expect(r.pendingDecision).toBeNull();
    expect(r.stage).toBe('starting');
  });

  it('edge: an Unconscious hero still chooses a destiny', () => {
    const s = structuredClone(depleteWell().state);
    Object.assign(hero(s, 'H3').status, { unconscious: true, skipNextTurn: true });
    const { order, state } = chooseAll(passTurn(s).state);
    expect(order).toContain('H3');
    expect(hero(state, 'H3').epic).not.toBeNull();
  });
});
