import { describe, expect, it } from 'vitest';
import { createSetup, legalActions, squareName, type GameState } from '../../src/rules/index.ts';
import { act, reject, run } from '../helpers/game.ts';

function draft(playerCount: 2 | 3 | 4): GameState {
  return run(createSetup({ mode: 'draft', playerCount }), [
    { type: 'pickHero', side: 'light', rangeType: 'short' },
    { type: 'pickHero', side: 'dark', rangeType: 'long' },
    { type: 'pickHero', side: 'dark', rangeType: 'short' },
    { type: 'pickHero', side: 'light', rangeType: 'long' },
  ]).state;
}

function finish(s: GameState): GameState {
  return run(s, [
    { type: 'setTurnOrder', side: 'light', first: 3 },
    { type: 'setTurnOrder', side: 'dark', first: 1 },
    { type: 'setStartFile', pickIndex: 3, file: 'c' },
    { type: 'setStartFile', pickIndex: 2, file: 'f' },
    { type: 'startGame' },
  ]).state;
}

describe('US1 – Set up and start a game', () => {
  it('US1-AS1 with 2 players each player controls both heroes of one side', () => {
    const s = finish(draft(2));
    const owner = (side: string) => new Set(s.heroes.filter((h) => h.side === side).map((h) => h.playerId));
    expect(owner('light')).toEqual(new Set(['P1']));
    expect(owner('dark')).toEqual(new Set(['P2']));
  });

  it('US1-AS2 with 3 players the single player of a side controls both its heroes; the other side one each', () => {
    const s = finish(draft(3));
    const light = s.heroes.filter((h) => h.side === 'light').map((h) => h.playerId);
    const dark = s.heroes.filter((h) => h.side === 'dark').map((h) => h.playerId);
    expect(new Set(light).size).toBe(1);
    expect(new Set(dark).size).toBe(2);
  });

  it('US1-AS3 Light chooses its turn order first, then Dark; the chosen order is used', () => {
    const s = draft(4);
    expect(reject(s, { type: 'setTurnOrder', side: 'dark', first: 1 })).toBe('LIGHT_FIRST');
    expect(reject(s, { type: 'setTurnOrder', side: 'light', first: 1 })).toBe('NOT_YOUR_HERO');
    const started = finish(s);
    // Light chose its 2nd pick (long, pickIndex 3) to play first; Dark its 1st pick (long, pickIndex 1).
    expect(started.heroes.map((h) => [h.id, h.side, h.rangeType])).toEqual([
      ['H1', 'light', 'long'], ['H2', 'dark', 'long'], ['H3', 'light', 'short'], ['H4', 'dark', 'short'],
    ]);
    expect(started.activeHeroId).toBe('H1');
  });

  it('US1-AS4 the starting state: Well 16, hero pools 3, Common 0, Peace, heroes on the chosen Bishop squares', () => {
    const s = draft(4);
    expect(reject(s, { type: 'startGame' })).toBe('SETUP_INCOMPLETE');
    const g = finish(s);
    expect(g.destiny.well).toEqual({ initialRemaining: 16, depleted: false });
    expect(g.destiny.common).toEqual({ light: 0, dark: 0 });
    expect(g.heroes.every((h) => h.pool === 3)).toBe(true);
    expect(g.tokens).toEqual({ peaceTreaty: 'peace', revenge: { light: 0, dark: 0 } });
    expect(g.units).toHaveLength(32);
    const at = Object.fromEntries(g.heroes.map((h) => [h.id, squareName(h.pos)]));
    // Light pick 3 (H1) on the c-file, pick 0 (H3) on f; Dark pick 2 (H4) on f, pick 1 (H2) on c.
    expect(at).toEqual({ H1: 'c0', H2: 'c9', H3: 'f0', H4: 'f9' });
    expect(g.heroes.map((h) => h.health)).toEqual([8, 8, 10, 10]);
  });

  it('US1-AS4 one hero per Bishop square: choosing a file moves the side’s other hero to the other file', () => {
    const s = act(draft(4), { type: 'setStartFile', pickIndex: 0, file: 'c' }).state;
    expect(s.setup.startFiles).toMatchObject({ '0': 'c', '3': 'f' });
    const t = act(s, { type: 'setStartFile', pickIndex: 3, file: 'c' }).state;
    expect(t.setup.startFiles).toMatchObject({ '0': 'f', '3': 'c' });
  });

  it('US1-AS5 Draft picks go Light, Dark, Dark, Light', () => {
    let s = createSetup({ mode: 'draft', playerCount: 4 });
    expect(reject(s, { type: 'pickHero', side: 'dark', rangeType: 'short' })).toBe('NOT_YOUR_PICK');
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      const a = legalActions(s).find((x) => x.type === 'pickHero') as { side: string } | undefined;
      order.push(a!.side);
      s = act(s, { type: 'pickHero', side: a!.side as 'light' | 'dark', rangeType: 'short' }).state;
    }
    expect(order).toEqual(['light', 'dark', 'dark', 'light']);
    expect(reject(s, { type: 'pickHero', side: 'light', rangeType: 'short' })).toBe('PICKS_DONE');
  });

  it('US1-AS6 Mirror: Light picks hero 1 for both sides, Dark picks hero 2 for both sides', () => {
    let s = createSetup({ mode: 'mirror', playerCount: 2 });
    expect(reject(s, { type: 'pickHero', side: 'dark', rangeType: 'long' })).toBe('NOT_YOUR_PICK');
    s = act(s, { type: 'pickHero', side: 'light', rangeType: 'long' }).state;
    expect(reject(s, { type: 'pickHero', side: 'light', rangeType: 'short' })).toBe('NOT_YOUR_PICK');
    s = act(s, { type: 'pickHero', side: 'dark', rangeType: 'short' }).state;
    const ranges = (side: string) => s.setup.picks.filter((p) => p.side === side).map((p) => p.rangeType).sort();
    expect(ranges('light')).toEqual(['long', 'short']);
    expect(ranges('dark')).toEqual(['long', 'short']);
  });
});
