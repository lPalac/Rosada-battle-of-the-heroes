import { describe, expect, it } from 'vitest';
import { act, eventsOf, hero, passTurn } from '../helpers/game.ts';
import { board, name, sq } from '../fixtures/position.ts';

function knockOut(target: 'H2' | 'H4', health: number) {
  const s = board({ a1: 'R' }, { heroes: { H1: 'b0', [target]: 'a3' }, health: { [target]: health }, phase: 'lead' });
  return act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('a5') });
}

describe('US4 – health and Unconscious', () => {
  for (const [target, health, max, half] of [['H2', 3, 10, 5], ['H4', 2, 8, 4]] as const) {
    it(`US4-AS9 at 0 health a hero goes to a friendly tavern, skips the next turn, then recovers to half (${max} → ${half})`, () => {
      const r = knockOut(target, health);
      expect(hero(r.state, target).health).toBe(0);
      expect(eventsOf(r.events, 'heroUnconscious')).toHaveLength(1);
      expect(r.state.pendingDecision).toEqual({ type: 'unconsciousTavern', heroId: target, options: [sq('<9'), sq('>9')] });
      let s = act(r.state, { type: 'decide', decision: { type: 'square', to: sq('>9') } }).state;
      expect(name(hero(s, target).pos)).toBe('T->9');
      // Play on until the knocked-out hero's turn comes: it is skipped…
      const skipped: string[] = [];
      while (!skipped.includes(target)) {
        const t = passTurn(s);
        skipped.push(...eventsOf(t.events, 'turnSkipped').map((e) => e.heroId));
        s = t.state;
      }
      expect(hero(s, target).health).toBe(0);
      expect(hero(s, target).status.recoverAtBeginningOfTurn).toBe(true);
      // …and on its following turn Heroic Recovery heals it to half max at Beginning of Turn.
      while (s.activeHeroId !== target) s = passTurn(s).state;
      expect(hero(s, target).health).toBe(half);
      expect(hero(s, target).status.unconscious).toBe(false);
    });
  }

  it('healing never goes above max health', () => {
    const s = board({}, { heroes: { H1: '<0' }, health: { H1: 9 } });
    const r = act(s, { type: 'buy', item: 'meal' }).state;
    expect(hero(r, 'H1').health).toBe(10);
  });
});
