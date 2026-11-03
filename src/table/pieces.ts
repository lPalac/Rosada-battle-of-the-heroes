// Keeps unit, hero, token and crystal meshes in sync with the GameState after every `apply` (FR-110).
import { Group, Mesh, MeshBasicMaterial, Object3D, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { GameEvent, GameState, Hero, Side, Unit } from '../rules/index.ts';
import { createAsset, crystalMesh, heroRing, tokenMesh } from './assets.ts';
import { shake, tweenTo } from './animate.ts';
import { toWorld, ZONES } from './coords.ts';
import type { TableScene } from './scene.ts';

const UPRIGHT = new Quaternion();
const LYING = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

export class PiecesView {
  readonly group = new Group();
  private units = new Map<string, Object3D>();
  private heroes = new Map<string, Object3D>();
  private crystals = new Group();
  private tokens = new Group();
  private activeRing: Mesh;

  constructor(private ts: TableScene) {
    this.group.add(this.crystals, this.tokens);
    this.activeRing = new Mesh(new TorusGeometry(0.4, 0.05, 8, 32), new MeshBasicMaterial({ color: '#ffd54f' }));
    this.activeRing.rotation.x = Math.PI / 2;
    this.activeRing.position.y = 0.04;
    this.group.add(this.activeRing);
  }

  unitObject(id: string): Object3D | undefined {
    return this.units.get(id);
  }

  heroObject(id: string): Object3D | undefined {
    return this.heroes.get(id);
  }

  private unitTarget(state: GameState, u: Unit, graveIndex: number | null): Vector3 {
    if (graveIndex === null) return toWorld(u.pos);
    const zone = ZONES.graveyard[u.side];
    const col = graveIndex % 5;
    const row = Math.floor(graveIndex / 5);
    return new Vector3(zone.x - 1.1 + col * 0.55, 0, zone.z + (u.side === 'light' ? -0.8 : 0.8) + row * (u.side === 'light' ? 0.6 : -0.6));
  }

  private heroTarget(state: GameState, h: Hero): Vector3 {
    const base = toWorld(h.pos);
    const sharing = state.heroes.filter((x) => x.pos.x === h.pos.x && x.pos.y === h.pos.y);
    const unitHere = state.units.some((u) => u.pos.x === h.pos.x && u.pos.y === h.pos.y);
    if (sharing.length === 1 && !unitHere) return base;
    // Several heroes on one square (or a hero beside a unit) stand in a ring.
    const i = sharing.findIndex((x) => x.id === h.id);
    const n = Math.max(sharing.length, unitHere ? 2 : 1);
    const angle = (i / n) * Math.PI * 2 + Math.PI / 4;
    const r = unitHere ? 0.33 : 0.25;
    return base.add(new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
  }

  sync(state: GameState, events: GameEvent[] = [], animate = true): void {
    const seen = new Set<string>();
    const place = (id: string, key: string, target: Vector3, data: Record<string, unknown>, map: Map<string, Object3D>, rotation?: Quaternion) => {
      seen.add(id);
      let obj = map.get(id);
      if (!obj) {
        obj = createAsset(key);
        obj.userData = data;
        obj.traverse((c) => (c.userData = { ...data }));
        obj.position.copy(target);
        if (rotation) obj.quaternion.copy(rotation);
        this.group.add(obj);
        map.set(id, obj);
        return obj;
      }
      if (animate && obj.position.distanceTo(target) > 0.01) tweenTo(this.ts, obj, target, { rotation });
      else {
        obj.position.copy(target);
        if (rotation) obj.quaternion.copy(rotation);
      }
      return obj;
    };

    // Units on the board and in the Graveyard.
    for (const u of state.units) {
      const obj = place(u.id, `unit.${u.side}.${u.type}`, this.unitTarget(state, u, null), { kind: 'unit', id: u.id }, this.units);
      if (obj.userData.type !== u.type) {
        // Promotion: rebuild the mesh.
        this.group.remove(obj);
        this.units.delete(u.id);
        place(u.id, `unit.${u.side}.${u.type}`, this.unitTarget(state, u, null), { kind: 'unit', id: u.id, type: u.type }, this.units);
      }
      this.units.get(u.id)!.userData.type = u.type;
      this.units.get(u.id)!.rotation.y = u.side === 'dark' ? Math.PI : 0;
    }
    const graveCount: Record<Side, number> = { light: 0, dark: 0 };
    for (const u of state.graveyard) {
      place(u.id, `unit.${u.side}.${u.type}`, this.unitTarget(state, u, graveCount[u.side]++), { kind: 'graveUnit', id: u.id }, this.units);
      this.units.get(u.id)!.userData.kind = 'graveUnit';
      this.units.get(u.id)!.traverse((c) => (c.userData = { kind: 'graveUnit', id: u.id }));
    }
    for (const [id, obj] of this.units) if (!seen.has(id)) {
      this.group.remove(obj);
      this.units.delete(id);
    }

    // Heroes: figure + side ring; Unconscious heroes lie down.
    for (const h of state.heroes) {
      const fresh = !this.heroes.has(h.id);
      const obj = place(h.id, h.art, this.heroTarget(state, h), { kind: 'hero', id: h.id }, this.heroes, h.status.unconscious ? LYING : UPRIGHT);
      if (fresh) {
        const ring = heroRing(h.side);
        ring.userData = { kind: 'hero', id: h.id };
        obj.add(ring);
        obj.scale.setScalar(0.85);
      }
    }
    const wounded = new Set(events.filter((e) => e.type === 'heroWounded').map((e) => (e as { heroId: string }).heroId));
    for (const id of wounded) {
      const obj = this.heroes.get(id);
      if (obj) setTimeout(() => shake(this.ts, obj), 380);
    }
    const active = this.heroes.get(state.activeHeroId);
    if (active && state.status === 'playing') {
      this.activeRing.visible = true;
      const target = this.heroTarget(state, state.heroes.find((h) => h.id === state.activeHeroId)!);
      if (animate) tweenTo(this.ts, this.activeRing, target.clone().setY(0.04));
      else this.activeRing.position.copy(target).setY(0.04);
    } else this.activeRing.visible = false;

    this.syncCrystals(state);
    this.syncTokens(state);
    this.ts.requestRender();
  }

  private syncCrystals(state: GameState): void {
    this.crystals.clear();
    const pile = (n: number, at: Vector3) => {
      for (let i = 0; i < Math.min(n, 24); i++) {
        const c = crystalMesh();
        c.position.set(at.x - 0.8 + (i % 6) * 0.32, 0.12 + Math.floor(i / 12) * 0.2, at.z - 0.4 + (Math.floor(i / 6) % 2) * 0.32);
        c.rotation.y = i;
        this.crystals.add(c);
      }
    };
    if (!state.destiny.well.depleted) pile(state.destiny.well.initialRemaining, ZONES.well);
    pile(state.destiny.common.light, ZONES.common.light);
    pile(state.destiny.common.dark, ZONES.common.dark);
  }

  private syncTokens(state: GameState): void {
    this.tokens.clear();
    const peace = tokenMesh(state.tokens.peaceTreaty === 'peace' ? 'token.peace' : 'token.war');
    peace.position.copy(ZONES.tokens).setY(0.03);
    this.tokens.add(peace);
    (['light', 'dark'] as const).forEach((side, s) => {
      for (let i = 0; i < state.tokens.revenge[side]; i++) {
        const r = tokenMesh('token.revenge');
        r.scale.setScalar(0.6);
        r.position.set(ZONES.tokens.x - 0.5 + i * 0.45, 0.03, ZONES.tokens.z + (s === 0 ? 0.8 : -0.8));
        this.tokens.add(r);
      }
    });
  }
}
