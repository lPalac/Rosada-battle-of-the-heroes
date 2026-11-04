// Canvas-drawn textures for placeholder table art (003 research R-09). Drawn once, or again only when data changes.
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/** Small deterministic noise so procedural textures look the same every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function woodGrain(g: CanvasRenderingContext2D, w: number, h: number, base: string, seed = 7): void {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const y = r() * h;
    g.strokeStyle = `rgba(${r() < 0.5 ? '40,22,10' : '120,80,45'},${0.08 + r() * 0.14})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += w / 12) g.lineTo(x, y + Math.sin(x / (40 + r() * 80) + i) * (3 + r() * 6));
    g.stroke();
  }
  // Planks
  g.strokeStyle = 'rgba(20,10,4,.55)';
  g.lineWidth = 3;
  for (let y = 0; y < h; y += h / 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
}

export function parchment(g: CanvasRenderingContext2D, w: number, h: number, seed = 3): void {
  const r = rng(seed);
  const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, '#efe1bf');
  grad.addColorStop(1, '#c9ad7a');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(110,80,40,${r() * 0.06})`;
    g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
  }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Draw `img` (or one column of it) into a box, covering it. */
export function drawCover(
  g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, column = 0, columns = 1,
): void {
  const sw = img.width / columns;
  const sh = img.height;
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  const sx = column * sw + (sw - cw) / 2;
  const sy = Math.max(0, (sh - ch) * 0.2);
  g.drawImage(img, sx, sy, cw, ch, x, y, w, h);
}
