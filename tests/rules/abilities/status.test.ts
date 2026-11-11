// 006 FR-004 (research R-05): every action ability of the active hero, usable now or the reason it is not; guarantee 21.
import { describe, expect, it } from 'vitest';
import { board } from '../../fixtures/position.ts';
import { abilityOffers, abilityStatus, type FavorId, type GameState } from '../../../src/rules/index.ts';
import { lead, use } from '../heroes/helpers.ts';

const statusOf = (s: GameState, id: string) => abilityStatus(s).find((x) => x.abilityId === id);
const CAV = { heroDefs: { H1: 'cavalier' } } as const;
const SIX: FavorId[] = ['overwhelm', 'decimate', 'greatIncursion', 'tacticalGenius', 'royalsFury', 'destinedForGreatness'];

describe('abilityStatus (FR-004)', () => {
  it('usable now', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    expect(statusOf(s, 'cavalier.demoralise')).toEqual({ abilityId: 'cavalier.demoralise', usable: true });
  });

  it('timing: not in its timing window now', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    expect(statusOf(s, 'cavalier.warhorse')).toMatchObject({ usable: false, reason: 'timing' });
  });

  it('noUses, usedThisTurn and notEnoughDestiny', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' }, uses: { H1: { 'cavalier.demoralise': 0 } } });
    s = lead(s, 'c3', 'b5');
    expect(statusOf(s, 'cavalier.demoralise')).toMatchObject({ usable: false, reason: 'noUses' });
    // Souls Clash (d3 / d5 Pawns) keeps After Lead open, so the phase is not passed by itself.
    let b = board({ c3: 'N', d3: 'P', d5: 'p', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    b = use(b, 'magus.flamingBolt', [{ heroId: 'H2' }]).state;
    b = lead(b, 'c3', 'b5');
    expect(b.phase).toBe('afterLead');
    expect(statusOf(b, 'magus.flamingBolt')).toMatchObject({ usable: false, reason: 'usedThisTurn' });
    let poor = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' }, pools: { H1: 0 } });
    poor = lead(poor, 'c3', 'b5');
    expect(statusOf(poor, 'cavalier.demoralise')).toMatchObject({ usable: false, reason: 'notEnoughDestiny' });
  });

  it('notAsHeroUnit: a Hero Unit cannot use Dragon Mount', () => {
    const base = board({ c3: 'N', h7: 'p' }, {
      ...CAV, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 }, heroes: { H1: 'd3' }, royalFavors: { light: SIX }, heroUnits: { H1: ['knight'] },
    });
    const s: GameState = { ...base, phase: 'afterLead', turn: { ...base.turn, leadAttempted: true, leadPossible: true } };
    expect(statusOf(s, 'dragonLord.dragonMount')).toMatchObject({ usable: false, reason: 'notAsHeroUnit' });
  });

  it('noTarget carries the ability\'s target hint', () => {
    // Souls Clash keeps After Lead open; the only enemy hero is out of the Magus's range.
    let s = board({ c3: 'N', d3: 'P', d5: 'p', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'h8', H4: 'h8' } });
    s = lead(s, 'c3', 'b5');
    expect(s.phase).toBe('afterLead');
    expect(statusOf(s, 'magus.flamingBolt')).toMatchObject({ usable: false, reason: 'noTarget', hint: 'enemyHeroInRange' });
  });

  it('passive abilities have no status (they have no Use button)', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'scout' }, heroes: { H1: 'c4' }, phase: 'beforeMove' });
    expect(statusOf(s, 'scout.elusive')).toBeUndefined();
  });

  it('guarantee 21: usable exactly for the abilities abilityOffers lists, and the state is not changed', () => {
    const positions: GameState[] = [
      board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, phase: 'beforeMove' }),
      lead(board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' } }), 'c3', 'b5'),
      board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' }),
      board({ c3: 'N', d5: 'n', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd4' }, phase: 'beforeMove' }),
      board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'scout' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' }),
      board({ c3: 'N', h7: 'p' }, { ...CAV, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 }, heroes: { H1: 'd3', H2: 'd3' }, phase: 'move' }),
    ];
    for (const s of positions) {
      const before = JSON.stringify(s);
      const usable = abilityStatus(s).filter((x) => x.usable).map((x) => x.abilityId).sort();
      const offered = [...new Set(abilityOffers(s).map((o) => o.abilityId))].sort();
      expect(usable).toEqual(offered);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});
