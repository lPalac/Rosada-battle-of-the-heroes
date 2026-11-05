// The Graveyard / Destiny Well strip beside the board (003 US7-AS1, `strip.graveyard`): one illustrated card under the
// Graveyard zones and the Well, like the Tabletop Simulator table.
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { assetEntry, loadImageTexture } from './assets.ts';
import { canvasTexture, parchment, rng } from './canvas.ts';
import { SQUARE, ZONES } from './coords.ts';

export function createStrip(): Mesh {
  assetEntry('strip.graveyard'); // key must exist (FR-041); a texture image would replace the drawing
  const w = 3.6 * SQUARE;
  const d = 9.6 * SQUARE;
  const tex = canvasTexture(384, 1024, (g, cw, ch) => {
    parchment(g, cw, ch, 21);
    const r = rng(9);
    // Destiny Well swirl in the middle.
    const cx = cw / 2;
    const cy = ch / 2;
    for (let i = 0; i < 180; i++) {
      const a = i * 0.21;
      const rr = 6 + i * 0.75;
      g.fillStyle = `rgba(${40 + i},${90 + i * 0.6},${150 + i * 0.4},${0.5 - i / 400})`;
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, 4 + r() * 4, 0, Math.PI * 2);
      g.fill();
    }
    // Graveyards: dark earth with headstones at both ends.
    for (const top of [true, false]) {
      const y0 = top ? 30 : ch - 330;
      g.fillStyle = 'rgba(40,36,32,.85)';
      g.fillRect(20, y0, cw - 40, 300);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(150,150,145,.7)';
        const x = 40 + (i % 3) * 110;
        const y = y0 + 40 + Math.floor(i / 3) * 130;
        g.beginPath();
        g.moveTo(x, y + 70);
        g.lineTo(x, y + 20);
        g.arc(x + 25, y + 20, 25, Math.PI, 0);
        g.lineTo(x + 50, y + 70);
        g.closePath();
        g.fill();
      }
    }
    g.fillStyle = '#3b2a18';
    g.font = 'bold 34px serif';
    g.textAlign = 'center';
    g.fillText('Destiny Well', cx, cy + 190);
    g.strokeStyle = '#5a4026';
    g.lineWidth = 8;
    g.strokeRect(6, 6, cw - 12, ch - 12);
  });
  const strip = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(ZONES.well.x, -0.095, ZONES.well.z);
  strip.receiveShadow = true;
  strip.userData = { kind: 'strip' };
  // 004 US6-AS3: the TTS Graveyard / Destiny Well board (landscape art, turned to run along the strip).
  loadImageTexture('tts.graveyard', (img) => {
    img.center.set(0.5, 0.5);
    img.rotation = Math.PI / 2;
    (strip.material as MeshStandardMaterial).map = img;
    (strip.material as MeshStandardMaterial).needsUpdate = true;
    strip.userData.tts = true;
  });
  return strip;
}
