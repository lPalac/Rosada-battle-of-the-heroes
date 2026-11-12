import { describe, expect, it } from 'vitest';
import { favorModel, TRACK_SLOTS } from '../../src/game/favor-model.ts';
import strings from '../../src/data/strings.en.json';
import { board } from '../fixtures/position.ts';

const PAWNS = { a2: 'P', b2: 'P', c2: 'P', d2: 'P', a7: 'p', b7: 'p', c7: 'p', d7: 'p' };

describe('US3-AS14 – tracker model', () => {
  const s = structuredClone(board({ ...PAWNS }, {
    royalFavors: { light: ['overwhelm', 'decimate', 'tidesOfDestiny', 'greatIncursion', 'tacticalGenius', 'royalsFury'], dark: ['deployTroops'] },
  }));
  s.royalFavors.dark.status.overwhelm.progress = 1;
  s.royalFavors.dark.status.royalsFury.progress = 2;
  const m = favorModel(s);

  it('US3-AS14 lists both sides with every Royal Favor in rulebook order and a requirement text', () => {
    for (const side of [m.light, m.dark]) {
      expect(side.favors).toHaveLength(12);
      expect(side.favors.map((f) => f.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      for (const f of side.favors) {
        expect(strings[f.nameKey as keyof typeof strings], f.nameKey).toBeTruthy();
        expect(strings[f.requirementKey as keyof typeof strings], f.requirementKey).toBeTruthy();
      }
    }
  });

  it('US3-AS14 statuses: done, half with progress, open', () => {
    const light = Object.fromEntries(m.light.favors.map((f) => [f.id, f]));
    const dark = Object.fromEntries(m.dark.favors.map((f) => [f.id, f]));
    expect(light.overwhelm).toMatchObject({ status: 'done', progress: 2, target: 2 });
    expect(light.tidesOfDestiny).toMatchObject({ status: 'half', progress: 1, target: 5 });
    expect(light.vanquishYourFoes).toMatchObject({ status: 'open', progress: 0 });
    expect(dark.overwhelm).toMatchObject({ status: 'half', progress: 1, target: 2 });
    expect(dark.royalsFury).toMatchObject({ status: 'half', progress: 2, target: 3 });
    expect(dark.deployTroops.status).toBe('done');
  });

  it('US3-AS14 the track in order, unlocked Powers and the next threshold', () => {
    expect(m.light.track).toEqual(['overwhelm', 'decimate', 'tidesOfDestiny', 'greatIncursion', 'tacticalGenius', 'royalsFury']);
    expect(m.light.slots).toBe(16);
    expect(TRACK_SLOTS).toBe(16);
    expect(m.light.powers.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['heroUnit']);
    expect(m.light.next).toEqual({ power: 'kingsForces', nameKey: 'power.kingsForces.name', needed: 1 });
    expect(m.dark.next).toEqual({ power: 'heroUnit', nameKey: 'power.heroUnit.name', needed: 5 });
  });
});

// 006 US7 (FR-041, B-14): one shared track with slots 1…11 and both sides' markers; the per-side lists and their
// 16-slot tracks stay for the Royal Favor menu.
describe('006 – the shared Royal Favor track', () => {
  const ORDER = ['bloodyTheCastleGates', 'overwhelm', 'greatIncursion', 'tacticalGenius', 'deployTroops', 'royalsFury',
    'decimate', 'offenseIsTheBestDefense', 'vanquishYourFoes', 'destinedForGreatness', 'manifestEpicDestiny'] as const;
  const shared = (light: number, dark: number) => favorModel(board({ ...PAWNS }, {
    royalFavors: { light: [...ORDER.slice(0, light)], dark: [...ORDER.slice(0, dark)] },
  })).shared;

  it('US7-AS4 Light 2 and Dark 1: the shared track has 11 slots and both counts', () => {
    expect(shared(2, 1)).toMatchObject({ slots: 11, light: 2, dark: 1 });
  });

  it('US7-AS4 two markers on one slot are both kept', () => {
    expect(shared(3, 3)).toMatchObject({ light: 3, dark: 3 });
  });

  it('US7-AS2 the Legendary Power names sit at 6…11', () => {
    const powers = shared(0, 0).powers;
    expect(powers.map((p) => p.threshold)).toEqual([6, 7, 8, 9, 10, 11]);
    for (const p of powers) expect(p.nameKey).toBe(`power.${p.id}.name`);
  });

  it('US7-AS4 a count above 11 is capped at 11', () => {
    const s = structuredClone(board({ ...PAWNS }, { royalFavors: { light: [...ORDER], dark: [] } }));
    s.royalFavors.light.track.push('tidesOfDestiny', 'tidesOfDestiny');
    expect(favorModel(s).shared.light).toBe(11);
  });

  it('US7-AS5 the per-side lists and 16-slot tracks stay for the menu', () => {
    const m = favorModel(board({ ...PAWNS }, { royalFavors: { light: ['overwhelm', 'decimate'], dark: ['deployTroops'] } }));
    expect(m.light.track).toHaveLength(2);
    expect(m.dark.track).toHaveLength(1);
    expect(m.light.slots).toBe(16);
  });
});
