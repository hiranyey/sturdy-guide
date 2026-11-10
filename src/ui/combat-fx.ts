// Combat "juice": HP bars that slide with a draining trail, floating numbers
// that scale with the hit, class-flavoured strike marks, crit flashes and
// hit-stop, lunges and dodges, and a proper death for a defeated foe.
// Pure presentation — nothing here touches game state.
import { h, setText } from './dom';
import { reducedMotion } from './prefs';
import type { ClassId } from '../core/types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Motion off (setting or OS): skip flashes and particles, keep timing short. */
export const calm = () =>
  reducedMotion() || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Replay a one-shot CSS animation class, then remove it so idle animations resume. */
export function pulse(el: Element, cls: string, ms = 450) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  const t = Number((el as HTMLElement).dataset[`fx${cls}`] ?? 0);
  if (t) clearTimeout(t);
  (el as HTMLElement).dataset[`fx${cls}`] = String(setTimeout(() => el.classList.remove(cls), ms));
}

/**
 * An HP bar that stays in the DOM so changes animate. Damage: the fill drops at
 * once and a pale trail lingers, then drains after it. Healing: a green trail
 * jumps ahead and the fill grows into it.
 */
export class LiveBar {
  readonly el: HTMLElement;
  private fill = h('div', { class: 'bar-fill' });
  private trail = h('div', { class: 'bar-trail' });
  private label = h('span', { class: 'bar-label' });
  private shown = '';
  private pct = -1;
  private timer = 0;

  constructor(cls: string) {
    this.el = h('div', { class: `bar live ${cls}` }, this.trail, this.fill, this.label);
  }

  set(value: number, max: number, cls: string, label = '') {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    this.el.className = `bar live ${cls}`;
    if (label !== this.shown) setText(this.label, (this.shown = label));
    if (this.pct < 0 || calm()) {
      this.fill.style.width = this.trail.style.width = `${pct}%`;
    } else if (pct < this.pct) {
      clearTimeout(this.timer);
      this.trail.classList.remove('heal');
      this.fill.style.width = `${pct}%`;
      pulse(this.el, 'jolt', 350);
      this.timer = window.setTimeout(() => { this.trail.style.width = `${pct}%`; }, 420);
    } else if (pct > this.pct) {
      clearTimeout(this.timer);
      this.trail.classList.add('heal');
      this.trail.style.transition = 'none';
      this.trail.style.width = `${pct}%`;
      void this.trail.offsetWidth;
      this.trail.style.transition = '';
      this.timer = window.setTimeout(() => { this.fill.style.width = `${pct}%`; }, 120);
    }
    this.pct = pct;
  }
}

export type FloatKind = 'dmg' | 'hurt' | 'heal' | 'miss' | 'status';

/** Kind of floating text from the beat's float string. */
export function floatKind(text: string, onEnemy: boolean): FloatKind {
  if (text.startsWith('-')) return onEnemy ? 'dmg' : 'hurt';
  if (text.startsWith('+')) return 'heal';
  if (/^(miss|dodge)$/i.test(text)) return 'miss';
  return 'status';
}

let floatSeq = 0;
/**
 * Floating text above `host`. `weight` (0–1, share of max HP) grows the number;
 * crits get a gold "CRIT" tag. Several floats in a row fan out instead of stacking.
 */
export function floatText(host: HTMLElement, text: string, kind: FloatKind, opts: { crit?: boolean; weight?: number } = {}) {
  const n = floatSeq++;
  const dx = ((n % 3) - 1) * 16 + (Math.random() * 10 - 5);
  const scale = 1 + Math.min(0.9, (opts.weight ?? 0) * 2.2) + (opts.crit ? 0.35 : 0);
  const f = h('span', {
    class: `float ${kind} ${opts.crit ? 'crit' : ''}`,
    style: `--fx:${dx.toFixed(0)}px;--fs:${scale.toFixed(2)}`,
  }, opts.crit ? h('small', null, 'CRIT') : null, text);
  host.appendChild(f);
  setTimeout(() => f.remove(), opts.crit ? 1300 : 1000);
}

/** Particles flying out of the middle of `host`. */
export function sparks(host: HTMLElement, colors: string[], count = 10, dist = 46) {
  if (calm()) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const d = dist * (0.6 + Math.random() * 0.6);
    const size = 4 + Math.random() * 5;
    const sp = h('span', {
      class: 'fx-spark',
      style: `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;background:${colors[i % colors.length]};color:${colors[i % colors.length]};animation-delay:${(Math.random() * 60).toFixed(0)}ms`,
    });
    host.appendChild(sp);
    setTimeout(() => sp.remove(), 900);
  }
}

export type StrikeStyle = 'slash' | 'stab' | 'fire' | 'note' | 'claw';

/** How each class's blows look on the foe. */
export const STRIKE_FOR: Record<ClassId, StrikeStyle> = { warrior: 'slash', rogue: 'stab', mage: 'fire', bard: 'note' };

let strikeSeq = 0;
function strikeSvg(style: StrikeStyle, crit: boolean): string {
  const id = `stk${strikeSeq++}`;
  const w = crit ? 9 : 6;
  switch (style) {
    case 'slash':
      return `<svg viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#ffd76a"/></linearGradient></defs>`
        + `<path class="stroke" d="M12 22 Q52 40 88 82" stroke="url(#${id})" stroke-width="${w}" fill="none" stroke-linecap="round"/>`
        + (crit ? `<path class="stroke s2" d="M86 18 Q50 44 16 84" stroke="url(#${id})" stroke-width="${w - 2}" fill="none" stroke-linecap="round"/>` : '')
        + '</svg>';
    case 'stab':
      return '<svg viewBox="0 0 100 100">'
        + `<path class="stroke" d="M20 30 L78 62" stroke="#e8f4ff" stroke-width="${w - 2}" stroke-linecap="round"/>`
        + `<path class="stroke s2" d="M24 70 L80 36" stroke="#b6ffd8" stroke-width="${w - 2}" stroke-linecap="round"/>`
        + (crit ? `<path class="stroke s3" d="M50 12 L52 88" stroke="#fff" stroke-width="${w - 3}" stroke-linecap="round"/>` : '')
        + '</svg>';
    case 'fire':
      return `<svg viewBox="0 0 100 100"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#fff6c0"/><stop offset=".35" stop-color="#ffb13b"/><stop offset=".7" stop-color="#ff4d1a" stop-opacity=".8"/><stop offset="1" stop-color="#ff2a00" stop-opacity="0"/></radialGradient></defs>`
        + `<circle class="boom" cx="50" cy="52" r="${crit ? 48 : 38}" fill="url(#${id})"/>`
        + '<circle class="ring" cx="50" cy="52" r="30" fill="none" stroke="#ffd76a" stroke-width="3"/></svg>';
    case 'note':
      return '<svg viewBox="0 0 100 100">'
        + '<circle class="ring" cx="50" cy="50" r="30" fill="none" stroke="#c9a7ff" stroke-width="3"/>'
        + (crit ? '<circle class="ring s2" cx="50" cy="50" r="30" fill="none" stroke="#ffd76a" stroke-width="2"/>' : '')
        + '<text class="nt n1" x="22" y="40">♪</text><text class="nt n2" x="64" y="34">♫</text><text class="nt n3" x="44" y="80">♪</text></svg>';
    case 'claw':
      return '<svg viewBox="0 0 100 100">'
        + [0, 1, 2].map((i) => `<path class="stroke s${i + 1}" d="M${26 + i * 18} 14 Q${36 + i * 18} 50 ${22 + i * 18} 86" stroke="#ff5a5a" stroke-width="${w - 1}" fill="none" stroke-linecap="round"/>`).join('')
        + '</svg>';
  }
}

/** A short-lived strike mark drawn over `host`. */
export function strike(host: HTMLElement, style: StrikeStyle, crit = false) {
  if (calm()) return;
  const el = h('span', { class: `fx-strike ${style} ${crit ? 'crit' : ''}`, 'aria-hidden': 'true', html: strikeSvg(style, crit) });
  host.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

export type FlashKind = 'crit' | 'hurt' | 'slay' | 'down';

/** A full-panel flash (gold for crits, red when you're hurt). Skipped with reduced motion. */
export function flash(panel: HTMLElement, kind: FlashKind) {
  if (calm()) return;
  const el = h('div', { class: `fx-flash ${kind}`, 'aria-hidden': 'true' });
  panel.appendChild(el);
  setTimeout(() => el.remove(), kind === 'down' ? 1400 : 600);
}

/** Freeze-frame on impact: the target glows white for a beat before the hit lands. */
export async function hitStop(el: HTMLElement, ms = 110) {
  el.classList.add('freeze');
  await wait(calm() ? 0 : ms);
  el.classList.remove('freeze');
}

/** The foe's death: freeze, flash, burst into embers and dissolve, then a stamp. */
export async function slay(sprite: HTMLElement, card: HTMLElement, panel: HTMLElement, boss: boolean) {
  await hitStop(sprite, boss ? 260 : 160);
  flash(panel, 'slay');
  sparks(sprite, ['#ffb13b', '#ff6a2a', '#ffd76a', '#9a8f8a'], boss ? 28 : 16, boss ? 90 : 64);
  sprite.classList.add('defeated');
  card.classList.add('slain');
  card.appendChild(h('div', { class: `fx-stamp ${boss ? 'boss' : ''}`, 'aria-hidden': 'true' }, boss ? 'VANQUISHED' : 'DEFEATED'));
  await wait(calm() ? 0 : 450);
}
