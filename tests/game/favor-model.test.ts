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
