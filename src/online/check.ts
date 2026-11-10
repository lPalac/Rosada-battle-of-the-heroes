// 005 research R-02: a state check value so clients can tell they still match the server (FR-013, FR-014).
import type { GameState } from '../rules/index.ts';

/** Canonical JSON: sorted keys, `undefined` dropped, so equal states always give the same text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** 32-bit FNV-1a over UTF-16 code units. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The check value of a game state, ignoring its log (the log only repeats the actions). */
export function stateCheck(state: GameState): number {
  const { log: _log, ...rest } = state;
  void _log;
  return fnv1a(canonicalJson(rest));
}
