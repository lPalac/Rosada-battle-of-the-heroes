// Renderer, lights and the render-on-demand loop (research R-14).
import {
  ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';

export interface TableScene {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** Ask for a frame; animations call this every frame while they run. */
  requestRender(): void;
  /** Called before each rendered frame (animations). Return true to keep rendering. */
  onFrame(fn: (dt: number) => boolean): void;
  frames: number;
}

export function createScene(canvas: HTMLCanvasElement): TableScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.background = new Color('#1d2127');
  const camera = new PerspectiveCamera(45, 1, 0.1, 200);

  scene.add(new AmbientLight('#ffffff', 0.9));
  const sun = new DirectionalLight('#fff3e0', 2.0);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
  scene.add(sun);

  const table = new Mesh(new PlaneGeometry(40, 28), new MeshStandardMaterial({ color: '#5b3a24', roughness: 0.9 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.06;
  table.receiveShadow = true;
  scene.add(table);

  const frameFns: ((dt: number) => boolean)[] = [];
  let pending = false;
  let last = performance.now();
  const ts: TableScene = {
    renderer, scene, camera, frames: 0,
    requestRender() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(loop);
    },
    onFrame(fn) {
      frameFns.push(fn);
      ts.requestRender();
    },
  };

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    }
  }

  function loop(now: number): void {
    pending = false;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    resize();
    let again = false;
    for (let i = frameFns.length - 1; i >= 0; i--) {
      if (frameFns[i](dt)) again = true;
      else frameFns.splice(i, 1);
    }
    renderer.render(scene, camera);
    ts.frames++;
    if (again) ts.requestRender();
  }

  window.addEventListener('resize', () => ts.requestRender());
  ts.requestRender();
  return ts;
}
