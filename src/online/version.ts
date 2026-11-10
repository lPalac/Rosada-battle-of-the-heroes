// 005 research R-10: client and server must run the same build and rules data (FR-065).
import { DATA } from '../rules/index.ts';
import { canonicalJson, fnv1a } from './check.ts';

// Replaced by Vite `define` (vite.config.ts); absent when the server runs under tsx in development.
declare const __BUILD_ID__: string | undefined;

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

let cached: string | null = null;

/** Hash of the static rules data, so a client with other data cannot join. */
export function dataHash(): string {
  cached ??= fnv1a(canonicalJson(DATA)).toString(16).padStart(8, '0');
  return cached;
}
