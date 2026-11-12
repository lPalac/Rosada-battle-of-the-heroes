// 006 US4 (FR-020, FR-026, research R-08): ability targets are picked on the board, step by step; targets not on the
// board keep a dialog; blocked targets carry their reason.
import { describe, expect, it } from 'vitest';
import { board, sq } from '../fixtures/position.ts';
import { abilityOffers, type AbilityOffer, type GameState } from '../../src/rules/index.ts';
import { nextPicks, targetPrompt } from '../../src/game/target-model.ts';
import { squareName } from '../../src/rules/board.ts';
import { lead, unitT } from '../rules/heroes/helpers.ts';

const offer = (s: GameState, id: string, option?: string): AbilityOffer => abilityOffers(s).find((o) => o.abilityId === id && o.option === option)!;
const squares = (xs: { coord: { x: number; y: number } }[]) => xs.map((x) => squareName(x.coord)).sort();

describe('US4 – targets on the board (B-02)', () => {
  it('US4-AS1 (model) Warhorse: one step of square picks, no dialog', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const o = offer(s, 'cavalier.warhorse');
    const p = targetPrompt(s, o);
    expect([p.length, p.fallback]).toEqual([1, null]);
    const first = nextPicks(s, o, []);
    expect(first.picks.length).toBe(o.targets.length);
    expect(first.picks.every((x) => 'square' in x.target)).toBe(true);
  });

  it('US4-AS2 (model) a unit, then the squares for that unit', () => {
    const s = board({ c3: 'N', e3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' }, phase: 'lead' });
    const o = offer(s, 'cavalier.tightFormation');
    expect(targetPrompt(s, o).length).toBe(2);
    const units = nextPicks(s, o, []);
    expect(squares(units.picks)).toEqual(['c3', 'e3']);
    const forC3 = nextPicks(s, o, [unitT(s, 'c3')]);
    expect(forC3.picks.length).toBeGreaterThan(0);
    expect(forC3.picks.every((x) => 'square' in x.target)).toBe(true);
    expect(squares(forC3.picks)).toContain('b5');
    expect(squares(forC3.picks)).not.toContain('g4'); // a square only the other Knight reaches
  });

  it('a target that is not on the board (a unit type) keeps the dialog', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'fanatic' }, pools: { H1: 40 }, heroes: { H1: 'd3' }, phase: 'beforeLead' });
    const o = offer(s, 'cultist.dreamOfIllFate');
    expect(targetPrompt(s, o).fallback).toBe('dialog');
  });

  it('FR-026 blocked targets come with their reason code', () => {
    let s = board({ c3: 'N', e6: 'n', c6: 'n', f5: 'K', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 }, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    const o = offer(s, 'dragonLord.terrifyingRoar');
    const step = nextPicks(s, o, []);
    expect(squares(step.picks)).toEqual(['c6']);
    expect(step.blocked.map((b) => [squareName(b.coord), b.code])).toEqual([['e6', 'ABILITY_WOULD_CHECK']]);
  });

  it('a pick on a hero is made on the hero\'s square', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    const o = offer(s, 'magus.flamingBolt');
    const step = nextPicks(s, o, []);
    expect(step.picks.map((x) => [squareName(x.coord), x.target])).toEqual([['e5', { heroId: 'H2' }]]);
    expect(sq('e5')).toEqual(step.picks[0].coord);
  });
});
