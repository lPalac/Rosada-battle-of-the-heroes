// T108: every RuleError code and every t('…') key used in src has an entry in strings.en.json.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import strings from '../src/data/strings.en.json';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const src = files('src').map((f) => ({ f, text: readFileSync(f, 'utf8') }));
const keys = new Set(Object.keys(strings));
/** Position problem codes come with their own message text (FR-103); they are not shown via error.* keys. */
const PROBLEM_CODES = ['TWO_UNITS', 'UNIT_OFF_BATTLEFIELD', 'UNPROMOTED_PAWN', 'KING_COUNT', 'KING_SHARES', 'NEGATIVE_POOL',
  'REVENGE_COUNT', 'HERO_OFF_BOARD', 'BAD_HEALTH'];

describe('UI strings (A-02)', () => {
  it('has a message for every RuleError code', () => {
    const codes = new Set<string>();
    for (const { text } of src.filter((s) => s.f.includes(join('src', 'rules')))) {
      for (const m of text.matchAll(/fail\(\s*['"]([A-Z_]+)['"]/g)) codes.add(m[1]);
      for (const m of text.matchAll(/code: '([A-Z_]+)'/g)) codes.add(m[1]);
      for (const m of text.matchAll(/\?\s*'([A-Z_]{3,})'\s*:\s*'([A-Z_]{3,})'/g)) codes.add(m[1]).add(m[2]);
    }
    expect(codes.size).toBeGreaterThan(30);
    const missing = [...codes].filter((c) => !PROBLEM_CODES.includes(c) && !keys.has(`error.${c}`));
    expect(missing).toEqual([]);
  });

  it('has every literal key passed to t()', () => {
    const missing: string[] = [];
    for (const { f, text } of src) {
      for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) if (!keys.has(m[1])) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('has the templated keys the UI builds (phases, sides, units, reasons, results)', () => {
    const needed = [
      ...['beforeTurn', 'beginningOfTurn', 'beforeMove', 'move', 'beforeLead', 'lead', 'afterLead', 'endOfTurn'].map((p) => `phase.${p}`),
      'side.light', 'side.dark', 'range.short', 'range.long',
      ...['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].map((u) => `unit.${u}`),
      ...['failedLead', 'destroyEnemy', 'ownUnitLost', 'woundEnemyHero', 'resilientDestiny', 'check', 'drink', 'meal', 'freeMeal',
        'freeDrink', 'inspiredLead', 'heroRetreat'].map((r) => `reason.${r}`),
      ...['checkmate', 'kingDestroyed', 'bothKingsInCheck', 'noEligibleUnits', 'agreed'].map((b) => `result.by.${b}`),
      ...['war', 'check', 'inspiredLead'].map((m) => `mod.${m}`),
      ...['move', 'advance', 'ram', 'push', 'unconscious', 'heroRetreat', 'sandbox'].map((r) => `log.heroMoved.${r}`),
      'log.ability.inspiredLead', 'log.ability.heroRetreat', 'log.bought.drink', 'log.bought.meal',
      'log.enforcement.sandbox', 'log.enforcement.rules', 'setup.mode.draft', 'setup.mode.mirror',
    ];
    expect(needed.filter((k) => !keys.has(k))).toEqual([]);
  });
});
