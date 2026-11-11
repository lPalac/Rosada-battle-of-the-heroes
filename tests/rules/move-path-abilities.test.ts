// 006 US1 (FR-003, FR-004, research R-05): "During Move" abilities act on every square of the Move's path, the start
// square included, until the Move ends; when no hero on the path is a legal target, the ability says why.
import { describe, expect, it } from 'vitest';
import { act } from '../helpers/game.ts';
import { board, sq } from '../fixtures/position.ts';
import { abilityOffers, abilityStatus, type GameState } from '../../src/rules/index.ts';
import { squareName } from '../../src/rules/board.ts';

const step = (s: GameState, to: string) => act(s, { type: 'moveStep', to: sq(to) }).state;
const breathSquares = (s: GameState) => abilityOffers(s)
  .filter((o) => o.abilityId === 'dragonLord.breathOfFieryDestruction' && o.option === 'square')
  .flatMap((o) => o.targets.map((t) => squareName((t[0] as { square: { x: number; y: number } }).square)));
const healTargets = (s: GameState, id: string) => abilityOffers(s).filter((o) => o.abilityId === id)
  .flatMap((o) => o.targets.map((t) => (t[0] as { heroId: string }).heroId));
const statusOf = (s: GameState, id: string) => abilityStatus(s).find((x) => x.abilityId === id);

const DRAGON = { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 }, phase: 'move' } as const;
const SAINT = { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'resolute' }, pools: { H1: 40 }, phase: 'move' } as const;

describe('US1 – "During Move" abilities on the path (B-10, B-11)', () => {
  it('US1-AS12 Breath: the start square, a square stepped onto and squares passed, with an enemy hero, until the Move ends', () => {
    // The Dragon Lord starts on d3 with the enemy hero H2; H4 (enemy) stands on f5.
    let s = board({ c3: 'N', h7: 'p' }, { ...DRAGON, heroes: { H1: 'd3', H2: 'd3', H4: 'f5' } });
    expect(breathSquares(s)).toEqual(['d3']);
    s = step(s, 'e4');
    expect(breathSquares(s)).toEqual(['d3']);
    s = step(s, 'f5');
    expect(breathSquares(s).sort()).toEqual(['d3', 'f5']);
    s = step(s, 'g6');
    expect(breathSquares(s).sort()).toEqual(['d3', 'f5']);
  });

  it('US1-AS12 Breath is not offered for a square with only a friendly hero', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...DRAGON, heroes: { H1: 'd3', H3: 'e4' } });
    s = step(s, 'e4');
    expect(breathSquares(s)).toEqual([]);
  });

  it('US1-AS13 Rejuvenating Stroll: a friendly hero on the start square or the path, also after stepping further', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd3', H3: 'd3' }, health: { H3: 5 }, phase: 'move' });
    expect(healTargets(s, 'monk.rejuvenatingStroll')).toEqual(['H3']);
    s = step(s, 'e4');
    expect(healTargets(s, 'monk.rejuvenatingStroll')).toEqual(['H3']);
    const enemy = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, heroes: { H1: 'd3', H2: 'e4' }, phase: 'move' });
    expect(healTargets(step(enemy, 'e4'), 'monk.rejuvenatingStroll')).toEqual([]);
  });

  it('US1-AS13 Saintly Inspiration: a friendly hero passed earlier in the Move is still a target', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...SAINT, heroes: { H1: 'c2', H3: 'd3' }, health: { H3: 5 } });
    s = step(s, 'd3');
    expect(healTargets(s, 'saint.saintlyInspiration')).toEqual(['H3']);
    s = step(s, 'e4');
    expect(healTargets(s, 'saint.saintlyInspiration')).toEqual(['H3']);
  });

  it('US1-AS14 the screenshot positions: no legal target, and the status says what is missing', () => {
    // B-10: the Light Dragon Lord walks over the Light Magus (a friendly hero).
    let b10 = board({ c3: 'N', h7: 'p' }, { ...DRAGON, heroDefs: { H1: 'cavalier', H3: 'magus' }, heroes: { H1: 'd3', H3: 'e4' } });
    b10 = step(b10, 'e4');
    expect(statusOf(b10, 'dragonLord.breathOfFieryDestruction')).toMatchObject({ usable: false, reason: 'noTarget', hint: 'enemyHeroOnPath' });
    // B-11: a Saint walks over an enemy hero.
    let b11 = board({ c3: 'N', h7: 'p' }, { ...SAINT, heroes: { H1: 'd3', H2: 'e4' } });
    b11 = step(b11, 'e4');
    expect(statusOf(b11, 'saint.saintlyInspiration')).toMatchObject({ usable: false, reason: 'noTarget', hint: 'friendlyHeroOnPath' });
  });
});
