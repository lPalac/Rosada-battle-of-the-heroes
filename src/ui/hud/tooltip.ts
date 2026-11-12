// 006 FR-026 (research R-20): a small tooltip at the pointer that says why a square or target is blocked.
import { el } from '../dom.ts';

export class BoardTooltip {
  readonly root = el('div', { class: 'board-tooltip', 'data-testid': 'board-tooltip', role: 'tooltip', style: 'display:none' });
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.body.append(this.root);
  }

  show(text: string, x: number, y: number, ms = 0): void {
    if (this.timer) clearTimeout(this.timer);
    this.root.textContent = text;
    this.root.style.display = 'block';
    this.root.style.left = `${Math.round(x + 14)}px`;
    this.root.style.top = `${Math.round(y + 14)}px`;
    if (ms > 0) this.timer = setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.root.style.display = 'none';
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }
}
