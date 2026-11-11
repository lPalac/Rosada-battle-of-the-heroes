// 006 US1 (FR-001, research R-02): 2 D for a new check from any kind of action, at most once per turn per side.
import { describe, expect, it } from 'vitest';
import { act, eventsOf } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import type { GameState } from '../../src/rules/index.ts';
import { formatLogEntry } from '../../src/game/log.ts';
import { lead, unitT, use } from './heroes/helpers.ts';

const checkGains = (s: GameState, side: 'light' | 'dark') =>
  s.destiny.entries.filter((e) => e.reason === 'check' && e.side === side && e.turn === s.turnNumber).length;
const id = (s: GameState, square: string) => unitOn(s, square)!.id;
const MAGUS = { heroDefs: { H1: 'magus' } } as const;

describe('US1 – check Destiny for new checks (B-05)', () => {
  it('US1-AS1 a Lead that puts the enemy King in check gains 2 D once', () => {
    const s = board({ a1: 'R', h1: 'K', e8: 'k' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('e1') });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['L-R@a1'] }]);
    expect(r.state.destiny.common.light).toBe(2);
    expect(checkGains(r.state, 'light')).toBe(1);
    // The log line names the checking unit's type.
    const line = r.state.log.filter((e) => e.type === 'check').map(formatLogEntry);
    expect(line).toEqual(['Dark King in check by Rook']);
  });

  it('US1-AS1 a Lead that checks with two units at once (a discovered check too) gains 2 D once', () => {
    // The Knight leaves the e-file: the Rook behind it checks, and the Knight checks from f6.
    const s = board({ e2: 'R', e4: 'N', h1: 'K', e8: 'k' }, { heroes: { H1: 'd3' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-N@e4', to: sq('f6') });
    const checks = eventsOf(r.events, 'check');
    expect(checks).toHaveLength(1);
    expect([...(checks[0] as { units: string[] }).units].sort()).toEqual(['L-N@e4', 'L-R@e2']);
    expect(checkGains(r.state, 'light')).toBe(1);
    expect(r.state.destiny.common.light).toBe(2);
  });

  it('US1-AS2 the reported case: Lead check, then Souls Clash uncovers the Queen; one check gain, one Destroy gain', () => {
    // Bishop c4→b5 checks e8; Souls Clash Destroys the Pawns on e4 and e6 and opens the e-file for the Queen on e2.
    let s = board({ c4: 'B', e2: 'Q', e4: 'P', e6: 'p', h1: 'K', e8: 'k', h7: 'p' }, { ...MAGUS, heroes: { H1: 'd3' } });
    s = lead(s, 'c4', 'b5');
    expect(checkGains(s, 'light')).toBe(1);
    const r = use(s, 'magus.soulsClash', [unitT(s, 'e4'), unitT(s, 'e6')]);
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['L-Q@e2'] }]);
    expect(checkGains(r.state, 'light')).toBe(1);
    const reasons = r.events.filter((e) => e.type === 'destinyChanged' && e.side === 'light' && e.delta > 0).map((e) => (e as { reason: string }).reason);
    expect(reasons).toContain('destroyEnemy');
    expect(reasons).not.toContain('check');
  });

  it('US1-AS3 a King left in check gains nothing again when an unrelated unit is Led', () => {
    // The Rook on a8 checks e8 from an earlier turn; the Rook on h1 is Led to h2.
    const s = board({ a8: 'R', h1: 'R', a1: 'K', e8: 'k' }, { heroes: { H1: 'g1' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: id(s, 'h1'), to: sq('h2') });
    expect(eventsOf(r.events, 'check')).toEqual([]);
    expect(checkGains(r.state, 'light')).toBe(0);
    expect(r.state.destiny.common.light).toBe(0);
  });

  it('US1-AS4 a Queen joining a Bishop\'s older check is a new check: 2 D', () => {
    const s = board({ b5: 'B', a4: 'Q', a1: 'K', e8: 'k' }, { heroes: { H1: 'b3' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: id(s, 'a4'), to: sq('e4') });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: [id(s, 'a4')] }]);
    expect(checkGains(r.state, 'light')).toBe(1);
  });

  it('US1-AS5 an ability that opens a line, with no Lead giving check, gains 2 D', () => {
    let s = board({ c3: 'N', e2: 'Q', e4: 'P', e6: 'p', h1: 'K', e8: 'k', h7: 'p' }, { ...MAGUS, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    expect(checkGains(s, 'light')).toBe(0);
    const r = use(s, 'magus.soulsClash', [unitT(s, 'e4'), unitT(s, 'e6')]);
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: ['L-Q@e2'] }]);
    expect(checkGains(r.state, 'light')).toBe(1);
  });

  it('US1-AS6 a Pawn promoting to a Queen that checks the enemy King gains 2 D at the promotion', () => {
    const s = board({ a7: 'P', a1: 'K', e8: 'k' }, { heroes: { H1: 'b6' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: id(s, 'a7'), to: sq('a8'), promoteTo: 'queen' });
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'dark', units: [id(s, 'a7')] }]);
    expect(checkGains(r.state, 'light')).toBe(1);
  });

  it('US1-AS6 the promotion chosen by decision gains the 2 D when it is made', () => {
    const s = board({ a7: 'P', a1: 'K', e8: 'k' }, { heroes: { H1: 'b6' }, phase: 'lead' });
    const led = act(s, { type: 'announceLead', unitId: id(s, 'a7'), to: sq('a8') });
    expect(eventsOf(led.events, 'check')).toEqual([]);
    expect(led.state.pendingDecision).toMatchObject({ type: 'promotion' });
    const r = act(led.state, { type: 'decide', decision: { type: 'promotion', to: 'queen' } });
    expect(eventsOf(r.events, 'check')).toHaveLength(1);
    expect(checkGains(r.state, 'light')).toBe(1);
  });

  it('US1-AS15 a side that uncovers a check on its own King gives the other side its 2 D, once per turn', () => {
    // Souls Clash Destroys the Light Pawn on e2 that shields the Light King on e1 from the Dark Rook on e6.
    let s = board({ c3: 'N', e1: 'K', e2: 'P', e4: 'p', e6: 'r', e8: 'k', h7: 'p' }, { ...MAGUS, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const r = use(s, 'magus.soulsClash', [unitT(s, 'e2'), unitT(s, 'e4')]);
    expect(eventsOf(r.events, 'check')).toEqual([{ type: 'check', side: 'light', units: [id(s, 'e6')] }]);
    expect(checkGains(r.state, 'dark')).toBe(1);
    expect(r.state.turn.checkDestinyClaimed).toEqual(['dark']);
  });

  it('guarantee 23: check Destiny rises by at most 2 D per side per turn', () => {
    let s = board({ c4: 'B', e2: 'Q', e4: 'P', e6: 'p', h1: 'K', e8: 'k', h7: 'p' }, { ...MAGUS, heroes: { H1: 'd3' } });
    const before = s.destiny.common.light;
    s = lead(s, 'c4', 'b5');
    s = use(s, 'magus.soulsClash', [unitT(s, 'e4'), unitT(s, 'e6')]).state;
    const fromCheck = s.destiny.entries.filter((e) => e.reason === 'check' && e.side === 'light').reduce((a, e) => a + e.delta, 0);
    expect(fromCheck).toBe(2);
    expect(s.destiny.common.light - before).toBeGreaterThanOrEqual(2);
  });

  it('guarantee 23a: no check event for an action that leaves an existing check as it is', () => {
    const s = board({ a8: 'R', h1: 'R', a1: 'K', e8: 'k' }, { heroes: { H1: 'g1' } });
    const r = act(s, { type: 'endPhase' });
    expect(eventsOf(r.events, 'check')).toEqual([]);
  });
});
