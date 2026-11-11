// Validates every src/data/*.json against its schema plus the cross-file rules in contracts/data-files.md.
// Exit code 1 on failure. Run with `npm run check:data`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';

const DIR = 'src/data';
const FILES = ['board', 'units', 'heroes', 'healthbars', 'rules', 'assets', 'royal-favors', 'abilities', 'online'] as const;

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
  errors.push(...checkAbilities(data));
  return errors;
}

/** 004 contracts/abilities-data.md rules 1, 3, 4, 5, 6 and 7. Rule 2 (implementations) is a Vitest test. */
function checkAbilities(data: Record<string, any>): string[] {
  const errors: string[] = [];
  const strings = load('strings.en.json');
  const abilities = new Map<string, any>((data.abilities.abilities ?? []).map((a: any) => [a.id, a]));
  const owner = new Map<string, string[]>();
  const own = (id: string, by: string) => owner.set(id, [...(owner.get(id) ?? []), by]);
  for (const a of abilities.values()) if (a.id.startsWith('general.')) own(a.id, 'general');
  for (const h of data.heroes.heroes ?? []) {
    for (const id of h.abilities) own(id, h.id);
    if (h.selectable) {
      // Rule 7: exactly the three forms.
      const forms = Object.keys(h.forms ?? {}).sort().join(',');
      if (forms !== 'dominant,fanatic,resolute') errors.push(`heroes.json ${h.id}: needs the forms fanatic, resolute, dominant`);
      for (const k of ['portrait', 'sheet']) if (!(h[k] in data.assets)) errors.push(`heroes.json ${h.id}: ${k} key ${h[k]} missing from assets.json`);
    }
    for (const form of Object.values<any>(h.forms ?? {})) {
      for (const id of form.abilities) {
        own(id, form.id);
        const a = abilities.get(id);
        // Rule 3: Epic form actions have a cost (Beginning of Epic Stage placements excepted), never uses.
        if (a && a.kind !== 'passive' && !a.timings.includes('beginningOfEpicStage') && !a.cost) errors.push(`abilities.json ${id}: Epic ability needs a cost`);
      }
      // Rule 6: art keys exist.
      for (const k of ['portrait', 'sheet']) if (!(form[k] in data.assets)) errors.push(`heroes.json ${form.id}: ${k} key ${form[k]} missing from assets.json`);
      if (!strings[`form.${form.id}.name`]) errors.push(`strings.en.json: missing form.${form.id}.name`);
    }
  }
  // Rule 1: every hero / form ability exists, and every ability belongs to exactly one owner.
  for (const [id, by] of owner) if (!abilities.has(id)) errors.push(`heroes.json ${by.join(',')}: unknown ability ${id}`);
  // 006 FR-002: a Starting Hero's limited ability costs 1 D per use, so it has both; nothing else may.
  const starting = new Set<string>((data.heroes.heroes ?? []).flatMap((h: any) => h.abilities));
  for (const a of abilities.values()) {
    const by = owner.get(a.id) ?? [];
    if (by.length !== 1) errors.push(`abilities.json ${a.id}: belongs to ${by.length} heroes or forms`);
    if (a.cost && a.uses && !starting.has(a.id)) errors.push(`abilities.json ${a.id}: has both cost and uses`);
    if (a.uses && !a.cost && starting.has(a.id)) errors.push(`abilities.json ${a.id}: a Starting ability with uses needs a cost (1 D per use)`);
    // 006: a target hint has its "why not" text.
    if (a.targetHint && !strings[`hint.${a.targetHint}`]) errors.push(`strings.en.json: missing hint.${a.targetHint}`);
    // Rule 4: values pairs are [normal, bloodied].
    for (const [k, v] of Object.entries<any>(a.values)) if (Array.isArray(v) && v.length !== 2) errors.push(`abilities.json ${a.id}: value ${k} must be [normal, bloodied]`);
    // Rule 5: strings and icons.
    for (const key of [a.name, a.text, ...a.timings.map((t: string) => `timing.${t}`)]) if (!strings[key]) errors.push(`strings.en.json: missing ${key}`);
    for (const icon of a.icons) if (!(`legend.${icon}` in data.assets)) errors.push(`abilities.json ${a.id}: icon ${icon} is not a Symbol Legend key`);
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
