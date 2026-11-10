import { sfx } from './audio';
import { hasIcon, iconize } from './art/icons';
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

const PLAIN_ONLY = new Set(['OPTION', 'TEXTAREA', 'TITLE', 'SELECT']);

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    // Emoji used as icons become the game's own drawings (not inside form controls, which only take text).
    else if (typeof c === 'string' && !PLAIN_ONLY.has((el as Element).tagName) && hasIcon(c)) for (const part of iconize(c)) el.appendChild(typeof part === 'string' ? document.createTextNode(part) : part);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** Replace an element's text, drawing any emoji icons in the game's own style. */
export function setText(el: HTMLElement, text: string) {
  el.textContent = '';
  append(el, [text]);
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

  constructor(cls = '', opts: { dismissable?: boolean; label?: string } = {}) {
    this.body = h('div', { class: `sheet-body ${cls}` });
    const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => opts.dismissable && this.close() });
    const grip = h('div', { class: 'sheet-grip', 'aria-hidden': 'true' });
    const panel = h('div', { class: `sheet-panel ${cls.split(/\s+/).filter(Boolean).map((c) => `is-${c}`).join(' ')}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label ?? 'Panel' }, grip, this.body);
    this.root = h('div', { class: 'sheet' }, backdrop, panel);
    this.done = new Promise((r) => (this.resolver = r));
    document.getElementById('overlay')!.appendChild(this.root);
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('open')));
    if (!cls.includes('combat')) sfx.open();
    swipeToDismiss(panel, this.body, () => !!opts.dismissable, () => this.close(), backdrop);
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

/**
 * Drag a sheet down to dismiss it. Starts from the grip, or anywhere when the
 * content is scrolled to the top. Sheets that must be answered rubber-band back.
 */
function swipeToDismiss(panel: HTMLElement, scroller: HTMLElement, canDismiss: () => boolean, dismiss: () => void, backdrop: HTMLElement) {
  let startY = 0, dy = 0, startT = 0, active = false, fromTop = false;
  const begin = (y: number, onGrip: boolean) => {
    startY = y;
    dy = 0;
    startT = performance.now();
    fromTop = onGrip || scroller.scrollTop <= 0;
    active = false;
  };
  const move = (y: number, e: Event) => {
    if (!fromTop) return;
    const d = y - startY;
    if (!active && d > 8) active = true;
    if (!active) return;
    if (e.cancelable) e.preventDefault();
    dy = Math.max(0, d);
    const shown = canDismiss() ? dy : dy * 0.25;
    panel.style.transition = 'none';
    panel.style.transform = `translateY(${shown}px)`;
    backdrop.style.opacity = String(Math.max(0.2, 1 - shown / 500));
  };
  const end = () => {
    if (!active) return;
    active = false;
    const v = dy / Math.max(1, performance.now() - startT);
    panel.style.transition = '';
    backdrop.style.opacity = '';
    if (canDismiss() && (dy > 120 || (dy > 40 && v > 0.6))) {
      panel.style.transform = '';
      dismiss();
    } else panel.style.transform = '';
  };
  panel.addEventListener('touchstart', (e) => begin(e.touches[0].clientY, (e.target as HTMLElement).classList.contains('sheet-grip')), { passive: true });
  panel.addEventListener('touchmove', (e) => move(e.touches[0].clientY, e), { passive: false });
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
  // Mouse / pen: drag by the grip.
  const grip = panel.querySelector('.sheet-grip') as HTMLElement;
  grip.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    begin(e.clientY, true);
    const mv = (ev: PointerEvent) => move(ev.clientY, ev);
    const up = () => { end(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
}

/** Fire `fn` after a press-and-hold; suppresses the click that would follow. */
export function longPress(el: HTMLElement, fn: (x: number, y: number) => void, ms = 450) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    sx = e.clientX;
    sy = e.clientY;
    timer = setTimeout(() => {
      fired = true;
      vibrate(12);
      fn(sx, sy);
    }, ms);
  });
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    if (fired) {
      e.stopImmediatePropagation();
      e.preventDefault();
      fired = false;
    }
  }, true);
}

/** Small floating info bubble anchored near a point; tap anywhere to dismiss. */
export function popover(x: number, y: number, ...children: Child[]) {
  document.querySelectorAll('.popover').forEach((p) => p.remove());
  const el = h('div', { class: 'popover', role: 'tooltip' }, ...children);
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  const left = Math.max(10, Math.min(window.innerWidth - r.width - 10, x - r.width / 2));
  const top = y - r.height - 18 > 10 ? y - r.height - 18 : y + 18;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
    window.removeEventListener('pointerdown', close, true);
  };
  setTimeout(() => window.addEventListener('pointerdown', close, true), 50);
  setTimeout(close, 5000);
  return el;
}

export function modal(cls = ''): { root: HTMLElement; card: HTMLElement; close: () => void } {
  const card = h('div', { class: `modal-card ${cls}`, role: 'dialog', 'aria-modal': 'true' });
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
