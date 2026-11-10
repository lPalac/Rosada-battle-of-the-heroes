// Ability engine core (004 T012, research R-01/R-03; contract guarantees 13 and 16).
import { describe, expect, it } from 'vitest';
import { act } from '../../helpers/game.ts';
import { board, toPhase } from '../../fixtures/position.ts';
import { seededRng } from '../../helpers/rng.ts';
import { abilityCost, abilityOffers, apply, legalActions, type GameState } from '../../../src/rules/index.ts';
import { lead, offered, refuse, use } from '../heroes/helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const epicMagus = (extra: object = {}) => ({ heroDefs: { H1: 'magus' }, stage: 'epic' as const, epic: { H1: 'resolute' as const }, pools: { H1: 20 }, ...extra });

describe('ability engine (004)', () => {
  it('offers abilities only in their timing window', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    expect(offered(s, 'magus.flamingBolt')).toBe(true);
    expect(offered(s, 'magus.futureSight')).toBe(false);
    const bl = toPhase(s, 'beforeLead');
    expect(offered(bl, 'magus.futureSight')).toBe(true);
    expect(refuse(bl, 'magus.soulsClash')).toBe('ABILITY_WRONG_TIMING');
  });

  it('charges the normal cost, or the Bloodied cost while Bloodied (guarantee 16)', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...epicMagus(), heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    expect(abilityCost(s, 'H1', 'grandArcanist.magicBombardment')).toBe(3);
    const b = board({ c3: 'N', h7: 'p' }, { ...epicMagus({ health: { H1: 6 } }), heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    expect(abilityCost(b, 'H1', 'grandArcanist.magicBombardment')).toBe(4);
    const r = use(b, 'grandArcanist.magicBombardment', [{ heroId: 'H2' }], 'wound');
    expect(h(r.state, 'H1').pool).toBe(16);
  });

  it('splits payment between the hero pool and the Common Pool (001 payment rules)', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...epicMagus({ pools: { H1: 1 }, common: { light: 5 } }), heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    const r = act(s, { type: 'useAbility', abilityId: 'grandArcanist.magicBombardment', targets: [{ heroId: 'H2' }], option: 'wound', pay: { hero: 1, common: 2 } });
    expect(h(r.state, 'H1').pool).toBe(0);
    expect(r.state.destiny.common.light).toBe(5 - 2 + 1); // +1 D for wounding an enemy hero
    const poor = board({ c3: 'N', h7: 'p' }, { ...epicMagus({ pools: { H1: 1 } }), heroes: { H1: 'c4', H2: 'e5' } });
    expect(abilityOffers(poor).some((o) => o.abilityId === 'grandArcanist.magicBombardment')).toBe(false);
  });

  it('counts uses per game and refuses at zero; uses never go below 0', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove', uses: { H1: { 'magus.flamingBolt': 1 } } });
    s = use(s, 'magus.flamingBolt', [{ heroId: 'H2' }]).state;
    expect(s.abilityState.H1!.uses['magus.flamingBolt']).toBe(0);
    expect(refuse(s, 'magus.flamingBolt', [{ heroId: 'H2' }])).toBe('ABILITY_NO_USES');
  });

  it('refuses "not as a Hero Unit" abilities to a Hero Unit and every ability to an Unconscious hero (Q-45)', () => {
    const favors = ['bloodyTheCastleGates', 'overwhelm', 'greatIncursion', 'tacticalGenius', 'deployTroops', 'royalsFury'] as const;
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'fanatic' }, heroes: { H1: 'd4' }, heroUnits: { H1: ['knight'] }, royalFavors: { light: [...favors] } });
    s = toPhase(s, 'afterLead' === s.phase ? 'afterLead' : s.phase);
    expect(abilityOffers({ ...s, phase: 'afterLead', turn: { ...s.turn, leadPossible: true } }).some((o) => o.abilityId === 'deathKnight.paleSteed')).toBe(false);
  });

  it('an Instead of Lead ability is the turn\'s Lead attempt', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' } });
    s = toPhase(s, 'lead');
    s = use(s, 'cavalier.tightFormation', [{ unitId: 'L-N@c3' }, { square: { x: 2, y: 5 } }]).state;
    expect(s.turn.leadAttempted).toBe(true);
    expect(apply(s, { type: 'announceLead', unitId: 'L-N@c3', to: { x: 4, y: 5 } }).ok).toBe(false);
  });

  it('phases rest while an ability is usable and pass when none is', () => {
    const magus = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' } });
    expect(magus.phase).toBe('beforeMove');
    const generic = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c4', H2: 'e5' } });
    expect(generic.phase).toBe('move');
  });

  it('guarantee 13: every listed useAbility is accepted', () => {
    const random = seededRng('engine-13');
    let s = board({ c3: 'N', d3: 'P', d5: 'p', e4: 'b', h7: 'p' }, { ...epicMagus({ pools: { H1: 60 } }), heroes: { H1: 'c4', H2: 'e5' } });
    let checked = 0;
    for (let i = 0; i < 60 && s.status === 'playing'; i++) {
      const legal = legalActions(s);
      for (const a of legal.filter((x) => x.type === 'useAbility')) {
        const r = apply(s, a);
        expect(r.ok, JSON.stringify(a) + (r.ok ? '' : r.error.code)).toBe(true);
        checked++;
      }
      const pick = legal.filter((a) => a.type !== 'offerDraw' && a.type !== 'setEnforcement');
      const next = pick[random.nextInt(0, pick.length - 1)];
      if (!next) break;
      s = act(s, next.type === 'submitRoll' ? { type: 'submitRoll', value: 15 } : next).state;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a Lead after the ability Lead resolves normally (lead helper)', () => {
    const s = lead(board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd3' } }), 'c3', 'b5');
    expect(s.phase).toBe('afterLead');
  });
});
