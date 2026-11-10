import { describe, expect, it } from 'vitest';
import { cleanName, newRoomCode, normaliseCode, ROOM_ALPHABET } from '../../src/online/codes.ts';
import { seededRng } from '../helpers/rng.ts';

describe('room codes and names (005 FR-002, FR-061, FR-063)', () => {
  it('uses an alphabet without look-alikes and 7 characters (≥ 10^9 codes)', () => {
    expect(ROOM_ALPHABET).toBe('23456789ABCDEFGHJKMNPQRSTUVWXYZ');
    for (const ch of '01OIL') expect(ROOM_ALPHABET).not.toContain(ch);
    expect(ROOM_ALPHABET.length ** 7).toBeGreaterThan(1e9);
    const rng = seededRng('codes');
    const code = newRoomCode((a, b) => rng.nextInt(a, b - 1));
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/);
  });

  it('accepts lower case, spaces and dashes when joining', () => {
    expect(normaliseCode(' abc-d ef g')).toBe('ABCDEFG');
    expect(normaliseCode('ABC')).toBeNull();
    expect(normaliseCode('ABCDEF0')).toBeNull();
  });

  it('cleans names: trimmed, no control characters, at most 20 characters', () => {
    expect(cleanName('  Luka  ')).toBe('Luka');
    expect(cleanName('Lu\u0000ka\n')).toBe('Luka');
    expect(cleanName('x'.repeat(30))).toHaveLength(20);
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(5)).toBeNull();
    expect(cleanName('<b>Rošada</b>')).toBe('<b>Rošada</b>'); // shown with textContent, never as markup
  });
});
