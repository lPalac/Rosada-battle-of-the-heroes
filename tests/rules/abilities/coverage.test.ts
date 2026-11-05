// Every ability in abilities.json has an implementation, and every implementation has data (contracts/abilities-data.md
// rule 2, 004 T016).
import { describe, expect, it } from 'vitest';
import { DATA } from '../../../src/rules/data.ts';
import { REGISTRY } from '../../../src/rules/heroes/index.ts';

describe('ability coverage (004)', () => {
  const ids = DATA.abilities.map((a) => a.id);
  const reg = REGISTRY();

  it('every action and reaction has an effect; every passive has hooks', () => {
    const missing = DATA.abilities.filter((a) => (a.kind === 'passive' ? !reg.passives[a.id] && !reg.impls[a.id] : !reg.impls[a.id] && !reg.passives[a.id]));
    expect(missing.map((a) => a.id)).toEqual([]);
  });

  it('no implementation without data', () => {
    const unknown = [...Object.keys(reg.impls), ...Object.keys(reg.passives)].filter((id) => !ids.includes(id));
    expect(unknown).toEqual([]);
  });

  it('84 hero abilities: 12 starting and 72 in the Epic forms', () => {
    const named = DATA.heroes.filter((h) => h.selectable);
    expect(named.flatMap((h) => h.abilities)).toHaveLength(12);
    expect(named.flatMap((h) => Object.values(h.forms!).flatMap((f) => f.abilities))).toHaveLength(72);
  });
});
