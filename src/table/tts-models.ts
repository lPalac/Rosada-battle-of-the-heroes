// Tabletop Simulator meshes (004 T063, US6): OBJ + diffuse + normal map from assets.json, scaled to the placeholder's
// height and centred on the square. Cached per file; the placeholder stays until the model has loaded (001 FR-113).
import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, TextureLoader, Vector3, type Object3D } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export interface MeshEntry {
  mesh: string;
  texture?: string;
  normal?: string;
  /** UV convention of this mesh (measured at import). */
  flipY?: boolean;
}

const objLoader = new OBJLoader();
const textureLoader = new TextureLoader();
const geometries = new Map<string, Promise<BufferGeometry[]>>();
const materials = new Map<string, Promise<MeshStandardMaterial>>();

const url = (path: string): string => encodeURI(`${import.meta.env.BASE_URL ?? '/'}${path}`);

function geometry(path: string): Promise<BufferGeometry[]> {
  let p = geometries.get(path);
  if (!p) {
    p = objLoader.loadAsync(url(path)).then((group) => {
      const out: BufferGeometry[] = [];
      group.traverse((o) => {
        if ((o as Mesh).isMesh) out.push((o as Mesh).geometry as BufferGeometry);
      });
      return out;
    });
    geometries.set(path, p);
  }
  return p;
}

/** The material with its texture loaded (the scene renders on demand, so a model must not appear before its texture). */
function material(e: MeshEntry): Promise<MeshStandardMaterial> {
  const key = `${e.texture ?? ''}|${e.normal ?? ''}|${e.flipY ?? true}`;
  let m = materials.get(key);
  if (!m) {
    m = (async () => {
      const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1 });
      if (e.texture) {
        const tex = await textureLoader.loadAsync(url(e.texture));
        tex.colorSpace = SRGBColorSpace;
        tex.flipY = e.flipY ?? true;
        tex.needsUpdate = true;
        mat.map = tex;
      }
      return mat;
    })();
    // The TTS normal maps are not standard tangent-space maps for most pieces (pawn mean RGB ≈ 70,70,133), so they
    // darken the models; they are imported but not applied.
    materials.set(key, m);
  }
  return m;
}

/** Load a TTS model, scaled so its height is `height` and its base sits on y = 0, centred in x/z. */
export async function loadTtsModel(e: MeshEntry, height: number): Promise<Object3D> {
  const geos = await geometry(e.mesh);
  const g = new Group();
  const mat = await material(e);
  for (const geo of geos) {
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  const box = new Box3().setFromObject(g);
  const size = box.getSize(new Vector3());
  const s = size.y > 0 ? height / size.y : 1;
  const centre = box.getCenter(new Vector3());
  for (const child of g.children) child.position.set(-centre.x, -box.min.y, -centre.z);
  g.scale.setScalar(s);
  g.userData.tts = true;
  return g;
}

/** Collider points of a TTS collider OBJ (for convex hulls in the sandbox), scaled like the visual model. */
export async function colliderPoints(path: string, height: number): Promise<Float32Array | null> {
  try {
    const geos = await geometry(path);
    const pts: number[] = [];
    for (const geo of geos) pts.push(...Array.from(geo.getAttribute('position').array as ArrayLike<number>));
    if (!pts.length) return null;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
      minZ = Math.min(minZ, pts[i + 2]); maxZ = Math.max(maxZ, pts[i + 2]);
    }
    const s = height / (maxY - minY || 1);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const out = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i += 3) {
      out[i] = (pts[i] - cx) * s;
      out[i + 1] = (pts[i + 1] - minY) * s;
      out[i + 2] = (pts[i + 2] - cz) * s;
    }
    return out;
  } catch {
    return null;
  }
}
