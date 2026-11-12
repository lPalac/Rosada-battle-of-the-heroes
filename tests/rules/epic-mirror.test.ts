// 006 US3 (FR-012, FR-013, research R-17, Q-75, Q-79): Mirror games. The two heroes of a side differ; the Epic Stage
// asks two choices, each for both heroes of one class. The generic test heroes keep the 003 behaviour.
import { describe, expect, it } from 'vitest';
import { act, reject } from '../helpers/game.ts';
import { chooseDestiny, toEpicChoice } from '../helpers/epic.ts';
import { createGame, createSetup, legalActions, pickableHeroes, type GameState } from '../../src/rules/index.ts';

const epicDecisions = (s: GameState) => [s.pendingDecision, ...s.decisionQueue].filter((d) => d?.type === 'epicDestiny');
const hero = (s: GameState, id: string) => s.heroes.find((h) => h.id === id)!;

describe('US3 – Mirror picks (FR-013)', () => {
  it('US3-AS8 Dark may not pick the hero Light picked; a different hero goes to both sides', () => {
    let s = createSetup({ mode: 'mirror', playerCount: 2 });
    s = act(s, { type: 'pickHero', side: 'light', heroDefinitionId: 'monk' }).state;
    expect(reject(s, { type: 'pickHero', side: 'dark', heroDefinitionId: 'monk' })).toBe('HERO_TAKEN');
    expect(pickableHeroes(s.setup).map((h) => h.id)).not.toContain('monk');
    expect(legalActions(s).filter((a) => a.type === 'pickHero').map((a) => (a as { heroDefinitionId: string }).heroDefinitionId).sort())
      .toEqual(['cavalier', 'magus', 'scout']);
    s = act(s, { type: 'pickHero', side: 'dark', heroDefinitionId: 'scout' }).state;
    const bySide = (side: string) => s.setup.picks.filter((p) => p.side === side).map((p) => p.heroDefinitionId).sort();
    expect([bySide('light'), bySide('dark')]).toEqual([['monk', 'scout'], ['monk', 'scout']]);
  });

  it('guarantee 28: Draft is unchanged, and picks of the generic test heroes are unchanged', () => {
    let d = createSetup({ mode: 'draft', playerCount: 2 });
    d = act(d, { type: 'pickHero', side: 'light', heroDefinitionId: 'monk' }).state;
    expect(reject(d, { type: 'pickHero', side: 'dark', heroDefinitionId: 'monk' })).toBe('HERO_TAKEN');
    let g = createSetup({ mode: 'mirror', playerCount: 2 });
    g = act(g, { type: 'pickHero', side: 'light', rangeType: 'short' }).state;
    g = act(g, { type: 'pickHero', side: 'dark', rangeType: 'short' }).state;
    expect(g.setup.picks).toHaveLength(4);
  });
});

describe('US3 – Mirror Epic destinies (FR-012)', () => {
  it('US3-AS6 two choices: the first chooser decides for its class, both heroes of that class take the form', () => {
    let s = toEpicChoice(['cavalier', 'monk'], 'mirror');
    const first = s.pendingDecision!;
    expect(first.type).toBe('epicDestiny');
    const chooser = (first as { heroId: string }).heroId;
    const twin = s.heroes.find((h) => h.id !== chooser && h.definitionId === hero(s, chooser).definitionId)!;
    expect(first).toMatchObject({ appliesTo: [chooser, twin.id] });
    expect(twin.side).not.toBe(hero(s, chooser).side);
    expect(epicDecisions(s)).toHaveLength(2);
    const r = act(s, { type: 'decide', decision: { type: 'destiny', destiny: 'resolute' } });
    expect(r.events.filter((e) => e.type === 'destinyChosen').map((e) => (e as { heroId: string }).heroId).sort()).toEqual([chooser, twin.id].sort());
    s = r.state;
    expect(hero(s, twin.id).form).toBe(hero(s, chooser).form);
    expect(hero(s, twin.id).epic).toEqual({ destiny: 'resolute' });
    expect(hero(s, chooser).form).not.toBeNull();
  });

  it('US3-AS7 then a hero of the other side chooses for the other class; the Fanatic / Dominant limit applies', () => {
    let s = toEpicChoice(['cavalier', 'monk'], 'mirror');
    const firstChooser = hero(s, (s.pendingDecision as { heroId: string }).heroId);
    s = chooseDestiny(s, 'fanatic');
    const second = s.pendingDecision as { type: string; heroId: string; options: string[]; appliesTo: string[] };
    expect(second.type).toBe('epicDestiny');
    const chooser = hero(s, second.heroId);
    expect(chooser.side).not.toBe(firstChooser.side);
    expect(chooser.definitionId).not.toBe(firstChooser.definitionId);
    expect(second.appliesTo).toHaveLength(2);
    expect(second.options).not.toContain('dominant'); // its side already has a Fanatic hero
    s = chooseDestiny(s, 'resolute');
    expect(s.stage).toBe('epic');
  });

  it('guarantee 27: after the Epic Stage, heroes with the same definition have the same destiny and form', () => {
    let s = toEpicChoice(['scout', 'magus'], 'mirror');
    s = chooseDestiny(s, 'dominant');
    s = chooseDestiny(s, 'resolute');
    expect(s.stage).toBe('epic');
    for (const def of ['scout', 'magus']) {
      const pair = s.heroes.filter((h) => h.definitionId === def);
      expect(pair).toHaveLength(2);
      expect(pair[0].epic).toEqual(pair[1].epic);
      expect(pair[0].form).toBe(pair[1].form);
    }
  });

  it('Draft with the named heroes still asks four choices, one per hero', () => {
    const s = toEpicChoice();
    expect(epicDecisions(s)).toHaveLength(4);
    expect(epicDecisions(s).every((d) => (d as { appliesTo: string[] }).appliesTo.length === 1)).toBe(true);
  });

  it('a Mirror game with the generic test heroes keeps the 003 behaviour: four choices', () => {
    let m = createSetup({ mode: 'mirror', playerCount: 4 });
    m = act(m, { type: 'pickHero', side: 'light', rangeType: 'short' }).state;
    m = act(m, { type: 'pickHero', side: 'dark', rangeType: 'long' }).state;
    for (const a of [
      { type: 'setTurnOrder', side: 'light', first: 0 }, { type: 'setTurnOrder', side: 'dark', first: 1 },
      { type: 'setStartFile', pickIndex: 0, file: 'c' }, { type: 'setStartFile', pickIndex: 1, file: 'c' },
    ] as const) m = act(m, a).state;
    let g = createGame(m.setup);
    g = { ...g, epicPending: true, destiny: { ...g.destiny, well: { ...g.destiny.well, initialRemaining: 0, depleted: true, depletedBy: 'H1' } } };
    for (let i = 0; i < 40 && g.pendingDecision?.type !== 'epicDestiny'; i++) {
      const legal = legalActions(g);
      g = act(g, (legal.find((a) => a.type === 'announceLead') ?? legal.find((a) => a.type === 'decide') ?? legal.find((a) => a.type === 'endPhase'))!).state;
    }
    expect(epicDecisions(g)).toHaveLength(4);
  });
});
