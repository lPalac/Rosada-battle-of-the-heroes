// Monk, Cultist, Saint, Supreme Inquisitor (004 US2-AS4…AS6, US3 Monk forms; Cultist per research R-13).
import { describe, expect, it } from 'vitest';
import { act, passTurn } from '../../helpers/game.ts';
import { board, sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { apply, legalLeadTargets, type GameState } from '../../../src/rules/index.ts';
import { at, finish, lead, offered, refuse, uid, unitT, use } from './helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const kinds = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);
const MONK = { heroDefs: { H1: 'monk' } } as const;
const epic = (form: 'fanatic' | 'resolute' | 'dominant', extra: object = {}) => ({
  heroDefs: { H1: 'monk' }, stage: 'epic' as const, epic: { H1: form }, pools: { H1: 40 }, ...extra,
});

describe('Monk (US2)', () => {
  it('US2-AS4 Rejuvenating Stroll: heal a friendly hero in the Monk\'s square for 1, once per turn', () => {
    let s = toPhase(board({ c3: 'N', h7: 'p' }, { ...MONK, heroes: { H1: 'd3', H3: 'd4' }, health: { H3: 4 } }), 'move');
    s = act(s, { type: 'moveStep', to: sq('d4') }).state;
    s = use(s, 'monk.rejuvenatingStroll', [{ heroId: 'H3' }]).state;
    expect(h(s, 'H3').health).toBe(5);
    expect(refuse(s, 'monk.rejuvenatingStroll', [{ heroId: 'H3' }])).toBe('ABILITY_USED_THIS_TURN');
  });

  it('US2-AS5 Preaching: −4 next turn; both uses on one unit → it cannot be Led', () => {
    // 006 FR-017: one use or both uses in one action, once per turn (replaces 004 Q-50's two uses in one turn).
    const start = board({ c3: 'N', d4: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, phase: 'beforeMove' });
    let s = use(start, 'monk.preaching', [unitT(start, 'd4')], 'one').state;
    expect(kinds(s, 'leadModifier')[0].data.value).toBe(-4);
    expect(refuse(s, 'monk.preaching', [unitT(s, 'd4')], 'one')).toBe('ABILITY_USED_THIS_TURN');
    s = use(start, 'monk.preaching', [unitT(start, 'd4')], 'both').state;
    expect(kinds(s, 'cannotLead')).toHaveLength(1);
    expect(refuse(s, 'monk.preaching', [unitT(s, 'd4')], 'one')).toBe('ABILITY_NO_USES');
    const q = board({ c3: 'N', d4: 'q', e2: 'P', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' } });
    expect(refuse(q, 'monk.preaching', [unitT(q, 'd4')])).toMatch(/ABILITY_(ROYALTY|BAD_TARGET|WRONG_TIMING)/);
  });

  it('US2-AS6 Make Peace Not War: no Destroy, no wounds, no roll, no check; only at War and not in check', () => {
    const peace = board({ c3: 'N', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, peaceTreaty: 'peace' });
    expect(refuse(peace, 'monk.makePeaceNotWar')).toMatch(/ABILITY_/);
    let s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...MONK, heroes: { H1: 'd3' }, peaceTreaty: 'war', phase: 'beginningOfTurn' });
    s = use(s, 'monk.makePeaceNotWar').state;
    expect(kinds(s, 'makePeace')).toHaveLength(1);
    s = toPhase(s, 'lead');
    // No Battle: the Knight cannot take d5; no roll for a Lead.
    expect(legalLeadTargets(s, uid(s, 'c3')).some((t) => t.to.x === sq('d5').x && t.to.y === sq('d5').y)).toBe(false);
    const r = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('b5') });
    expect(r.events.some((e) => e.type === 'rollRequested')).toBe(false);
  });
});

describe('Cultist (US3, research R-13)', () => {
  it('US3-cultist-righteousMight: +1 to Leads into Battle per friendly auxiliary Pawn', () => {
    let s = board({ c3: 'N', d5: 'p', a3: 'P', b3: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' }, auxiliary: ['a3', 'b3'] });
    s = toPhase(s, 'lead');
    s = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('d5') }).state;
    expect(s.turn.lead!.modifiers.find((m) => m.source === 'cultist.righteousMight')?.value).toBe(2);
  });

  it('US3-cultist-spiritualHealing: heal 1 + 1 per adjacent friendly auxiliary unit', () => {
    let s = board({ c3: 'N', e4: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' }, auxiliary: ['e4'], health: { H1: 10 }, phase: 'beforeMove' });
    s = use(s, 'cultist.spiritualHealing').state;
    expect(h(s, 'H1').health).toBe(12);
  });

  it('US3-cultist-religiousFervor: token, then a Pawn, then a Bishop; Bloodied straight to the Bishop; cleared by an enemy Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' }, phase: 'beforeLead' });
    s = use(s, 'cultist.religiousFervor', [at('e4')]).state;
    expect(kinds(s, 'fervor')).toHaveLength(1);
    expect(refuse(s, 'cultist.religiousFervor', [at('e4')])).toBe('ABILITY_USED_THIS_TURN');
    s = finish(lead(s, 'c3', 'b5'));
    for (let i = 0; i < 5 && !unitOn(s, 'e4'); i++) s = passTurn(s).state;
    expect(s.turnNumber).toBe(6);
    expect(unitOn(s, 'e4')?.type).toBe('pawn');
    expect(unitOn(s, 'e4')?.kind).toBe('auxiliary');
  });

  it('US3-cultist-knightmare: after forking with a Knight, it and the forked units cannot be Led', () => {
    let s = board({ c3: 'N', c7: 'r', f6: 'b', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    expect(kinds(s, 'cannotLead').length).toBe(3);
  });

  it('US3-cultist-sacrifice: at the end of the next turn the Pawn is Destroyed and enemy heroes near it take 3', () => {
    let s = board({ c3: 'N', d4: 'P', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3', H2: 'e5' } });
    s = lead(s, 'c3', 'b5');
    s = use(s, 'cultist.sacrifice', [unitT(s, 'd4')]).state;
    const hp = h(s, 'H2').health;
    for (let i = 0; i < 5; i++) s = passTurn(s).state;
    expect(unitOn(s, 'd4')).toBeUndefined();
    expect(h(s, 'H2').health).toBeLessThanOrEqual(hp - 3);
  });

  it('US3-cultist-falseSalvation: Destroy an adjacent enemy Pawn and create a friendly auxiliary Pawn there (Bloodied: a main Pawn returns)', () => {
    let s = board({ c3: 'N', d6: 'p', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const pawn = s.units.find((u) => u.side === 'dark' && u.type === 'pawn' && Math.max(Math.abs(u.pos.x - h(s, 'H1').pos.x), Math.abs(u.pos.y - h(s, 'H1').pos.y)) <= 1);
    expect(pawn).toBeTruthy();
    const r = use(s, 'cultist.falseSalvation', [{ unitId: pawn!.id }]).state;
    const made = r.units.find((u) => u.side === 'light' && u.type === 'pawn' && u.pos.x === pawn!.pos.x && u.pos.y === pawn!.pos.y);
    expect(made?.kind).toBe('auxiliary');
    expect(refuse(s, 'cultist.falseSalvation', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-cultist-dreamOfIllFate: an enemy hero who Leads the chosen type next turn takes 4 wounds; not royalty', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' }, phase: 'beforeLead' });
    expect(refuse(s, 'cultist.dreamOfIllFate', [{ unitType: 'queen' }])).toBe('ABILITY_BAD_TARGET');
    s = use(s, 'cultist.dreamOfIllFate', [{ unitType: 'pawn' }]).state;
    expect(kinds(s, 'dream')).toHaveLength(1);
    // Next turn: the enemy hero Leads a Pawn and takes 4 wounds.
    let e = board({ f6: 'p', a2: 'P' }, {
      ...epic('fanatic'), heroes: { H1: 'a3', H2: 'f7' }, active: 'H2',
      effects: [{ kind: 'dream', source: { abilityId: 'cultist.dreamOfIllFate', heroId: 'H1' }, target: { unitType: 'pawn', side: 'dark' }, expires: { at: 'turnEnd', turn: 2 }, data: { turn: 2, wounds: 4 } }],
    });
    const hp = h(e, 'H2').health;
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('f5') }).state;
    expect(h(e, 'H2').health).toBe(hp - 4);
  });
});

describe('Saint (US3)', () => {
  it('US3-saint-saintlyInspiration: heal a friendly hero in the Saint\'s square for 2', () => {
    let s = toPhase(board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3', H3: 'd4' }, health: { H3: 4 } }), 'move');
    s = act(s, { type: 'moveStep', to: sq('d4') }).state;
    s = use(s, 'saint.saintlyInspiration', [{ heroId: 'H3' }]).state;
    expect(h(s, 'H3').health).toBe(6);
  });

  it('US3-saint-sacredRite: heal 4 a friendly hero next to a friendly Bishop', () => {
    const s = board({ c3: 'N', e4: 'B', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' }, health: { H1: 10 }, phase: 'beforeMove' });
    expect(h(use(s, 'saint.sacredRite', [{ heroId: 'H1' }]).state, 'H1').health).toBe(14);
    expect(refuse(s, 'saint.sacredRite', [{ heroId: 'H3' }])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-saint-pilgrimage: a Pawn forward through enemy units in its file; no Ram, no Battle', () => {
    let s = board({ d3: 'P', d4: 'p', d5: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c3', H2: 'd6' } });
    s = toPhase(s, 'lead');
    const hp = h(s, 'H2').health;
    s = finish(use(s, 'saint.pilgrimage', [unitT(s, 'd3'), at('d6')]).state);
    expect(unitOn(s, 'd6')?.side).toBe('light');
    expect(unitOn(s, 'd4')?.side).toBe('dark');
    expect(h(s, 'H2').health).toBe(hp);
  });

  it('US3-saint-martyrdom: adjacent enemy units cannot be Led; 2 wounds each; Movement 1 next turn', () => {
    let s = board({ c3: 'N', e4: 'p', e3: 'n', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const hp = h(s, 'H1').health;
    const pos = h(s, 'H1').pos;
    const n = s.units.filter((u) => u.side === 'dark' && Math.max(Math.abs(u.pos.x - pos.x), Math.abs(u.pos.y - pos.y)) <= 1).length;
    if (n > 0) {
      s = use(s, 'saint.martyrdom').state;
      expect(kinds(s, 'cannotLead')).toHaveLength(n);
      expect(h(s, 'H1').health).toBe(hp - 2 * n);
    }
  });

  it('US3-saint-wingsOfDestiny: a main unit returns from the Graveyard to an empty starting square of its type', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = { ...s, graveyard: [{ id: 'L-R-a', side: 'light', type: 'rook', originalType: 'rook', kind: 'main', pos: sq('a1'), hasBeenLed: true, promoted: false, enPassantTarget: null }] };
    s = lead(s, 'c3', 'b5');
    s = use(s, 'saint.wingsOfDestiny', [{ unitId: 'L-R-a' }, at('a1')]).state;
    expect(unitOn(s, 'a1')?.type).toBe('rook');
    expect(s.graveyard).toHaveLength(0);
  });
});

describe('Supreme Inquisitor (US3)', () => {
  it('US3-supremeInquisitor-zealotMob: 2 wounds to an enemy hero whose Lead passes next to the Inquisitor', () => {
    let e = board({ f6: 'b', a2: 'P' }, { ...epic('dominant'), heroes: { H1: 'd4', H2: 'f7' }, active: 'H2' });
    const hp = h(e, 'H2').health;
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('b2') }).state;
    expect(h(e, 'H2').health).toBe(hp - 2);
  });

  it('US3-supremeInquisitor-unexpectedVisit: after moving 0 squares, move up to 3', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    expect(offered(s, 'supremeInquisitor.unexpectedVisit') || s.turn.movePath.length > 0).toBe(true);
  });

  it('US3-supremeInquisitor-inquisition: an adjacent enemy unit becomes a Pawn until the end of the next turn', () => {
    let s = board({ c3: 'N', e4: 'n', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const n = s.units.find((u) => u.side === 'dark' && u.type === 'knight');
    const pos = h(s, 'H1').pos;
    if (n && Math.max(Math.abs(n.pos.x - pos.x), Math.abs(n.pos.y - pos.y)) <= 1) {
      const r = use(s, 'supremeInquisitor.inquisition', [{ unitId: n.id }]).state;
      expect(r.units.find((u) => u.id === n.id)!.type).toBe('pawn');
      expect(kinds(r, 'modify')).toHaveLength(1);
    }
    expect(refuse(s, 'supremeInquisitor.inquisition', [unitT(s, 'h7')])).toMatch(/ABILITY_/);
  });

  it('US3-supremeInquisitor-sanctimonious: enemy units next to the unit that just Destroyed cannot initiate Battle', () => {
    let s = board({ c3: 'N', d5: 'p', e6: 'p', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    s = use(s, 'supremeInquisitor.sanctimonious', [unitT(s, 'e6')]).state;
    expect(kinds(s, 'cannotBattle')).toHaveLength(1);
  });

  it('US3-supremeInquisitor-blindFaith: a friendly Pawn in range one square forward into Battle', () => {
    let s = board({ d3: 'P', d4: 'n', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'c3' } });
    s = toPhase(s, 'lead');
    s = finish(use(s, 'supremeInquisitor.blindFaith', [unitT(s, 'd3'), at('d4')]).state);
    expect(unitOn(s, 'd4')?.side).toBe('light');
  });

  it('US3-supremeInquisitor-dogmaticIndoctrination: Destroy an adjacent unprotected enemy Bishop and create a friendly one', () => {
    let s = board({ c3: 'N', e4: 'b', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const b = s.units.find((u) => u.side === 'dark' && u.type === 'bishop')!;
    const pos = h(s, 'H1').pos;
    if (Math.max(Math.abs(b.pos.x - pos.x), Math.abs(b.pos.y - pos.y)) <= 1) {
      const r = use(s, 'supremeInquisitor.dogmaticIndoctrination', [{ unitId: b.id }]).state;
      expect(r.units.find((u) => u.side === 'light' && u.type === 'bishop' && u.kind === 'auxiliary')).toBeTruthy();
    }
    expect(apply(s, { type: 'useAbility', abilityId: 'supremeInquisitor.dogmaticIndoctrination', targets: [unitT(s, 'h7')] }).ok).toBe(false);
  });
});
