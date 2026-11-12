// 006 US6 (FR-035, FR-039, research R-10): the flash layer. A flash appears, stays 1 s, then moves to the log panel and
// fades (about 0.4 s); flashes start 120 ms apart, at most 4 are visible and the rest wait. With reduced motion a flash
// only fades; e2e builds take no animation time. The "CHECK" notice is drawn above the checked King instead, follows it
// every frame, blinks three times (steady for three seconds with reduced motion) and takes no clicks.
import type { Flash } from '../../game/flash-model.ts';
import type { Side } from '../../rules/index.ts';
import { el } from '../dom.ts';

export interface FlashLayerOptions {
  /** e2e builds: no animation time (flashes are still recorded for the test hook). */
  instant: boolean;
  /** Where flashes travel to: the log panel's rectangle, if shown. */
  logRect: () => DOMRect | null;
  /** The checked King's square centre on screen, or null when that King is not on the board. */
  kingScreen: (side: Side) => { x: number; y: number } | null;
}

const STAY_MS = 1000;
const LEAVE_MS = 400;
const GAP_MS = 120;
const MAX_VISIBLE = 4;
const CHECK_MS = 3000;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class FlashLayer {
  readonly root = el('div', { class: 'flash-layer', 'aria-live': 'polite' });
  private readonly list = el('div', { class: 'flash-list' });
  private queue: Flash[] = [];
  private visible = 0;
  private nextStart = 0;
  private pumping = false;
  /** Every flash shown so far (newest last), for the test hook. */
  private readonly history: Flash[] = [];
  private readonly checks = new Map<Side, { node: HTMLElement; until: number; frame: number }>();

  constructor(private readonly o: FlashLayerOptions) {
    this.root.append(this.list);
  }

  push(flashes: Flash[]): void {
    for (const f of flashes) {
      this.history.push(f);
      if (this.history.length > 200) this.history.shift();
      if (f.kind === 'check') this.showCheck(f);
      else this.queue.push(f);
    }
    this.pump();
  }

  shown(): { kind: string; text: string; tone: string }[] {
    return this.history.map((f) => ({ kind: f.kind, text: f.text, tone: f.tone }));
  }

  /** A new game: drop what is waiting and the CHECK notices. */
  clear(): void {
    this.queue = [];
    this.list.replaceChildren();
    this.visible = 0;
    for (const side of [...this.checks.keys()]) this.endCheck(side);
    this.history.length = 0;
  }

  private pump(): void {
    if (this.pumping) return;
    while (this.queue.length && this.visible < MAX_VISIBLE) {
      const wait = Math.max(0, this.nextStart - performance.now());
      if (wait > 0 && !this.o.instant) {
        this.pumping = true;
        setTimeout(() => {
          this.pumping = false;
          this.pump();
        }, wait);
        return;
      }
      this.start(this.queue.shift()!);
      this.nextStart = performance.now() + (this.o.instant ? 0 : GAP_MS);
    }
  }

  private start(f: Flash): void {
    const node = el('div', { class: `flash tone-${f.tone}${f.side ? ` side-${f.side}` : ''}`, 'data-testid': 'flash', 'data-kind': f.kind }, f.text);
    this.list.append(node);
    this.visible++;
    const done = (): void => {
      node.remove();
      this.visible--;
      this.pump();
    };
    if (this.o.instant) {
      setTimeout(done, 0);
      return;
    }
    setTimeout(() => {
      const target = this.o.logRect();
      if (target && !reducedMotion()) {
        const r = node.getBoundingClientRect();
        const dx = target.left + target.width / 2 - (r.left + r.width / 2);
        const dy = target.top + 24 - (r.top + r.height / 2);
        node.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`;
      }
      node.classList.add('leaving');
      setTimeout(done, LEAVE_MS);
    }, STAY_MS);
  }

  private showCheck(f: Flash): void {
    const side = f.side;
    if (!side) return;
    // A new check on the same King restarts the notice.
    this.endCheck(side);
    const node = el('div', { class: `check-flash side-${side}${reducedMotion() ? ' steady' : ''}`, 'data-testid': 'check-flash', 'data-side': side }, f.text);
    this.root.append(node);
    const entry = { node, until: performance.now() + CHECK_MS, frame: 0 };
    this.checks.set(side, entry);
    const place = (): void => {
      if (performance.now() >= entry.until) {
        this.endCheck(side);
        return;
      }
      const p = this.o.kingScreen(side);
      node.style.visibility = p ? 'visible' : 'hidden';
      if (p) {
        node.style.left = `${p.x}px`;
        node.style.top = `${p.y}px`;
      }
      entry.frame = requestAnimationFrame(place);
    };
    place();
  }

  private endCheck(side: Side): void {
    const c = this.checks.get(side);
    if (!c) return;
    cancelAnimationFrame(c.frame);
    c.node.remove();
    this.checks.delete(side);
  }
}
