// One-off import of the Tabletop Simulator export into public/tts (004 contracts/tts-assets.md, research R-09/R-10).
// Usage: npx tsx scripts/import-tts-assets.ts "<path to assets/Table top simulator tokens and other>"
// Resizes and compresses what the game uses, then merges the `assets.json` entries. Idempotent: same input, same output.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

type Kind = 'sheet' | 'portrait' | 'texture' | 'normal' | 'board' | 'token' | 'sky' | 'icon';

interface ImageJob {
  key: string;
  src: string;
  out: string;
  kind: Kind;
}

const OUT = 'public/tts';
const UNIT_TYPES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as const;
const CAP: Record<string, string> = { king: 'King', queen: 'Queen', rook: 'Rook', bishop: 'Bishop', knight: 'Knight', pawn: 'Pawn' };

/** Sheets (R-10; ImageBack 176642 confirmed as the Spy Master at import). The Cultist has no sheet image (A-05). */
const SHEETS: Record<string, string> = {
  cavalier: 'Custom_Tile__Image__b18778.jpg',
  deathKnight: 'Custom_Tile__Image__005dad.jpg',
  dragonLord: 'Custom_Tile__ImageBack__b18778.jpg',
  holyPaladin: 'Custom_Tile__ImageBack__005dad.jpg',
  monk: 'Custom_Tile__Image__c32610.jpg',
  saint: 'Custom_Tile__ImageBack__c32610.jpg',
  supremeInquisitor: 'Custom_Tile__ImageBack__d037f6.jpg',
  scout: 'Custom_Tile__Image__176642.jpg',
  scoundrel: 'Custom_Tile__Image__7936e1.jpg',
  spyMaster: 'Custom_Tile__ImageBack__176642.jpg',
  royalAssassin: 'Custom_Tile__ImageBack__7936e1.jpg',
  magus: 'Custom_Tile__Image__5d643b.jpg',
  necromancer: 'Custom_Tile__Image__199d3e.jpg',
  grandArcanist: 'Custom_Tile__ImageBack__5d643b.jpg',
  chronomonger: 'Custom_Tile__ImageBack__199d3e.jpg',
};

/** Portraits, matched against the portraits printed on the sheets. */
const PORTRAITS: Record<string, string> = {
  cavalier: 'Cavalier_dark__Image__0f4363.png',
  deathKnight: 'Cavalier_dark__Image__5b76a0.png',
  dragonLord: 'Cavalier_dark__Image__917fd2.png',
  holyPaladin: 'Cavalier_dark__Image__7ff7a2.png',
  monk: 'Mank_light__Image__84cc84.png',
  cultist: 'Mank_light__Image__6805de.png',
  saint: 'Mank_light__Image__f4a807.png',
  supremeInquisitor: 'Mank_light__Image__ef9baf.png',
  scout: 'Scout_light__Image__d061da.png',
  scoundrel: 'Scout_light__Image__561d48.png',
  spyMaster: 'Scout_light__Image__9f2b7a.png',
  royalAssassin: 'Scout_light__Image__498d8a.png',
  magus: 'Magus_light__Image.png',
  necromancer: 'Magus_Necromancer_light__Image.png',
  grandArcanist: 'Magus_Grand-Arcanist_light__Image.png',
  chronomonger: 'Magus_Cronomonger_light__Image.png',
};

/** Ability marker tokens (380×285) and the hero-specific tokens named while viewing them. */
const TOKENS: Record<string, string> = {
  'token.ability.arcaneShackles': 'Arcane Shackles__Image.png',
  'token.ability.banishment': 'Banishment__Image.png',
  'token.ability.certaintyAndDeath': 'Certainty & Death__Image.png',
  'token.ability.tightFormation': 'Charge Enemy Lines__Image.png',
  'token.ability.convergeTimelines': 'Converge Timelines__Image.png',
  'token.ability.counterintelligence': 'Counter-inteligence__Image.png',
  'token.ability.crusade': 'Crusade__Image.png',
  'token.ability.divineProtector': 'Divine Protector__Image.png',
  'token.ability.infiltrate': 'Infiltrate Spy__Image.png',
  'token.ability.inquisition': 'Inquisition__Image.png',
  'token.ability.killOrder': 'Kill Order__Image.png',
  'token.ability.martyrdom': 'Martyrdom 02__Image.png',
  'token.ability.mislead': 'Mislead__Image.png',
  'token.ability.paragonOfHonor': 'Paragon of Honour__Image.png',
  'token.ability.poisonWater': 'Poison Water__Image__ca9039.png',
  'token.ability.preaching': 'Preaching 01__Image.png',
  'token.ability.sanctimonious': 'Sanctimonious__Image.png',
  'token.ability.seekRevenge': 'Seek Revenge__Image.png',
  'token.aura.auraOfFear': 'Cavalier_Custom_Token__Image__56dadb.png',
  'token.aura.auraOfRadiance': 'Cavalier_Custom_Token__Image__e47186.png',
  'token.aura.zealotMob': 'Monk_Custom_Token__Image__07904b.png',
  'token.aura.elusiveSabotage': 'Scout_Custom_Token__Image__34fb5e.png',
  'token.unit.legendaryAncient': 'Cavalier_Custom_Token__Image__ce8a8f.png',
  'token.unit.demon': 'Magus_Custom_Token__Image__02ab0b.png',
  'token.square.portal1': 'Magus_Custom_Token__Image__24f6ad.png',
  'token.square.portal2': 'Magus_Custom_Token__Image__95c9ac.png',
  'token.square.makePeaceNotWar': 'Monk_Custom_Token__Image__16fe5f.png',
  'token.square.bearTrap': 'Scout_Custom_Token__Image__f1a9c6.png',
  'token.square.grotto': 'Scout_Custom_Token__Image__4c3936.png',
  'token.ring.knight': 'Cavalier_Custom_Token__Image__390399.png',
  'token.ring.bishop': 'Magus_Custom_Token__Image__2437be.png',
  'tts.token.peace': 'Peace_War_Custom_Token__Image__5c7861.png',
  'tts.token.war': 'Peace_War__Image.png',
  'token.active': 'Custom_Tile__Image__fff643.png',
  'token.destiny.dark': 'Custom_Tile__Image__556301.png',
  'token.destiny.light': 'Custom_Tile__Image__fef92d.png',
};

const AUX: Record<string, [string, string]> = {
  // [first file, second file]; the lighter one becomes Light.
  pawn: ['Aux Pawn__Image__215d69.png', 'Aux Pawn__Image__f74f83.png'],
  knight: ['Aux Knight__Image.png', 'Aux Kight__Image.png'],
  bishop: ['Aux Bishop__Image__01e87f.png', 'Aux Bishop__Image__e9e885.png'],
  rook: ['Aux Rook__Image__1f93cc.png', 'Aux Rook__Image__2ce813.png'],
  queen: ['Aux Queen__Image__8e9857.png', 'Aux Queen__Image__c8adcd.png'],
};

const BIG: { key: string; src: string; out: string; kind: Kind; width: number }[] = [
  { key: 'tts.graveyard', src: 'Grave Yard_D Well__Image.png', out: 'board/graveyard.webp', kind: 'board', width: 2048 },
  { key: 'tts.board', src: 'Custom_Model__Diffuse__f894a2.png', out: 'board/board.webp', kind: 'board', width: 2048 },
  { key: 'tts.achievements', src: 'Custom_Tile__Image__22e7d5.png', out: 'board/achievements.webp', kind: 'board', width: 1406 },
  { key: 'pool.common.light', src: 'Common Destiny Pool Light__Image.png', out: 'board/common-pool.webp', kind: 'board', width: 1400 },
  { key: 'pool.hero', src: 'Hero Pool 1__Image.png', out: 'board/hero-pool.webp', kind: 'board', width: 1011 },
  { key: 'bar.16', src: 'Health Bar 16__Image.png', out: 'board/bar-16.webp', kind: 'board', width: 2048 },
  { key: 'bar.20', src: 'Health Bar 20__Image.png', out: 'board/bar-20.webp', kind: 'board', width: 2048 },
  { key: 'legend', src: 'Custom_Tile__Image__b2ed5d.png', out: 'board/legend.webp', kind: 'board', width: 1200 },
];

/** Symbol Legend icons as fractions of the legend image (x, y, w, h), cut for the HUD. */
const ICONS: Record<string, [number, number, number, number]> = {
  wound: [0.05, 0.125, 0.07, 0.07], heal: [0.05, 0.19, 0.07, 0.07], movement: [0.05, 0.255, 0.07, 0.07],
  hero: [0.05, 0.32, 0.07, 0.07], push: [0.05, 0.385, 0.07, 0.07], adjacent: [0.05, 0.45, 0.07, 0.07],
  range: [0.05, 0.515, 0.07, 0.07],
  destiny: [0.34, 0.125, 0.07, 0.07], lead: [0.34, 0.19, 0.07, 0.07], cannotLead: [0.34, 0.255, 0.07, 0.07],
  battle: [0.34, 0.32, 0.07, 0.07], cannotBattle: [0.34, 0.385, 0.07, 0.07], linked: [0.34, 0.45, 0.07, 0.07],
  cannot: [0.34, 0.515, 0.07, 0.07],
  destroy: [0.67, 0.125, 0.08, 0.07], cannotBeDestroyed: [0.67, 0.19, 0.08, 0.07], destroyInBattle: [0.67, 0.255, 0.08, 0.07],
  cannotBeDestroyedInBattle: [0.67, 0.32, 0.08, 0.07], notRoyalty: [0.67, 0.385, 0.08, 0.07],
  mustNotCheck: [0.67, 0.45, 0.08, 0.07], noRoll: [0.67, 0.515, 0.08, 0.07],
};

function jobs(): ImageJob[] {
  const out: ImageJob[] = [];
  for (const [id, f] of Object.entries(SHEETS)) out.push({ key: `sheet.${id}`, src: f, out: `sheet/${id}.jpg`, kind: 'sheet' });
  for (const [id, f] of Object.entries(PORTRAITS)) out.push({ key: `portrait.${id}`, src: f, out: `portrait/${id}.webp`, kind: 'portrait' });
  for (const [key, f] of Object.entries(TOKENS)) out.push({ key, src: f, out: `token/${key.replace(/^token\./, '').replace(/\./g, '-')}.webp`, kind: 'token' });
  out.push({ key: 'room.sky', src: 'Table_Sky__Sky.jpg', out: 'sky/sky.jpg', kind: 'sky' });
  out.push({ key: 'tts.table.texture', src: 'Table__Diffuse.png', out: 'texture/table.webp', kind: 'texture' });
  for (const t of UNIT_TYPES) out.push({ key: `tts.${t}.normal`, src: `${CAP[t]}__Normal.png`, out: `texture/${t}-normal.webp`, kind: 'normal' });
  return out;
}

/**
 * Which V direction the mesh's UVs use: sample the Light texture at every UV with and without flipping; the brighter
 * result is right (Light pieces are white). The TTS meshes do not all use the same convention.
 */
async function uvFlipY(objFile: string, textureFile: string): Promise<boolean> {
  const lines = readFileSync(objFile, 'utf8').split(/\r?\n/);
  const nums = (l: string, n: number) => l.trim().split(/\s+/).slice(1, 1 + n).map(Number);
  const vs = lines.filter((l) => l.startsWith('v ')).map((l) => nums(l, 3));
  const uvs = lines.filter((l) => l.startsWith('vt ')).map((l) => nums(l, 2));
  const { data, info } = await sharp(textureFile).resize(256, 256).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sample = (u: number, v: number) => {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height)));
    const i = (y * info.width + x) * info.channels;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  // Weighted by triangle area, sampled at each face's UV centre.
  let flipped = 0;
  let straight = 0;
  for (const l of lines) {
    if (!l.startsWith('f ')) continue;
    const idx = l.trim().split(/\s+/).slice(1).map((p) => p.split('/').map(Number));
    for (let k = 1; k + 1 < idx.length; k++) {
      const tri = [idx[0], idx[k], idx[k + 1]];
      const [a, b, c] = tri.map((q) => vs[q[0] - 1]);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      const t = tri.map((q) => uvs[q[1] - 1]);
      if (t.some((x) => !x)) continue;
      const u = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const v = (t[0][1] + t[1][1] + t[2][1]) / 3;
      flipped += area * sample(u, 1 - v); // three's default flipY: image row 0 is v = 1
      straight += area * sample(u, v);
    }
  }
  return flipped >= straight;
}

async function brightness(file: string): Promise<number> {
  const { channels } = await sharp(file).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

async function writeImage(src: string, out: string, kind: Kind, width?: number): Promise<void> {
  mkdirSync(dirname(out), { recursive: true });
  let img = sharp(src);
  switch (kind) {
    case 'sheet': img = img.resize(1500, 902, { fit: 'fill' }).jpeg({ quality: 85, mozjpeg: true }); break;
    case 'portrait': img = img.resize({ width: 512 }).webp({ quality: 82 }); break;
    case 'texture': case 'normal': img = img.resize(1024, 1024).webp({ quality: kind === 'normal' ? 90 : 82 }); break;
    case 'board': img = img.resize({ width: width ?? 2048, withoutEnlargement: true }).webp({ quality: 82 }); break;
    case 'token': img = img.resize(256, 256, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }); break;
    case 'sky': img = img.resize(2048, 1024).jpeg({ quality: 78, mozjpeg: true }); break;
    case 'icon': img = img.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }); break;
  }
  await img.toFile(out);
}

/** OBJ copied without comments and the material lines (textures come from assets.json). */
function copyObj(src: string, out: string): void {
  mkdirSync(dirname(out), { recursive: true });
  const text = readFileSync(src, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && !l.startsWith('mtllib') && !l.startsWith('usemtl')).join('\n');
  writeFileSync(out, `${text}\n`);
}

function folderSize(dir: string): number {
  let total = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    total += st.isDirectory() ? folderSize(p) : st.size;
  }
  return total;
}

async function main(): Promise<void> {
  const srcDir = process.argv[2];
  if (!srcDir || !existsSync(srcDir)) throw new Error('Pass the TTS asset folder');
  const at = (f: string) => {
    const p = join(srcDir, f);
    if (!existsSync(p)) throw new Error(`Missing ${f}`);
    return p;
  };
  rmSync(OUT, { recursive: true, force: true });
  const entries: Record<string, Record<string, unknown>> = {};
  for (const j of jobs()) {
    await writeImage(at(j.src), join(OUT, j.out), j.kind);
    entries[j.key] = { image: `tts/${j.out}` };
  }
  for (const b of BIG) {
    await writeImage(at(b.src), join(OUT, b.out), b.kind, b.width);
    entries[b.key] = { image: `tts/${b.out}` };
  }
  // Legend icons.
  const legend = at('Custom_Tile__Image__b2ed5d.png');
  const meta = await sharp(legend).metadata();
  for (const [id, [x, y, w, h]] of Object.entries(ICONS)) {
    const out = join(OUT, `icon/${id}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    await sharp(legend)
      .extract({ left: Math.round(x * meta.width!), top: Math.round(y * meta.height!), width: Math.round(w * meta.width!), height: Math.round(h * meta.height!) })
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(out);
    entries[`legend.${id}`] = { image: `tts/icon/${id}.webp` };
  }
  // Auxiliary tokens: the brighter image is Light.
  for (const [type, [a, b]] of Object.entries(AUX)) {
    const [light, dark] = (await brightness(at(a))) >= (await brightness(at(b))) ? [a, b] : [b, a];
    for (const [side, f] of [['light', light], ['dark', dark]] as const) {
      const out = `token/aux-${type}-${side}.webp`;
      await writeImage(at(f), join(OUT, out), 'token');
      entries[`marker.auxiliary.${side}.${type}`] = { image: `tts/${out}` };
    }
  }
  // Unit meshes: mesh + collider + normal, diffuse per side (the brighter texture is Light).
  for (const t of UNIT_TYPES) {
    copyObj(at(`${CAP[t]}__Mesh.obj`), join(OUT, `mesh/${t}.obj`));
    copyObj(at(`${CAP[t]}__Collider.obj`), join(OUT, `mesh/${t}-collider.obj`));
    const diffuse = readdirSync(srcDir).filter((f) => f.startsWith(`${CAP[t]}__Diffuse__`)).sort();
    const [light, dark] = (await brightness(at(diffuse[0]))) >= (await brightness(at(diffuse[1]))) ? diffuse : [diffuse[1], diffuse[0]];
    for (const [side, f] of [['light', light], ['dark', dark]] as const) {
      const out = `texture/${t}-${side}.webp`;
      await writeImage(at(f), join(OUT, out), 'texture');
      entries[`unit.${side}.${t}`] = {
        mesh: `tts/mesh/${t}.obj`, texture: `tts/${out}`, normal: `tts/texture/${t}-normal.webp`, collider: `tts/mesh/${t}-collider.obj`,
        flipY: await uvFlipY(join(OUT, `mesh/${t}.obj`), at(light)),
        // 006 FR-043: the TTS unit models face the other way from the board's pieces.
        yaw: 180,
      };
    }
    delete entries[`tts.${t}.normal`];
  }
  copyObj(at('Aux Queen__Mesh.obj'), join(OUT, 'mesh/aux-queen.obj'));
  copyObj(at('Table__Mesh.obj'), join(OUT, 'mesh/table.obj'));
  entries['tts.table'] = { mesh: 'tts/mesh/table.obj', texture: 'tts/texture/table.webp' };
  delete entries['tts.table.texture'];

  // Merge into assets.json: TTS fields win, placeholders stay as the fallback (001 FR-113).
  const file = 'src/data/assets.json';
  const assets = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
  for (const [key, entry] of Object.entries(entries)) assets[key] = { ...(assets[key] ?? {}), ...entry };
  writeFileSync(file, `${JSON.stringify(assets, null, 2)}\n`);
  const mb = folderSize(OUT) / 1024 / 1024;
  console.log(`✓ ${Object.keys(entries).length} asset keys merged; public/tts is ${mb.toFixed(1)} MB`);
  if (mb > 30) throw new Error('public/tts is over the 30 MB budget');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
