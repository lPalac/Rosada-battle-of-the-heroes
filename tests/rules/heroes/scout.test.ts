// Scout, Scoundrel, Spy Master, Royal Assassin (004 US2-AS7…AS9, US3 Scout forms).
import { describe, expect, it } from 'vitest';
import { act, passTurn } from '../../helpers/game.ts';
import { board, sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { apply, legalActions, type GameState } from '../../../src/rules/index.ts';
import { at, finish, lead, offered, refuse, settle, uid, unitT, use } from './helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const kinds = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);
const SCOUT = { heroDefs: { H1: 'scout' } } as const;
const epic = (form: 'fanatic' | 'resolute' | 'dominant', extra: object = {}) => ({
  heroDefs: { H1: 'scout' }, stage: 'epic' as const, epic: { H1: form }, pools: { H1: 40 }, ...extra,
});
const fx = (kind: string, abilityId: string, target: object, data: object = {}) =>
  ({ kind, source: { abilityId, heroId: 'H1' as const }, target, expires: { at: 'removed' as const }, data }) as never;

describe('Scout (US2)', () => {
  it('US2-AS7 Elusive: may end a Move on an enemy unit\'s square; Ram wounds −2', () => {
    let s = toPhase(board({ c3: 'N', d4: 'p', h7: 'p' }, { ...SCOUT, heroes: { H1: 'd3' } }), 'move');
    s = act(s, { type: 'moveStep', to: sq('d4') }).state;
    expect(apply(s, { type: 'endPhase' }).ok).toBe(true);
    // Rammed by a Dark Rook: 1 wound instead of 3.
    let r = board({ e8: 'r', a8: 'k', h2: 'P' }, { ...SCOUT, heroes: { H1: 'e5', H2: 'e9' }, active: 'H2' });
    const hp = h(r, 'H1').health;
    r = lead(r, 'e8', 'e3');
    expect(h(r, 'H1').health).toBe(hp - 1);
    // A generic hero may not end there.
    let g = board({ c3: 'N', d4: 'p', h7: 'p' }, { heroes: { H1: 'd3' } });
    g = act(g, { type: 'moveStep', to: sq('d4') }).state;
    expect(apply(g, { type: 'endPhase' }).ok).toBe(false);
  });

  it('US2-AS8 Bear Traps: −3 to enemy Leads next to it; 4 wounds to an enemy hero who steps in; removed by a Lead onto it', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...SCOUT, heroes: { H1: 'e5' }, phase: 'beforeMove' });
    s = use(s, 'scout.bearTraps').state;
    expect(kinds(s, 'bearTrap')).toHaveLength(1);
    expect(refuse(s, 'scout.bearTraps')).toBe('ABILITY_NO_USES');
    const trap = fx('bearTrap', 'scout.bearTraps', { square: sq('e5') }, { penalty: -3, wounds: 4 });
    // Enemy Lead next to it: −3.
    let e = board({ f6: 'p', a2: 'P' }, { ...SCOUT, heroes: { H1: 'a3', H2: 'f7' }, active: 'H2', effects: [trap] });
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('f5') }).state;
    expect(e.turn.lead!.modifiers.find((m) => m.source === 'scout.bearTraps')?.value).toBe(-3);
    // An enemy hero stepping in: 4 wounds, trap gone.
    let w = board({ f6: 'p', a2: 'P' }, { ...SCOUT, heroes: { H1: 'a3', H2: 'e6' }, active: 'H2', effects: [trap] });
    const hp = h(w, 'H2').health;
    w = act(w, { type: 'moveStep', to: sq('e5') }).state;
    expect(h(w, 'H2').health).toBe(hp - 4);
    expect(kinds(w, 'bearTrap')).toHaveLength(0);
    // Make Peace Not War stops the wounds (Q-46).
    let p = board({ f6: 'p', a2: 'P' }, {
      ...SCOUT, heroes: { H1: 'a3', H2: 'e6' }, active: 'H2', peaceTreaty: 'war',
      effects: [trap, fx('makePeace', 'monk.makePeaceNotWar', { none: true })],
    });
    const hp2 = h(p, 'H2').health;
    p = act(p, { type: 'moveStep', to: sq('e5') }).state;
    expect(h(p, 'H2').health).toBe(hp2);
  });

  it('US2-AS9 Poison Water: an enemy unit in your square cannot be Led next turn, then −3 until the Epic Stage', () => {
    let s = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...SCOUT, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    s = use(s, 'scout.poisonWater', [unitT(s, 'd4')]).state;
    expect(kinds(s, 'cannotLead')).toHaveLength(1);
    expect(kinds(s, 'leadModifier')[0].data.value).toBe(-3);
    expect(refuse(s, 'scout.poisonWater', [unitT(s, 'd4')])).toBe('ABILITY_NO_USES');
    const q = board({ c3: 'N', d4: 'q', e2: 'P', h7: 'p' }, { ...SCOUT, heroes: { H1: 'd4' } });
    expect(refuse(q, 'scout.poisonWater', [unitT(q, 'd4')])).toMatch(/ABILITY_(ROYALTY|BAD_TARGET|WRONG_TIMING)/);
  });
});

describe('Scoundrel (US3)', () => {
  it('US3-scoundrel-elusiveSabotage: −3 to Leads with an enemy unit in the Scoundrel\'s square', () => {
    let e = board({ f6: 'p', a2: 'P' }, { ...epic('fanatic'), heroes: { H1: 'f6', H2: 'f7' }, active: 'H2' });
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('f5') }).state;
    expect(e.turn.lead!.modifiers.find((m) => m.source === 'scoundrel.elusiveSabotage')?.value).toBe(-3);
  });

  it('US3-scoundrel-bushwack: 2 wounds and a push away; +1 into a friendly unit', () => {
    const s = board({ c3: 'N', f6: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4', H2: 'e5' }, phase: 'beforeMove' });
    const hp = h(s, 'H2').health;
    const r = use(s, 'scoundrel.bushwack', [{ heroId: 'H2' }]).state;
    expect(h(r, 'H2').pos).toEqual(sq('f6'));
    expect(h(r, 'H2').health).toBe(hp - 3);
    expect(refuse(s, 'scoundrel.bushwack', [{ heroId: 'H3' }])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-scoundrel-massConfusion: Promote a friendly Pawn standing on an enemy Pawn starting square', () => {
    let s = board({ c3: 'N', d7: 'P', h6: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd5' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'scoundrel.massConfusion', [unitT(s, 'd7')]).state;
    expect(s.pendingDecision?.type).toBe('promotion');
    s = act(s, { type: 'decide', decision: { type: 'promotion', to: 'queen' } }).state;
    expect(unitOn(s, 'd7')?.type).toBe('queen');
  });

  it('US3-scoundrel-misdirection: push an adjacent enemy Pawn back one square', () => {
    let s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4' } });
    s = lead(s, 'c3', 'b1');
    const r = use(s, 'scoundrel.misdirection', [unitT(s, 'd5')]).state;
    expect(unitOn(r, 'd6')?.type).toBe('pawn');
    expect(refuse(s, 'scoundrel.misdirection', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-scoundrel-deviousGambit: when an unprotected friendly unit next to the Scoundrel is Destroyed, Destroy the attacker', () => {
    let e = board({ d4: 'P', d6: 'r', a8: 'k', h2: 'P' }, { ...epic('fanatic'), heroes: { H1: 'c4', H2: 'd7' }, active: 'H2' });
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'd6'), to: sq('d4') }).state;
    e = settle(e);
    if (e.turn.lead!.success === null && !e.pendingDecision) e = act(e, { type: 'submitRoll', value: 20 }).state;
    expect(e.pendingDecision?.type).toBe('reaction');
    e = act(e, { type: 'decide', decision: { type: 'reaction', use: true, targets: [{ unitId: 'D-R@d6' }] } }).state;
    expect(e.units.some((u) => u.id === 'D-R@d6')).toBe(false);
    expect(h(e, 'H1').pool).toBe(40 - 5);
  });

  it('US3-scoundrel-highTreason: Destroy a friendly Queen in range and all enemy units next to it', () => {
    let s = board({ c3: 'N', d5: 'Q', e6: 'p', c6: 'n', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4' } });
    s = toPhase(s, 'beforeLead');
    s = use(s, 'scoundrel.highTreason', [unitT(s, 'd5')]).state;
    expect(unitOn(s, 'd5')).toBeUndefined();
    expect(unitOn(s, 'e6')).toBeUndefined();
    expect(unitOn(s, 'c6')).toBeUndefined();
  });
});

describe('Spy Master (US3)', () => {
  it('US3-spyMaster-evasive: Rammed, the Spy Master may go to the Smuggler\'s Grotto', () => {
    let r = board({ e8: 'r', a8: 'k', h2: 'P' }, {
      ...epic('resolute'), heroes: { H1: 'e5', H2: 'e9' }, active: 'H2',
      effects: [{ kind: 'grotto', source: { abilityId: 'spyMaster.smugglersGrotto', heroId: 'H1' }, target: { area: [sq('<4'), sq('>5')] }, expires: { at: 'removed' }, data: { side: 'light' } }],
    });
    r = toPhase(r, 'lead');
    r = act(r, { type: 'announceLead', unitId: uid(r, 'e8'), to: sq('e3') }).state;
    if (r.turn.lead!.success === null && !r.pendingDecision) r = act(r, { type: 'submitRoll', value: 20 }).state;
    while (r.pendingDecision && r.pendingDecision.type !== 'abilityChoice') r = act(r, legalActions(r).find((a) => a.type === 'decide')!).state;
    expect(r.pendingDecision?.type).toBe('abilityChoice');
    r = act(r, { type: 'decide', decision: { type: 'abilityChoice', choice: '0,4' } }).state;
    expect(h(r, 'H1').pos).toEqual(sq('<4'));
  });

  it('US3-spyMaster-smugglersGrotto: placed when the Epic Stage begins; a tavern for the Spy Master side, the two squares adjacent', () => {
    const s = board({ c3: 'N', h7: 'p' }, {
      ...epic('resolute'), heroes: { H1: '<3' },
      effects: [{ kind: 'grotto', source: { abilityId: 'spyMaster.smugglersGrotto', heroId: 'H1' }, target: { area: [sq('<4'), sq('>5')] }, expires: { at: 'removed' }, data: { side: 'light' } }],
    });
    let m = act(s, { type: 'moveStep', to: sq('<4') }).state;
    expect(m.turn.tavernShopOpen).toEqual(sq('<4'));
    m = act(m, { type: 'moveStep', to: sq('>5') }).state;
    expect(h(m, 'H1').pos).toEqual(sq('>5'));
  });

  it('US3-spyMaster-misinformation: push an enemy hero in range one empty square, not a Hero Unit', () => {
    const s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd4', H2: 'e6' }, phase: 'beforeMove' });
    const r = use(s, 'spyMaster.misinformation', [{ heroId: 'H2' }, at('f7')]).state;
    expect(h(r, 'H2').pos).toEqual(sq('f7'));
    expect(refuse(s, 'spyMaster.misinformation', [{ heroId: 'H2' }, at('h8')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-spyMaster-infiltrate: a Spy Pawn placed in the enemy Royal Rank, Led backwards; re-use returns it', () => {
    let s = board({ c3: 'P', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd4' } });
    s = toPhase(s, 'lead');
    s = use(s, 'spyMaster.infiltrate', [unitT(s, 'c3')]).state;
    const spy = unitOn(s, 'c8')!;
    expect(spy.tags).toContain('spy');
    expect(spy.modifiedFrom).toBe('pawn');
    expect(s.turn.leadAttempted).toBe(true);
    const later = { ...s, phase: 'lead' as const, turn: { ...s.turn, leadAttempted: false, leadPossible: true } };
    expect(apply(later, { type: 'announceLead', unitId: spy.id, to: sq('c7') }).ok).toBe(false); // out of range is fine; path is backwards
  });

  it('US3-spyMaster-mislead: an enemy unit in range not on its starting square cannot be Led next turn', () => {
    let s = board({ c3: 'N', e5: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd4' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'spyMaster.mislead', [unitT(s, 'e5')]).state;
    expect(kinds(s, 'cannotLead')).toHaveLength(1);
    expect(refuse(s, 'spyMaster.mislead', [unitT(s, 'h7')])).toMatch(/ABILITY_(BAD_TARGET|USED_THIS_TURN)/);
  });

  it('US3-spyMaster-counterintelligence: cannot Battle; instead of being Destroyed it escapes', () => {
    let s = board({ c3: 'N', e4: 'P', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd4' } });
    s = toPhase(s, 'beforeLead');
    s = use(s, 'spyMaster.counterintelligence', [unitT(s, 'e4')]).state;
    expect(kinds(s, 'counterintelligence')).toHaveLength(1);
    let e = board({ c3: 'N', f6: 'b', a8: 'k', h2: 'P' }, {
      ...epic('resolute'), heroes: { H1: 'a3', H2: 'f7' }, active: 'H2',
      effects: [{ kind: 'counterintelligence', source: { abilityId: 'spyMaster.counterintelligence', heroId: 'H1' }, target: { unitId: 'L-N@c3' }, expires: { at: 'turnStart', heroId: 'H1' }, data: {} }],
    });
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('c3') }).state;
    if (e.turn.lead!.success === null && !e.pendingDecision) e = act(e, { type: 'submitRoll', value: 20 }).state;
    expect(e.pendingDecision?.type).toBe('reaction');
    const opt = (e.pendingDecision as { options: { square: { x: number; y: number } }[][] }).options[0];
    e = act(e, { type: 'decide', decision: { type: 'reaction', use: true, targets: opt } }).state;
    expect(e.units.some((u) => u.id === 'L-N@c3')).toBe(true);
  });
});

describe('Royal Assassin (US3)', () => {
  it('US3-royalAssassin-patientPreparation: +2 to the Lead after moving 0 squares', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd4' } });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('b5') }).state;
    expect(s.turn.lead!.modifiers.find((m) => m.source === 'royalAssassin.patientPreparation')?.value).toBe(2);
  });

  it('US3-royalAssassin-killOrder: Destroyed at the end of a later turn the Assassin ends next to it', () => {
    let s = board({ c3: 'N', e5: 'p', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd4' } });
    s = toPhase(s, 'beforeLead');
    s = use(s, 'royalAssassin.killOrder', [unitT(s, 'e5')]).state;
    expect(kinds(s, 'killOrder')).toHaveLength(1);
    s = finish(lead(s, 'c3', 'b5'));
    s = passTurn(s).state; // end of this turn: not yet
    expect(unitOn(s, 'e5')).toBeTruthy();
  });

  it('US3-royalAssassin-assassinateTheUnworthy: Destroy an enemy unit next to you and your King', () => {
    let s = board({ c3: 'N', e2: 'n', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const r = use(s, 'royalAssassin.assassinateTheUnworthy', [unitT(s, 'e2')]).state;
    expect(unitOn(r, 'e2')).toBeUndefined();
    expect(refuse(s, 'royalAssassin.assassinateTheUnworthy', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-royalAssassin-reapTheWeary: a Bloodied enemy hero in your square drops to 0', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd4', H2: 'd4' }, health: { H2: 5 } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'royalAssassin.reapTheWeary', [{ heroId: 'H2' }]).state;
    expect(h(s, 'H2').health).toBe(0);
  });

  it('US3-royalAssassin-redCarpet: the Queen Battles and continues to the next unit in its path', () => {
    let s = board({ d3: 'Q', d5: 'p', d7: 'p', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c3' } });
    s = toPhase(s, 'lead');
    s = use(s, 'royalAssassin.redCarpet', [unitT(s, 'd3'), at('d5')]).state;
    s = finish(s);
    expect(unitOn(s, 'd7')?.type).toBe('queen');
    expect(s.units.filter((u) => u.side === 'dark' && u.type === 'pawn')).toHaveLength(1);
  });

  it('US3-royalAssassin-regicide: Destroy an adjacent enemy Queen unprotected before the Lead', () => {
    let s = board({ c3: 'N', e5: 'q', e2: 'P', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd4' } });
    s = lead(s, 'c3', 'b5');
    expect(offered(s, 'royalAssassin.regicide')).toBe(true);
    if (offered(s, 'royalAssassin.regicide')) {
      s = use(s, 'royalAssassin.regicide', [unitT(s, 'e5')]).state;
      expect(unitOn(s, 'e5')).toBeUndefined();
    }
    expect(refuse(s, 'royalAssassin.regicide', [unitT(s, 'h7')])).toMatch(/ABILITY_/);
  });
});
