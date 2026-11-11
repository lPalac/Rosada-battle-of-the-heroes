// 006 X-01, X-02 (FR-032): modifier sources, Destiny and heal reasons and marks are shown by name, never by key.
import { describe, expect, it } from 'vitest';
import { markLabel, modifierLabel, reasonLabel } from '../../src/game/labels.ts';

describe('labels (X-01, X-02)', () => {
  it('a modifier with its own string uses it', () => {
    expect(modifierLabel('war', 2)).toBe('War +2');
    expect(modifierLabel('inspiredLead', 4)).toBe('Inspired Lead +4');
  });

  it('an ability modifier shows the ability name with a signed value', () => {
    expect(modifierLabel('magus.futureSight', 2)).toBe('Future Sight +2');
    expect(modifierLabel('scout.bearTraps', -3)).toBe('Bear Traps −3');
  });

  it('an unknown modifier falls back to a plain text, never a key', () => {
    const label = modifierLabel('somethingNew', 1);
    expect(label).not.toContain('mod.');
    expect(label).not.toContain('somethingNew');
    expect(label).toContain('+1');
  });

  it('a reason with its own string uses it; an ability reason shows the ability name', () => {
    expect(reasonLabel('check')).toBe('check');
    expect(reasonLabel('destroyEnemy')).toBe('destroyed an enemy unit');
    expect(reasonLabel('monk.rejuvenatingStroll')).toBe('Rejuvenating Stroll');
    const other = reasonLabel('somethingNew');
    expect(other).not.toContain('reason.');
    expect(other).not.toContain('somethingNew');
  });

  it('a mark shows its effect name, else the ability name, else "Mark"', () => {
    expect(markLabel('bearTrap')).toBe('Bear Trap');
    expect(markLabel('monk.preaching')).toBe('Preaching');
    expect(markLabel('somethingNew')).toBe('Mark');
  });
});
