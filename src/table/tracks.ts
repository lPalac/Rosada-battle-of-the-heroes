// The shared Royal Favor track (006 FR-041: slots 1…11, the Legendary Power names at 6…11, a Light and a Dark marker)
// and turn-order medallions beside each hero sheet, the active one glowing (003 US7-AS4). Fed by favorModel, like the
// tracker modal.
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { favorModel, type SharedTrack } from '../game/favor-model.ts';
import type { GameState, Side } from '../rules/index.ts';
import { assetEntry } from './assets.ts';
import { canvasTexture, parchment } from './canvas.ts';
import { SQUARE } from './coords.ts';
import { seatPose } from './sheets.ts';

/** 006 FR-041 (B-14): the shared track, 1.2 × 8.4 squares, standing lengthwise between the board and the strip. */
export const TRACK_SIZE = { w: 1.2 * SQUARE, d: 8.4 * SQUARE };
export const TRACK_X = -6.1 * SQUARE;
const W = 192;
const H = 1344;
const SHORT: Record<string, string> = {
  heroUnit: 'Hero Unit', kingsForces: "King's Forces", advancedWarfare: 'Adv. Warfare', farReach: 'Far Reach', swiftChange: 'Swift Change', finalForm: 'Final Form',
};
const MARKER: Record<Side, { fill: string; stroke: string }> = {
  light: { fill: '#e6b422', stroke: '#7a5a10' },
  dark: { fill: '#7e57c2', stroke: '#311b92' },
};

export interface TrackInfo {
  slots: number;
  light: number;
  dark: number;
}

export interface MedallionInfo {
  heroId: string;
  number: number;
  active: boolean;
}

export class TracksView {
  readonly group = new Group();
  private track: { tex: CanvasTexture; key: string; info: TrackInfo };
  private medallions = new Map<string, { mesh: Mesh; info: MedallionInfo }>();

  constructor() {
    assetEntry('track.favors');
    const tex = canvasTexture(W, H, () => {});
    const mesh = new Mesh(new PlaneGeometry(TRACK_SIZE.w, TRACK_SIZE.d), new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    // Canvas top is the Dark end (−z), so slot 1 is drawn at the bottom, at Light's end.
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(TRACK_X, -0.06, 0);
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'track' };
    this.group.add(mesh);
    this.track = { tex, key: '', info: { slots: 11, light: 0, dark: 0 } };
  }

  trackInfo(): TrackInfo {
    return this.track.info;
  }

  medallionList(): MedallionInfo[] {
    return [...this.medallions.values()].map((m) => m.info);
  }

  sync(state: GameState): void {
    if (state.status === 'setup') return;
    const shared = favorModel(state).shared;
    this.track.info = { slots: shared.slots, light: shared.light, dark: shared.dark };
    const key = `${shared.light}:${shared.dark}`;
    if (key !== this.track.key) {
      this.track.key = key;
      this.drawTrack(this.track.tex, shared);
    }
    const slots: Record<Side, number> = { light: 0, dark: 0 };
    for (const h of [...state.heroes].sort((a, b) => a.turnOrder - b.turnOrder)) {
      const slot = slots[h.side]++;
      let med = this.medallions.get(h.id);
      if (!med) {
        const top = canvasTexture(128, 128, (g) => {
          g.fillStyle = assetEntry('medallion').color ?? '#d9d2c0';
          g.fillRect(0, 0, 128, 128);
          g.fillStyle = h.side === 'light' ? '#6b4a2b' : '#222';
          g.font = 'bold 84px serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(h.turnOrder), 64, 70);
        });
        const side = new MeshStandardMaterial({ color: '#8c7a55', metalness: 0.4, roughness: 0.4 });
        const face = new MeshStandardMaterial({ map: top, metalness: 0.2, roughness: 0.5, emissive: '#000000' });
        const mesh = new Mesh(new CylinderGeometry(0.42 * SQUARE, 0.42 * SQUARE, 0.08, 40), [side, face, side]);
        const pose = seatPose(h.side, slot === 0 ? 'medallion0' : 'medallion1');
        mesh.position.set(pose.x, -0.02, pose.z);
        mesh.rotation.y = pose.rot + Math.PI / 2; // the cap's texture is a quarter turn off
        mesh.castShadow = true;
        mesh.userData = { kind: 'medallion', heroId: h.id };
        this.group.add(mesh);
        med = { mesh, info: { heroId: h.id, number: h.turnOrder, active: false } };
        this.medallions.set(h.id, med);
      }
      const active = state.status === 'playing' && h.id === state.activeHeroId;
      med.info = { ...med.info, active };
      const face = (med.mesh.material as MeshStandardMaterial[])[1];
      face.emissive.set(active ? '#a07a10' : '#000000');
      med.mesh.scale.setScalar(active ? 1.15 : 1);
      med.mesh.position.y = active ? 0.02 : -0.02;
    }
  }

  /** Slots 1…11 from Light's end; each slot's number and power name are drawn once for each seat (the Dark copy turned
   * 180°); Light's marker sits in the half of the slot nearer Light, Dark's in the other half. */
  private drawTrack(tex: CanvasTexture, m: SharedTrack): void {
    const g = (tex.image as HTMLCanvasElement).getContext('2d')!;
    parchment(g, W, H, 33);
    const cell = H / m.slots;
    const label = (i: number, cx: number, cy: number, turned: boolean): void => {
      const power = m.powers.find((p) => p.threshold === i + 1);
      g.save();
      g.translate(cx, cy);
      if (turned) g.rotate(Math.PI);
      g.fillStyle = '#3b2a18';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.font = 'bold 26px serif';
      g.fillText(String(i + 1), -W / 2 + 12, power ? -10 : 0);
      if (power) {
        g.font = '15px sans-serif';
        g.fillText(SHORT[power.id] ?? power.id, -W / 2 + 12, 16);
      }
      g.restore();
    };
    const marker = (side: Side, cx: number, cy: number): void => {
      g.beginPath();
      g.arc(cx, cy, 20, 0, Math.PI * 2);
      g.fillStyle = MARKER[side].fill;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = MARKER[side].stroke;
      g.stroke();
    };
    for (let i = 0; i < m.slots; i++) {
      const top = H - (i + 1) * cell;
      const power = m.powers.some((p) => p.threshold === i + 1);
      g.fillStyle = power ? 'rgba(160,120,40,.22)' : 'rgba(60,40,20,.08)';
      g.fillRect(6, top + 4, W - 12, cell - 8);
      g.strokeStyle = power ? '#a07a10' : '#6b4a2b';
      g.lineWidth = power ? 4 : 2;
      g.strokeRect(6, top + 4, W - 12, cell - 8);
      g.strokeStyle = 'rgba(107,74,43,.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(12, top + cell / 2);
      g.lineTo(W - 12, top + cell / 2);
      g.stroke();
      // Light's half (nearer Light, the lower half) and Dark's half.
      label(i, W / 2, top + cell * 0.75, false);
      label(i, W / 2, top + cell * 0.25, true);
      if (m.light === i + 1) marker('light', W - 36, top + cell * 0.75);
      if (m.dark === i + 1) marker('dark', 36, top + cell * 0.25);
    }
    tex.needsUpdate = true;
  }
}
