// Highlights for selectable units, legal move squares, Lead destinations (Battle marked) and decision squares
// (FR-111, US7-AS1).
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry } from 'three';
import type { Highlights } from '../game/hud-model.ts';
import type { Coord } from '../rules/index.ts';
import { toWorld } from './coords.ts';
import type { PiecesView } from './pieces.ts';

const COLORS = { move: '#4caf50', lead: '#29b6f6', battle: '#ef5350', decision: '#ffd54f', place: '#ba68c8' };

export class HighlightView {
  readonly group = new Group();
  private plane = new PlaneGeometry(0.9, 0.9);
  private ring = new RingGeometry(0.3, 0.38, 32);
  private mats = Object.fromEntries(
    Object.entries(COLORS).map(([k, c]) => [k, new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false })]),
  ) as Record<keyof typeof COLORS, MeshBasicMaterial>;
  private selectMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  private selectedMat = new MeshBasicMaterial({ color: '#ffd54f', depthWrite: false });
  /** Squares currently highlighted, for tests and picking hints. */
  current: { kind: string; coord: Coord }[] = [];

  show(h: Highlights, selectedUnitId: string | null, pieces: PiecesView, extra: { coords: Coord[]; kind: 'place' | 'decision' } | null = null): void {
    this.group.clear();
    this.current = [];
    const square = (c: Coord, kind: keyof typeof COLORS) => {
      const m = new Mesh(this.plane, this.mats[kind]);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(toWorld(c, 0.012));
      m.renderOrder = 2;
      this.group.add(m);
      this.current.push({ kind, coord: c });
    };
    h.moves.forEach((c) => square(c, 'move'));
    h.leads.forEach((l) => square(l.to, l.isBattle ? 'battle' : 'lead'));
    h.decision.forEach((c) => square(c, 'decision'));
    extra?.coords.forEach((c) => square(c, extra.kind));
    for (const id of h.selectable) {
      const obj = pieces.unitObject(id);
      if (!obj) continue;
      const r = new Mesh(this.ring, id === selectedUnitId ? this.selectedMat : this.selectMat);
      r.rotation.x = -Math.PI / 2;
      r.position.copy(obj.position).setY(0.015);
      r.renderOrder = 3;
      this.group.add(r);
    }
  }
}
