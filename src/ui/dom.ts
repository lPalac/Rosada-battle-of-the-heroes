// Tiny DOM helpers for the HUD (no UI framework, research R-03).
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') node.className = String(v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function mount(parent: HTMLElement, ...children: Child[]): void {
  parent.replaceChildren();
  for (const c of children) if (c !== null && c !== undefined && c !== false) parent.append(typeof c === 'object' ? c : String(c));
}

export function button(label: string, onClick: () => void, opts: { testid?: string; disabled?: boolean; kind?: string; title?: string } = {}): HTMLButtonElement {
  return el('button', {
    class: `btn ${opts.kind ?? ''}`.trim(), onclick: () => onClick(), disabled: opts.disabled, 'data-testid': opts.testid, title: opts.title,
  }, label);
}
