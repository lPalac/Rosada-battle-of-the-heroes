// 005 T023 / analysis C1: the server's RoomDeps roll with node:crypto's randomInt (uniform, no modulo bias).
import { describe, expect, it, vi } from 'vitest';

const randomInt = vi.fn((min: number, max: number) => (min + max) >> 1);
vi.mock('node:crypto', async (original) => ({ ...(await original<typeof import('node:crypto')>()), randomInt }));

describe('server RoomDeps', () => {
  it('US3-AS3 server rolls come from crypto.randomInt(1, 21)', async () => {
    const { serverDeps } = await import('../../server/deps.ts');
    expect(serverDeps.randomInt(1, 21)).toBe(11);
    expect(randomInt).toHaveBeenCalledWith(1, 21);
  });

  it('seat tokens are 128 bits and stored as SHA-256', async () => {
    const { serverDeps } = await import('../../server/deps.ts');
    const token = serverDeps.newToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(16);
    expect(serverDeps.hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
