// Hero sheet model (004 T055, US5): sheet keys, health bar, pool, uses, corrected-cost badges, canvas fallback.
import { describe, expect, it } from 'vitest';
import { board } from '../fixtures/position.ts';
import { sheetModel } from '../../src/game/sheet-model.ts';
import { use } from '../rules/heroes/helpers.ts';

describe('sheet model (US5)', () => {
  it('US5-AS1 the starting sheet, then the Epic form sheet', () => {
    expect(sheetModel(board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' } }), 'H1').sheetKey).toBe('sheet.cavalier');
    const epic = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' } });
    expect(sheetModel(epic, 'H1').sheetKey).toBe('sheet.dragonLord');
    expect(sheetModel(epic, 'H1').name).toBe('Dragon Lord');
  });

  it('US5-AS2 health and the health bar (16 or 20)', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier', H3: 'magus' }, health: { H1: 7 } });
    expect([sheetModel(s, 'H1').health, sheetModel(s, 'H1').bar]).toEqual([7, 20]);
    expect(sheetModel(s, 'H3').bar).toBe(16);
  });

  it('US5-AS3 the Hero Destiny Pool', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, pools: { H1: 6 } });
    expect(sheetModel(s, 'H1').pool).toBe(6);
  });

  it('US5-AS5 uses left per ability', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    s = use(s, 'magus.flamingBolt', [{ heroId: 'H2' }]).state;
    expect(sheetModel(s, 'H1').abilities.find((a) => a.id === 'magus.flamingBolt')!.usesLeft).toBe(1);
  });

  it('006 US1-AS7 (FR-002) cost and uses are shown together: "1 D · 1 of 1 left"', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'd4' }, phase: 'beforeMove' });
    const row = (st: typeof s, id: string) => sheetModel(st, 'H1').abilities.find((a) => a.id === id)!;
    expect(row(s, 'cavalier.demoralise').costText).toBe('1 D · 1 of 1 left');
    expect(row(s, 'cavalier.warhorse').costText).toBe('');
    s = use(s, 'cavalier.demoralise').state;
    expect(row(s, 'cavalier.demoralise').costText).toBe('1 D · 0 of 1 left');
    const epic = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' } });
    expect(sheetModel(epic, 'H1').abilities.find((a) => a.id === 'dragonLord.breathOfFieryDestruction')!.costText).toBe('3/4 D');
  });

  it('FR-001a a corrected-cost badge where the printed sheet differs from Hero Rules 2_0', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' } });
    const breath = sheetModel(s, 'H1').abilities.find((a) => a.id === 'dragonLord.breathOfFieryDestruction')!;
    expect(breath.cost).toEqual([3, 4]);
    expect(breath.printedCost).toEqual([3, 5]);
    expect(sheetModel(s, 'H1').abilities.find((a) => a.id === 'dragonLord.dragonMount')!.printedCost).toBeNull();
  });

  it('A-05 the Cultist uses the canvas-drawn sheet', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'monk' }, stage: 'epic', epic: { H1: 'fanatic' } });
    expect(sheetModel(s, 'H1').canvasSheet).toBe(true);
    expect(sheetModel(s, 'H1').portraitKey).toBe('portrait.cultist');
  });
});
