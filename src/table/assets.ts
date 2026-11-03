// Visual assets from src/data/assets.json (FR-113, research R-12). Placeholders are built in code; a `gltf` or
// `image` entry replaces them without code changes.
import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Group, LatheGeometry, Mesh,
  MeshStandardMaterial, Object3D, OctahedronGeometry, PlaneGeometry, SphereGeometry, SRGBColorSpace, TextureLoader,
  TorusGeometry, Vector2,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import assetsJson from '../data/assets.json';
import { d20Faces, d20Geometry } from '../physics/d20.ts';

export interface AssetEntry {
  placeholder?: string;
  gltf?: string;
  image?: string;
  color?: string;
  scale?: number;
}

const ASSETS = assetsJson as unknown as Record<string, AssetEntry>;

export function assetEntry(key: string): AssetEntry {
  const e = ASSETS[key];
  if (!e) throw new Error(`Asset key ${key} missing from assets.json`);
  return e;
}

const geometryCache = new Map<string, BufferGeometry>();
const materialCache = new Map<string, MeshStandardMaterial>();

function material(color: string, opts: { metalness?: number; roughness?: number } = {}): MeshStandardMaterial {
  const k = `${color}|${opts.metalness ?? 0.1}|${opts.roughness ?? 0.55}`;
  let m = materialCache.get(k);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(color), metalness: opts.metalness ?? 0.1, roughness: opts.roughness ?? 0.55 });
    materialCache.set(k, m);
  }
  return m;
}

function lathe(points: [number, number][]): LatheGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), 24);
}

const BASE: [number, number][] = [[0, 0], [0.32, 0], [0.32, 0.06], [0.24, 0.12], [0.2, 0.16]];

function profile(type: string): [number, number][] {
  switch (type) {
    case 'pawn': return [...BASE, [0.12, 0.34], [0.16, 0.38], [0.1, 0.42], [0, 0.42]];
    case 'rook': return [...BASE, [0.18, 0.5], [0.24, 0.54], [0.24, 0.66], [0, 0.66]];
    case 'knight': return [...BASE, [0.16, 0.42], [0, 0.42]];
    case 'bishop': return [...BASE, [0.12, 0.5], [0.16, 0.56], [0.1, 0.64], [0, 0.66]];
    case 'queen': return [...BASE, [0.12, 0.6], [0.2, 0.7], [0.16, 0.76], [0, 0.76]];
    case 'king': return [...BASE, [0.13, 0.66], [0.21, 0.74], [0.17, 0.8], [0, 0.8]];
    default: return [...BASE, [0, 0.4]];
  }
}

function cachedGeometry(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geometryCache.get(key);
  if (!g) {
    g = make();
    geometryCache.set(key, g);
  }
  return g;
}

function unitPlaceholder(type: string, color: string): Object3D {
  const g = new Group();
  const mat = material(color);
  const body = new Mesh(cachedGeometry(`lathe-${type}`, () => lathe(profile(type))), mat);
  body.castShadow = true;
  g.add(body);
  const add = (geo: BufferGeometry, y: number, rot = 0) => {
    const m = new Mesh(geo, mat);
    m.position.y = y;
    m.rotation.y = rot;
    m.castShadow = true;
    g.add(m);
  };
  if (type === 'knight') add(cachedGeometry('knight-head', () => new BoxGeometry(0.16, 0.3, 0.36)), 0.56);
  if (type === 'bishop') add(cachedGeometry('bishop-top', () => new SphereGeometry(0.05, 12, 8)), 0.71);
  if (type === 'queen') add(cachedGeometry('queen-top', () => new SphereGeometry(0.07, 12, 8)), 0.82);
  if (type === 'king') {
    add(cachedGeometry('king-v', () => new BoxGeometry(0.05, 0.2, 0.05)), 0.9);
    add(cachedGeometry('king-h', () => new BoxGeometry(0.16, 0.05, 0.05)), 0.92);
  }
  return g;
}

function heroPlaceholder(kind: string): Object3D {
  const g = new Group();
  const mat = material(kind === 'hero-short' ? '#c0392b' : '#2e86c1', { metalness: 0.3, roughness: 0.4 });
  const skin = material('#f1d1a8');
  const body = new Mesh(cachedGeometry(`${kind}-body`, () => (kind === 'hero-short' ? new ConeGeometry(0.2, 0.62, 16) : new CylinderGeometry(0.12, 0.2, 0.62, 16))), mat);
  body.position.y = 0.31;
  const head = new Mesh(cachedGeometry('hero-head', () => new SphereGeometry(0.11, 16, 12)), skin);
  head.position.y = 0.72;
  g.add(body, head);
  if (kind === 'hero-short') {
    const sword = new Mesh(cachedGeometry('sword', () => new BoxGeometry(0.04, 0.5, 0.02)), material('#d5d8dc', { metalness: 0.8, roughness: 0.2 }));
    sword.position.set(0.2, 0.42, 0);
    sword.rotation.z = -0.4;
    g.add(sword);
  } else {
    const staff = new Mesh(cachedGeometry('staff', () => new CylinderGeometry(0.02, 0.02, 0.95, 8)), material('#7e5109'));
    staff.position.set(0.2, 0.48, 0);
    const orb = new Mesh(cachedGeometry('orb', () => new SphereGeometry(0.06, 12, 8)), material('#aed6f1', { metalness: 0.2, roughness: 0.1 }));
    orb.position.set(0.2, 0.98, 0);
    g.add(staff, orb);
  }
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return g;
}

/** Side colour ring under a hero figure. */
export function heroRing(side: 'light' | 'dark'): Mesh {
  const e = assetEntry(`hero.${side}`);
  const ring = new Mesh(cachedGeometry('hero-ring', () => new TorusGeometry(0.28, 0.04, 8, 24)), material(e.color ?? '#ffffff'));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  return ring;
}

function faceTexture(n: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = assetEntry('die.d20').color ?? '#1f6feb';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.font = 'bold 46px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 78);
  if (n === 6 || n === 9) g.fillRect(48, 104, 32, 5);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Icosahedron with a numbered texture on every face (numbers match physics/d20.ts). */
export function d20Mesh(): Mesh {
  const geo = d20Geometry();
  const uv: number[] = [];
  for (let f = 0; f < 20; f++) uv.push(0.5, 0.95, 0.05, 0.12, 0.95, 0.12);
  const { numbers } = d20Faces();
  // Geometry vertex order: v0, v1, v2 per face. Put the label upright-ish on each face.
  geo.setAttribute('uv', new (geo.getAttribute('position').constructor as any)(new Float32Array(uv), 2));
  geo.clearGroups();
  const mats = numbers.map((n) => new MeshStandardMaterial({ map: faceTexture(n), roughness: 0.35, metalness: 0.1 }));
  for (let f = 0; f < 20; f++) geo.addGroup(f * 3, 3, f);
  const m = new Mesh(geo, mats);
  m.castShadow = true;
  return m;
}

export function crystalMesh(): Mesh {
  const e = assetEntry('crystal');
  const m = new Mesh(cachedGeometry('crystal', () => new OctahedronGeometry(0.11)), material(e.color ?? '#7fd1ff', { metalness: 0.2, roughness: 0.15 }));
  m.castShadow = true;
  return m;
}

export function tokenMesh(key: string): Mesh {
  const e = assetEntry(key);
  const m = new Mesh(cachedGeometry('token', () => new CylinderGeometry(0.32, 0.32, 0.06, 32)), material(e.color ?? '#ffffff'));
  m.castShadow = true;
  return m;
}

const gltfLoader = new GLTFLoader();
const textureLoader = new TextureLoader();

/** Build the object for an asset key; glTF/image entries load in the background and swap in when ready. */
export function createAsset(key: string): Object3D {
  const e = assetEntry(key);
  const holder = new Group();
  const [, side, type] = key.split('.');
  let placeholder: Object3D;
  if (key.startsWith('unit.')) placeholder = unitPlaceholder(type, e.color ?? (side === 'light' ? '#e8e2d0' : '#2b2b2b'));
  else if (key.startsWith('hero.')) placeholder = heroPlaceholder(e.placeholder ?? 'hero-short');
  else if (key === 'crystal') placeholder = crystalMesh();
  else if (key.startsWith('token.')) placeholder = tokenMesh(key);
  else if (key === 'die.d20') placeholder = d20Mesh();
  else placeholder = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), material(e.color ?? '#888888'));
  holder.add(placeholder);
  if (e.scale) holder.scale.setScalar(e.scale);
  if (e.gltf) {
    gltfLoader.load(e.gltf, (gltf) => {
      holder.remove(placeholder);
      holder.add(gltf.scene);
    });
  } else if (e.image) {
    textureLoader.load(e.image, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      const plane = new Mesh(new PlaneGeometry(0.8, 0.8), new MeshStandardMaterial({ map: tex, transparent: true }));
      plane.position.y = 0.5;
      holder.remove(placeholder);
      holder.add(plane);
    });
  }
  return holder;
}

export { material };
