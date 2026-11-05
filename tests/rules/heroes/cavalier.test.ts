// Cavalier, Death Knight, Dragon Lord, Holy Paladin (004 US2-AS1…AS3, US3 Cavalier forms).
import { describe, expect, it } from 'vitest';
import { act } from '../../helpers/game.ts';
import { board, sq, toPhase, unitOn } from '../../fixtures/position.ts';
import { abilityOffers, apply, type GameState } from '../../../src/rules/index.ts';
import { at, finish, lead, offered, refuse, settle, uid, unitT, use } from './helpers.ts';

const h = (s: GameState, id: string) => s.heroes.find((x) => x.id === id)!;
const effects = (s: GameState, kind: string) => s.effects.filter((e) => e.kind === kind);

const CAV = { heroDefs: { H1: 'cavalier' } } as const;
const epic = (form: 'fanatic' | 'resolute' | 'dominant', extra: object = {}) => ({
  heroDefs: { H1: 'cavalier' }, stage: 'epic' as const, epic: { H1: form }, pools: { H1: 30 }, ...extra,
});

describe('Cavalier (US2)', () => {
  it('US2-AS1 Warhorse: after the Lead, move one square, once per turn', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'e4');
    expect(s.phase).toBe('afterLead');
    const offer = abilityOffers(s).find((o) => o.abilityId === 'cavalier.warhorse')!;
    expect(offer.cost).toBe(0);
    const before = { ...h(s, 'H1').pos };
    const target = offer.targets[0];
    s = use(s, 'cavalier.warhorse', target).state;
    expect(h(s, 'H1').pos).not.toEqual(before);
    expect(refuse(s, 'cavalier.warhorse', target)).toBe('ABILITY_USED_THIS_TURN');
  });

  it('US2-AS2 Demoralise: marks the Cavalier; an enemy Lead passing next to it and leaving its range fails without a roll', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...CAV, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    s = use(s, 'cavalier.demoralise').state;
    expect(effects(s, 'demoralise')).toHaveLength(1);
    expect(s.abilityState.H1!.uses['cavalier.demoralise']).toBe(0);
    expect(refuse(s, 'cavalier.demoralise')).toBe('ABILITY_NO_USES');
    // The enemy's turn: a Bishop from f6 to b2 passes e5 (next to d4) and ends out of range → fails.
    let e = board({ f6: 'b', g2: 'P' }, {
      ...CAV, heroes: { H1: 'd4', H2: 'f7' }, active: 'H2',
      effects: [{ kind: 'demoralise', source: { abilityId: 'cavalier.demoralise', heroId: 'H1' }, target: { heroId: 'H1' }, expires: { at: 'turnStart', heroId: 'H1' }, data: {} }],
    });
    e = toPhase(e, 'lead');
    const r = act(e, { type: 'announceLead', unitId: uid(e, 'f6'), to: sq('b2') });
    expect(r.events.some((x) => x.type === 'leadFailed')).toBe(true);
    expect(r.events.some((x) => x.type === 'rollRequested')).toBe(false);
    expect(effects(r.state, 'demoralise')).toHaveLength(0);
    // Royalty is not affected.
    let q = board({ f6: 'q', g2: 'P' }, {
      ...CAV, heroes: { H1: 'd4', H2: 'f7' }, active: 'H2',
      effects: [{ kind: 'demoralise', source: { abilityId: 'cavalier.demoralise', heroId: 'H1' }, target: { heroId: 'H1' }, expires: { at: 'turnStart', heroId: 'H1' }, data: {} }],
    });
    q = toPhase(q, 'lead');
    const rq = act(q, { type: 'announceLead', unitId: uid(q, 'f6'), to: sq('b2') });
    expect(rq.events.some((x) => x.type === 'leadFailed')).toBe(false);
  });

  it('US2-AS3 Tight Formation: Lead a Knight without Battle instead of the Lead; protected in Battle next turn', () => {
    let s = board({ c3: 'N', d5: 'p' }, { ...CAV, heroes: { H1: 'd3' } });
    s = toPhase(s, 'lead');
    expect(refuse(s, 'cavalier.tightFormation', [unitT(s, 'c3'), at('d5')])).toBe('ABILITY_BAD_TARGET');
    const r = use(s, 'cavalier.tightFormation', [unitT(s, 'c3'), at('b5')]);
    expect(r.state.turn.leadAttempted).toBe(true);
    s = finish(r.state);
    expect(unitOn(s, 'b5')?.type).toBe('knight');
    expect(effects(s, 'protectedInBattle')).toHaveLength(1);
  });
});

describe('Death Knight (US3)', () => {
  it('US3-deathKnight-auraOfFear: enemy Leads next to the Death Knight get −2, −3 when Bloodied; not royalty', () => {
    const mk = (health?: number) => {
      let s = board({ f6: 'b', g2: 'P' }, { ...epic('fanatic'), heroes: { H1: 'd4', H2: 'f7' }, active: 'H2', ...(health ? { health: { H1: health } } : {}) });
      s = toPhase(s, 'lead');
      return act(s, { type: 'announceLead', unitId: uid(s, 'f6'), to: sq('b2') }).state.turn.lead!.modifiers;
    };
    expect(mk().find((m) => m.source === 'deathKnight.auraOfFear')?.value).toBe(-2);
    expect(mk(5).find((m) => m.source === 'deathKnight.auraOfFear')?.value).toBe(-3);
  });

  it('US3-deathKnight-seekRevenge: an adjacent friendly unit Destroyed gives +2 to the next Lead', () => {
    let s = board({ d3: 'P', e4: 'p', c2: 'N' }, { ...epic('fanatic'), heroes: { H1: 'd2', H2: 'f5' }, active: 'H2' });
    s = lead(s, 'e4', 'd3');
    expect(s.effects.some((e) => e.kind === 'nextLeadBonus' && e.source.abilityId === 'deathKnight.seekRevenge')).toBe(true);
  });

  it('US3-deathKnight-paleSteed: move one square, not as a Hero Unit', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'e4');
    expect(offered(s, 'deathKnight.paleSteed')).toBe(true);
    const hu = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4' }, heroUnits: { H1: ['knight'] }, royalFavors: { light: ['bloodyTheCastleGates', 'overwhelm', 'greatIncursion', 'tacticalGenius', 'deployTroops', 'royalsFury'] } });
    expect(refuse(hu, 'deathKnight.paleSteed', [at('d5')])).toMatch(/ABILITY_(NOT_AS_HERO_UNIT|WRONG_TIMING)/);
  });

  it('US3-deathKnight-imNotDoneWithYou: after Destroying an enemy Pawn in Battle, an undead auxiliary Pawn is created there', () => {
    let s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    const r = use(s, 'deathKnight.imNotDoneWithYou', [at('d5')]);
    const made = r.state.units.find((u) => u.tags?.includes('undead'));
    expect(made?.type).toBe('pawn');
    expect(made?.pos).toEqual(sq('d5'));
    // Refused without a Destroyed enemy Pawn.
    let n = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    n = lead(n, 'c3', 'b5');
    expect(refuse(n, 'deathKnight.imNotDoneWithYou', [at('b5')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-deathKnight-dutyBeyondTheGrave: an undead Knight on an unoccupied Knight starting square', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const r = use(s, 'deathKnight.dutyBeyondTheGrave', [at('b1')]);
    expect(unitOn(r.state, 'b1')?.tags).toEqual(['undead']);
    expect(h(r.state, 'H1').pool).toBe(30 - 6);
    expect(refuse(s, 'deathKnight.dutyBeyondTheGrave', [at('c1')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-deathKnight-legendaryAncient: 5 health, cannot Battle on its first turn, 1 wound per Lead', () => {
    let s = board({ c3: 'N', h7: 'p', e5: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4' }, phase: 'beginningOfTurn' });
    s = use(s, 'deathKnight.legendaryAncient').state;
    const la = s.units.find((u) => u.tags?.includes('legendaryAncient'))!;
    expect(la.health).toBe(5);
    s = toPhase(s, 'lead');
    expect(apply(s, { type: 'announceLead', unitId: la.id, to: sq('e5') }).ok).toBe(false);
    s = lead(s, 'd4', 'd5');
    expect(s.units.find((u) => u.id === la.id)!.health).toBe(4);
    const occupied = board({ d4: 'N', h7: 'p' }, { ...epic('fanatic'), heroes: { H1: 'd4' } });
    expect(refuse(occupied, 'deathKnight.legendaryAncient')).toMatch(/ABILITY_(BAD_TARGET|WRONG_TIMING)/);
  });
});

describe('Dragon Lord (US3)', () => {
  it('US3-dragonLord-wingedStride: Movement 6', () => {
    const s = board({ c3: 'N', h7: 'p' }, epic('resolute'));
    expect(h(s, 'H1').movement).toBe(6);
    expect(s.turn.movementLeft).toBe(6);
  });

  it('US3-dragonLord-dragonMount: move one square after the Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    expect(offered(s, 'dragonLord.dragonMount')).toBe(true);
  });

  it('US3-dragonLord-breathOfFieryDestruction: square option wounds enemy heroes on the Move path; Knight option along its path', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'c0', H2: 'c1' } });
    s = act(s, { type: 'moveStep', to: sq('c1') }).state;
    const hp = h(s, 'H2').health;
    s = use(s, 'dragonLord.breathOfFieryDestruction', [at('c1')], 'square').state;
    expect(h(s, 'H2').health).toBe(hp - 2);
    expect(refuse(s, 'dragonLord.breathOfFieryDestruction', [at('c1')], 'square')).toBe('ABILITY_USED_THIS_TURN');
    let k = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3', H2: 'd5' }, auxiliary: ['d5'] });
    k = toPhase(k, 'lead');
    k = use(k, 'dragonLord.breathOfFieryDestruction', [], 'knight').state;
    const before = h(k, 'H2').health;
    k = lead(k, 'c3', 'd5');
    expect(h(k, 'H2').health).toBeLessThan(before - 2);
  });

  it('US3-dragonLord-draconicDescent: a Knight Led 2×2; no Battle with royalty', () => {
    let s = board({ c3: 'N', e5: 'q', e2: 'P', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = toPhase(s, 'lead');
    expect(refuse(s, 'dragonLord.draconicDescent', [unitT(s, 'c3'), at('e5')])).toBe('ABILITY_BAD_TARGET');
    s = use(s, 'dragonLord.draconicDescent', [unitT(s, 'c3'), at('a5')]).state;
    s = finish(s);
    expect(unitOn(s, 'a5')?.type).toBe('knight');
  });

  it('US3-dragonLord-terrifyingRoar: hero placed on the enemy unit\'s square, the unit pushed back', () => {
    let s = board({ c3: 'N', e6: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'd5');
    const r = use(s, 'dragonLord.terrifyingRoar', [unitT(s, 'e6')]);
    expect(h(r.state, 'H1').pos).toEqual(sq('e6'));
    expect(unitOn(r.state, 'e7')?.type).toBe('pawn');
    expect(refuse(s, 'dragonLord.terrifyingRoar', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-dragonLord-greatWyrmOffering: Destroy an adjacent enemy Pawn, create a friendly Knight there', () => {
    let s = board({ c3: 'N', e4: 'p', h7: 'p' }, { ...epic('resolute'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const adj = s.units.find((u) => u.side === 'dark' && u.type === 'pawn' && Math.max(Math.abs(u.pos.x - h(s, 'H1').pos.x), Math.abs(u.pos.y - h(s, 'H1').pos.y)) <= 1);
    if (adj) {
      const r = use(s, 'dragonLord.greatWyrmOffering', [{ unitId: adj.id }]);
      expect(r.state.units.find((u) => u.side === 'light' && u.type === 'knight' && u.kind === 'auxiliary')).toBeTruthy();
    }
    expect(refuse(s, 'dragonLord.greatWyrmOffering', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });
});

describe('Holy Paladin (US3)', () => {
  it('US3-holyPaladin-auraOfRadiance: +1 to friendly Leads of units next to the Paladin', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = toPhase(s, 'lead');
    const r = act(s, { type: 'announceLead', unitId: uid(s, 'c3'), to: sq('b5') });
    expect(r.state.turn.lead!.modifiers.find((m) => m.source === 'holyPaladin.auraOfRadiance')?.value).toBe(1);
  });

  it('US3-holyPaladin-magnificentStallion: move one square after the Lead', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    expect(offered(s, 'holyPaladin.magnificentStallion')).toBe(true);
  });

  it('US3-holyPaladin-divineProtector: wounds go to the Paladin; the hero is not pushed by a Ram', () => {
    let s = board({ c3: 'N', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3', H3: 'e6' }, phase: 'beforeMove' });
    expect(refuse(s, 'holyPaladin.divineProtector', [{ heroId: 'H1' }])).toBe('ABILITY_BAD_TARGET');
    s = use(s, 'holyPaladin.divineProtector', [{ heroId: 'H3' }]).state;
    // Dark rook Rams H3 on e6: H3 stays, the Paladin takes the wounds.
    let e = board({ e8: 'r', a8: 'k', h2: 'P' }, {
      ...epic('dominant'), heroes: { H1: 'd3', H3: 'e6', H2: 'e9' }, active: 'H2',
      effects: [{ kind: 'divineProtector', source: { abilityId: 'holyPaladin.divineProtector', heroId: 'H1' }, target: { heroId: 'H3' }, expires: { at: 'turnStart', heroId: 'H1' }, data: {} }],
    });
    const p1 = h(e, 'H1').health;
    const p3 = h(e, 'H3').health;
    e = lead(e, 'e8', 'e4');
    expect(h(e, 'H3').pos).toEqual(sq('e6'));
    expect(h(e, 'H3').health).toBe(p3);
    expect(h(e, 'H1').health).toBeLessThan(p1);
    expect(s.effects.some((x) => x.kind === 'divineProtector')).toBe(true);
  });

  it('US3-holyPaladin-paragonOfHonor: a protecting Knight may take the Queen\'s place in Battle (2 D)', () => {
    let e = board({ d4: 'Q', c2: 'N', d6: 'r', a8: 'k', h2: 'P' }, {
      ...epic('dominant'), heroes: { H1: 'c1', H2: 'd7' }, active: 'H2', pools: { H1: 10 },
      effects: [{ kind: 'paragon', source: { abilityId: 'holyPaladin.paragonOfHonor', heroId: 'H1' }, target: { unitId: 'L-Q@d4' }, expires: { at: 'turnStart', heroId: 'H1' }, data: { swapCost: 2 } }],
    });
    e = toPhase(e, 'lead');
    e = act(e, { type: 'announceLead', unitId: uid(e, 'd6'), to: sq('d4') }).state;
    if (e.turn.lead!.success === null && !e.pendingDecision) e = act(e, { type: 'submitRoll', value: 20 }).state;
    expect(e.pendingDecision?.type).toBe('reaction');
    e = act(e, { type: 'decide', decision: { type: 'reaction', use: true, targets: [{ unitId: 'L-N@c2' }] } }).state;
    e = settle(e);
    expect(e.units.find((u) => u.id === 'L-Q@d4')?.pos).toEqual(sq('c2'));
    expect(e.units.some((u) => u.id === 'L-N@c2')).toBe(false);
    expect(h(e, 'H1').pool).toBe(8);
  });

  it('US3-holyPaladin-crusade: Lead a Knight that cannot be Destroyed in Battle next turn', () => {
    let s = board({ c3: 'N', d5: 'p', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = toPhase(s, 'lead');
    s = use(s, 'holyPaladin.crusade', [unitT(s, 'c3'), at('d5')]).state;
    s = finish(s);
    expect(unitOn(s, 'd5')?.side).toBe('light');
    expect(effects(s, 'protectedInBattle')).toHaveLength(1);
    expect(refuse(toPhase(board({ c3: 'N', g6: 'P', h8: 'p' }, { ...epic('dominant'), heroes: { H1: 'f6' } }), 'lead'), 'holyPaladin.crusade', [{ unitId: 'L-N@c3' }, at('b5')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-holyPaladin-knightAPeasant: an adjacent friendly Pawn becomes a Knight (Modify)', () => {
    let s = board({ c3: 'N', d2: 'P', h7: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3' } });
    s = lead(s, 'c3', 'b5');
    const pawn = s.units.find((u) => u.side === 'light' && u.type === 'pawn' && Math.abs(u.pos.x - h(s, 'H1').pos.x) <= 1 && Math.abs(u.pos.y - h(s, 'H1').pos.y) <= 1);
    if (pawn) {
      const r = use(s, 'holyPaladin.knightAPeasant', [{ unitId: pawn.id }]);
      const u = r.state.units.find((x) => x.id === pawn.id)!;
      expect(u.type).toBe('knight');
      expect(u.modifiedFrom).toBe('pawn');
    }
    expect(refuse(s, 'holyPaladin.knightAPeasant', [unitT(s, 'h7')])).toBe('ABILITY_BAD_TARGET');
  });

  it('US3-holyPaladin-holyWrath: 4 wounds to an adjacent enemy hero and Destroy a unit next to both', () => {
    let s = board({ c3: 'N', h7: 'p', e4: 'p' }, { ...epic('dominant'), heroes: { H1: 'd3', H2: 'e3' }, pools: { H1: 30 } });
    s = lead(s, 'c3', 'b5');
    const offer = abilityOffers(s).find((o) => o.abilityId === 'holyPaladin.holyWrath');
    if (offer) {
      const t = offer.targets.find((x) => x.length === 2) ?? offer.targets[0];
      const before = h(s, 'H2').health;
      const r = use(s, 'holyPaladin.holyWrath', t);
      expect(h(r.state, 'H2').health).toBe(before - 4);
    }
    expect(refuse(s, 'holyPaladin.holyWrath', [{ heroId: 'H3' }])).toBe('ABILITY_BAD_TARGET');
  });
});
