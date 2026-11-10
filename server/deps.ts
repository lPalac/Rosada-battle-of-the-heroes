// 005 T025: the RoomCore dependencies on the server (research R-05, R-09). Node only.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { RoomDeps } from '../src/online/room-core.ts';

export const serverDeps: RoomDeps = {
  randomInt: (min, max) => randomInt(min, max),
  newToken: () => randomBytes(16).toString('base64url'),
  hashToken: (token) => createHash('sha256').update(token).digest('hex'),
  now: () => new Date(),
};
