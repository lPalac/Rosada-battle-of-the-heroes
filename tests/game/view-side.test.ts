// 006 US7 (FR-040, B-13): the side the default camera looks from. Online it is the local seat's side on every turn;
// in hot-seat it follows the active hero.
import { describe, expect, it } from 'vitest';
import { board } from '../fixtures/position.ts';
import { viewSide } from '../../src/game/view-side.ts';

const seat = (side: 'light' | 'dark', heroSlots: number[]) => ({ side, heroSlots });

describe('viewSide (US7-AS1 model part)', () => {
  const s = board({}, { heroes: { H1: 'c0' } });
  const active = s.heroes.find((h) => h.id === s.activeHeroId)!;
  const other = active.side === 'light' ? 'dark' : 'light';
  const otherTurn = { ...s, activeHeroId: s.heroes.find((h) => h.side === other)!.id };

  it('US7-AS1 (model) online: the local seat\'s side, on its own turn and on the other side\'s turn', () => {
    for (const st of [s, otherTurn]) {
      expect(viewSide(st, seat('light', [0]))).toBe('light');
      expect(viewSide(st, seat('dark', [1]))).toBe('dark');
    }
  });

  it('US7-AS1 (model) a 3-player seat holding both heroes of a side sees that side', () => {
    for (const st of [s, otherTurn]) expect(viewSide(st, seat('dark', [0, 1]))).toBe('dark');
  });

  it('US7-AS1 (model) hot-seat follows the active hero', () => {
    expect(viewSide(s, null)).toBe(active.side);
    expect(viewSide(otherTurn, null)).toBe(other);
  });

  it('US7-AS1 (model) during setup with no active hero: Light', () => {
    expect(viewSide({ ...s, activeHeroId: null } as never, null)).toBe('light');
  });
});
