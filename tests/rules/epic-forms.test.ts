// Engine-level Epic form behaviour (004 T038, US3-AS1…AS4).
import { describe, expect, it } from 'vitest';
import { board, toPhase } from '../fixtures/position.ts';
import { abilityOffers, heroAbilityIds } from '../../src/rules/index.ts';
import { sheetModel } from '../../src/game/sheet-model.ts';
import { refuse, use } from './heroes/helpers.ts';
import { act } from '../helpers/game.ts';

const epic = (destiny: 'fanatic' | 'resolute' | 'dominant', extra: object = {}) =>
  ({ heroDefs: { H1: 'magus' }, stage: 'epic' as const, epic: { H1: destiny }, pools: { H1: 30 }, ...extra });

describe('US3 Epic forms', () => {
  it('US3-AS1 form, sheet key and name follow the destiny; the form replaces the starting abilities (A-02)', () => {
    const s = board({ c3: 'N', h7: 'p' }, epic('dominant'));
    const h = s.heroes.find((x) => x.id === 'H1')!;
    expect(h.form).toBe('chronomonger');
    expect(sheetModel(s, 'H1').sheetKey).toBe('sheet.chronomonger');
    expect(heroAbilityIds(h).some((id) => id.startsWith('magus.'))).toBe(false);
  });

  it('US3-AS2 X/Y cost and a/b values by Bloodied', () => {
    const n = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4', H2: 'd4' }, phase: 'beforeMove' });
    expect(abilityOffers(n).find((o) => o.abilityId === 'necromancer.leechingTouch')!.cost).toBe(3);
    const b = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic', { health: { H1: 5 } }), heroes: { H1: 'c4', H2: 'd4' }, phase: 'beforeMove' });
    expect(abilityOffers(b).find((o) => o.abilityId === 'necromancer.leechingTouch')!.cost).toBe(5);
    const hp = b.heroes.find((x) => x.id === 'H2')!.health;
    const r = use(b, 'necromancer.leechingTouch', [{ heroId: 'H2' }], 'wound').state;
    expect(r.heroes.find((x) => x.id === 'H2')!.health).toBe(hp - 4);
  });

  it('US3-AS3 timing window, once per turn and conditions', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c4', H2: 'd5' }, phase: 'beforeMove' });
    expect(refuse(s, 'grandArcanist.fireball', [{ square: { x: 3, y: 4 } }])).toBe('ABILITY_WRONG_TIMING');
    s = use(s, 'grandArcanist.magicBombardment', [{ heroId: 'H2' }], 'wound').state;
    expect(refuse(s, 'grandArcanist.magicBombardment', [{ heroId: 'H2' }], 'wound')).toBe('ABILITY_USED_THIS_TURN');
  });

  it('US3-AS4 Always Active effects need no action', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'scout' }, stage: 'epic', epic: { H1: 'dominant' }, heroes: { H1: 'c4' } });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: 'L-N@c3', to: { x: 2, y: 5 } }).state;
    expect(s.turn.lead!.modifiers.some((m) => m.source === 'royalAssassin.patientPreparation')).toBe(true);
  });
});
