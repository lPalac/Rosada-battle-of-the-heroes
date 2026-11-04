// 10×10 board from board.json: Battlefield checkering, King's Court, Wilderness, Taverns; Graveyard and Well zones.
import {
  BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial,
} from 'three';
import { DATA, regionOf, type Coord } from '../rules/index.ts';
import { assetEntry, material } from './assets.ts';
import { canvasTexture, parchment, rng } from './canvas.ts';
import { SQUARE, toWorld, ZONES } from './coords.ts';

export interface BoardView {
  group: Group;
  /** The illustrated frame around the 10×10 board (003 US7-AS1). */
  border: Mesh;
  /** Pickable square meshes; `userData.coord` holds the board coordinate. */
  squares: Mesh[];
  graveyardZones: Mesh[];
}

const REGION_COLORS = {
  battlefieldLight: '#ead9b0',
  battlefieldDark: '#86603e',
  kingsCourt: '#6f7f5a',
  wilderness: '#4f6b3a',
};

function label(text: string, color = '#f5f5f5'): Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 32);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(2, 0.5, 1);
  return s;
}

/** Forest, water and castle walls drawn around the board, under the squares (`board.border`, research R-09). */
function createBorder(): Mesh {
  assetEntry('board.border');
  const frame = 0.9; // squares of border on each side
  const size = (DATA.board.size + 2 * frame) * SQUARE;
  const tex = canvasTexture(1024, 1024, (g, w, h) => {
    const r = rng(17);
    parchment(g, w, h, 4);
    const px = (frame / (DATA.board.size + 2 * frame)) * w;
    // Water ring.
    g.fillStyle = '#3f6f8f';
    g.fillRect(0, 0, w, px * 0.45);
    g.fillRect(0, h - px * 0.45, w, px * 0.45);
    g.fillRect(0, 0, px * 0.45, h);
    g.fillRect(w - px * 0.45, 0, px * 0.45, h);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = 'rgba(200,225,240,.35)';
      g.lineWidth = 2;
      const x = r() * w;
      const y = r() < 0.5 ? r() * px * 0.4 : h - r() * px * 0.4;
      g.beginPath();
      g.arc(x, y, 6, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    // Forest along the sides.
    for (let i = 0; i < 260; i++) {
      const side = Math.floor(r() * 4);
      const t = r();
      const d = px * (0.5 + r() * 0.42);
      const [x, y] = side === 0 ? [t * w, d] : side === 1 ? [t * w, h - d] : side === 2 ? [d, t * h] : [w - d, t * h];
      g.fillStyle = `rgb(${40 + r() * 30},${80 + r() * 50},${36 + r() * 20})`;
      g.beginPath();
      g.arc(x, y, 8 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
    // Castle walls behind each King's Court (top = Dark, bottom = Light).
    for (const y of [px * 0.55, h - px * 0.55 - 24]) {
      g.fillStyle = '#8d8f91';
      g.fillRect(w * 0.3, y, w * 0.4, 24);
      for (let x = w * 0.3; x < w * 0.7; x += 22) g.fillRect(x, y - 10, 12, 10);
      g.fillStyle = '#6d6f71';
      g.fillRect(w * 0.47, y - 18, w * 0.06, 42);
    }
    g.strokeStyle = '#4a3420';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
  const m = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.1;
  m.receiveShadow = true;
  m.userData = { kind: 'border' };
  return m;
}

export function createBoard(): BoardView {
  const group = new Group();
  const squares: Mesh[] = [];
  const geo = new BoxGeometry(0.98 * SQUARE, 0.1, 0.98 * SQUARE);
  for (let y = 0; y < DATA.board.size; y++) {
    for (let x = 0; x < DATA.board.size; x++) {
      const coord: Coord = { x, y };
      const region = regionOf(coord)!;
      let color: string;
      if (region === 'battlefield') color = (x + y) % 2 === 0 ? REGION_COLORS.battlefieldDark : REGION_COLORS.battlefieldLight;
      else if (region === 'tavern') color = assetEntry('tavern').color ?? '#8a5a2b';
      else color = REGION_COLORS[region];
      const m = new Mesh(geo, material(color, { roughness: 0.8 }));
      m.position.copy(toWorld(coord, -0.05));
      m.receiveShadow = true;
      m.userData = { kind: 'square', coord };
      group.add(m);
      squares.push(m);
      if (region === 'tavern') {
        const roof = new Mesh(new BoxGeometry(0.5 * SQUARE, 0.04, 0.5 * SQUARE), material('#5d3a1a'));
        roof.position.copy(toWorld(coord, 0.02));
        group.add(roof);
      }
    }
  }
  // File and rank labels along Light's edge and left side.
  [...'abcdefgh'].forEach((f, i) => {
    const s = label(f);
    s.position.copy(toWorld({ x: i + 1, y: -0.75 }, 0.05));
    s.scale.set(1.2, 0.3, 1);
    group.add(s);
  });
  for (let r = 1; r <= 8; r++) {
    const s = label(String(r));
    s.position.copy(toWorld({ x: -0.75, y: r }, 0.05));
    s.scale.set(1.2, 0.3, 1);
    group.add(s);
  }
  const graveyardZones: Mesh[] = [];
  for (const side of ['light', 'dark'] as const) {
    const zone = new Mesh(new PlaneGeometry(ZONES.graveyardSize.w, ZONES.graveyardSize.d), new MeshStandardMaterial({ color: '#2c2f33', roughness: 1 }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.copy(ZONES.graveyard[side]).setY(-0.04);
    zone.userData = { kind: 'graveyard', side };
    group.add(zone);
    graveyardZones.push(zone);
    const l = label(`Graveyard`, '#bbbbbb');
    l.position.copy(ZONES.graveyard[side]).add({ x: 0, y: 0.1, z: (side === 'light' ? 1.55 : -1.55) * SQUARE } as any);
    group.add(l);
  }
  const well = new Mesh(new PlaneGeometry(2.2 * SQUARE, 1.6 * SQUARE), new MeshStandardMaterial({ color: '#203a4f', roughness: 1, transparent: true, opacity: 0.55 }));
  well.rotation.x = -Math.PI / 2;
  well.position.copy(ZONES.well).setY(-0.04);
  group.add(well);
  const border = createBorder();
  group.add(border);
  return { group, squares, graveyardZones, border };
}
