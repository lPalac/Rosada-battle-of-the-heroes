// Save files (FR-200, FR-201) and fixture export (FR-204).
import { describe, expect, it } from 'vitest';
import { toFixture } from '../../src/game/fixture.ts';
import { migrateState, parseSaveFile, toSaveFile } from '../../src/game/save.ts';
import { replay } from '../../src/game/session.ts';
import { createSetup, type Action } from '../../src/rules/index.ts';
import { position, sq } from '../fixtures/position.ts';
import { act, newGame } from '../helpers/game.ts';

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

describe('003 – older saves load (T008)', () => {
  it('a version 1 save (001/002 shape) gets the 003 defaults and replays', () => {
    const initial = createSetup({ mode: 'draft', playerCount: 4 }) as unknown as Record<string, unknown>;
    for (const k of ['stage', 'epicPending', 'royalFavors']) delete initial[k];
    delete (initial.destiny as { well: Record<string, unknown> }).well.depletedBy;
    const text = JSON.stringify({ ...toSaveFile(initial as never, setupActions), version: 1 });
    const save = parseSaveFile(text);
    expect(save.initial.stage).toBe('starting');
    expect(save.initial.royalFavors.light.track).toEqual([]);
    const s = replay(save.initial, save.actions);
    expect(s.heroes.every((h) => h.epic === null && h.heroUnitId === null)).toBe(true);
    expect(s.heroes.map((h) => h.heroUnitType)).toEqual(['knight', 'bishop', 'bishop', 'knight']);
  });

  it('006: a version 2 save gets the sandbox resume point, the Move start, the per-side check mark and appliesTo', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as Record<string, any>;
    delete old.sandboxResume;
    delete old.turn.moveStart;
    delete old.turn.checkDestinyClaimed;
    old.turn.checkBonusClaimed = true;
    old.pendingDecision = { type: 'epicDestiny', heroId: 'H2', options: ['fanatic'] };
    old.decisionQueue = [{ type: 'epicDestiny', heroId: 'H3', options: [] }];
    old.version = 2;
    const m = migrateState(old as never);
    expect(m.version).toBe(3);
    expect(m.sandboxResume).toBeNull();
    expect(m.turn.moveStart).toBeNull();
    expect(m.turn.checkDestinyClaimed).toEqual(['light']);
    expect('checkBonusClaimed' in m.turn).toBe(false);
    expect(m.pendingDecision).toMatchObject({ appliesTo: ['H2'] });
    expect(m.decisionQueue[0]).toMatchObject({ appliesTo: ['H3'] });
    const unclaimed = migrateState({ ...old, turn: { ...old.turn, checkBonusClaimed: false } } as never);
    expect(unclaimed.turn.checkDestinyClaimed).toEqual([]);
  });

  it('006: a version 2 save loads; one that no longer replays says it was made with older rules', () => {
    const initial = createSetup({ mode: 'draft', playerCount: 4 });
    expect(parseSaveFile(JSON.stringify({ ...toSaveFile(initial, setupActions), version: 2 })).version).toBe(3);
    const bad = JSON.stringify({ ...toSaveFile(initial, [{ type: 'startGame' }]), version: 2 });
    expect(() => parseSaveFile(bad)).toThrow('This save was made with older rules and cannot be continued');
  });

  it('004: a 003 save gets empty effects, ability uses and no Epic forms', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as Record<string, unknown> & { heroes: Record<string, unknown>[] };
    delete old.effects;
    delete old.abilityState;
    delete old.nextEffectId;
    for (const h of old.heroes) delete h.form;
    const m = migrateState(old as never);
    expect(m.effects).toEqual([]);
    expect(m.abilityState).toEqual({});
    expect(m.nextEffectId).toBe(1);
    expect(m.heroes.every((h) => h.form === null)).toBe(true);
  });
});
