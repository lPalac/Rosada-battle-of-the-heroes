// 005 T026 / research R-11: message rate and room creation limits.
import { describe, expect, it } from 'vitest';
import { CreationLimiter, RateLimiter } from '../../server/limits.ts';

describe('server limits (FR-062)', () => {
  it('drops messages over 20 per second and disconnects after 3 bursts in a minute', () => {
    const r = new RateLimiter(20, 3);
    const burst = (t: number) => Array.from({ length: 25 }, () => r.hit(t));
    const first = burst(0);
    expect(first.slice(0, 20).every((v) => v === 'ok')).toBe(true);
    expect(first.slice(20).every((v) => v === 'drop')).toBe(true);
    expect(burst(1000).at(-1)).toBe('drop');
    expect(burst(2000)).toContain('kick');
    // Bursts more than a minute apart do not add up.
    const calm = new RateLimiter(20, 3);
    for (const t of [0, 61_000, 122_000]) expect(Array.from({ length: 25 }, () => calm.hit(t))).not.toContain('kick');
  });

  it('allows 5 new rooms per address per hour', () => {
    const c = new CreationLimiter(5);
    for (let i = 0; i < 5; i++) expect(c.allow('1.2.3.4', i)).toBe(true);
    expect(c.allow('1.2.3.4', 10)).toBe(false);
    expect(c.allow('5.6.7.8', 10)).toBe(true);
    expect(c.allow('1.2.3.4', 3600_001)).toBe(true);
  });
});
