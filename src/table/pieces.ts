// Keeps unit, hero, token and crystal meshes in sync with the GameState after every `apply` (FR-110).
import { Group, Mesh, MeshBasicMaterial, Object3D, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { GameEvent, GameState, Hero, Side, Unit } from '../rules/index.ts';
import { assetEntry, createAsset, crystalMesh, heroRing, material, tokenMesh } from './assets.ts';
import { shake, tweenTo } from './animate.ts';
import { SQUARE, toWorld, unitOffset, ZONES } from './coords.ts';
import type { TableScene } from './scene.ts';

const UPRIGHT = new Quaternion();
const yawOf = (side: Side): number => (side === 'dark' ? Math.PI : 0);
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

  /** True while the sandbox physics world moves the pieces (002 US1). */
  physics = false;

  /** Draw units and hero figures where the physics world has them; Dark units keep facing the Light side. */
  applyPoses(poses: Map<string, { p: [number, number, number]; q: [number, number, number, number] }>, sides: Map<string, Side>): void {
    for (const [id, pose] of poses) {
      const obj = this.units.get(id) ?? this.heroes.get(id);
      if (!obj) continue;
      obj.position.set(pose.p[0], pose.p[1], pose.p[2]);
      obj.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]);
      if (this.units.has(id)) obj.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yawOf(sides.get(id) ?? 'light')));
    }
    this.ts.requestRender();
  }

  /** Every unit and hero mesh, for tests (offsets and tilt in rules mode). */
  allPieces(): { id: string; obj: Object3D }[] {
    return [...this.units, ...this.heroes].map(([id, obj]) => ({ id, obj }));
  }

  unitObject(id: string): Object3D | undefined {
    return this.units.get(id);
  }

  heroObject(id: string): Object3D | undefined {
    return this.heroes.get(id);
  }

  /** Rest point of a unit: its square (two units on the square's diagonal, in id order) or its Graveyard slot. */
  unitTarget(state: GameState, u: Unit, graveIndex: number | null): Vector3 {
    if (graveIndex === null) {
      const here = state.units.filter((x) => x.pos.x === u.pos.x && x.pos.y === u.pos.y).map((x) => x.id).sort();
      return toWorld(u.pos).add(unitOffset(here.indexOf(u.id), here.length));
    }
    const zone = ZONES.graveyard[u.side];
    const col = graveIndex % 5;
    const row = Math.floor(graveIndex / 5);
    const dir = u.side === 'light' ? -1 : 1;
    return new Vector3(zone.x + (-1.1 + col * 0.55) * SQUARE, 0, zone.z + (0.8 * dir - row * 0.6 * dir) * SQUARE);
  }

  /** Rest point of a hero figure: centre if alone; with units it stands in a free corner, else in a ring. */
  heroTarget(state: GameState, h: Hero): Vector3 {
    const base = toWorld(h.pos);
    const sharing = state.heroes.filter((x) => x.pos.x === h.pos.x && x.pos.y === h.pos.y);
    const units = state.units.filter((u) => u.pos.x === h.pos.x && u.pos.y === h.pos.y).length;
    const i = sharing.findIndex((x) => x.id === h.id);
    if (units > 0) {
      // Units use the centre or the (−,+)/(+,−) diagonal, so heroes take the other two corners, then the rest.
      const corners = [[-1, -1], [1, 1], [-1, 1], [1, -1]].map(([x, z]) => new Vector3(x, 0, z).multiplyScalar(0.3 * SQUARE));
      return base.add(corners[i % corners.length]);
    }
    if (sharing.length === 1) return base;
    const angle = (i / sharing.length) * Math.PI * 2 + Math.PI / 4;
    const r = 0.25 * SQUARE;
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
      if (this.physics) return obj; // in sandbox the physics world owns the poses (002 US1)
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
      this.syncMarker(this.units.get(u.id)!, u);
      if (!this.physics) this.units.get(u.id)!.rotation.set(0, yawOf(u.side), 0); // also stands fallen pieces up
    }
    const graveCount: Record<Side, number> = { light: 0, dark: 0 };
    for (const u of state.graveyard) {
      place(u.id, `unit.${u.side}.${u.type}`, this.unitTarget(state, u, graveCount[u.side]++), { kind: 'graveUnit', id: u.id }, this.units);
      if (!this.physics) this.units.get(u.id)!.rotation.set(0, yawOf(u.side), 0);
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
      // A Hero Unit stands for its hero: the unit mesh with the hero's ring is drawn instead of the figure (003 T039).
      obj.visible = !h.heroUnitId;
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

  /** Auxiliary units get a blue ring, Hero Units their hero's side ring and a gold band (003 FR-036, T039). */
  private syncMarker(obj: Object3D, u: Unit): void {
    const want = u.kind === 'main' ? null : u.kind;
    const current = obj.children.find((c) => c.name === 'kindMarker');
    if (current && current.userData.marker === want) return;
    if (current) obj.remove(current);
    if (!want) return;
    const color = want === 'auxiliary' ? assetEntry('marker.auxiliary').color ?? '#7fd1ff' : '#ffd54f';
    const ring = new Mesh(new TorusGeometry(0.34, want === 'hero' ? 0.06 : 0.04, 8, 28), material(color, { metalness: 0.5, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    ring.name = 'kindMarker';
    ring.userData = { kind: 'unit', id: u.id, marker: want };
    obj.add(ring);
    if (want === 'hero') {
      const side = heroRing(u.side);
      side.userData = { kind: 'unit', id: u.id };
      side.position.y = 0.12;
      ring.add(side);
      side.rotation.x = 0;
      side.position.set(0, 0, -0.07);
    }
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
    if (state.tokens.peaceTreaty !== 'removed') {
      // The Declaration of War token leaves the table in the Epic Stage (003 FR-006).
      const peace = tokenMesh(state.tokens.peaceTreaty === 'peace' ? 'token.peace' : 'token.war');
      peace.position.copy(ZONES.tokens).setY(0.03);
      this.tokens.add(peace);
    }
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
