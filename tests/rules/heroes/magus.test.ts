// Magus, Necromancer, Grand Arcanist, Chronomonger (004 US2-AS10…AS12, US3 Magus forms).
import { describe, expect, it } from 'vitest';
import { act, passTurn } from '../../helpers/game.ts';
import { board, sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { abilityOffers, apply, destinyGeneration, type GameState } from '../../../src/rules/index.ts';
import { at, finish, lead, offered, refuse, settle, uid, unitT, use } from './helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const kinds = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);
const MAGUS = { heroDefs: { H1: 'magus' } } as const;
const epic = (form: 'fanatic' | 'resolute' | 'dominant', extra: object = {}) => ({
  heroDefs: { H1: 'magus' }, stage: 'epic' as const, epic: { H1: form }, pools: { H1: 40 }, ...extra,
});

describe('Magus (US2)', () => {
  it('US2-AS10 Future Sight: take 1 wound, +2 to the next Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...MAGUS, heroes: { H1: 'c4' }, phase: 'beforeLead' });
    const hp = h(s, 'H1').health;
    s = use(s, 'magus.futureSight').state;
    expect(h(s, 'H1').health).toBe(hp - 1);
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('b5') }).state;
    expect(s.turn.lead!.modifiers.find((m) => m.source === 'magus.futureSight')?.value).toBe(2);
    expect(kinds(s, 'nextLeadBonus')).toHaveLength(0);
  });

  it('US2-AS11 Flaming Bolt: 2 wounds to an enemy hero in range, 2 uses', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...MAGUS, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    const hp = h(s, 'H2').health;
    s = use(s, 'magus.flamingBolt', [{ heroId: 'H2' }]).state;
    expect(h(s, 'H2').health).toBe(hp - 2);
    expect(s.abilityState.H1!.uses['magus.flamingBolt']).toBe(1);
    expect(refuse(s, 'magus.flamingBolt', [{ heroId: 'H2' }])).toBe('ABILITY_USED_THIS_TURN');
    const far = board({ c3: 'N', h7: 'p' }, { ...MAGUS, heroes: { H1: 'c4', H2: 'h8' } });
    expect(refuse(far, 'magus.flamingBolt', [{ heroId: 'H2' }])).toMatch(/ABILITY_(WRONG_TIMING|BAD_TARGET)/);
  });

  it('US2-AS12 Souls Clash: Destroy an adjacent friendly Pawn and an enemy Pawn in its file, heal 3', () => {
    let s = board({ c3: 'N', d3: 'P', d5: 'p', h7: 'p' }, { ...MAGUS, heroes: { H1: 'c4' }, health: { H1: 4 } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'magus.soulsClash', [unitT(s, 'd3'), unitT(s, 'd5')]).state;
    expect(unitOn(s, 'd3')).toBeUndefined();
    expect(unitOn(s, 'd5')).toBeUndefined();
    expect(h(s, 'H1').health).toBe(7);
    expect(refuse(s, 'magus.soulsClash', [unitT(s, 'h7'), unitT(s, 'h7')])).toBe('ABILITY_NO_USES');
  });
});

describe('Necromancer (US3)', () => {
  it('US3-necromancer-graveSacrifice: +1 generation per 5 units in the own Graveyard, on the Necromancer\'s turn', () => {
    const s = board({ c3: 'N', h7: 'p' }, epic('fanatic'));
    const base = destinyGeneration(s, 'light');
    const g = { ...s, graveyard: Array.from({ length: 5 }, (_, i) => ({ ...s.units[0], id: `g${i}`, side: 'light' as const })) };
    expect(destinyGeneration(g, 'light')).toBe(base + 1);
  });

  it('US3-necromancer-soulSyphon: heal 2 when an adjacent main unit is Destroyed', () => {
    let s = board({ d3: 'P', e4: 'p', a2: 'P' }, { ...epic('fanatic'), heroes: { H1: 'c3', H2: 'f5' }, active: 'H2', health: { H1: 6 } });
    s = lead(s, 'e4', 'd3');
    expect(h(s, 'H1').health).toBe(8);
  });

  it('US3-necromancer-bloodRitual: take 2 wounds, +3 (Bloodied +4) to the Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4' }, phase: 'beforeLead' });
    s = use(s, 'necromancer.bloodRitual').state;
    expect(kinds(s, 'nextLeadBonus')[0].data.value).toBe(3);
    let b = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4' }, phase: 'beforeLead', health: { H1: 6 } });
    b = use(b, 'necromancer.bloodRitual').state;
    expect(kinds(b, 'nextLeadBonus')[0].data.value).toBe(4);
    expect(refuse(b, 'necromancer.bloodRitual')).toBe('ABILITY_USED_THIS_TURN');
  });

  it('US3-necromancer-leechingTouch: 2/4 wounds and heal 3, or Destroy an adjacent enemy auxiliary unit and heal 2', () => {
    let s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4', H2: 'd4' }, phase: 'beforeMove', health: { H1: 12 }, auxiliary: ['d5'] });
    const hp = h(s, 'H2').health;
    const r = use(s, 'necromancer.leechingTouch', [{ heroId: 'H2' }], 'wound');
    expect(h(r.state, 'H2').health).toBe(hp - 2);
    expect(h(r.state, 'H1').health).toBe(15);
    const a = use(s, 'necromancer.leechingTouch', [unitT(s, 'd5')], 'destroyAux');
    expect(unitOn(a.state, 'd5')).toBeUndefined();
    expect(h(a.state, 'H1').health).toBe(14);
    expect(refuse(s, 'necromancer.leechingTouch', [unitT(s, 'h7')], 'destroyAux')).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-necromancer-awakenTheDeathless: an undead Knight or Bishop on an empty starting square; 3/2 wounds to the caster', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4' } });
    s = lead(s, 'c3', 'b5');
    const hp = h(s, 'H1').health;
    const r = use(s, 'necromancer.awakenTheDeathless', [at('c1'), { unitType: 'bishop' }]);
    expect(unitOn(r.state, 'c1')?.tags).toEqual(['undead']);
    expect(h(r.state, 'H1').health).toBe(hp - 3);
    expect(refuse(s, 'necromancer.awakenTheDeathless', [at('c1'), { unitType: 'knight' }])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-necromancer-undeadLegions: undead Pawns on every free Pawn starting square; 1 + created wounds', () => {
    let s = board({ c3: 'N', a2: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4' } });
    s = lead(s, 'c3', 'b5');
    const hp = h(s, 'H1').health;
    s = use(s, 'necromancer.undeadLegions').state;
    const made = s.units.filter((u) => u.tags?.includes('undead') && u.type === 'pawn');
    expect(made).toHaveLength(7);
    expect(h(s, 'H1').health).toBe(hp - 8);
    // Bloodied: 1 wound and an instant Lead without Battle with a created Pawn.
    let b = board({ c3: 'N', a2: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'c4' }, health: { H1: 6 } });
    b = lead(b, 'c3', 'b5');
    b = use(b, 'necromancer.undeadLegions').state;
    expect(b.pendingDecision?.type).toBe('abilityChoice');
    expect(h(b, 'H1').health).toBe(5);
  });
});

describe('Grand Arcanist (US3)', () => {
  it('US3-grandArcanist-magicBombardment: 2 wounds to a hero in range, or Destroy an adjacent auxiliary unit', () => {
    const s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c4', H2: 'e6' }, phase: 'beforeMove', auxiliary: ['d5'] });
    const hp = h(s, 'H2').health;
    expect(h(use(s, 'grandArcanist.magicBombardment', [{ heroId: 'H2' }], 'wound').state, 'H2').health).toBe(hp - 2);
    expect(unitOn(use(s, 'grandArcanist.magicBombardment', [unitT(s, 'd5')], 'destroyAux').state, 'd5')).toBeUndefined();
    expect(refuse(s, 'grandArcanist.magicBombardment', [unitT(s, 'h7')], 'destroyAux')).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-grandArcanist-arcaneShackles: the unit cannot be Led nor Destroyed in Battle; no second mark', () => {
    let s = board({ c3: 'N', e5: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c4' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'grandArcanist.arcaneShackles', [unitT(s, 'e5')]).state;
    expect(kinds(s, 'arcaneShackles')).toHaveLength(1);
    // Enemy turn: the shackled pawn cannot be Led; light cannot Battle it either.
    const dark = { ...s, activeHeroId: 'H2' as const };
    expect(apply(dark, { type: 'announceLead', unitId: uid(s, 'e5'), to: sq('e4') }).ok).toBe(false);
    expect(refuse({ ...s, abilityState: { H1: { uses: {}, usedThisTurn: [] } } }, 'grandArcanist.arcaneShackles', [unitT(s, 'e5')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-grandArcanist-conjurePortal: same colour, not the enemy Royal Rank; a Lead onto one Portal ends on the other', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c4' } });
    s = lead(s, 'c3', 'b5');
    expect(refuse(s, 'grandArcanist.conjurePortal', [at('d4'), at('d5')])).toBe('ABILITY_BAD_TARGET');
    s = use(s, 'grandArcanist.conjurePortal', [at('d4'), at('f6')]).state;
    expect(kinds(s, 'portal')).toHaveLength(1);
    // A Light Knight Led onto d4 comes out on f6.
    let k = board({ b3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'b4' }, effects: [{ kind: 'portal', source: { abilityId: 'grandArcanist.conjurePortal', heroId: 'H1' }, target: { area: [sq('d4'), sq('f6')] }, expires: { at: 'removed' }, data: {} }] });
    k = lead(k, 'b3', 'f6');
    expect(unitOn(k, 'f6')?.type).toBe('knight');
  });

  it('US3-grandArcanist-summonShadowDemon: a Demon that only Battles; the previous one vanishes; no generation', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd4' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'grandArcanist.summonShadowDemon', [{ unitType: 'rook' }]).state;
    const demon = s.units.find((u) => u.tags?.includes('demon'))!;
    expect(demon.type).toBe('rook');
    expect(destinyGeneration(s, 'light')).toBe(destinyGeneration({ ...s, units: s.units.filter((u) => u.id !== demon.id) }, 'light'));
    expect(refuse(s, 'grandArcanist.summonShadowDemon', [{ unitType: 'rook' }])).toBe('ABILITY_USED_THIS_TURN');
  });

  it('US3-grandArcanist-fireball: 2×2 in range; at the end of the next turn 5 wounds and Destroy', () => {
    let s = board({ c3: 'N', e6: 'p', a7: 'p' }, { ...epic('resolute'), heroDefs: { H1: 'magus', H2: 'scout' }, heroes: { H1: 'c4', H2: 'e7' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'grandArcanist.fireball', [at('e6')]).state;
    const hp = h(s, 'H2').health;
    s = passTurn(passTurn(s).state).state;
    expect(unitOn(s, 'e6')).toBeUndefined();
    expect(h(s, 'H2').health).toBeLessThanOrEqual(hp - 5);
    expect(kinds(s, 'fireball')).toHaveLength(0);
  });
});

describe('Chronomonger (US3)', () => {
  it('US3-chronomonger-noTimeToLose: falling Unconscious, choose to keep the turn: start square, 1 health', () => {
    let s = board({ e5: 'P', h2: 'P', d7: 'r' }, { heroDefs: { H1: 'magus' }, stage: 'epic', epic: { H1: 'dominant' }, heroes: { H1: 'd5', H2: 'd8' }, active: 'H2', health: { H1: 2 } });
    s = lead(s, 'd7', 'd2');
    expect(s.pendingDecision).toBeNull();
    expect(h(s, 'H1').health).toBe(1);
    expect(h(s, 'H1').status.unconscious).toBe(false);
    expect(h(s, 'H1').pos).toEqual(h(s, 'H1').startSquare);
  });

  it('US3-chronomonger-certaintyAndDeath: the Lead succeeds; the next Lead too, then the unit is Destroyed', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' } });
    s = toPhase(s, 'lead');
    const r = use(s, 'chronomonger.certaintyAndDeath', [unitT(s, 'c3'), at('b5')]);
    expect(r.events.some((e) => e.type === 'rollRequested')).toBe(false);
    s = settle(r.state);
    expect(unitOn(s, 'b5')?.type).toBe('knight');
    expect(kinds(s, 'certainty')).toHaveLength(1);
    expect(refuse(toPhase(board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' } }), 'lead'), 'chronomonger.certaintyAndDeath', [{ unitId: 'L-N@c3' }, at('c5')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-chronomonger-rapidMarch: a Pawn on its starting square Led 3 forward, no en passant', () => {
    let s = board({ c2: 'P', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c3' } });
    s = toPhase(s, 'lead');
    s = use(s, 'chronomonger.rapidMarch').state;
    s = lead(s, 'c2', 'c5');
    expect(unitOn(s, 'c5')?.enPassantTarget).toBeNull();
    const none = toPhase(board({ c4: 'P', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c3' } }), 'lead');
    expect(offered(none, 'chronomonger.rapidMarch')).toBe(false);
  });

  it('US3-chronomonger-timeyWimeyShift: swap turn order with the ally; the ally becomes active', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' } });
    s = passTurn(passTurn(passTurn(passTurn(s).state).state).state).state;
    expect(s.activeHeroId).toBe('H1');
    expect(s.phase).toBe('beforeTurn');
    s = use(s, 'chronomonger.timeyWimeyShift', [{ heroId: 'H3' }]).state;
    expect(s.activeHeroId).toBe('H3');
    expect(h(s, 'H1').turnOrder).toBe(3);
    expect(h(s, 'H3').turnOrder).toBe(1);
  });

  it('US3-chronomonger-convergeTimelines: a copy where the Lead began; marks are not copied (Q-46)', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'chronomonger.convergeTimelines').state;
    const copy = s.units.find((u) => u.tags?.includes('clone'))!;
    expect(copy.pos).toEqual(sq('c3'));
    expect(copy.type).toBe('knight');
    expect(kinds(s, 'converge')).toHaveLength(1);
    let n = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' } });
    n = toPhase(n, 'beforeMove');
    expect(refuse(n, 'chronomonger.convergeTimelines')).toBe('ABILITY_WRONG_TIMING');
  });

  it('US3-chronomonger-temporalFlux: Destroyed friendly units come back on a starting square of their type', () => {
    let s = board({ d3: 'P', e4: 'p', a2: 'P' }, {
      ...epic('dominant'), heroes: { H1: 'c4', H2: 'f5' }, active: 'H2',
      effects: [{ kind: 'temporalFlux', source: { abilityId: 'chronomonger.temporalFlux', heroId: 'H1' }, target: { square: sq('c0') }, expires: { at: 'turnEnd', heroId: 'H1', count: 1 }, data: {} }],
    });
    s = lead(s, 'e4', 'd3');
    expect(s.units.filter((u) => u.side === 'light' && u.type === 'pawn')).toHaveLength(2);
    const c = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c4' }, phase: 'beforeMove' });
    const used = use(c, 'chronomonger.temporalFlux').state;
    expect(kinds(used, 'temporalFlux')).toHaveLength(1);
    expect(refuse(used, 'chronomonger.temporalFlux')).toBe('ABILITY_USED_THIS_TURN');
  });
});

void abilityOffers;
void finish;
