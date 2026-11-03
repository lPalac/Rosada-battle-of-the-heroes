// Save files (FR-200, FR-201) and fixture export (FR-204).
import { describe, expect, it } from 'vitest';
import { toFixture } from '../../src/game/fixture.ts';
import { parseSaveFile, toSaveFile } from '../../src/game/save.ts';
import { replay } from '../../src/game/session.ts';
import { createSetup, type Action } from '../../src/rules/index.ts';
import { position, sq } from '../fixtures/position.ts';
import { act } from '../helpers/game.ts';

const setupActions: Action[] = [
  { type: 'pickHero', side: 'light', rangeType: 'short' }, { type: 'pickHero', side: 'dark', rangeType: 'long' },
  { type: 'pickHero', side: 'dark', rangeType: 'short' }, { type: 'pickHero', side: 'light', rangeType: 'long' },
  { type: 'setTurnOrder', side: 'light', first: 0 }, { type: 'setTurnOrder', side: 'dark', first: 1 },
  { type: 'setStartFile', pickIndex: 0, file: 'c' }, { type: 'setStartFile', pickIndex: 1, file: 'c' },
  { type: 'startGame' }, { type: 'moveStep', to: sq('d1') }, { type: 'endPhase' },
];

describe('save files', () => {
  it('round-trips the starting state and action log, and replays to the same game', () => {
    const initial = createSetup({ mode: 'draft', playerCount: 4 });
    const text = JSON.stringify(toSaveFile(initial, setupActions));
    const save = parseSaveFile(text);
    expect(save.actions).toEqual(setupActions);
    const s = replay(save.initial, save.actions);
    expect(s.status).toBe('playing');
    expect(s.heroes[0].pos).toEqual(sq('d1'));
  });

  it('rejects files that are not save files or do not replay', () => {
    expect(() => parseSaveFile('{"hello":1}')).toThrow(/Not a Rošada save file/);
    const initial = createSetup({ mode: 'draft', playerCount: 4 });
    const bad = JSON.stringify(toSaveFile(initial, [{ type: 'startGame' }]));
    expect(() => parseSaveFile(bad)).toThrow(/Replay failed/);
  });
});

describe('fixture export (FR-204)', () => {
  it('exports a position that the test fixture loader rebuilds', () => {
    const original = act(position(`
      ..........
      .....k....
      ..........
      ..........
      ....2.....
      ...P......
      ..........
      .....3....
      .....K..R.
      ..1.....4.`, { peaceTreaty: 'war', health: { H2: 6 } }), { type: 'moveStep', to: sq('c1') }).state;
    const code = toFixture(original);
    const [, diagram, json] = /position\(`\n([\s\S]*?)`, ([\s\S]*)\);/.exec(code)!;
    const rebuilt = position(diagram, JSON.parse(json));
    expect(rebuilt.units.map((u) => [u.type, u.side, u.pos])).toEqual(
      expect.arrayContaining(original.units.map((u) => [u.type, u.side, u.pos])),
    );
    expect(rebuilt.heroes.map((h) => [h.id, h.pos, h.health])).toEqual(original.heroes.map((h) => [h.id, h.pos, h.health]));
    expect(rebuilt.tokens.peaceTreaty).toBe('war');
  });
});
