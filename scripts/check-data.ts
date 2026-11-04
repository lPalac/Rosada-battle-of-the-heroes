// Validates every src/data/*.json against its schema plus the cross-file rules in contracts/data-files.md.
// Exit code 1 on failure. Run with `npm run check:data`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';

const DIR = 'src/data';
const FILES = ['board', 'units', 'heroes', 'healthbars', 'rules', 'assets', 'royal-favors'] as const;

function load(name: string): any {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

export function checkData(): string[] {
  const errors: string[] = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  const data: Record<string, any> = {};
  for (const f of FILES) {
    data[f] = load(`${f}.json`);
    const validate = ajv.compile(load(`schemas/${f}.schema.json`));
    if (!validate(data[f])) {
      for (const e of validate.errors ?? []) errors.push(`${f}.json ${e.instancePath || '/'} ${e.message}`);
    }
  }
  // Cross-file rules.
  const bars = new Map<string, any>((data.healthbars.bars ?? []).map((b: any) => [b.id, b]));
  for (const bar of bars.values()) {
    const pts: number[] = bar.resilientPoints;
    if (pts.some((p, i) => i > 0 && p <= pts[i - 1])) errors.push(`healthbars.json ${bar.id}: points must be ascending and unique`);
    if (pts.some((p) => p < 1 || p > bar.max)) errors.push(`healthbars.json ${bar.id}: points must be within 1…${bar.max}`);
    if (bar.startingMax > bar.max) errors.push(`healthbars.json ${bar.id}: startingMax above max`);
  }
  for (const h of data.heroes.heroes ?? []) {
    const bar = bars.get(h.healthBar);
    if (!bar) errors.push(`heroes.json ${h.id}: health bar ${h.healthBar} does not exist`);
    else if (h.maxHealth > bar.startingMax) errors.push(`heroes.json ${h.id}: maxHealth above the bar's red area (${bar.startingMax})`);
    for (const k of ['portrait', 'epicArt']) if (!(h[k] in data.assets)) errors.push(`heroes.json ${h.id}: ${k} key ${h[k]} missing from assets.json`);
    if (!(h.art in data.assets)) errors.push(`heroes.json ${h.id}: art key ${h.art} missing from assets.json`);
  }
  for (const side of ['light', 'dark']) {
    for (const t of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
      if (!(`unit.${side}.${t}` in data.assets)) errors.push(`assets.json: missing unit.${side}.${t}`);
    }
  }
  for (const key of ['die.d20', 'board', 'tavern', 'crystal', 'token.peace', 'token.war', 'token.revenge']) {
    if (!(key in data.assets)) errors.push(`assets.json: missing ${key}`);
  }
  const favors = data['royal-favors'];
  const ids = new Set<string>();
  for (const f of favors.favors) {
    if (ids.has(f.id)) errors.push(`royal-favors.json: duplicate id ${f.id}`);
    ids.add(f.id);
    if (f.kind !== 'once' && !f.target) errors.push(`royal-favors.json ${f.id}: kind ${f.kind} needs a target`);
  }
  const th: number[] = favors.powers.map((p: any) => p.threshold);
  if (th.some((t, i) => i > 0 && t <= th[i - 1])) errors.push('royal-favors.json: power thresholds must ascend');
  for (const key of ['table.top', 'room.floor', 'board.border', 'strip.graveyard', 'sheet.hero', 'track.favors', 'medallion', 'marker.auxiliary']) {
    if (!(key in data.assets)) errors.push(`assets.json: missing ${key}`);
  }
  return errors;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!);
if (isMain) {
  const errors = checkData();
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${FILES.length} data files valid`);
}
