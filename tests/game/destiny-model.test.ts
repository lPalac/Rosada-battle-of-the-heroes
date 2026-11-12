// 006 US3 (FR-010, FR-011, research R-01): the Epic destiny dialog's model: who chooses, the hero's own three forms
// by name and portrait, which cards are blocked, and the choices made so far.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/rules/index.ts';
import { chooseDestiny, toEpicChoice } from '../helpers/epic.ts';
import { destinyChoiceModel } from '../../src/game/destiny-model.ts';

const choose = (s: GameState, destiny: 'fanatic' | 'resolute' | 'dominant') => chooseDestiny(s, destiny);

describe('US3 – the Epic destiny choice model (B-01)', () => {
  it('US3-AS1 the dialog names the choosing hero, its side and player, and "choice n of 4"', () => {
    const s = toEpicChoice();
    const m = destinyChoiceModel(s)!;
    const h = s.heroes.find((x) => x.id === m.heroId)!;
    const names: Record<string, string> = { cavalier: 'Cavalier', monk: 'Monk', scout: 'Scout', magus: 'Magus' };
    expect(m.heroName).toBe(names[h.definitionId]);
    expect([m.side, m.playerId, m.named]).toEqual([h.side, h.playerId, true]);
    expect([m.step, m.of]).toEqual([1, 4]);
    expect(m.appliesTo).toEqual([{ heroId: h.id, side: h.side, heroName: names[h.definitionId] }]);
  });

  it('US3-AS2 the cards show the chooser\'s own three forms with their portraits', () => {
    const forms: Record<string, string[]> = {
      cavalier: ['Death Knight', 'Dragon Lord', 'Holy Paladin'], monk: ['Cultist', 'Saint', 'Supreme Inquisitor'],
      scout: ['Scoundrel', 'Spy Master', 'Royal Assassin'], magus: ['Necromancer', 'Grand Arcanist', 'Chronomonger'],
    };
    let s = toEpicChoice();
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const m = destinyChoiceModel(s)!;
      const def = s.heroes.find((x) => x.id === m.heroId)!.definitionId;
      expect(m.cards.map((c) => c.destiny)).toEqual(['fanatic', 'resolute', 'dominant']);
      expect(m.cards.map((c) => c.formName)).toEqual(forms[def]);
      for (const c of m.cards) {
        expect(c.portraitKey).toMatch(/^portrait\./);
        seen.add(c.portraitKey);
      }
      s = choose(s, m.cards.find((c) => c.allowed)!.destiny);
    }
    expect(seen.size).toBe(12);
  });

  it('US3-AS3 the next dialog shows another hero and the choices made so far', () => {
    let s = toEpicChoice();
    const first = destinyChoiceModel(s)!;
    s = choose(s, 'resolute');
    const second = destinyChoiceModel(s)!;
    expect(second.heroId).not.toBe(first.heroId);
    expect(second.step).toBe(2);
    expect(second.chosen).toEqual([{ heroId: first.heroId, heroName: first.heroName, formName: first.cards[1].formName, destiny: 'resolute' }]);
  });

  it('US3-AS4 with the side\'s other hero Fanatic, the Dominant card is blocked with its reason', () => {
    let s = toEpicChoice();
    const order: string[] = [];
    // Choose Fanatic for every hero until a hero whose ally is already Fanatic comes up.
    for (let i = 0; i < 4; i++) {
      const m = destinyChoiceModel(s)!;
      const dominant = m.cards.find((c) => c.destiny === 'dominant')!;
      if (!dominant.allowed) {
        expect(dominant.blockedBy).toBe('fanatic');
        return;
      }
      order.push(m.heroId);
      s = choose(s, 'fanatic');
    }
    throw new Error(`no blocked Dominant card in ${order.join(', ')}`);
  });

  it('no model when no destiny is being chosen', () => {
    const s = toEpicChoice();
    expect(destinyChoiceModel({ ...s, pendingDecision: null })).toBeNull();
  });
});
