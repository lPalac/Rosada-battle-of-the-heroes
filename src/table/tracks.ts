// Royal Favor tracks (one per side, 16 slots with the Legendary Power marks at 6…11) and turn-order medallions
// beside each hero sheet, the active one glowing (003 US7-AS3, AS4). Fed by favorModel, like the tracker modal.
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { favorModel, type SideFavors } from '../game/favor-model.ts';
import type { GameState, Side } from '../rules/index.ts';
import { assetEntry } from './assets.ts';
import { canvasTexture, parchment } from './canvas.ts';
import { SQUARE } from './coords.ts';
import { seatPose } from './sheets.ts';

const W = 896;
const H = 256;
const SHORT: Record<string, string> = {
  heroUnit: 'Hero Unit', kingsForces: "King's Forces", advancedWarfare: 'Adv. Warfare', farReach: 'Far Reach', swiftChange: 'Swift Change', finalForm: 'Final Form',
};
const INITIALS = (id: string) => id.replace(/([A-Z])/g, ' $1').split(' ').map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3);

export interface TrackInfo {
  side: Side;
  slots: number;
  tokens: number;
}

export interface MedallionInfo {
  heroId: string;
  number: number;
  active: boolean;
}

export class TracksView {
  readonly group = new Group();
  private tracks = new Map<Side, { tex: CanvasTexture; key: string; info: TrackInfo }>();
  private medallions = new Map<string, { mesh: Mesh; info: MedallionInfo }>();

  constructor() {
    assetEntry('track.favors');
    for (const side of ['light', 'dark'] as const) {
      const tex = canvasTexture(W, H, () => {});
      const mesh = new Mesh(new PlaneGeometry(4.6 * SQUARE, 1.31 * SQUARE), new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      const pose = seatPose(side, 'track');
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = pose.rot;
      mesh.position.set(pose.x, -0.06, pose.z);
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'track', side };
      this.group.add(mesh);
      this.tracks.set(side, { tex, key: '', info: { side, slots: 16, tokens: 0 } });
    }
  }

  trackList(): TrackInfo[] {
    return [...this.tracks.values()].map((t) => t.info);
  }

  medallionList(): MedallionInfo[] {
    return [...this.medallions.values()].map((m) => m.info);
  }

  sync(state: GameState): void {
    if (state.status === 'setup') return;
    const model = favorModel(state);
    for (const side of ['light', 'dark'] as const) {
      const t = this.tracks.get(side)!;
      const m = model[side];
      t.info = { side, slots: m.slots, tokens: m.track.length };
      const key = JSON.stringify(m.track);
      if (key !== t.key) {
        t.key = key;
        this.drawTrack(t.tex, m);
      }
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

  private drawTrack(tex: CanvasTexture, m: SideFavors): void {
    const g = (tex.image as HTMLCanvasElement).getContext('2d')!;
    parchment(g, W, H, m.side === 'light' ? 31 : 32);
    g.fillStyle = m.side === 'light' ? '#3b2a18' : '#1a1a1a';
    g.font = 'bold 30px serif';
    g.textBaseline = 'middle';
    g.fillText(`Royal Favors – ${m.side === 'light' ? 'Light' : 'Dark'}`, 18, 26);
    const cell = 100;
    for (let i = 0; i < m.slots; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const x = 24 + col * (cell + 6);
      const y = 56 + row * 96;
      const power = m.powers.find((p) => p.threshold === i + 1);
      g.fillStyle = power ? 'rgba(160,120,40,.25)' : 'rgba(60,40,20,.12)';
      g.fillRect(x, y, cell, 84);
      g.strokeStyle = power ? '#a07a10' : '#6b4a2b';
      g.lineWidth = power ? 4 : 2;
      g.strokeRect(x, y, cell, 84);
      g.fillStyle = '#5a4026';
      g.font = 'bold 18px sans-serif';
      g.textAlign = 'left';
      g.fillText(String(i + 1), x + 6, y + 14);
      if (power) {
        g.font = '14px sans-serif';
        g.textAlign = 'center';
        g.fillText(SHORT[power.id] ?? power.id, x + cell / 2, y + 74);
      }
      const id = m.track[i];
      if (id) {
        g.fillStyle = m.side === 'light' ? '#e8dcc0' : '#333';
        g.beginPath();
        g.arc(x + cell / 2, y + 38, 26, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#a07a10';
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = m.side === 'light' ? '#3b2a18' : '#eee';
        g.font = 'bold 18px sans-serif';
        g.textAlign = 'center';
        g.fillText(INITIALS(id), x + cell / 2, y + 39);
      }
      g.textAlign = 'left';
    }
    tex.needsUpdate = true;
  }
}
