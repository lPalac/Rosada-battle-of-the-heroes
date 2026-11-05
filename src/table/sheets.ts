// Hero sheets on the table, one in front of each seat (003 US7-AS2, AS5, FR-040…FR-042): portrait, name and range,
// health track with marker, Destiny pool, Bloodied, and in the Epic Stage the destiny, its Epic art and the
// Destiny Generation tracker. Canvas textures, redrawn only when that hero's data changes.
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import assetsJson from '../data/assets.json';
import { DATA, destinyGeneration, EPIC_DESTINIES, healthBarOf, isBloodied, type GameState, type Hero, type Side } from '../rules/index.ts';
import { assetEntry } from './assets.ts';
import { canvasTexture, drawCover, loadImage, parchment } from './canvas.ts';
import { sheetModel, type SheetModel } from '../game/sheet-model.ts';
import strings from '../data/strings.en.json';
import { SQUARE } from './coords.ts';

const ASSETS = assetsJson as unknown as Record<string, { image?: string; columns?: number }>;
const W = 640;
const H = 400;
export const SHEET_SIZE = { w: 2.9 * SQUARE, d: 1.8 * SQUARE };

/** Seat layout: each side's two sheets and its Royal Favor track along its own table edge (research R-09). */
export function seatPose(side: Side, slot: number | 'track' | 'medallion0' | 'medallion1'): { x: number; z: number; rot: number } {
  const s = side === 'light' ? 1 : -1;
  const z = 6.65 * SQUARE;
  const x = slot === 'track' ? 3.7 * SQUARE : slot === 0 || slot === 'medallion0' ? -4.15 * SQUARE : -0.5 * SQUARE;
  const dx = slot === 'medallion0' || slot === 'medallion1' ? -SHEET_SIZE.w / 2 - 0.4 * SQUARE : 0;
  return { x: s * (x + dx), z: s * z, rot: side === 'light' ? 0 : Math.PI };
}

export function imageUrl(key: string): string | null {
  const img = ASSETS[key]?.image;
  return img ? encodeURI(`${import.meta.env.BASE_URL ?? '/'}${img}`) : null;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function image(key: string): Promise<HTMLImageElement | null> {
  let p = images.get(key);
  if (!p) {
    const url = imageUrl(key);
    p = url ? loadImage(url).catch(() => null) : Promise.resolve(null);
    images.set(key, p);
  }
  return p;
}

export interface SheetInfo {
  heroId: string;
  name: string;
  portrait: string | null;
  portraitLoaded: boolean;
  /** Health the marker shows; equals the hero's health. */
  healthMarker: number;
  pool: number;
  destiny: string | null;
  /** Column of the Epic art shown (0 Fanatic, 1 Resolute, 2 Dominant), or null. */
  epicColumn: number | null;
  generation: number | null;
  bloodied: boolean;
  /** 004: sheet image key (`sheet.hero` = canvas-drawn), uses left per ability, corrected-cost badges, marks. */
  sheetKey: string;
  uses: Record<string, number>;
  badges: string[];
  marks: string[];
}

interface Sheet {
  mesh: Mesh;
  tex: CanvasTexture;
  key: string;
  info: SheetInfo;
  loaded: Set<string>;
}

export class SheetsView {
  readonly group = new Group();
  private sheets = new Map<string, Sheet>();
  constructor(private onRedraw: () => void) {
    assetEntry('sheet.hero');
  }

  meshOf(heroId: string): Mesh | undefined {
    return this.sheets.get(heroId)?.mesh;
  }

  list(): SheetInfo[] {
    return [...this.sheets.values()].map((s) => s.info);
  }

  sync(state: GameState): void {
    if (state.status === 'setup') return;
    const slots: Record<Side, number> = { light: 0, dark: 0 };
    for (const h of [...state.heroes].sort((a, b) => a.turnOrder - b.turnOrder)) {
      const slot = slots[h.side]++;
      const def = DATA.heroes.find((d) => d.id === h.definitionId);
      const portraitKey = def?.portrait ?? 'portrait.short';
      const epicKey = def?.epicArt ?? 'epic.short';
      const generation = state.stage === 'epic' ? destinyGeneration(state, h.side) : null;
      const bloodied = isBloodied(state, h.id);
      const model = sheetModel(state, h.id);
      const named = !!def?.selectable;
      const info: SheetInfo = {
        heroId: h.id, name: named ? `${h.id} · ${model.name}` : `${h.id} · ${h.side === 'light' ? 'Light' : 'Dark'} ${h.rangeType === 'short' ? 'Short' : 'Long'} range`,
        portrait: imageUrl(named ? model.portraitKey : portraitKey), portraitLoaded: false, healthMarker: h.health, pool: h.pool,
        destiny: h.epic?.destiny ?? null, epicColumn: h.epic ? EPIC_DESTINIES.indexOf(h.epic.destiny) : null, generation, bloodied,
        sheetKey: model.sheetKey,
        uses: Object.fromEntries(model.abilities.filter((a) => a.usesLeft !== null).map((a) => [a.id, a.usesLeft!])),
        badges: model.abilities.filter((a) => a.printedCost).map((a) => a.id),
        marks: model.marks,
      };
      const key = JSON.stringify([info, h.maxHealth, h.status.unconscious, h.heroUnitId]);
      let sheet = this.sheets.get(h.id);
      if (!sheet) {
        const tex = canvasTexture(W, H, () => {});
        const mesh = new Mesh(new PlaneGeometry(SHEET_SIZE.w, SHEET_SIZE.d), new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
        mesh.rotation.x = -Math.PI / 2;
        const pose = seatPose(h.side, slot);
        mesh.position.set(pose.x, -0.06, pose.z);
        mesh.rotation.z = pose.rot;
        mesh.receiveShadow = true;
        mesh.userData = { kind: 'sheet', heroId: h.id };
        this.group.add(mesh);
        sheet = { mesh, tex, key: '', info, loaded: new Set() };
        this.sheets.set(h.id, sheet);
      }
      sheet.info = { ...info, portraitLoaded: sheet.loaded.has(portraitKey) };
      if (sheet.key === key) continue;
      sheet.key = key;
      if (!model.canvasSheet && imageUrl(model.sheetKey)) this.drawTts(sheet, h, model);
      else this.draw(sheet, h, named ? model.portraitKey : portraitKey, epicKey);
    }
  }

  /**
   * 004 (research R-12): the TTS sheet image with overlays drawn on top: health bar with marker, Destiny pool, uses
   * left, corrected-cost badges (FR-001a), Bloodied / Unconscious and marks.
   */
  private drawTts(sheet: Sheet, h: Hero, model: SheetModel): void {
    const g = (sheet.tex.image as HTMLCanvasElement).getContext('2d')!;
    const S = strings as Record<string, string>;
    const paint = (art: HTMLImageElement | null, bar: HTMLImageElement | null) => {
      parchment(g, W, H, h.turnOrder);
      if (art) g.drawImage(art, 0, 0, W, H - 40);
      // Health bar strip along the bottom, marker at the current health.
      const y = H - 40;
      g.fillStyle = '#1d140a';
      g.fillRect(0, y, W, 40);
      if (bar) g.drawImage(bar, 0, y + 6, W, 28);
      const max = model.bar;
      const mx = ((Math.min(h.health, max) - 0.5) / max) * W;
      g.fillStyle = '#ffd54f';
      g.beginPath();
      g.moveTo(mx, y + 2);
      g.lineTo(mx - 8, y - 10);
      g.lineTo(mx + 8, y - 10);
      g.fill();
      // Overlays: pool, state, uses, badges.
      const tag = (text: string, x: number, ty: number, bg: string) => {
        g.font = 'bold 18px sans-serif';
        const w = g.measureText(text).width + 12;
        g.fillStyle = bg;
        g.fillRect(x, ty, w, 24);
        g.fillStyle = '#fff';
        g.textBaseline = 'middle';
        g.fillText(text, x + 6, ty + 12);
        return w;
      };
      let x = 8;
      x += tag(`D ${h.pool}`, x, 8, '#3b2a6e') + 6;
      x += tag(`${h.health}/${h.maxHealth}`, x, 8, '#2e5c2e') + 6;
      if (model.bloodied) x += tag('BLOODIED', x, 8, '#b03a2e') + 6;
      if (h.status.unconscious) x += tag('Unconscious', x, 8, '#555') + 6;
      let ty = 40;
      for (const a of model.abilities) {
        const name = S[a.nameKey] ?? a.id;
        if (a.usesLeft !== null) {
          tag(`${name}: ${a.usesLeft}/${a.uses}`, 8, ty, '#5a4a1a');
          ty += 28;
        }
        if (a.printedCost && a.cost) {
          tag(`${name}: ${a.cost[0]}/${a.cost[1]} D`, 8, ty, '#8a2b2b');
          ty += 28;
        }
      }
      for (const m of model.marks) {
        tag(m, W - 160, ty, '#444');
        ty += 28;
      }
      sheet.tex.needsUpdate = true;
      this.onRedraw();
    };
    paint(null, null);
    void Promise.all([image(model.sheetKey), image(`bar.${model.bar}`)]).then(([art, bar]) => {
      if (art) sheet.loaded.add(model.sheetKey);
      sheet.info = { ...sheet.info, portraitLoaded: !!art };
      paint(art, bar);
    });
  }

  private draw(sheet: Sheet, h: Hero, portraitKey: string, epicKey: string): void {
    const g = (sheet.tex.image as HTMLCanvasElement).getContext('2d')!;
    const info = sheet.info;
    const paint = (portrait: HTMLImageElement | null, epic: HTMLImageElement | null) => {
      parchment(g, W, H, h.turnOrder);
      const side = h.side === 'light' ? '#f1e6c8' : '#2b2b2b';
      g.fillStyle = h.side === 'light' ? '#c9b27a' : '#3a3a3a';
      g.fillRect(0, 0, W, 54);
      g.fillStyle = h.side === 'light' ? '#2a1d0e' : '#eee';
      g.font = 'bold 30px serif';
      g.textBaseline = 'middle';
      g.fillText(info.name, 16, 28);
      // Art: the Epic form's column once chosen, else the portrait.
      const art = info.epicColumn !== null && epic ? epic : portrait;
      g.fillStyle = '#3b2a18';
      g.fillRect(14, 66, 216, 318);
      if (art) drawCover(g, art, 18, 70, 208, 310, art === epic ? info.epicColumn! : 0, art === epic ? ASSETS[epicKey]?.columns ?? 1 : 1);
      g.strokeStyle = side;
      g.lineWidth = 4;
      g.strokeRect(16, 68, 212, 314);
      // Health track: one box per point, red area = the starting part of the bar.
      const bar = healthBarOf(h.healthBarId);
      const x0 = 246;
      g.fillStyle = '#2a1d0e';
      g.font = 'bold 22px sans-serif';
      g.fillText(`Health ${h.health}/${h.maxHealth}`, x0, 82);
      const perRow = 10;
      const bw = 34;
      for (let i = 1; i <= h.maxHealth; i++) {
        const row = Math.floor((i - 1) / perRow);
        const col = (i - 1) % perRow;
        const x = x0 + col * (bw + 4);
        const y = 100 + row * (bw + 6);
        const red = i <= bar.startingMax;
        g.fillStyle = i <= h.health ? (red ? '#b03a2e' : '#4f8a3c') : 'rgba(60,40,20,.18)';
        g.fillRect(x, y, bw, bw);
        if (bar.resilientPoints.includes(i)) {
          g.fillStyle = '#7fd1ff';
          g.beginPath();
          g.arc(x + bw - 7, y + 7, 5, 0, Math.PI * 2);
          g.fill();
        }
        if (i === h.health) {
          g.strokeStyle = '#ffd54f';
          g.lineWidth = 4;
          g.strokeRect(x - 2, y - 2, bw + 4, bw + 4);
        }
      }
      let y = 100 + Math.ceil(h.maxHealth / perRow) * (bw + 6) + 26;
      g.fillStyle = '#2a1d0e';
      g.font = 'bold 24px sans-serif';
      g.fillText(`Destiny pool: ${h.pool}`, x0, y);
      if (info.bloodied) {
        g.fillStyle = '#b03a2e';
        g.fillText('BLOODIED', x0 + 230, y);
      }
      if (h.status.unconscious) {
        g.fillStyle = '#555';
        g.fillText('Unconscious', x0 + 230, y);
      }
      y += 36;
      if (info.destiny) {
        g.fillStyle = '#5a1f6e';
        g.font = 'bold 24px serif';
        g.fillText(`Epic: ${info.destiny[0].toUpperCase()}${info.destiny.slice(1)}`, x0, y);
        y += 34;
      }
      if (info.generation !== null) {
        g.fillStyle = '#2a1d0e';
        g.font = '20px sans-serif';
        g.fillText('Generation', x0, y);
        for (let n = 1; n <= 8; n++) {
          const x = x0 + 112 + (n - 1) * 34;
          g.fillStyle = n === info.generation ? '#ffd54f' : 'rgba(60,40,20,.18)';
          g.beginPath();
          g.arc(x, y, 14, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#2a1d0e';
          g.font = 'bold 16px sans-serif';
          g.textAlign = 'center';
          g.fillText(String(n), x, y + 1);
          g.textAlign = 'left';
        }
      }
      sheet.tex.needsUpdate = true;
      this.onRedraw();
    };
    paint(null, null);
    void Promise.all([image(portraitKey), image(epicKey)]).then(([p, e]) => {
      if (p) sheet.loaded.add(portraitKey);
      sheet.info = { ...sheet.info, portraitLoaded: !!p };
      paint(p, e);
    });
  }
}
