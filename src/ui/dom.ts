type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Typewriter that can be skipped by tapping the element. */
export function typewrite(el: HTMLElement, text: string, speed = 2): Promise<void> {
  return new Promise((resolve) => {
    el.textContent = '';
    let i = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.textContent = text;
      el.removeEventListener('click', finish);
      resolve();
    };
    el.addEventListener('click', finish);
    const step = () => {
      if (done) return;
      i += speed;
      el.textContent = text.slice(0, i);
      if (i >= text.length) finish();
      else requestAnimationFrame(step);
    };
    if (speed >= 50) finish();
    else requestAnimationFrame(step);
  });
}

let toastHost: HTMLElement | null = null;
export function toast(text: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info', ms = 2600) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts' });
    document.body.appendChild(toastHost);
  }
  const t = h('div', { class: `toast toast-${kind}` }, text);
  toastHost.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

/** Bottom sheet that resolves when closed. */
export class Sheet {
  root: HTMLElement;
  body: HTMLElement;
  private closed = false;
  private resolver: (() => void) | null = null;
  readonly done: Promise<void>;

  constructor(cls = '', opts: { dismissable?: boolean } = {}) {
    this.body = h('div', { class: `sheet-body ${cls}` });
    const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => opts.dismissable && this.close() });
    this.root = h('div', { class: 'sheet' }, backdrop, h('div', { class: 'sheet-panel' }, h('div', { class: 'sheet-grip' }), this.body));
    this.done = new Promise((r) => (this.resolver = r));
    document.getElementById('overlay')!.appendChild(this.root);
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('open')));
  }

  set(...children: Child[]) {
    this.body.innerHTML = '';
    append(this.body, children);
    this.body.scrollTop = 0;
  }

  add(...children: Child[]) {
    append(this.body, children);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.root.classList.remove('open');
    setTimeout(() => this.root.remove(), 320);
    this.resolver?.();
  }
}

export function modal(cls = ''): { root: HTMLElement; card: HTMLElement; close: () => void } {
  const card = h('div', { class: `modal-card ${cls}` });
  const root = h('div', { class: 'modal' }, card);
  document.getElementById('overlay')!.appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
  return {
    root, card,
    close: () => {
      root.classList.remove('open');
      setTimeout(() => root.remove(), 300);
    },
  };
}

export function bar(value: number, max: number, cls: string, label?: string) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'bar-fill', style: `width:${pct}%` }), label ? h('span', { class: 'bar-label' }, label) : null);
}
