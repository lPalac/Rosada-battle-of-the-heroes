// Ability effects on the table (004 T059, US4-AS2, US5-AS6): square tokens (Bear Trap, Portals, Smuggler's Grotto,
// Religious Fervor, Fireball, Temporal Flux) lie on their squares; marks on units and heroes show as small tokens
// beside them. Images come from assets.json (`token.square.*`, `token.ability.*`), else a coloured disc.
import { CircleGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import assetsJson from '../data/assets.json';
import type { Effect, GameState } from '../rules/index.ts';
import { SQUARE, toWorld } from './coords.ts';

const ASSETS = assetsJson as unknown as Record<string, { image?: string }>;
const loader = new TextureLoader();
const textures = new Map<string, Texture | null>();

const SQUARE_IMAGES: Record<string, string[]> = {
  bearTrap: ['token.square.bearTrap'],
  portal: ['token.square.portal1', 'token.square.portal2'],
  grotto: ['token.square.grotto', 'token.square.grotto'],
};
const COLORS: Record<string, string> = {
  fervor: '#d9a441', fireball: '#e2582c', temporalFlux: '#6ac0e8', bearTrap: '#8a6b3c', portal: '#7b61c9', grotto: '#4f8a3c',
};

export interface EffectTokenInfo {
  id: number;
  kind: string;
  image: string | null;
  squares: number;
}

function texture(key: string, onLoad: () => void): Texture | null {
  if (textures.has(key)) return textures.get(key)!;
  const img = ASSETS[key]?.image;
  if (!img) {
    textures.set(key, null);
    return null;
  }
  const tex = loader.load(encodeURI(`${import.meta.env.BASE_URL ?? '/'}${img}`), onLoad);
  tex.colorSpace = SRGBColorSpace;
  textures.set(key, tex);
  return tex;
}

/** `scout.poisonWater` → `token.ability.poisonWater`. */
const markKey = (e: Effect): string => `token.ability.${e.source.abilityId.split('.')[1]}`;

export class EffectsView {
  readonly group = new Group();
  private info: EffectTokenInfo[] = [];
  private key = '';

  constructor(private onRedraw: () => void) {}

  list(): EffectTokenInfo[] {
    return this.info;
  }

  sync(state: GameState): void {
    const key = JSON.stringify([state.effects, state.units.map((u) => [u.id, u.pos]), state.heroes.map((h) => h.pos)]);
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    this.info = [];
    for (const e of state.effects) {
      const squares = 'square' in e.target ? [e.target.square] : 'area' in e.target ? e.target.area : [];
      if (squares.length) {
        const keys = SQUARE_IMAGES[e.kind] ?? [];
        squares.forEach((p, i) => {
          const tex = keys[i] ? texture(keys[i], this.onRedraw) : null;
          const mesh = new Mesh(
            new PlaneGeometry(SQUARE * 0.8, SQUARE * 0.8),
            new MeshStandardMaterial({ map: tex ?? undefined, color: tex ? '#ffffff' : (COLORS[e.kind] ?? '#888888'), transparent: true, opacity: tex ? 1 : 0.55 }),
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(toWorld(p, 0.012));
          this.group.add(mesh);
        });
        this.info.push({ id: e.id, kind: e.kind, image: keys[0] ?? null, squares: squares.length });
        continue;
      }
      // A mark: a small token beside the marked unit or hero.
      const pos = 'unitId' in e.target ? state.units.find((u) => u.id === (e.target as { unitId: string }).unitId)?.pos
        : 'heroId' in e.target ? state.heroes.find((h) => h.id === (e.target as { heroId: string }).heroId)?.pos : undefined;
      if (!pos) continue;
      const k = markKey(e);
      const tex = texture(k, this.onRedraw);
      const disc = new Mesh(new CircleGeometry(SQUARE * 0.16, 24), new MeshStandardMaterial({ map: tex ?? undefined, color: tex ? '#ffffff' : '#c0392b' }));
      disc.rotation.x = -Math.PI / 2;
      const w = toWorld(pos, 0.02);
      disc.position.set(w.x + SQUARE * 0.32, w.y, w.z + SQUARE * 0.32);
      this.group.add(disc);
      this.info.push({ id: e.id, kind: e.kind, image: tex ? k : null, squares: 0 });
    }
    this.onRedraw();
  }
}
