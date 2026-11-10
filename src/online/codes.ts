// 005 research R-11: room codes (7 characters, no look-alikes) and display names (FR-002, FR-063).
import { ONLINE } from './limits.ts';

export const ROOM_ALPHABET = ONLINE.codeAlphabet;

/** A fresh room code; `randomInt(min, maxExclusive)` is crypto.randomInt on the server. */
export function newRoomCode(randomInt: (min: number, maxExcl: number) => number, length = ONLINE.codeLength): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)];
  return code;
}

/** What a player typed (lower case, spaces, dashes) → the code, or null if it cannot be one. */
export function normaliseCode(input: string): string | null {
  const code = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== ONLINE.codeLength) return null;
  return [...code].every((ch) => ROOM_ALPHABET.includes(ch)) ? code : null;
}

/** Control characters, zero-width characters and bidirectional overrides. */
function isHidden(cp: number): boolean {
  return (
    cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0xfeff
  );
}

/** Trimmed display name without hidden characters, at most 20 characters; null if nothing is left. */
export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const kept = [...input].filter((ch) => !isHidden(ch.codePointAt(0)!)).join('').trim();
  const name = [...kept].slice(0, ONLINE.nameMax).join('').trim();
  return name.length > 0 ? name : null;
}
