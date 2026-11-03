import { describe, expect, it } from 'vitest';
import { GameSession, undo } from '../../src/game/session.ts';
import { board, name, sq } from '../fixtures/position.ts';

describe('undo (FR-012, research R-11)', () => {
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

  it('cannot undo past a phase change', () => {
    const session = new GameSession(board({ e1: 'K', e8: 'k', d2: 'P' }, { heroes: { H1: 'd1' } }));
    session.dispatch({ type: 'moveStep', to: sq('d0') });
    session.dispatch({ type: 'endPhase' });
    expect(session.canUndo()).toBe(false);
  });

  it('can change the announced Lead before rolling, but not after the roll', () => {
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
    expect(undo(s0, [{ type: 'moveStep', to: sq('d1') }, { type: 'endPhase' }])).toBeNull();
  });
});
