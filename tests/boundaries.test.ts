// Constitution II / research R-04: the rules core and session stay engine-free.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src/rules', 'src/game'];
const FORBIDDEN = [/^three(\/|$)/, /^@dimforge\//, /^colyseus/, /(^|\/)(table|physics|ui)(\/|$)/];
const FORBIDDEN_GLOBALS = /\b(document|window|localStorage|requestAnimationFrame|HTMLElement)\b/;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('engine-free boundary (constitution II)', () => {
  const files = ROOTS.flatMap(tsFiles);

  it('finds the rules files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    it(`${relative('.', file)} imports nothing forbidden`, () => {
      const src = readFileSync(file, 'utf8');
      const imports = [...src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        const bad = FORBIDDEN.find((re) => re.test(spec.replace(/^(\.\.\/)+/, '')));
        expect(bad, `${file} imports ${spec}`).toBeUndefined();
      }
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(FORBIDDEN_GLOBALS.exec(code)?.[0], `${file} uses a DOM global`).toBeUndefined();
    });
  }
});
