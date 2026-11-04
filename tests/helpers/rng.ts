// Test-only seeded PRNG for random playouts (constitution IV). The game itself keeps no seed (FR-037).
export interface Rng {
  nextFloat(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRng(seed: string): Rng {
  let a = hash(seed);
  const nextFloat = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextInt = (min: number, max: number): number => min + Math.floor(nextFloat() * (max - min + 1));
  return { nextFloat, nextInt, pick: (items) => items[nextInt(0, items.length - 1)] };
}
