// Raycast picking of squares, units, heroes and the Graveyard; click and drag (sandbox) gestures.
import { Object3D, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { Coord, Side } from '../rules/index.ts';
import { fromWorld, toWorld } from './coords.ts';

export type Pick =
  | { kind: 'square'; coord: Coord }
  | { kind: 'unit'; id: string; coord: Coord }
  | { kind: 'graveUnit'; id: string }
  | { kind: 'hero'; id: string; coord: Coord }
  | { kind: 'graveyard'; side: Side };

export interface PickHandlers {
  onClick(pick: Pick): void;
  /** Drag from one pick to another (sandbox drag and drop). */
  onDrag?(from: Pick, to: Pick): void;
}

export class Picker {
  private ray = new Raycaster();

  constructor(private camera: Camera, private canvas: HTMLCanvasElement, private roots: () => Object3D[]) {}

  pickAt(clientX: number, clientY: number): Pick | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.ray.intersectObjects(this.roots(), true);
    // Pieces win over squares so a click on a unit selects it.
    const order = ['unit', 'hero', 'graveUnit', 'square', 'graveyard'];
    const found = hits
      .map((h) => ({ data: h.object.userData as Record<string, any>, point: h.point }))
      .filter((h) => order.includes(h.data.kind))
      .sort((a, b) => order.indexOf(a.data.kind) - order.indexOf(b.data.kind))[0];
    if (!found) return null;
    const d = found.data;
    if (d.kind === 'square') return { kind: 'square', coord: d.coord };
    if (d.kind === 'graveyard') return { kind: 'graveyard', side: d.side };
    if (d.kind === 'graveUnit') return { kind: 'graveUnit', id: d.id };
    const coord = fromWorld(new Vector3(found.point.x, 0, found.point.z));
    return { kind: d.kind, id: d.id, coord } as Pick;
  }

  /** Screen position of a square centre (used by browser tests to click squares). */
  screenOf(c: Coord): { x: number; y: number } {
    const p = toWorld(c, 0).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  /** A click is a press and release that barely moves; a longer move is a drag (or a camera orbit). */
  listen(handlers: PickHandlers, dragEnabled: () => boolean): void {
    let down: { x: number; y: number; pick: Pick | null } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, pick: this.pickAt(e.clientX, e.clientY) };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const start = down;
      down = null;
      if (moved < 6) {
        if (start.pick) handlers.onClick(start.pick);
        return;
      }
      if (dragEnabled() && handlers.onDrag && start.pick && (start.pick.kind === 'unit' || start.pick.kind === 'hero' || start.pick.kind === 'graveUnit')) {
        const end = this.pickAt(e.clientX, e.clientY);
        if (end) handlers.onDrag(start.pick, end);
      }
    });
  }
}
