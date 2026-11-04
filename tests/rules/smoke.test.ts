import { describe, expect, it } from 'vitest';
import { legalActions } from '../../src/rules/index.ts';
import { act, newGame } from '../helpers/game.ts';
import { position, sq } from '../fixtures/position.ts';

describe('smoke', () => {
  it('starts a game at H1 Move', () => {
    const s = newGame();
    expect(s.status).toBe('playing');
    expect(s.phase).toBe('move');
    expect(s.activeHeroId).toBe('H1');
    expect(s.units).toHaveLength(32);
    expect(legalActions(s).length).toBeGreaterThan(0);
  });

  it('plays one Peace turn: Lead e2-e4 without a roll', () => {
    let s = newGame();
    // H1 starts on c0; walk to d1? Range 1 from c0 covers b1, c1, d1.
    s = act(s, { type: 'endPhase' }).state; // move → beforeLead
    s = act(s, { type: 'endPhase' }).state; // → lead
    expect(s.phase).toBe('lead');
    const r = act(s, { type: 'announceLead', unitId: 'L-N-b', to: sq('c3') });
    expect(r.events.some((e) => e.type === 'unitLed')).toBe(true);
    // Short range advance decision
    expect(r.state.pendingDecision?.type).toBe('advanceSquare');
  });

  it('builds fixtures', () => {
    const s = position(`
      ..........
      .....k....
      ..........
      ..........
      ..........
      ..........
      ..........
      ..........
      .....K....
      ..1.......`);
    expect(s.units).toHaveLength(2);
    expect(s.phase).toBe('move');
  });
});
