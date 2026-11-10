import { describe, expect, it } from 'vitest';
import { GameSession, undo } from '../../src/game/session.ts';
import { board, name, sq } from '../fixtures/position.ts';

// 001 FR-012 as amended by 005 FR-030 (Luka, 2026-11-10): the acting player undoes step by step through their own
// turn, across phase changes, back to the last reveal (a roll, a destroyed unit, a wound) or the start of the turn.
describe('undo (001 FR-012 amended by 005 FR-030, research R-11)', () => {
  it('undoes Move steps within the phase', () => {
    const s0 = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd0' } });
    const session = new GameSession(s0);
    session.dispatch({ type: 'moveStep', to: sq('d1') });
    session.dispatch({ type: 'moveStep', to: sq('c1') });
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(name(session.state.heroes[0].pos)).toBe('d1');
    session.undo();
    expect(name(session.state.heroes[0].pos)).toBe('d0');
    expect(session.canUndo()).toBe(false);
  });

  it('US2-AS9 undoes across phase changes within the turn, step by step', () => {
    const s0 = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' } });
    const session = new GameSession(s0);
    const phase0 = session.state.phase;
    session.dispatch({ type: 'moveStep', to: sq('d0') });
    session.dispatch({ type: 'endPhase' });
    expect(session.state.phase).not.toBe(phase0);
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(session.state.phase).toBe(phase0);
    expect(name(session.state.heroes[0].pos)).toBe('d0');
    session.undo();
    expect(name(session.state.heroes[0].pos)).toBe('d1');
    expect(session.canUndo()).toBe(false); // the start of the game
  });

  it('can change the announced Lead before rolling, but not after the roll (a reveal)', () => {
    const s0 = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    const session = new GameSession(s0);
    session.dispatch({ type: 'announceLead', unitId: 'L-P@d2', to: sq('d4') });
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(session.state.turn.lead).toBeNull();
    session.dispatch({ type: 'announceLead', unitId: 'L-P@d2', to: sq('d3') });
    session.dispatch({ type: 'submitRoll', value: 2 });
    expect(session.canUndo()).toBe(false);
  });

  it('after a reveal, later actions of the same turn can be undone back to the reveal only', () => {
    const s0 = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, phase: 'lead', peaceTreaty: 'war' });
    const session = new GameSession(s0);
    session.dispatch({ type: 'announceLead', unitId: 'L-P@d2', to: sq('d3') });
    session.dispatch({ type: 'submitRoll', value: 20 });
    const afterRoll = session.actions.length;
    if (!session.state.pendingDecision && session.state.activeHeroId === 'H1') {
      session.dispatch({ type: 'endPhase' });
      if (session.state.activeHeroId === 'H1') {
        expect(session.canUndo()).toBe(true);
        session.undo();
      }
    }
    expect(session.actions.length).toBe(afterRoll);
    expect(session.canUndo()).toBe(false);
  });

  it('never undoes across the Active Hero hand-off', () => {
    const s0 = board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' }, pools: { H1: 0 }, phase: 'lead' });
    const session = new GameSession(s0);
    session.dispatch({ type: 'announceLead', unitId: 'L-P@d2', to: sq('d3') });
    session.dispatch({ type: 'decide', decision: { type: 'square', to: sq('c2') } });
    expect(session.state.activeHeroId).toBe('H2');
    expect(session.canUndo()).toBe(false);
  });

  it('the pure undo works on the action log', () => {
    const s0 = board({ e1: 'K', e8: 'k' }, { heroes: { H1: 'd0' } });
    expect(undo(s0, [{ type: 'moveStep', to: sq('d1') }])).toEqual([]);
    // 005: a phase change inside the turn is no longer a barrier.
    expect(undo(s0, [{ type: 'moveStep', to: sq('d1') }, { type: 'endPhase' }])).toEqual([{ type: 'moveStep', to: sq('d1') }]);
  });
});
