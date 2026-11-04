// 10×10 board from board.json: Battlefield checkering, King's Court, Wilderness, Taverns; Graveyard and Well zones.
import {
  BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial,
} from 'three';
import { DATA, regionOf, type Coord } from '../rules/index.ts';
import { assetEntry, material } from './assets.ts';
import { SQUARE, toWorld, ZONES } from './coords.ts';

export interface BoardView {
  group: Group;
  /** Pickable square meshes; `userData.coord` holds the board coordinate. */
  squares: Mesh[];
  graveyardZones: Mesh[];
}

const REGION_COLORS = {
  battlefieldLight: '#e9d8b4',
  battlefieldDark: '#8b5e3c',
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
  const well = new Mesh(new PlaneGeometry(2.2 * SQUARE, 1.6 * SQUARE), new MeshStandardMaterial({ color: '#203a4f', roughness: 1 }));
  well.rotation.x = -Math.PI / 2;
  well.position.copy(ZONES.well).setY(-0.04);
  group.add(well);
  return { group, squares, graveyardZones };
}
