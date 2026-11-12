// Highlights for selectable units, legal move squares, Lead destinations (Battle marked) and decision squares
// (FR-111, US7-AS1). 006: the Move reach ("pass only" squares lighter) and the planned path with step numbers (B-16),
// ability target picks (B-02), squares blocked for a rule reason (FR-025, FR-026), the Range outline (B-20).
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Sprite, SpriteMaterial } from 'three';
import type { Highlights } from '../game/hud-model.ts';
import type { Coord } from '../rules/index.ts';
import { SQUARE, toWorld } from './coords.ts';
import type { PiecesView } from './pieces.ts';

const COLORS = {
  move: '#4caf50', pass: '#a5d6a7', path: '#ffb300', lead: '#29b6f6', battle: '#ef5350', decision: '#ffd54f', place: '#ba68c8',
  target: '#26c6da', blocked: '#616161', range: '#90caf9',
};
export type HighlightKind = keyof typeof COLORS;

/** Extra squares to draw on top of the model's highlights (decisions, targets, blocked targets, sandbox placement). */
export interface Overlay {
  coords: Coord[];
  kind: HighlightKind;
}

export class HighlightView {
  readonly group = new Group();
  private plane = new PlaneGeometry(0.9 * SQUARE, 0.9 * SQUARE);
  private outline = new RingGeometry(0.42 * SQUARE, 0.47 * SQUARE, 4, 1, Math.PI / 4);
  private ring = new RingGeometry(0.3, 0.38, 32);
  private mats = Object.fromEntries(
    Object.entries(COLORS).map(([k, c]) => [k, new MeshBasicMaterial({ color: c, transparent: true, opacity: k === 'pass' ? 0.35 : 0.55, depthWrite: false })]),
  ) as Record<HighlightKind, MeshBasicMaterial>;
  private selectMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  private selectedMat = new MeshBasicMaterial({ color: '#ffd54f', depthWrite: false });
  private numbers = new Map<number, SpriteMaterial>();
  /** Squares currently highlighted, for tests and picking hints. */
  current: { kind: string; coord: Coord }[] = [];

  private numberMaterial(n: number): SpriteMaterial {
    let m = this.numbers.get(n);
    if (!m) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(0,0,0,.65)';
      g.beginPath();
      g.arc(32, 32, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = 'bold 36px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), 32, 34);
      m = new SpriteMaterial({ map: new CanvasTexture(c), depthWrite: false, depthTest: false });
      this.numbers.set(n, m);
    }
    return m;
  }

  show(h: Highlights, selectedUnitId: string | null, pieces: PiecesView, extra: Overlay[] = [], plan: Coord[] = []): void {
    this.group.clear();
    this.current = [];
    const square = (c: Coord, kind: HighlightKind) => {
      const m = new Mesh(kind === 'range' ? this.outline : this.plane, this.mats[kind]);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(toWorld(c, kind === 'range' ? 0.01 : 0.012));
      m.renderOrder = 2;
      this.group.add(m);
      this.current.push({ kind, coord: c });
    };
    const onPlan = (c: Coord) => plan.some((p) => p.x === c.x && p.y === c.y);
    if (h.reach.length) h.reach.forEach((r) => { if (!onPlan(r.to)) square(r.to, r.canEnd ? 'move' : 'pass'); });
    else h.moves.forEach((c) => square(c, 'move'));
    (h.range ?? []).forEach((c) => square(c, 'range'));
    h.leads.forEach((l) => square(l.to, l.isBattle ? 'battle' : 'lead'));
    h.blocked.forEach((b) => square(b.to, 'blocked'));
    h.decision.forEach((c) => square(c, 'decision'));
    for (const o of extra) o.coords.forEach((c) => square(c, o.kind));
    plan.forEach((c, i) => {
      square(c, 'path');
      const s = new Sprite(this.numberMaterial(i + 1));
      s.position.copy(toWorld(c, 0.35));
      s.scale.set(0.45 * SQUARE, 0.45 * SQUARE, 1);
      s.renderOrder = 4;
      this.group.add(s);
    });
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
