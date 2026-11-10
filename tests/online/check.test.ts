import { describe, expect, it } from 'vitest';
import { canonicalJson, stateCheck } from '../../src/online/check.ts';
import { replay } from '../../src/game/session.ts';
import { apply } from '../../src/rules/index.ts';
import { pickAll, startedRoom } from './helpers.ts';

describe('state check (005 FR-014)', () => {
  it('is independent of key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: undefined, c: 2 }] })).toBe(canonicalJson({ a: [1, { c: 2 }], b: 1 }));
  });

  it('is equal for a replayed copy and changes after an action', () => {
    const core = startedRoom();
    pickAll(core);
    const copy = replay(core.room.save.initial, core.room.save.actions);
    expect(stateCheck(copy)).toBe(stateCheck(core.state));
    const next = apply(core.state, { type: 'endPhase' });
    expect(next.ok).toBe(true);
    if (next.ok) expect(stateCheck(next.state)).not.toBe(stateCheck(core.state));
  });
});
