// Named heroes in setup and Epic forms from destiny (004 US1, FR-003, US3-AS1).
import { describe, expect, it } from 'vitest';
import { act, reject } from '../helpers/game.ts';
import {
  createGame, createSetup, heroAbilityIds, legalActions, selectableHeroes, type GameState,
} from '../../src/rules/index.ts';
import { DATA } from '../../src/rules/data.ts';
import { hudModel } from '../../src/game/hud-model.ts';

function draft(ids: string[]): GameState {
  let s = createSetup({ mode: 'draft', playerCount: 4 });
  const order = ['light', 'dark', 'dark', 'light'] as const;
  ids.forEach((id, i) => {
    s = act(s, { type: 'pickHero', side: order[i], heroDefinitionId: id }).state;
  });
  s = act(s, { type: 'setTurnOrder', side: 'light', first: 0 }).state;
  s = act(s, { type: 'setTurnOrder', side: 'dark', first: 1 }).state;
  s = act(s, { type: 'setStartFile', pickIndex: 0, file: 'c' }).state;
  s = act(s, { type: 'setStartFile', pickIndex: 1, file: 'c' }).state;
  return createGame(s.setup);
}

describe('US1 named heroes', () => {
  it('US1-AS1 the four heroes with their stats', () => {
    const g = draft(['cavalier', 'scout', 'magus', 'monk']);
    const by = (id: string) => g.heroes.find((h) => h.definitionId === id)!;
    expect([by('cavalier').maxHealth, by('cavalier').movement, by('cavalier').range]).toEqual([10, 5, 1]);
    expect([by('monk').maxHealth, by('monk').movement, by('monk').range]).toEqual([10, 5, 1]);
    expect([by('scout').maxHealth, by('scout').movement, by('scout').range]).toEqual([8, 3, 3]);
    expect([by('magus').maxHealth, by('magus').movement, by('magus').range]).toEqual([8, 3, 3]);
  });

  it('US1-AS2 the Hero Unit type comes from the hero', () => {
    const g = draft(['cavalier', 'scout', 'magus', 'monk']);
    expect(g.heroes.find((h) => h.definitionId === 'scout')!.heroUnitType).toBe('knight');
    expect(g.heroes.find((h) => h.definitionId === 'monk')!.heroUnitType).toBe('bishop');
  });

  it('US1-AS3 the HUD lists the hero name and abilities', () => {
    const g = draft(['cavalier', 'scout', 'magus', 'monk']);
    const cav = g.heroes.find((h) => h.definitionId === 'cavalier')!;
    expect(heroAbilityIds(cav)).toEqual(['cavalier.warhorse', 'cavalier.demoralise', 'cavalier.tightFormation']);
    const hud = hudModel(g).heroes;
    expect(hud.find((x) => x.id === cav.id)!.name).toBe('Cavalier');
    expect(hud.find((x) => x.id === cav.id)!.abilities.map((a) => [a.id, a.uses, a.timings[0]])).toEqual([
      ['cavalier.warhorse', null, 'afterLead'], ['cavalier.demoralise', 1, 'beforeMove'], ['cavalier.tightFormation', 1, 'insteadOfLead'],
    ]);
  });

  it('US1-AS4 generic heroes are not offered in setup but still load', () => {
    expect(selectableHeroes().map((h) => h.id)).toEqual(['cavalier', 'monk', 'scout', 'magus']);
    const picks = legalActions(createSetup({ mode: 'draft', playerCount: 4 })).filter((a) => a.type === 'pickHero');
    expect(picks.map((a) => (a as { heroDefinitionId: string }).heroDefinitionId).sort()).toEqual(['cavalier', 'magus', 'monk', 'scout']);
    expect(DATA.heroes.some((h) => h.id === 'generic-short')).toBe(true);
  });

  it('FR-003 Draft refuses a hero twice; Mirror gives both sides the same heroes', () => {
    let s = createSetup({ mode: 'draft', playerCount: 2 });
    s = act(s, { type: 'pickHero', side: 'light', heroDefinitionId: 'cavalier' }).state;
    expect(reject(s, { type: 'pickHero', side: 'dark', heroDefinitionId: 'cavalier' })).toBe('HERO_TAKEN');
    let m = createSetup({ mode: 'mirror', playerCount: 2 });
    m = act(m, { type: 'pickHero', side: 'light', heroDefinitionId: 'monk' }).state;
    expect(m.setup.picks.map((p) => p.heroDefinitionId)).toEqual(['monk', 'monk']);
  });

  it('US3-AS1 the destiny sets the Epic form (Cavalier + Fanatic → Death Knight)', () => {
    let g = draft(['cavalier', 'scout', 'magus', 'monk']);
    g = { ...g, epicPending: true, destiny: { ...g.destiny, well: { ...g.destiny.well, initialRemaining: 0, depleted: true, depletedBy: 'H4' } } };
    // Pass to the next Before Turn: answer each destiny with Fanatic or the first allowed.
    let s = g;
    for (let i = 0; i < 40 && s.stage !== 'epic'; i++) {
      const legal = legalActions(s);
      const pick = legal.find((a) => a.type === 'decide' && a.decision.type === 'destiny' && a.decision.destiny === 'fanatic') ?? legal.find((a) => a.type === 'decide')
        ?? legal.find((a) => a.type === 'announceLead') ?? legal.find((a) => a.type === 'submitRoll') ?? legal.find((a) => a.type === 'endPhase');
      s = act(s, pick!).state;
    }
    const cav = s.heroes.find((h) => h.definitionId === 'cavalier')!;
    expect(cav.form).toBe(DATA.heroes.find((h) => h.id === 'cavalier')!.forms![cav.epic!.destiny].id);
    expect(heroAbilityIds(cav)[0].split('.')[0]).toBe(cav.form);
  });
});
