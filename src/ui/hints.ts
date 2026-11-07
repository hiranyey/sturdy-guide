// One-time tips for a first journey: a small bubble over the map, shown once per
// device, one at a time. Tap it (or wait) to dismiss.
import { h } from './dom';

const KEY = 'hexbound.hints';

export type HintId = 'walk' | 'beacon' | 'torches' | 'inspect' | 'growth' | 'weather';

let seen: Record<string, 1> = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, 1>; } catch { return {}; }
})();
const queue: { id: HintId; text: string; at: 'top' | 'bottom' }[] = [];
let showing: HTMLElement | null = null;

const remember = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* private mode */ } };

/** Has this tip been shown on this device? */
export const hintSeen = (id: HintId) => !!seen[id];

/** Show a tip once ever (per device). `at` places it under the HUD or above the dock. */
export function hint(id: HintId, text: string, at: 'top' | 'bottom' = 'bottom') {
  if (seen[id] || queue.some((q) => q.id === id)) return;
  seen[id] = 1;
  remember();
  queue.push({ id, text, at });
  if (!showing) next();
}

/** Close the current tip (e.g. the hero did what it said). */
export function dismissHint(id?: HintId) {
  if (!showing || (id && showing.dataset.id !== id)) return;
  const el = showing;
  showing = null;
  el.classList.remove('show');
  setTimeout(() => { el.remove(); next(); }, 260);
}

/** Forget every tip (Settings → "Show tips again"). */
export function resetHints() {
  seen = {};
  remember();
}

function next() {
  const q = queue.shift();
  if (!q) return;
  const el = h('div', { class: `hint-bubble at-${q.at}`, role: 'status', 'data-id': q.id, onclick: () => dismissHint() },
    h('span', { class: 'hint-ico' }, '💡'), h('span', { class: 'hint-text' }, q.text), h('span', { class: 'hint-ok' }, 'Got it'));
  document.body.appendChild(el);
  showing = el;
  requestAnimationFrame(() => el.classList.add('show'));
  const id = q.id;
  setTimeout(() => { if (showing?.dataset.id === id) dismissHint(id); }, 9000);
}
