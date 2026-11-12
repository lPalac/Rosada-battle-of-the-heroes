// The room and the wooden table under the board (003 US7-AS1, research R-09): stone floor, fog, warm lights and an
// irregular, thick table slab. Keys `room.floor` and `table.top` in assets.json.
import {
  Color, ExtrudeGeometry, Fog, Group, Mesh, MeshStandardMaterial, PlaneGeometry, PointLight, RepeatWrapping, Scene, Shape,
} from 'three';
import { EquirectangularReflectionMapping } from 'three';
import { assetEntry, loadImageTexture, notifyAssetLoaded, ttsModelsEnabled } from './assets.ts';
import { loadTtsRaw } from './tts-models.ts';
import { canvasTexture, rng, woodGrain } from './canvas.ts';

export interface RoomView {
  group: Group;
  tableTop: Mesh;
  floor: Mesh;
}

/** Table top in world units: wide enough for the 002 sandbox rim (±13.07). */
const HALF_W = 15;
const HALF_D = 13.5;
const THICK = 0.6;
/** The slab's top surface (y), just under the board and the strip. */
const SLAB_TOP = -0.13;

function slabShape(): Shape {
  const r = rng(11);
  const s = new Shape();
  const pts: [number, number][] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // A rounded rectangle with small irregular bumps, like a hand-cut slab.
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const k = 1 / Math.max(Math.abs(cx) / HALF_W, Math.abs(cy) / HALF_D);
    const rr = Math.min(k, Math.hypot(HALF_W, HALF_D)) * (0.96 + r() * 0.04);
    pts.push([cx * rr, cy * rr]);
  }
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export function createRoom(scene: Scene): RoomView {
  const group = new Group();
  const floorEntry = assetEntry('room.floor');
  const stone = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = floorEntry.color ?? '#2e2620';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      for (let x = (y / 64) % 2 ? -48 : 0; x < w; x += 96) {
        const shade = 30 + Math.floor(r() * 22);
        g.fillStyle = `rgb(${shade + 8},${shade + 4},${shade})`;
        g.fillRect(x + 3, y + 3, 90, 58);
      }
    }
  });
  stone.wrapS = stone.wrapT = RepeatWrapping;
  stone.repeat.set(10, 10);
  const floor = new Mesh(new PlaneGeometry(160, 160), new MeshStandardMaterial({ map: stone, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  floor.receiveShadow = true;
  floor.userData = { kind: 'room' };
  group.add(floor);

  const topEntry = assetEntry('table.top');
  const wood = canvasTexture(1024, 1024, (g, w, h) => woodGrain(g, w, h, topEntry.color ?? '#6b4a2b'));
  wood.wrapS = wood.wrapT = RepeatWrapping;
  wood.repeat.set(1 / (2 * HALF_W), 1 / (2 * HALF_D));
  wood.offset.set(0.5, 0.5);
  const geo = new ExtrudeGeometry(slabShape(), { depth: THICK, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.12, bevelSegments: 2 });
  const tableTop = new Mesh(geo, new MeshStandardMaterial({ map: wood, roughness: 0.85, metalness: 0.02 }));
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.y = -0.13 - THICK - 0.08;
  tableTop.receiveShadow = true;
  tableTop.userData = { kind: 'table' };
  group.add(tableTop);
  // 004 US6-AS3: the TTS table wood replaces the drawn grain when it has loaded.
  loadImageTexture('tts.table', (tex) => {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(1 / (2 * HALF_W), 1 / (2 * HALF_D));
    tex.offset.set(0.5, 0.5);
    (tableTop.material as MeshStandardMaterial).map = tex;
    (tableTop.material as MeshStandardMaterial).needsUpdate = true;
    tableTop.userData.tts = true;
  });

  // Dim room: fog and warm point lights around the table (the sun from scene.ts stays the key light).
  scene.background = new Color('#14110e');
  // 004 US6-AS3: the TTS sky around the room.
  loadImageTexture('room.sky', (tex) => {
    tex.mapping = EquirectangularReflectionMapping;
    scene.background = tex;
    group.userData.sky = true;
  });
  scene.fog = new Fog('#14110e', 38, 90);
  for (const [x, z] of [[-14, 10], [14, 10], [-14, -10], [14, -10]]) {
    const l = new PointLight('#ffb36b', 60, 40, 1.6);
    l.position.set(x, 9, z);
    group.add(l);
  }
  // 006 FR-042 (B-23): the Tabletop Simulator table model, loaded after the first frame. The drawn slab shows until it
  // has loaded, and stays with `?placeholders`; the sandbox keeps its flat collider and rim.
  const tableEntry = assetEntry('tts.table');
  if (tableEntry.mesh && ttsModelsEnabled()) {
    requestAnimationFrame(() => setTimeout(() => {
      loadTtsRaw({ mesh: tableEntry.mesh!, texture: tableEntry.texture, flipY: tableEntry.flipY })
        .then((model) => {
          const scale = tableEntry.scale ?? 0.58;
          model.scale.setScalar(scale);
          model.rotation.y = ((tableEntry.yaw ?? 0) * Math.PI) / 180;
          // The model's top (y = 0) at the slab's top; the floor at the feet of its legs.
          model.position.y = tableEntry.offsetY ?? SLAB_TOP;
          model.traverse((c) => (c.userData = { kind: 'table' }));
          group.add(model);
          tableTop.visible = false;
          floor.position.y = model.position.y + (model.userData.minY as number) * scale - 0.02;
          group.userData.ttsTable = true;
          notifyAssetLoaded();
        })
        .catch(() => {
          // The slab stays: the table model is a decoration.
        });
    }, 0));
  }
  scene.add(group);
  return { group, tableTop, floor };
}
