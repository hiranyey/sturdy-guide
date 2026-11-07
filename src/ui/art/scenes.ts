// Procedural storybook scene banners for event cards (and a dim landscape behind combat).
// Flat-vector layered silhouettes with atmospheric perspective. Pure string output, no DOM.
import type { Biome, PoiKind } from '../../core/types';
import { hashString, mulberry32 } from '../../core/rng';

type Rand = () => number;
export type SceneTime = 'day' | 'dusk' | 'night';
export type ScenePoi = PoiKind | 'wild' | 'quest';
export interface SceneOptions {
  biome: Biome;
  poi?: ScenePoi;
  landmark?: string;
  seed: number;
  time?: SceneTime;
  omen?: string;
}

const W = 360, H = 140;
let counter = 0;

// ---------- numbers & colours ----------
/** Coordinate precision: whole pixels for landscape, tenths while painting the small subjects. */
let P = 1;
const f = (n: number): string => String(Math.round(n * P) / P);
const op = (a: number): string => ` opacity="${Math.round(a * 100) / 100}"`;

function rgb(c: string): number[] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------- svg primitives ----------
function pd(a: number[]): string {
  let s = '';
  for (let i = 0; i < a.length; i += 2) s += (i ? 'L' : 'M') + f(a[i]) + ' ' + f(a[i + 1]);
  return s;
}
const poly = (a: number[], fill: string, ex = ''): string => `<path d="${pd(a)}Z" fill="${fill}"${ex}/>`;
const pth = (d: string, fill: string, ex = ''): string => `<path d="${d}" fill="${fill}"${ex}/>`;
const circ = (x: number, y: number, r: number, fill: string, ex = ''): string =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${ex}/>`;
const ell = (x: number, y: number, rx: number, ry: number, fill: string, ex = ''): string =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${ex}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, ex = ''): string =>
  `<path d="M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z" fill="${fill}"${ex}/>`;
const sd = (d: string, col: string, w: number, ex = ''): string =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${Math.round(w * 10) / 10}" stroke-linecap="round"${ex}/>`;
const line = (a: number[], col: string, w: number, ex = ''): string => sd(pd(a), col, w, ex);
function dots(a: number[], col: string, w: number, ex = ''): string {
  if (!a.length) return '';
  let d = '';
  for (let i = 0; i < a.length; i += 2) d += `M${f(a[i])} ${f(a[i + 1])}h0`;
  return `<path d="${d}" stroke="${col}" stroke-width="${Math.round(w * 10) / 10}" stroke-linecap="round"${ex}/>`;
}
const g = (x: number, y: number, k: number, body: string): string =>
  `<g transform="translate(${f(x)} ${f(y)})${k !== 1 ? ` scale(${Math.round(k * 100) / 100})` : ''}">${body}</g>`;
/** Dark storybook outline for foreground subjects. */
const OL = ' stroke="#2a2233" stroke-width=".7"';
/** Circle as path data, so many circles of one colour share a single <path>. */
const cd = (x: number, y: number, r: number): string =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
/** Bottom edge for ground fills; the land layer is lifted, so fills run past the frame. */
const BOT = H + 14;

// ---------- time of day ----------
interface TimeDef { sky: string[]; haze: string; tint: string; ta: number; glow: number }
const TIMES: Record<SceneTime, TimeDef> = {
  day: { sky: ['#5b98d4', '#9ccbea', '#e6f1ee'], haze: '#c6deea', tint: '#000000', ta: 0, glow: 0.25 },
  dusk: { sky: ['#2c3270', '#a65e7e', '#f3b06a'], haze: '#d4968c', tint: '#4a2a55', ta: 0.24, glow: 0.6 },
  night: { sky: ['#060a20', '#141d48', '#2e3a6a'], haze: '#2a3864', tint: '#0e1636', ta: 0.5, glow: 0.9 },
};

class Scene {
  out: string[] = [];
  defs: string[] = [];
  busy: number[][] = [];
  snowy = false;
  private n = 0;
  private glows = new Map<string, string>();
  readonly p: string;
  readonly t: TimeDef;
  readonly time: SceneTime;
  readonly dark: number;
  readonly haze: string;
  constructor(p: string, t: TimeDef, time: SceneTime, dark: number, haze: string) {
    this.p = p; this.t = t; this.time = time; this.dark = dark; this.haze = haze;
  }
  /** Colour with atmospheric perspective (far 0..1) and time-of-day tint applied. */
  c(col: string, far = 0): string {
    let x = mix(col, this.haze, far);
    x = mix(x, this.t.tint, this.t.ta * (1 - far * 0.6));
    return this.dark ? mix(x, '#0f1222', this.dark) : x;
  }
  add(...s: string[]): void { this.out.push(...s); }
  grad(kind: string, attrs: string, stops: Array<[string, number, number?]>): string {
    const id = this.p + (this.n++).toString(36);
    const st = stops.map(([c, o, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');
    this.defs.push(`<${kind} id="${id}"${attrs}>${st}</${kind}>`);
    return `url(#${id})`;
  }
  lin(stops: Array<[string, number, number?]>, horiz = false): string {
    return this.grad('linearGradient', horiz ? '' : ' x2="0" y2="1"', stops);
  }
  /** Soft radial glow fill (cached per colour). */
  glow(col: string): string {
    let u = this.glows.get(col);
    if (!u) {
      u = this.grad('radialGradient', '', [[col, 0, 1], [col, 0.35, 0.45], [col, 1, 0]]);
      this.glows.set(col, u);
    }
    return u;
  }
  halo(x: number, y: number, r: number, col: string, a: number): string {
    return circ(x, y, r, this.glow(col), op(a));
  }
  free(x: number, pad = 0): boolean {
    return this.busy.every(([a, b]) => x < a - pad || x > b + pad);
  }
}

// ---------- terrain helpers ----------
function smoothRidge(r: Rand, y0: number, amp: number, freq: number, n = 16): number[] {
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -20 + (400 * i) / n;
    const v = 0.55 * Math.sin(x * freq + p1) + 0.3 * Math.sin(x * freq * 2.3 + p2) + 0.15 * Math.sin(x * freq * 5.1 + p3);
    out.push(x, y0 - amp * (0.5 + 0.5 * v));
  }
  return out;
}
function smoothD(p: number[], bottom = BOT): string {
  const n = p.length;
  let d = `M${f(p[0])} ${bottom}L${f(p[0])} ${f(p[1])}`;
  for (let i = 2; i < n - 2; i += 2) d += `Q${f(p[i])} ${f(p[i + 1])} ${f((p[i] + p[i + 2]) / 2)} ${f((p[i + 1] + p[i + 3]) / 2)}`;
  return d + `L${f(p[n - 2])} ${f(p[n - 1])}L${f(p[n - 2])} ${bottom}Z`;
}
function craggy(r: Rand, y0: number, amp: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -20 + (400 * i) / n + (i && i < n ? (r() - 0.5) * (240 / n) : 0);
    out.push(x, y0 - amp * (i % 2 ? 0.25 + 0.35 * r() : 0.65 + 0.35 * r()));
  }
  return out.concat([380, BOT, -20, BOT]);
}
function yAt(p: number[], x: number): number {
  for (let i = 0; i < p.length - 2; i += 2) {
    if (x >= p[i] && x <= p[i + 2]) return p[i + 1] + ((p[i + 3] - p[i + 1]) * (x - p[i])) / (p[i + 2] - p[i]);
  }
  return p[1];
}
function peak(s: Scene, x: number, base: number, w: number, h: number, far: number, dark: string, light: string, cap: string | null): string {
  let o = poly([x - w, base, x, base - h, x + w, base], s.c(dark, far)) +
    poly([x - w, base, x, base - h, x + w * 0.1, base, x - w * 0.15, base - h * 0.4], s.c(light, far));
  if (cap) {
    const y = base - h;
    o += poly([x - w * 0.34, y + h * 0.34, x, y, x + w * 0.34, y + h * 0.34, x + w * 0.16, y + h * 0.28, x + w * 0.02, y + h * 0.4, x - w * 0.14, y + h * 0.26], s.c(cap, far));
  }
  return o;
}
function cloud(x: number, y: number, w: number, r: Rand): string {
  const n = 3 + Math.floor(r() * 2);
  const wt: number[] = [];
  for (let i = 0; i < n; i++) wt.push((i === 0 || i === n - 1 ? 0.7 : 1.3) + r() * 0.5);
  const sum = wt.reduce((a, b) => a + b, 0);
  let d = `M${f(x)} ${f(y)}`, cx = x;
  for (const k of wt) {
    const seg = (w * k) / sum;
    cx += seg;
    d += `A${f(seg / 2)} ${f(seg / 2)} 0 0 1 ${f(cx)} ${f(y)}`;
  }
  return d + 'Z';
}

// ---------- flora & rocks ----------
/** One or more pines (x,y,h triples) merged into a few paths. */
function pines(s: Scene, list: number[], far: number, snow = false): string {
  let dk = '', lt = '', sn = '', tr = '';
  for (let k = 0; k < list.length; k += 3) {
    const x = list[k], y = list[k + 1], h = list[k + 2];
    tr += pd([x - h * 0.04, y + 0.5, x - h * 0.04, y - h * 0.15, x + h * 0.04, y - h * 0.15, x + h * 0.04, y + 0.5]) + 'Z';
    for (let i = 0; i < 3; i++) {
      const yb = y - h * (0.1 + i * 0.22), yt = y - h * (0.56 + i * 0.22), w = h * (0.3 - i * 0.065);
      dk += pd([x - w, yb, x, yt, x + w, yb]) + 'Z';
      lt += pd([x - w, yb, x, yt, x, yb]) + 'Z';
      if (snow) {
        const m = yt + (yb - yt) * 0.5;
        sn += pd([x - w * 0.5, m, x, yt, x + w * 0.5, m, x + w * 0.2, m - 1, x - w * 0.15, m + 1]) + 'Z';
      }
    }
  }
  return pth(tr, s.c('#5a3b22', far)) + pth(dk, s.c('#2d6a35', far)) + pth(lt, s.c('#3f8a46', far)) + (sn ? pth(sn, s.c('#eef4fb', far)) : '');
}
const pine = (s: Scene, x: number, y: number, h: number, far: number, snow = false): string => pines(s, [x, y, h], far, snow);
const LEAF = ['#2f6b2f', '#4c9a43', '#6fb456'];
function broad(s: Scene, x: number, y: number, h: number, far: number, pal = LEAF): string {
  const [a, b, c] = pal.map((v) => s.c(v, far));
  return rect(x - h * 0.045, y - h * 0.42, h * 0.09, h * 0.43, s.c('#5a3b22', far)) +
    pth(cd(x, y - h * 0.64, h * 0.3) + cd(x - h * 0.19, y - h * 0.5, h * 0.19) + cd(x + h * 0.19, y - h * 0.48, h * 0.18), a) +
    pth(cd(x - h * 0.08, y - h * 0.7, h * 0.2) + cd(x - h * 0.2, y - h * 0.55, h * 0.1), b) + pth(cd(x - h * 0.15, y - h * 0.78, h * 0.09), c);
}
/** Small distant round trees, all merged. */
function farTrees(s: Scene, list: number[], far: number): string {
  let tr = '', a = '', b = '';
  for (let i = 0; i < list.length; i += 3) {
    const x = list[i], y = list[i + 1], h = list[i + 2];
    tr += `M${f(x)} ${f(y)}v${f(-h * 0.5)}`;
    a += cd(x, y - h * 0.62, h * 0.3) + cd(x + h * 0.16, y - h * 0.45, h * 0.18);
    b += cd(x - h * 0.08, y - h * 0.68, h * 0.18);
  }
  return sd(tr, s.c('#5a3b22', far), 1) + pth(a, s.c(LEAF[0], far)) + pth(b, s.c(LEAF[1], far));
}
/** Bare dead trees: list of x,y,h,dir quads, merged into a trunk path and a branch path. */
function deadTrees(s: Scene, list: number[], far: number): string {
  let tr = '', br = '', hs = 0;
  for (let i = 0; i < list.length; i += 4) {
    const x = list[i], y = list[i + 1], h = list[i + 2], m = list[i + 3];
    hs += h;
    tr += pd([x, y, x + m * h * 0.05, y - h * 0.5, x - m * h * 0.02, y - h]);
    br += pd([x + m * h * 0.04, y - h * 0.45, x + m * h * 0.3, y - h * 0.7, x + m * h * 0.4, y - h * 0.68]) + pd([x, y - h * 0.72, x - m * h * 0.26, y - h * 0.9]) +
      pd([x - m * h * 0.13, y - h * 0.81, x - m * h * 0.14, y - h * 0.95]);
  }
  const col = s.c('#4a4238', far), avg = hs / (list.length / 4);
  return sd(tr, col, Math.max(1, avg * 0.06)) + sd(br, col, Math.max(0.8, avg * 0.03));
}
function palm(s: Scene, x: number, y: number, h: number, m: number): string {
  const tx = x + m * h * 0.2, ty = y - h;
  let o = sd(`M${f(x)} ${f(y)}Q${f(x - m * h * 0.04)} ${f(y - h * 0.6)} ${f(tx)} ${f(ty)}`, s.c('#8a6236'), h * 0.06);
  [-3.0, -2.3, -1.6, -0.9, -0.2].forEach((a, i) => {
    const ex = tx + Math.cos(a) * h * 0.46, ey = ty + Math.sin(a) * h * 0.16 + h * 0.2;
    const qx = tx + Math.cos(a) * h * 0.26, qy = ty + Math.sin(a) * h * 0.3 - h * 0.06;
    o += pth(`M${f(tx)} ${f(ty)}Q${f(qx)} ${f(qy - h * 0.05)} ${f(ex)} ${f(ey)}Q${f(qx)} ${f(qy + h * 0.06)} ${f(tx)} ${f(ty)}Z`, s.c(i % 2 ? '#2f8a3a' : '#45a24c'));
  });
  return o + circ(tx - 1, ty + 1.5, h * 0.035, s.c('#6b4a2a')) + circ(tx + 1.4, ty + 2, h * 0.035, s.c('#6b4a2a'));
}
function cactus(s: Scene, x: number, y: number, h: number, m: number): string {
  const gc = s.c('#4f8a45'), lt = s.c('#78b05e'), w = h * 0.17;
  return line([x, y, x, y - h], gc, w) +
    line([x, y - h * 0.4, x - m * h * 0.27, y - h * 0.4, x - m * h * 0.27, y - h * 0.7], gc, w * 0.75) +
    line([x, y - h * 0.56, x + m * h * 0.23, y - h * 0.56, x + m * h * 0.23, y - h * 0.8], gc, w * 0.75) +
    line([x - w * 0.22, y - h * 0.08, x - w * 0.22, y - h * 0.92], lt, w * 0.22);
}
function rock(s: Scene, x: number, y: number, w: number, h: number, far = 0, base = '#9a958a', shade = '#6f6a61'): string {
  return poly([x - w, y, x - w * 0.8, y - h * 0.55, x - w * 0.35, y - h, x + w * 0.35, y - h * 0.9, x + w, y - h * 0.35, x + w * 0.9, y], s.c(base, far)) +
    poly([x + w * 0.1, y, x + w * 0.35, y - h * 0.9, x + w, y - h * 0.35, x + w * 0.9, y], s.c(shade, far));
}
function bush(s: Scene, x: number, y: number, w: number, far = 0, pal = LEAF): string {
  return ell(x, y - w * 0.3, w, w * 0.5, s.c(pal[0], far)) + ell(x - w * 0.3, y - w * 0.45, w * 0.55, w * 0.4, s.c(pal[1], far)) +
    ell(x - w * 0.4, y - w * 0.6, w * 0.25, w * 0.18, s.c(pal[2], far));
}
/** Reed beds with cattails: list of x,y,count triples. */
function reeds(s: Scene, list: number[], r: Rand): string {
  let st = '', tops = '';
  for (let k = 0; k < list.length; k += 3) {
    const x = list[k], y = list[k + 1], n = list[k + 2];
    for (let i = 0; i < n; i++) {
      const dx = (i - n / 2) * 1.7 + (r() - 0.5), hh = 9 + r() * 9, lean = (r() - 0.5) * 5;
      st += `M${f(x + dx)} ${f(y)}q0 ${f(-hh * 0.6)} ${f(lean)} ${f(-hh)}`;
      if (r() < 0.55) tops += `M${f(x + dx + lean * 0.93)} ${f(y - hh * 0.9)}v-3`;
    }
  }
  return sd(st, s.c('#5d7040'), 0.8) + (tops ? sd(tops, s.c('#6b4a2a'), 1.8) : '');
}
function tufts(pts: number[], col: string): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) {
    const x = f(pts[i]), y = f(pts[i + 1]);
    d += `M${x} ${y}l-1.6 -3.2M${x} ${y}l.2 -4.4M${x} ${y}l1.8 -3`;
  }
  return d ? sd(d, col, 0.7) : '';
}
function smoke(s: Scene, x: number, y: number, k = 1): string {
  const col = s.time === 'night' ? '#7d84a6' : s.time === 'dusk' ? '#c9b3b8' : '#ebe7df';
  const c = (i: number) => cd(x + i * 2.6 * k + Math.sin(i * 1.7) * k, y - i * 5.5 * k, (1.6 + i * 1.1) * k);
  return pth(c(0) + c(1), col, op(0.55)) + pth(c(2) + c(3), col, op(0.3));
}
function fire(s: Scene, x: number, y: number, k = 1): string {
  return s.halo(x, y - 3 * k, 26 * k, '#ff9a3c', Math.max(0.35, s.t.glow)) +
    line([x - 5 * k, y + 1 * k, x + 5 * k, y - 1 * k], '#5a3a22', 1.8 * k) + line([x - 5 * k, y - 1 * k, x + 5 * k, y + 1 * k], '#4a2e1a', 1.8 * k) +
    pth(`M${f(x - 4 * k)} ${f(y)}Q${f(x - 6 * k)} ${f(y - 6 * k)} ${f(x)} ${f(y - 12 * k)}Q${f(x + 6 * k)} ${f(y - 6 * k)} ${f(x + 4 * k)} ${f(y)}Z`, '#ee7a28') +
    pth(`M${f(x - 2.6 * k)} ${f(y)}Q${f(x - 3.6 * k)} ${f(y - 4 * k)} ${f(x + 0.4 * k)} ${f(y - 8 * k)}Q${f(x + 3.6 * k)} ${f(y - 4 * k)} ${f(x + 2.6 * k)} ${f(y)}Z`, '#ffcf55') +
    ell(x, y - 1.6 * k, 1.4 * k, 2.4 * k, '#fff4cc') + dots([x - 3 * k, y - 15 * k, x + 2 * k, y - 18 * k, x + 4 * k, y - 13 * k], '#ffd76a', 0.9 * k);
}
function win(s: Scene, x: number, y: number, w: number, h: number, halo = true): string {
  const lit = s.time === 'day' ? '#f0d58c' : '#ffd76a';
  return (halo && s.t.glow > 0.3 ? s.halo(x + w / 2, y + h / 2, w * 2.6, '#ffc84a', s.t.glow * 0.7) : '') +
    `<path d="M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}ZM${f(x + w / 2)} ${f(y)}v${f(h)}" fill="${lit}" stroke="#3a2a22" stroke-width=".5"/>`;
}
function fireflies(s: Scene, r: Rand, n: number, x0: number, x1: number, y0: number, y1: number): string {
  const p: number[] = [];
  let o = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    p.push(x, y);
    if (i % 2 === 0) o += s.halo(x, y, 4, '#e8ff9a', 0.6);
  }
  return o + dots(p, '#f4ffc0', 1.3);
}

// ---------- landscape ----------
interface Land { water: boolean; groundTop: number; path: string }

function landscape(s: Scene, b: Biome, R: (t: string) => Rand, cx: number, hasSubject: boolean): Land {
  const far = R('far'), mid = R('mid'), dec = R('decor');
  const add = (...x: string[]) => s.add(...x);
  const gnd = (y0: number, amp: number, top: string, bot: string, r: Rand): number[] => {
    const p = smoothRidge(r, y0, amp, 0.014, 12);
    add(pth(smoothD(p), s.lin([[s.c(top), 0], [s.c(bot), 1]])));
    return p;
  };
  // Far range: soft blue hills by default
  const softFar = () => {
    add(pth(smoothD(smoothRidge(far, 82, 34, 0.013)), s.c('#5f7aa6', 0.55)));
    add(pth(smoothD(smoothRidge(far, 90, 20, 0.022)), s.c('#4f6e7a', 0.42)));
  };
  let groundTop = 100, path = '#d9c08a';
  switch (b) {
    case 'grass': {
      softFar();
      const m = smoothRidge(mid, 95, 11, 0.02);
      add(pth(smoothD(m), s.c('#6f9f42', 0.22)));
      const ft: number[] = [];
      for (let i = 0; i < 8; i++) {
        const x = mid() * W;
        ft.push(x, yAt(m, x) + 2, 9 + mid() * 6);
      }
      add(farTrees(s, ft, 0.3));
      const gp = gnd(101, 5, '#a2d061', '#74aa42', mid);
      groundTop = yAt(gp, cx);
      const cols = ['#fff6e0', '#ffd76a', '#f28fb0', '#e8635a', '#c9a8f0'];
      const fl: number[][] = cols.map(() => []);
      for (let i = 0; i < 46; i++) {
        const x = dec() * W, y = 104 + dec() * 34;
        if (hasSubject && Math.abs(x - cx) < 46 && y < 116) continue;
        fl[i % cols.length].push(x, y);
      }
      fl.forEach((p, i) => add(dots(p, s.c(cols[i]), 1.8)));
      const tf: number[] = [];
      for (let i = 0; i < 10; i++) tf.push(dec() * W, 108 + dec() * 30);
      add(tufts(tf, s.c('#4f8a2e')));
      const tx = dec() < 0.5 ? 24 + dec() * 16 : 320 + dec() * 16;
      if (s.free(tx, 20)) add(broad(s, tx, 116, 44, 0));
      add(bush(s, 6, 136, 16), bush(s, 352, 134, 18));
      break;
    }
    case 'forest': {
      softFar();
      for (const [y0, fz, hz, col] of [[92, 0.42, 12, '#2f6a3a'], [99, 0.2, 18, '#2a5a30']] as const) {
        const zz: number[] = [-12, BOT];
        let x = -10;
        while (x < 372) {
          const h = hz * (0.7 + mid() * 0.6), w = h * 0.36;
          zz.push(x, y0 - h, x + w * 0.8, y0 - h * 0.15 + mid() * 2);
          x += w * (1.3 + mid() * 0.6);
        }
        add(poly(zz.concat([372, BOT]), s.c(col, fz)));
      }
      const gp = gnd(103, 4, '#5f9a45', '#3e7530', mid);
      groundTop = yAt(gp, cx);
      path = '#b89a68';
      const trees: number[][] = [];
      for (let i = 0; i < 14 && trees.length < 7; i++) {
        const x = dec() * W;
        if (!s.free(x, 10)) continue;
        trees.push([x, 106 + dec() * 14, 30 + dec() * 22, dec()]);
      }
      trees.sort((a, b2) => a[1] - b2[1]);
      for (const [x, y, h, k] of trees) add(k < 0.5 ? pine(s, x, y, h * 1.2, 0) : broad(s, x, y, h, 0, ['#2a5f2c', '#3f8a3e', '#62a854']));
      add(tufts([20, 130, 90, 126, 280, 132, 330, 124], s.c('#2f5a24')));
      add(pine(s, 4, 142, 96, 0), pine(s, 356, 144, 90, 0));
      break;
    }
    case 'swamp': {
      add(pth(smoothD(smoothRidge(far, 88, 20, 0.016)), s.c('#5d7088', 0.55)));
      const m = smoothRidge(mid, 96, 7, 0.02);
      add(pth(smoothD(m), s.c('#556b45', 0.3)));
      const dt: number[] = [];
      for (let i = 0; i < 5; i++) {
        const x = mid() * W;
        dt.push(x, yAt(m, x) + 1, 16 + mid() * 14, i % 2 ? 1 : -1);
      }
      add(deadTrees(s, dt, 0.4));
      const gp = gnd(101, 4, '#7b9160', '#4f633f', mid);
      groundTop = yAt(gp, cx);
      path = '#9a9468';
      for (let i = 0; i < 3; i++) {
        let x = dec() * W;
        if (hasSubject && Math.abs(x - cx) < 60) x = x < cx ? cx - 90 : cx + 90;
        const y = 114 + dec() * 18, rx = 20 + dec() * 22;
        add(ell(x, y, rx, rx * 0.16, s.c('#4c6a64')), ell(x - rx * 0.2, y - 0.5, rx * 0.5, rx * 0.04, s.c('#8fb0a8'), op(0.6)));
        add(ell(x + rx * 0.4, y + 0.6, 2.4, 0.9, s.c('#6f9a4a')));
      }
      const rb: number[] = [8, 140, 7, 350, 140, 6];
      for (let i = 0; i < 6; i++) {
        const x = dec() * W;
        if (s.free(x, 6)) rb.push(x, 108 + dec() * 26, 5 + Math.floor(dec() * 4));
      }
      const dn: number[] = [];
      if (s.free(36, 16)) dn.push(30, 120, 52, 1);
      if (s.free(330, 16)) dn.push(334, 124, 46, -1);
      if (dn.length) add(deadTrees(s, dn, 0));
      add(reeds(s, rb, dec));
      break;
    }
    case 'hills': {
      softFar();
      const m1 = smoothRidge(mid, 92, 18, 0.018);
      add(pth(smoothD(m1), s.c('#8d9450', 0.3)));
      const ft: number[] = [];
      for (let i = 0; i < 4; i++) {
        const x = mid() * W;
        ft.push(x, yAt(m1, x) + 2, 8 + mid() * 5);
      }
      add(farTrees(s, ft, 0.35));
      add(pth(smoothD(smoothRidge(mid, 99, 12, 0.026)), s.c('#a6ad5e', 0.12)));
      const gp = gnd(105, 4, '#b9c06e', '#8d9450', mid);
      groundTop = yAt(gp, cx);
      path = '#ddd0a0';
      for (let i = 0; i < 5; i++) {
        const x = dec() * W;
        if (s.free(x, 8)) add(rock(s, x, 112 + dec() * 22, 4 + dec() * 6, 4 + dec() * 5));
      }
      const tf: number[] = [];
      for (let i = 0; i < 10; i++) tf.push(dec() * W, 108 + dec() * 30);
      add(tufts(tf, s.c('#6e7536')));
      add(rock(s, 10, 140, 18, 16), bush(s, 352, 136, 14, 0, ['#6f7a38', '#8d9450', '#a8b264']));
      break;
    }
    case 'mountain': {
      const n = 4 + Math.floor(far() * 2);
      for (let i = 0; i < n; i++) {
        const x = -10 + ((i + far() * 0.7) * 380) / n;
        add(peak(s, x, 92, 38 + far() * 26, 44 + far() * 26, 0.5, '#6e7186', '#9a9fb3', '#f4f7fb'));
      }
      add(poly(craggy(far, 98, 30, 13), s.c('#5e5e6a', 0.28)));
      add(poly(craggy(mid, 104, 16, 11), s.c('#6c6b72', 0.1)));
      const gp = gnd(107, 3, '#8e8e97', '#5f5f69', mid);
      groundTop = yAt(gp, cx);
      path = '#b4ad9e';
      for (let i = 0; i < 6; i++) {
        const x = dec() * W;
        if (s.free(x, 8)) add(rock(s, x, 112 + dec() * 24, 5 + dec() * 8, 5 + dec() * 7, 0, '#a09c94', '#6c6862'));
      }
      if (s.free(40, 12)) add(pine(s, 36, 122, 34, 0));
      add(rock(s, 6, 142, 22, 26, 0, '#7d7a76', '#57544f'), rock(s, 356, 142, 18, 18, 0, '#7d7a76', '#57544f'));
      break;
    }
    case 'snow': {
      const n = 4 + Math.floor(far() * 2);
      for (let i = 0; i < n; i++) {
        const x = -10 + ((i + far() * 0.7) * 380) / n;
        add(peak(s, x, 92, 36 + far() * 24, 38 + far() * 22, 0.42, '#7f97ba', '#b4c6de', '#ffffff'));
      }
      const m = smoothRidge(mid, 98, 10, 0.02);
      add(pth(smoothD(m), s.c('#dbe5f2', 0.15)));
      const fp: number[] = [];
      for (let i = 0; i < 7; i++) {
        const x = mid() * W;
        fp.push(x, yAt(m, x) + 3, 12 + mid() * 8);
      }
      add(pines(s, fp, 0.3, true));
      const gp = gnd(104, 4, '#f6f9fd', '#cbd8ea', mid);
      groundTop = yAt(gp, cx);
      path = '#cfdbec';
      for (let i = 0; i < 5; i++) add(ell(dec() * W, 112 + dec() * 24, 14 + dec() * 16, 1.6, s.c('#c4d3e8'), op(0.8)));
      for (let i = 0; i < 4; i++) {
        const x = dec() * W;
        if (s.free(x, 10)) add(pine(s, x, 112 + dec() * 12, 28 + dec() * 16, 0, true));
      }
      add(pine(s, 6, 142, 70, 0, true), pine(s, 354, 142, 64, 0, true));
      break;
    }
    case 'desert': {
      const n = 2 + Math.floor(far() * 2);
      for (let i = 0; i < n; i++) {
        const x = 20 + far() * 320, w = 24 + far() * 30, h = 14 + far() * 16, y = 92;
        add(poly([x - w, y, x - w + 4, y - h, x + w - 5, y - h, x + w, y], s.c('#c27e52', 0.45)),
          poly([x - w + 4, y - h, x + w - 5, y - h, x + w - 4, y - h + 3, x - w + 3, y - h + 3], s.c('#dc9a68', 0.45)),
          poly([x + w * 0.4, y - h + 3, x + w - 4, y - h + 3, x + w, y, x + w * 0.5, y], s.c('#a8683e', 0.45)));
      }
      const m = smoothRidge(mid, 97, 12, 0.017);
      add(pth(smoothD(m), s.c('#d99f4c', 0.25)), sd(smoothD(m).replace(/^M[^L]*L/, 'M').replace(/L[^L]*L[^L]*Z$/, ''), s.c('#f6d58e', 0.2), 1.2));
      const gp = gnd(104, 5, '#f2c46d', '#d9a050', mid);
      groundTop = yAt(gp, cx);
      path = '#f7dca0';
      let rp = '';
      for (let i = 0; i < 8; i++) {
        const x = dec() * W, y = 110 + dec() * 28;
        rp += `M${f(x)} ${f(y)}q8 -2.5 16 0`;
      }
      add(sd(rp, s.c('#c98f44'), 0.8, op(0.6)));
      for (let i = 0; i < 3; i++) {
        const x = dec() * W;
        if (s.free(x, 8)) add(cactus(s, x, 110 + dec() * 14, 14 + dec() * 10, i % 2 ? 1 : -1));
      }
      if (s.free(20, 10)) add(cactus(s, 18, 132, 36, 1));
      add(rock(s, 352, 140, 16, 12, 0, '#c08a5a', '#8f5f38'));
      break;
    }
    case 'sand':
    case 'water':
    case 'deep': {
      const deep = b === 'deep';
      const hz = 86;
      if (!deep && far() < 0.8) {
        const x = far() < 0.5 ? 40 + far() * 60 : 260 + far() * 60, w = 40 + far() * 40;
        add(pth(`M${f(x - w)} ${hz}Q${f(x - w * 0.4)} ${f(hz - 14 - far() * 8)} ${f(x)} ${f(hz - 10)}Q${f(x + w * 0.5)} ${f(hz - 12)} ${f(x + w)} ${hz}Z`, s.c('#4f7a7a', 0.55)));
      }
      const sea = deep ? ['#4f7fba', '#1f3f78', '#0d1f40'] : ['#7fbfe0', '#3a86c0', '#1f5a8f'];
      add(rect(-10, hz, 380, BOT - hz, s.lin([[s.c(sea[0], 0.15), 0], [s.c(sea[1]), 0.4], [s.c(sea[2]), 1]])));
      add(rect(-10, hz - 0.5, 380, 1.2, s.c('#e8f4fb', 0.3), op(0.5)));
      // waves, growing with distance from horizon
      let wv = '';
      for (let row = 0; row < 8; row++) {
        const y = hz + 3 + row * row * 0.9 + row * 2.5, sz = 2 + row * (deep ? 1.4 : 1);
        for (let i = 0; i < 5 + row; i++) {
          const x = mid() * W;
          wv += `M${f(x)} ${f(y)}q${f(sz)} ${f(-sz * 0.6)} ${f(sz * 2)} 0q${f(sz)} ${f(-sz * 0.6)} ${f(sz * 2)} 0`;
        }
      }
      add(sd(wv, s.c('#e6f4fb', 0.1), deep ? 1 : 0.8, op(0.55)));
      if (deep) {
        for (let i = 0; i < 3; i++) add(pth(smoothD(smoothRidge(mid, 112 + i * 10, 6, 0.03)), s.c(i % 2 ? '#1a3a70' : '#22488a'), op(0.5)));
      }
      if (b === 'sand') {
        const sp = smoothRidge(mid, 106, 9, 0.012, 12);
        add(pth(smoothD(sp), s.c('#cfae6c')));
        const sp2 = sp.map((v, i) => (i % 2 ? v + 3 : v));
        add(sd(smoothD(sp).replace(/^M[^L]*L/, 'M').replace(/L[^L]*L[^L]*Z$/, ''), '#ffffff', 1.4, op(0.75)));
        add(pth(smoothD(sp2), s.lin([[s.c('#f0dba0'), 0], [s.c('#d8b874'), 1]])));
        groundTop = yAt(sp2, cx);
        path = '#f8e8bc';
        add(dots([dec() * W, 120 + dec() * 16, dec() * W, 118 + dec() * 18, dec() * W, 122 + dec() * 14], s.c('#f6f0e6'), 2));
        if (s.free(26, 16)) add(palm(s, 20, 134, 54, 1));
        if (s.free(338, 16)) add(palm(s, 344, 136, 46, -1));
        add(rock(s, 70 + dec() * 30, 126, 7, 6, 0, '#a59a86', '#7a705e'));
      } else {
        groundTop = 108;
        if (!deep && mid() < 0.5 && s.free(300, 30)) {
          const x = 290 + mid() * 50, y = hz + 1;
          add(poly([x - 6, y - 1.5, x + 6, y - 1.5, x + 4, y + 0.5, x - 4, y + 0.5], s.c('#5a3b22', 0.3)), poly([x, y - 2, x, y - 12, x + 5, y - 2.5], s.c('#f4ecd8', 0.25)));
        }
      }
      return { water: b !== 'sand', groundTop, path };
    }
  }
  return { water: false, groundTop, path };
}

function pathPoly(r: Rand, xb: number, xt: number, yt: number, wb: number, wt: number, wig: number): number[] {
  const L: number[] = [], Rt: number[] = [];
  const ph = r() * 6.28, N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = BOT - (BOT - yt) * t;
    const x = xb + (xt - xb) * t + wig * Math.sin(t * 4.2 + ph) * (1 - t);
    const w = wb + (wt - wb) * Math.pow(t, 0.7);
    L.push(x - w / 2, y);
    Rt.unshift(x + w / 2, y);
  }
  const out = L.slice();
  for (let i = 0; i < Rt.length; i += 2) out.push(Rt[i], Rt[i + 1]);
  return out;
}

// ---------- points of interest (drawn at origin = ground centre) ----------
type Painter = (s: Scene, r: Rand) => string;

function cottage(s: Scene, x: number, y: number, w: number, h: number, roof: string, fume: boolean): string {
  const rh = h * 0.8;
  return rect(x + w * 0.18, y - h - rh * 0.95, 3.4, rh * 0.7, s.c('#8b6b5a'), OL) + (fume ? smoke(s, x + w * 0.18 + 1.7, y - h - rh * 1.05) : '') +
    rect(x - w / 2, y - h, w, h, s.c('#ead9b0'), OL) + rect(x + w * 0.14, y - h + 0.4, w * 0.36 - 0.4, h - 0.8, s.c('#c9b48a')) +
    poly([x - w / 2 - 3, y - h + 1, x - w / 2 + 4, y - h - rh, x + w / 2 - 4, y - h - rh, x + w / 2 + 3, y - h + 1], s.c(roof), OL) +
    poly([x - w / 2 + 4, y - h - rh, x + w / 2 - 4, y - h - rh, x + w / 2 - 3, y - h - rh * 0.6, x - w / 2 + 2.4, y - h - rh * 0.6], s.c(s.snowy ? '#f2f6fb' : mix(roof, '#ffffff', 0.18))) +
    rect(x - w * 0.34, y - h * 0.62, w * 0.17, h * 0.62, s.c('#5a3a26'), OL) +
    win(s, x - w * 0.02, y - h * 0.7, w * 0.17, h * 0.34) + (w > 25 ? win(s, x + w * 0.26, y - h * 0.7, w * 0.13, h * 0.34, false) : '');
}

const POI: Record<ScenePoi, Painter> = {
  village(s, r) {
    const n = 3 + Math.floor(r() * 3);
    const roofs = ['#b5523b', '#8a5a34', '#5b6f8e', '#a2683a', '#7d4a5a'];
    const hs: number[][] = [];
    for (let i = 0; i < n; i++) {
      const back = i % 2 === 1 ? 1 : 0;
      hs.push([-60 + (120 * (i + 0.5)) / n + (r() - 0.5) * 6, back ? -8 : 0, back ? 0.8 : 1, Math.floor(r() * roofs.length), r(), r()]);
    }
    hs.sort((a, b) => a[1] - b[1]);
    let o = broad(s, -20 + r() * 40, -9, 30, 0.1);
    const smoky = new Set([Math.floor(r() * n), Math.floor(r() * n)]);
    hs.forEach(([x, y, k, ri, a, b2], i) => { o += cottage(s, x, y, (25 + a * 8) * k, (14 + b2 * 4) * k, roofs[ri], smoky.has(i)); });
    let posts = '';
    for (let x = -74; x <= 74; x += 9) posts += `M${x} 9v-7`;
    o += sd(posts, s.c('#7a5636'), 1.6) + sd('M-75 4H75M-75 7H75', s.c('#8f6a44'), 0.9);
    return o;
  },
  ruin(s, r) {
    const st = s.c('#cfc6b2'), sh = s.c('#a0977f'), dk = s.c('#7d7565');
    let o = poly([-34, 2, 38, 2, 34, -2, -32, -2], dk);
    // broken arch: full left pier, arch snapped off at the upper right, stub of the right pier
    o += pth('M-28 0V-36A28 28 0 0 1 18 -57.4L15 -53L13.5 -51L9.6 -47.5A15 15 0 0 0 -15 -36V0Z', st, OL) +
      pth('M-28 0V-36H-23V0Z', sh) + pth('M15 0V-22L19 -26L23 -21L28 -24V0Z', st, OL) + rect(22, -23, 6, 23, sh) +
      sd('M-28 -36h13M-25 -50l11 6M-6 -63l2 13M-28 -18h13', dk, 0.6);
    for (const [x, h, w] of [[-60, 34 + r() * 10, 10], [50, 24 + r() * 10, 9], [68, 12 + r() * 8, 9]]) {
      o += poly([x - w / 2, 0, x - w / 2, -h, x - w / 6, -h - 3, x + w / 6, -h + 1, x + w / 2, -h - 2, x + w / 2, 0], st, OL) +
        rect(x + w * 0.15, -h + 1, w * 0.35, h - 1, sh) + line([x - w * 0.15, -2, x - w * 0.15, -h + 2], sh, 0.6) +
        rect(x - w / 2 - 1.5, -3, w + 3, 3, sh, OL);
    }
    o += rect(32, -4, 7, 4, sh, OL) + poly([-44, 0, -42, -5, -36, -6, -34, 0], st, OL) + rect(2, -3, 6, 3, sh, OL) + rect(-4, -5, 5, 5, st, OL);
    o += sd('M-26 -6q-3 -8 1 -16t0 -14q2 -8 6 -12M18 -18q4 6 1 10', s.c('#4c8a3a'), 1.3) + dots([-26, -12, -23, -24, -25, -32, -19, -44, 19, -14], s.c('#6fb456'), 2.4);
    return o;
  },
  cave(s, r) {
    const rk = s.c('#8a8278'), lt = s.c('#a8a094'), dk = s.c('#5e5850');
    const top: number[] = [];
    for (let i = 0; i <= 8; i++) top.push(-86 + i * 21.5, -(i === 0 || i === 8 ? 12 : 34 + r() * 22 - Math.abs(i - 4) * 4));
    let o = poly([-92, 4].concat(top, [92, 4]), rk, OL) +
      poly([-92, 4, ...top.slice(0, 6), -30, -20, -50, 4], lt) + poly([30, -10, ...top.slice(12), 92, 4, 40, 4], dk);
    o += pth('M-26 2Q-28 -34 0 -38Q28 -34 26 2Z', '#120d18', OL) + pth('M-18 2Q-20 -26 0 -30Q20 -26 18 2Z', s.lin([['#2a2030', 0], ['#06040a', 1]]));
    o += poly([-16, -30, -13, -22, -10, -32, -6, -24, -2, -36, 2, -27, 6, -35, 10, -25, 14, -31], s.c('#7a7268'));
    if (s.time !== 'day') o += dots([-5, -12, -1, -12], '#ffd76a', 1.4) + s.halo(-3, -12, 7, '#ffcf40', 0.4);
    o += rock(s, -40, 4, 9, 8, 0, '#9a9286', '#6e675e') + rock(s, 36, 5, 7, 6, 0, '#9a9286', '#6e675e');
    return o;
  },
  shrine(s) {
    const st = s.c('#c4bcaa'), sh = s.c('#968e7c');
    return s.halo(0, -20, 46, '#ffe08a', Math.max(0.45, s.t.glow * 0.8)) + rect(-26, -4, 52, 5, sh, OL) + rect(-21, -8, 42, 4, st, OL) +
      rect(-16, -30, 5, 22, st, OL) + rect(11, -30, 5, 22, sh, OL) + rect(-11, -26, 22, 18, s.c('#4a3a3a')) +
      s.halo(0, -17, 14, '#fff2b0', 0.9) + pth('M0 -24Q4 -18 0 -12Q-4 -18 0 -24Z', '#fff4c8') +
      poly([-24, -30, -18, -38, 0, -46, 18, -38, 24, -30], s.c('#7a4a3a'), OL) + poly([-18, -38, 0, -46, 0, -38], s.c('#9a5e48')) +
      circ(0, -48, 2, '#ffd76a', OL) + rect(-22, -12, 2, 4, '#f4ecd8') + rect(20, -12, 2, 4, '#f4ecd8') +
      dots([-21, -13.5, 21, -13.5], '#ffd76a', 1.6);
  },
  camp(s, r) {
    const tent = (x: number, w: number, h: number, a: string, b: string) =>
      poly([x - w, 0, x, -h, x + w, 0], s.c(a), OL) + poly([x, -h, x + w, 0, x + w * 0.2, 0], s.c(b)) + poly([x - w * 0.25, 0, x, -h * 0.55, x + w * 0.2, 0], '#2a1e1a') +
      line([x, -h, x - 2, -h - 4], s.c('#5a3b22'), 0.9);
    return tent(-30, 18, 24, '#c2733f', '#9a5530') + tent(34, 14, 18, '#5f8a8a', '#46696a') + fire(s, 2, 4) + smoke(s, 4, -14, 1.2) +
      ell(-6, 8, 7, 2, s.c('#6b4a2a'), OL) + (r() < 0.5 ? rect(50, -6, 7, 6, s.c('#8a6a3a'), OL) : '');
  },
  tower(s) {
    const st = s.c('#a39ab2'), sh = s.c('#7a7090'), rf = s.c('#4a3f7e');
    let o = ell(0, 2, 28, 4, s.c('#6a7a4a', 0.1)) + poly([-11, 0, -8, -62, 8, -62, 11, 0], st, OL) + poly([2, 0, 3, -62, 8, -62, 11, 0], sh);
    o += sd('M-9 -14h6M1 -22h8M-8 -36h5M2 -48h6', s.c('#8a8098'), 0.7);
    o += rect(-13, -65, 26, 4, sh, OL) + poly([-15, -65, 0, -96, 15, -65], rf, OL) + poly([-15, -65, 0, -96, -3, -65], s.c('#6a5cae'));
    o += line([0, -96, 0, -104], '#3a2a22', 0.8) + poly([0, -104, 8, -102, 0, -100], s.c('#d4a64a'));
    o += pth('M-3 0V-7A3 3 0 0 1 3 -7V0Z', s.c('#4a3020'), OL) + win(s, -2.4, -30, 4.8, 6) + win(s, -2.4, -54, 4.8, 6);
    o += s.halo(0, -51, 16, '#b58bff', 0.4) + dots([-14, -80, 15, -74, -18, -60, 18, -88], '#e6d6ff', 1.1);
    return o;
  },
  grove(s, r) {
    let o = '';
    const pal = ['#26552a', '#3c7d38', '#5e9e4a'];
    const ts: number[][] = [];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ts.push([Math.cos(a) * 74 + (r() - 0.5) * 8, Math.sin(a) * 12, r()]);
    }
    ts.sort((a, b) => a[1] - b[1]);
    o += s.halo(0, -10, 50, '#e8ff9a', Math.max(0.35, s.t.glow * 0.6)) + ell(0, 0, 52, 8, s.c('#9cc860'), op(0.8)) + dots([-30, 2, -18, 5, 0, 6, 18, 5, 30, 2], s.c('#b8b4a8'), 3) + rock(s, 0, 2, 7, 10, 0, '#8a9a7a', '#5e6e52') + dots([-2, -5], '#c8ff9a', 1.6);
    for (const [x, y, k] of ts) {
      const h = (44 + k * 14) * (y < -6 ? 0.82 : 1), far = y < -6 ? 0.12 : 0;
      o += pth(`M${f(x - 9)} ${f(y)}Q${f(x - 4)} ${f(y - 4)} ${f(x - 4)} ${f(y - h * 0.45)}L${f(x + 4)} ${f(y - h * 0.45)}Q${f(x + 4)} ${f(y - 4)} ${f(x + 10)} ${f(y)}Z`, s.c('#5a3e28', far), OL) +
        pth(`M${f(x + 1)} ${f(y)}L${f(x + 1.5)} ${f(y - h * 0.45)}H${f(x + 4)}Q${f(x + 4)} ${f(y - 4)} ${f(x + 10)} ${f(y)}Z`, s.c('#3e2a1c', far));
      o += pth(cd(x, y - h * 0.64, h * 0.3) + cd(x - h * 0.22, y - h * 0.5, h * 0.2) + cd(x + h * 0.22, y - h * 0.5, h * 0.2), s.c(pal[0], far)) +
        pth(cd(x - h * 0.07, y - h * 0.72, h * 0.19) + cd(x - h * 0.25, y - h * 0.56, h * 0.09), s.c(pal[1], far)) + pth(cd(x - h * 0.15, y - h * 0.8, h * 0.08), s.c(pal[2], far));
    }
    return o + fireflies(s, r, 18, -60, 60, -50, -2);
  },
  stranger(s) {
    const cl = s.c('#3b2f4f'), cd = s.c('#2a2038');
    return ell(9, 1, 14, 2, '#000000', op(0.18)) + line([9, 1, 10, -34], s.c('#6b4a2a'), 1.4) +
      (s.time !== 'day' ? s.halo(11, -34, 14, '#ffc84a', 0.7) + rect(9, -36, 3.4, 4, '#ffd76a', ' stroke="#2a2233" stroke-width=".5"') : '') +
      pth('M-8 0Q-9 -16 -5 -24Q-4 -31 0 -32Q4 -31 5 -24Q9 -16 8 0Z', cl, OL) + pth('M1 -31Q5 -28 5 -22Q8 -14 8 0H2Q4 -14 1 -31Z', cd) +
      ell(0, -25, 2.6, 3.2, '#140f1c') + line([5, -18, 9, -20], cl, 2.4) + dots([-0.8, -25, 1.2, -25], s.time === 'day' ? '#9a8ab0' : '#ffd76a', 0.7);
  },
  start(s) {
    return poly([-40, 0, -22, -24, -4, 0], s.c('#b8823f'), OL) + poly([-22, -24, -4, 0, -18, 0], s.c('#946630')) +
      poly([-27, 0, -22, -12, -17, 0], '#2a1e1a') + fire(s, 14, 4) + smoke(s, 16, -14, 1.2) +
      rect(-48, 2, 16, 4, s.c('#7a4a5a'), OL) + rect(-4, -3, 6, 7, s.c('#8a6a3a'), OL) +
      line([40, 6, 40, -26], s.c('#6b4a2a'), 2) + poly([40, -24, 54, -24, 57, -21, 54, -18, 40, -18], s.c('#a87c4e'), OL) + poly([40, -15, 27, -15, 24, -12, 27, -9, 40, -9], s.c('#a87c4e'), OL);
  },
  quest(s) {
    const ob = s.c('#24203a'), ol = s.c('#3a3458');
    let o = s.halo(0, -26, 64, '#a46bff', 0.7);
    o += rect(-3, -130, 6, 104, s.lin([['#c9a4ff', 0, 0], ['#c9a4ff', 0.7, 0.55], ['#ffffff', 1, 0.9]]));
    o += poly([-34, 2, -30, -40, -24, -64, -18, -42, -14, 2], ob, OL) + poly([-30, -40, -24, -64, -24, 2, -34, 2], ol) +
      poly([14, 2, 18, -46, 25, -70, 30, -40, 34, 2], ob, OL) + poly([18, -46, 25, -70, 25, 2, 14, 2], ol);
    o += poly([-20, -46, 0, -56, 20, -50, 18, -44, 0, -50, -18, -40], ob, OL);
    o += ell(0, -22, 12, 20, s.grad('radialGradient', '', [['#ffffff', 0], ['#d4b0ff', 0.35], ['#7a3ad0', 0.85], ['#3a1a6a', 1]]), OL);
    o += dots([-24, -50, -24, -36, -24, -22, 24, -54, 24, -40, 24, -26], '#d6b8ff', 1.5) + dots([0, -56], '#ffffff', 2.4);
    o += sd('M-40 4l8 -2l6 3M30 4l10 -1l6 2', '#b58bff', 0.8, op(0.8));
    return o;
  },
  wild() { return ''; },
};
/** Half-width at scale 1 and drawing scale of each subject. */
const POI_SIZE: Record<ScenePoi, [number, number]> = {
  village: [78, 1.15], ruin: [72, 1.1], cave: [90, 1], shrine: [28, 1.35], camp: [54, 1.3], tower: [24, 0.9],
  grove: [90, 1.05], stranger: [14, 1.6], start: [58, 1.25], quest: [40, 1.05], wild: [0, 1],
};

// ---------- landmarks (drawn at origin = ground centre) ----------
/** Landmarks: half-width at scale 1, drawing scale when centred, painter. */
const LM: Record<string, [number, number, Painter]> = {
  standing_stones: [44, 1.3, (s, r) => {
    const ps: number[][] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      ps.push([Math.cos(a) * 34, Math.sin(a) * 7, 16 + r() * 8]);
    }
    ps.sort((a, b) => a[1] - b[1]);
    let o = ell(0, 0, 40, 9, s.c('#6a8a4a'), op(0.5));
    for (const [x, y, h0] of ps) {
      const h = h0 * (y < 0 ? 0.85 : 1), far = y < 0 ? 0.12 : 0;
      o += poly([x - 4, y, x - 4.5, y - h * 0.7, x - 2, y - h, x + 2.5, y - h * 0.95, x + 4, y - h * 0.6, x + 4, y], s.c('#aaa69c', far), OL) +
        poly([x + 1, y, x + 2.5, y - h * 0.95, x + 4, y - h * 0.6, x + 4, y], s.c('#7f7b72', far)) + dots([x - 2, y - h * 0.3], s.c('#6f9a4a', far), 2);
    }
    return o + s.halo(0, -8, 20, '#bfe6ff', s.t.glow * 0.5);
  }],
  statue: [22, 1.4, (s) => {
    const st = s.c('#bdb7a8'), sh = s.c('#8f897b');
    return rect(-11, -9, 22, 9, sh, OL) + rect(-13, -12, 26, 3.5, st, OL) +
      pth('M-6 -12L-4 -36Q0 -40 4 -36L6 -12Z', st, OL) + pth('M1 -38Q4 -36 4 -36L6 -12H1Z', sh) +
      circ(0, -40, 3.6, st, OL) + line([3, -33, 15, -42], st, 2.6) +
      line([-4, -32, -6, -20], sh, 2.2) + dots([-8, -10, 9, -5, -3, -14], s.c('#5f8a3e'), 2.4);
  }],
  well: [22, 1.5, (s) => {
    const st = s.c('#a49d90'), sh = s.c('#7d766a'), wd = s.c('#6b4a2a');
    return rect(-12, -13, 24, 13, st, OL) + rect(3, -13, 9, 13, sh) + sd('M-12 -7h24M-6 -13v6M4 -7v7M-2 0v-7', sh, 0.5) +
      ell(0, -13, 12.5, 3, s.c('#c4bdae'), OL) + ell(0, -13, 9.5, 2, '#1f2a3a') +
      rect(-12, -34, 2.4, 21, wd, OL) + rect(9.6, -34, 2.4, 21, wd, OL) + line([-11, -28, 11, -28], wd, 1.2) +
      poly([-17, -32, 0, -42, 17, -32], s.c('#8a4a32'), OL) + line([2, -28, 2, -20], '#3a2a22', 0.5) + rect(0, -20, 4, 3.4, s.c('#8a6a3a'), OL);
  }],
  signpost: [20, 1.5, (s) => {
    const wd = s.c('#7a5636'), arm = s.c('#a87c4e');
    return rect(-1.6, -36, 3.2, 36, wd, OL) + poly([0, -32, 15, -32, 19, -29, 15, -26, 0, -26], arm, OL) +
      poly([0, -23, -14, -22, -18, -19, -14, -16, 0, -17], arm, OL) + poly([0, -13, 12, -11, 15, -8, 11, -6, 0, -8], s.c('#95683e'), OL) +
      ell(0, 0, 6, 1.6, '#000000', op(0.15));
  }],
  windmill: [32, 1.2, (s, r) => {
    const a0 = r() * 90;
    let sails = '';
    for (let i = 0; i < 4; i++) sails += `<path d="M0 -38L2 -40L3.5 -66L-3 -66L-2 -40Z" fill="${s.c('#efe4cc')}" stroke="#5a3b22" stroke-width=".6" transform="rotate(${Math.round(a0 + i * 90)} 0 -38)"/>`;
    return poly([-11, 0, -7, -36, 7, -36, 11, 0], s.c('#e6dcc4'), OL) + poly([2, 0, 3, -36, 7, -36, 11, 0], s.c('#c4b796')) +
      poly([-9, -35, 0, -46, 9, -35], s.c('#8a4a32'), OL) + pth('M-3 0V-7A3 3 0 0 1 3 -7V0Z', s.c('#5a3a26'), OL) + win(s, -2, -24, 4, 5) +
      sails + circ(0, -38, 2, s.c('#5a3b22'));
  }],
  scarecrow: [18, 1.6, (s) => {
    const wd = s.c('#6b4a2a');
    return line([0, 2, 0, -30], wd, 1.8) + line([-13, -22, 13, -22], wd, 1.5) + poly([-8, -25, 8, -25, 6, -10, -6, -10], s.c('#6a5a8a'), OL) +
      sd('M-13 -22l-3 2M-13 -22l-3 -1M13 -22l3 2M13 -22l3 -1M-3 -10l-1 4M2 -10l1 4', s.c('#e0b860'), 0.8) +
      circ(0, -29, 4.2, s.c('#e08a3a'), OL) + dots([-1.5, -29.5, 1.5, -29.5], '#2a1e1a', 1) +
      poly([-7, -32, 7, -32, 4, -34, 3, -40, -3, -40, -4, -34], s.c('#3a2a22'), OL) + pth('M10 -24q2 -4 5 -3l2 -1l-1 2q0 3 -3 3Z', s.c('#1e1a22'));
  }],
  great_tree: [40, 1.0, (s) => {
    const a = s.c('#2f6b2f'), b = s.c('#4c9a43'), c = s.c('#6fb456');
    let o = pth('M-18 2Q-8 -2 -7 -14L-6 -36H6L7 -14Q8 -2 20 2Q6 0 0 1Q-8 0 -18 2Z', s.c('#6b4a30'), OL) + pth('M2 -36H6L7 -14Q8 -2 20 2Q8 0 3 0Z', s.c('#4f3522'));
    for (const [x, y, rr] of [[-26, -44, 18], [26, -46, 18], [0, -60, 26], [-16, -66, 17], [16, -68, 17]]) o += circ(x, y, rr, a);
    for (const [x, y, rr] of [[-24, -50, 12], [-4, -70, 16], [18, -54, 9]]) o += circ(x, y, rr, b);
    o += circ(-10, -78, 7, c) + circ(-28, -56, 5, c);
    o += sd('M-14 -34v8M-2 -38v10M12 -36v7', '#c84a4a', 0.9) + sd('M-8 -36v6M18 -34v8', '#ffd76a', 0.9);
    return o;
  }],
  cart: [24, 1.5, (s) => {
    const wd = s.c('#8a5f38'), dk = s.c('#5a3b22');
    return poly([-18, -5, 12, -9, 13, -20, -17, -15], wd, OL) + sd('M-17.5 -10l30 -4.5M-3 -7v-11', dk, 0.6) +
      `<circle cx="-10" cy="-4" r="5.5" fill="none" stroke="${dk}" stroke-width="1.4"/>` + sd('M-10 -9.5v11M-15.5 -4h11', dk, 0.7) +
      ell(12, 0, 6, 1.4, dk) + line([-18, -8, -28, -2], dk, 1.2) + ell(16, -4, 4, 3, s.c('#c9a86a'), OL);
  }],
  sword_stone: [20, 1.5, (s) => {
    return s.halo(0, -34, 16, '#ffe08a', Math.max(0.4, s.t.glow * 0.7)) + rock(s, 0, 1, 15, 15, 0, '#9a968c', '#6c685f') +
      pth('M-15 1Q-14 -10 -6 -14L-2 -12Q-10 -8 -10 1Z', s.c('#5f8a3e'), op(0.8)) +
      rect(-1.3, -32, 2.6, 19, s.c('#dfe6ee'), OL) + rect(0, -32, 1.3, 19, s.c('#a8b4c2')) +
      rect(-6.5, -34.5, 13, 2.6, '#d4a64a', OL) + rect(-1, -42, 2, 7.5, s.c('#6b3a2a'), OL) + circ(0, -43, 1.8, '#ffd76a', OL) +
      pth('M5 -40l.7 -2.3l.7 2.3l2.3 .7l-2.3 .7l-.7 2.3l-.7 -2.3l-2.3 -.7Z', '#fff8d8');
  }],
  banner: [18, 1.5, (s) => {
    return line([0, 2, 3, -42], s.c('#6b4a2a'), 1.6) + poly([2, -42, 3.5, -48, 4.6, -42], s.c('#b8bcc4')) +
      pth('M3 -40L24 -37L20 -32L25 -28L19 -26L22 -21L4 -24Z', s.c('#a8323a'), OL) + circ(12, -31, 3, s.c('#d4a64a')) +
      line([-6, 2, 4, -8], s.c('#6b4a2a'), 1.2);
  }],
  ashes: [18, 1.7, (s) => {
    let o = ell(0, 0, 11, 3.4, s.c('#4a4440'));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28;
      o += ell(Math.cos(a) * 12, Math.sin(a) * 3.6, 2.6, 1.6, s.c(i % 2 ? '#8a857c' : '#a49e94'), OL);
    }
    return o + line([-5, 0, 5, -1], s.c('#2a2220'), 1.6) + line([-4, -1, 4, 0.5], s.c('#3a2e28'), 1.4) +
      sd('M0 -2q-4 -6 0 -12t0 -12', s.c('#b8b4ae'), 1.2, op(0.5)) + dots([1, -1, -2, 0], '#ff8a3a', 1);
  }],
  mushrooms: [28, 1.5, (s, r) => {
    let o = '';
    const ms: number[][] = [];
    for (let i = 0; i < 6; i++) ms.push([-22 + i * 9 + (r() - 0.5) * 4, (r() - 0.5) * 4, 6 + r() * 10]);
    ms.sort((a, b) => a[1] - b[1]);
    for (const [x, y, h] of ms) {
      const w = h * 0.6;
      o += s.halo(x, y - h, h * 1.8, '#7fe0ff', Math.max(0.35, s.t.glow * 0.8)) + rect(x - h * 0.12, y - h, h * 0.24, h, s.c('#efe6d2'), OL) +
        pth(`M${f(x - w)} ${f(y - h + 1)}A${f(w)} ${f(h * 0.5)} 0 0 1 ${f(x + w)} ${f(y - h + 1)}Z`, '#4fb6dc', OL) +
        dots([x - w * 0.4, y - h - h * 0.15, x + w * 0.3, y - h - h * 0.25], '#e0faff', h * 0.16);
    }
    return o;
  }],
  stump: [22, 1.6, (s) => {
    return poly([-16, 1, -12, -3, -12, -16, 12, -16, 12, -3, 17, 1], s.c('#7a5636'), OL) + poly([4, -16, 12, -16, 12, -3, 17, 1, 4, 1], s.c('#5a3e26')) +
      ell(0, -16, 12, 3.4, s.c('#c9a678'), OL) + `<ellipse cx="0" cy="-16" rx="7" ry="2" fill="none" stroke="${s.c('#9a7a50')}" stroke-width=".6"/>` +
      pth('M-5 1V-6A5 5 0 0 1 5 -6V1Z', '#24170f') + sd('M-9 -4v-9M8 -6v-7', s.c('#5a3e26'), 0.6) + dots([-12, -9, 13, -12], s.c('#6f9a4a'), 2.4);
  }],
  totem: [18, 1.4, (s) => {
    const cols = ['#a8643a', '#5f7f9a', '#c49a4a'];
    let o = '';
    for (let i = 0; i < 3; i++) {
      const y = -11 * (i + 1);
      o += rect(-6, y, 12, 11, s.c(cols[i]), OL) + dots([-2.4, y + 3.6, 2.4, y + 3.6], '#1e1a22', 1.8) + rect(-2.5, y + 6.5, 5, 1.6, '#1e1a22');
    }
    return o + poly([-6, -30, -18, -35, -14, -31, -6, -27], s.c('#c44a3a'), OL) + poly([6, -30, 18, -35, 14, -31, 6, -27], s.c('#c44a3a'), OL) +
      poly([-4, -33, 0, -40, 4, -33], s.c('#e0b860'), OL) + sd('M-8 2l-2 -5M8 2l2 -5', s.c('#f4ecd8'), 0.8);
  }],
  lantern: [16, 1.5, (s) => {
    return s.halo(8, -29, 26, '#ffc84a', Math.max(0.5, s.t.glow)) + line([0, 2, 0, -38], s.c('#3a3430'), 2.2) + line([0, -36, 9, -36, 9, -34], s.c('#3a3430'), 1) +
      poly([5.5, -33, 12.5, -33, 9, -35.5], s.c('#3a3430')) + rect(6, -33, 6, 8, '#ffd76a', ' stroke="#3a3430" stroke-width=".8"') + rect(8.4, -32, 1.2, 6, '#fff4c8');
  }],
  cairn: [16, 1.7, (s) => {
    let o = '';
    for (const [x, y, rx, ry, c] of [[0, -3, 12, 4, '#9a958a'], [1, -9, 10, 3.5, '#b0aa9e'], [-1, -14.5, 8, 3, '#8f897e'], [0.5, -19, 6, 2.6, '#aaa498'], [1, -23, 3.6, 2, '#9a958a']] as const)
      o += ell(x, y, rx, ry, s.c(c), OL);
    return o;
  }],
  obelisk: [16, 1.2, (s) => {
    return s.halo(0, -30, 30, '#8fa0ff', s.t.glow * 0.5) + rect(-11, -3, 22, 4, s.c('#4a4658'), OL) +
      poly([-7, -3, -5, -54, 0, -61, 5, -54, 7, -3], s.c('#26243a'), OL) + poly([-7, -3, -5, -54, 0, -61, -1, -3], s.c('#3e3b58')) +
      dots([-2, -46, 2, -40, -1, -33, 3, -27, -3, -21, 1, -14], '#ffd76a', 0.9) + s.halo(1, -36, 6, '#ffd76a', 0.8) + dots([1, -36], '#fff2b0', 2);
  }],
  crystals: [26, 1.4, (s, r) => {
    let o = s.halo(0, -16, 34, '#c49aff', Math.max(0.4, s.t.glow * 0.8)) + rock(s, 0, 2, 22, 8, 0, '#7a7480', '#55505a');
    for (const [x, h, w, a] of [[-12, 18, 4, -22], [12, 20, 4.5, 20], [-4, 30, 5.5, -6], [5, 24, 4.5, 8], [-18, 10, 3, -38]]) {
      const hh = h * (0.85 + r() * 0.3);
      o += `<g transform="rotate(${a} ${x} 0)">` + poly([x - w, 0, x - w, -hh, x, -hh - w * 1.4, x + w, -hh, x + w, 0], '#8a5ad6', OL) +
        poly([x - w, 0, x - w, -hh, x, -hh - w * 1.4, x - w * 0.1, 0], '#c4a2ff') + line([x - w * 0.5, -2, x - w * 0.5, -hh + 1], '#efe2ff', 0.6) + '</g>';
    }
    return o;
  }],
  lava_vent: [36, 1.3, (s) => {
    return s.halo(0, -6, 40, '#ff7a2a', Math.max(0.55, s.t.glow)) + pth('M-36 2Q-24 -14 -10 -16L-6 -12H6L10 -16Q24 -14 36 2Z', s.c('#3a2e2e'), OL) +
      pth('M-6 -12H6L10 -16Q24 -14 36 2H8Z', s.c('#2a2020')) + ell(0, -12, 7, 2.2, '#ff8a2a') + ell(0, -12.3, 4, 1.2, '#ffd060') +
      sd('M-6 -8l-6 4l-4 6M8 -7l5 5l7 2', '#ff8a2a', 1.2) + sd('M-6 -8l-6 4M8 -7l5 5', '#ffd060', 0.5) +
      circ(-2, -24, 5, s.c('#5a5050'), op(0.6)) + circ(3, -33, 7, s.c('#6a6060'), op(0.45)) + circ(-1, -45, 9, s.c('#7a7070'), op(0.3)) +
      dots([-4, -20, 5, -26, 2, -18], '#ffb04a', 1.1);
  }],
  geyser: [26, 1.2, (s) => {
    return ell(0, 0, 22, 5, s.c('#9a958a'), OL) + ell(0, -0.5, 17, 3.5, s.c('#7fd0e0')) + ell(-4, -1.2, 7, 1, '#e6fbff', op(0.7)) +
      pth('M-3 -2Q-5 -28 -1 -50Q2 -52 3 -48Q6 -26 3 -2Z', '#f4fbff', op(0.85)) +
      circ(-4, -50, 7, '#f4fbff', op(0.6)) + circ(5, -54, 6, '#f4fbff', op(0.5)) + circ(-10, -42, 5, '#f4fbff', op(0.4)) + circ(12, -44, 6, '#f4fbff', op(0.35)) +
      circ(0, -62, 9, '#f4fbff', op(0.25));
  }],
  ice_spire: [22, 1.1, (s) => {
    return s.halo(0, -30, 30, '#bfe6ff', s.t.glow * 0.5) +
      poly([-13, 1, -9, -26, -11, -34, -4, -72, 1, -52, 5, -60, 9, -28, 14, 1], s.c('#c6e6fa'), OL) +
      poly([1, -52, 5, -60, 9, -28, 14, 1, 2, 1], s.c('#88b8e0')) + ell(-1, -24, 4.5, 11, s.c('#5a7aa8'), op(0.45)) +
      sd('M-8 -20l3 -14M-6 -46l2 -10', '#ffffff', 0.8, op(0.8)) + poly([-22, 1, -19, -8, -16, 1], s.c('#a9d0ee'), OL) + poly([18, 1, 21, -6, 24, 1], s.c('#a9d0ee'), OL);
  }],
  ribcage: [44, 1.2, (s) => {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const x = -34 + i * 11, h = 36 - Math.abs(i - 2.5) * 5;
      d += `M${f(x)} 1C${f(x - 4)} ${f(-h)} ${f(x + 18)} ${f(-h * 1.15)} ${f(x + 26)} ${f(-h * 0.62)}`;
    }
    return sd('M-38 2Q0 -4 40 0', s.c('#8a826e'), 4.4) + sd(d, s.c('#7a7262'), 4.4) + sd(d, s.c('#efe6d0'), 2.8) +
      sd('M-38 2Q0 -4 40 0', s.c('#e2d8c0'), 2.6) + ell(44, -2, 7, 5, s.c('#e8dfc8'), OL) + dots([45, -3], '#2a2233', 2);
  }],
  bones: [18, 1.8, (s) => {
    const bn = s.c('#ece3cc');
    return pth('M-14 0A7 6 0 0 1 0 0Z', s.c('#8a6a4a'), OL) + circ(8, -4, 4.5, bn, OL) + rect(5.5, -1.5, 5, 3, bn, OL) + dots([6.5, -4.5, 9.5, -4.5], '#2a2233', 1.6) +
      line([-20, 3, -8, 0], bn, 1.6) + dots([-20, 3, -8, 0], bn, 3) + line([14, 3, 24, 1], bn, 1.4) + dots([14, 3, 24, 1], bn, 2.6);
  }],
  oasis: [38, 1.3, (s) => {
    return ell(0, 1, 34, 7, s.c('#6fae4a')) + ell(0, 1, 26, 4.6, s.c('#3a9ac8')) + ell(-6, 0, 12, 1.2, '#cdf2ff', op(0.7)) +
      palm(s, -22, 0, 40, -1) + palm(s, 18, 2, 34, 1) + palm(s, 30, -1, 26, 1) + reeds(s, [-8, 4, 4], mulberry32(7));
  }],
  shipwreck: [40, 1.3, (s) => {
    const wd = s.c('#6b4a30'), dk = s.c('#4a3020');
    return rock(s, -6, 4, 26, 8, 0, '#6e6a64', '#4e4a46') +
      pth('M-32 -6Q-28 4 -10 4L16 3Q28 -2 32 -14L20 -9L14 -15L6 -7L-6 -11L-14 -5Z', wd, OL) +
      sd('M-28 -2Q-16 0 0 -1L18 -3M-24 -5L10 -6', dk, 0.7) + line([-2, -6, 10, -48], wd, 1.8) + line([2, -22, 14, -28], wd, 1) +
      pth('M9 -44Q20 -38 14 -30L4 -28Q8 -36 9 -44Z', s.c('#e8dcc0'), OL) + sd('M-36 6q4 -2 8 0t8 0M26 6q4 -2 8 0', '#ffffff', 0.8, op(0.7));
  }],
  tidepool: [30, 1.6, (s) => {
    return rock(s, -20, 2, 12, 9, 0, '#8a857a', '#5f5a52') + rock(s, 20, 2, 11, 7, 0, '#8a857a', '#5f5a52') + ell(0, 1, 16, 4, s.c('#5ab0c8'), OL) +
      ell(-4, 0, 7, 1, '#d8f6ff', op(0.7)) + pth('M4 -1l1 -2l1 2l2 .2l-1.6 1.2l.6 2l-2 -1l-2 1l.6 -2l-1.6 -1.2Z', '#e8643a') + dots([-8, 2, -10, 1], '#f4c8b8', 1.6);
  }],
};

// ---------- render ----------
function render(o: SceneOptions, combat: boolean): string {
  P = 1;
  const time: SceneTime = o.time ?? 'day';
  const T = TIMES[time];
  const omen = combat ? undefined : o.omen;
  let skyC = T.sky.slice(), haze = T.haze;
  if (omen === 'blood-moon') {
    skyC = skyC.map((c, i) => mix(c, '#8c1a26', time === 'day' ? 0.1 + i * 0.05 : 0.3));
    haze = mix(haze, '#8a3038', 0.28);
  } else if (omen === 'golden-hour') {
    skyC = skyC.map((c, i) => mix(c, '#f4b64e', time === 'night' ? 0.08 : 0.16 + i * 0.12));
    haze = mix(haze, '#f0c272', time === 'night' ? 0.08 : 0.3);
  }
  const s = new Scene('hs' + (++counter).toString(36) + '_', T, time, combat ? 0.18 : 0, haze);
  const R = (tag: string): Rand => mulberry32((o.seed ^ hashString(tag)) >>> 0);
  const sr = R('sky');
  const dk = (c: string) => (combat ? mix(c, '#0f1222', 0.35) : c);

  // 1. sky
  s.add(rect(0, 0, W, H, s.lin([[dk(skyC[0]), 0], [dk(skyC[1]), 0.36], [dk(skyC[2]), 0.64]])));
  const sx = sr() < 0.5 ? 46 + sr() * 70 : 244 + sr() * 70;
  const blood = omen === 'blood-moon';
  if (time !== 'day') {
    const stars: number[] = [], bright: number[] = [];
    const n = time === 'night' ? 40 : 12;
    for (let i = 0; i < n + (omen === 'lucky-stars' ? 16 : 0); i++) (i % 5 ? stars : bright).push(sr() * W, sr() * (time === 'night' ? 70 : 38));
    s.add(dots(stars, '#ffffff', 0.9, op(time === 'night' ? 0.8 : 0.5)), dots(bright, '#fff6d8', 1.6, op(time === 'night' ? 0.9 : 0.6)));
  }
  const moon = (x: number, y: number, r: number, a: number) => {
    const mc = blood ? '#e0503c' : '#f2eed8', cr = blood ? '#b0352c' : '#d6d0b4';
    s.add(s.halo(x, y, r * 4, blood ? '#ff5040' : '#dfe6ff', (blood ? 0.6 : 0.35) * a), circ(x, y, r, mc, op(a)),
      circ(x - r * 0.3, y - r * 0.2, r * 0.25, cr, op(a * 0.6)), circ(x + r * 0.35, y + r * 0.3, r * 0.18, cr, op(a * 0.6)), circ(x + r * 0.1, y - r * 0.5, r * 0.12, cr, op(a * 0.6)));
  };
  if (time === 'day') {
    const gold = omen === 'golden-hour';
    s.add(s.halo(sx, 26, gold ? 48 : 36, gold ? '#ffd36a' : '#fff2b8', 0.75), circ(sx, 26, 10, gold ? '#ffe28a' : '#fff8dc'));
    if (blood) moon(W - sx, 30, 7, 0.75);
  } else if (time === 'dusk') {
    s.add(s.halo(sx, 72, 74, '#ffb060', 0.85), circ(sx, 72, 15, '#ffd27a'));
    if (blood) moon(W - sx, 26, 8, 0.95);
  } else moon(sx, 24, blood ? 10 : 8.5, 1);
  if (omen === 'lucky-stars') {
    const x = 60 + sr() * 240, y = 12 + sr() * 16;
    s.add(sd(`M${f(x - 34)} ${f(y + 12)}L${f(x)} ${f(y)}`, s.lin([['#ffffff', 0, 0], ['#fff6d8', 1, 1]], true), 1.4));
    for (let i = 0; i < 3; i++) {
      const px = 20 + sr() * 320, py = 8 + sr() * 40;
      s.add(pth(`M${f(px)} ${f(py - 3.5)}l.9 2.6l2.6 .9l-2.6 .9l-.9 2.6l-.9 -2.6l-2.6 -.9l2.6 -.9Z`, '#ffd76a', op(0.9)));
    }
  }
  const calm = omen === 'clear-skies' || omen === 'still-air';
  const nc = calm ? 0 : (time === 'night' ? 1 : 2) + Math.floor(sr() * 2) + (omen === 'fair-winds' ? 2 : 0);
  const cc = time === 'day' ? ['#ffffff', '#dbe8f2', 0.9] as const : time === 'dusk' ? ['#f7c7aa', '#d98f8a', 0.8] as const : [blood ? '#5a2a3a' : '#3c4a7c', blood ? '#3a1a2a' : '#2c3864', 0.7] as const;
  for (let i = 0; i < nc; i++) {
    const x = 10 + sr() * 300, y = 18 + sr() * 30, w = 30 + sr() * 36;
    s.add(pth(cloud(x, y, w, sr), dk(cc[0]), op(cc[2])), ell(x + w / 2, y, w / 2, 1.6, dk(cc[1]), op(cc[2])));
  }
  if (omen === 'fair-winds') {
    let d = '';
    for (let i = 0; i < 3; i++) {
      const x = 20 + sr() * 260, y = 20 + sr() * 40;
      d += `M${f(x)} ${f(y)}q20 -6 40 0t40 0a4 4 0 1 0 -4 -5`;
    }
    s.add(sd(d, '#ffffff', 1, op(0.55)));
  }
  if (time !== 'night' && omen !== 'still-air' && !combat) {
    let d = '';
    const bx = 60 + sr() * 240, by = 22 + sr() * 26;
    for (let i = 0; i < 2 + Math.floor(sr() * 3); i++) {
      const x = bx + i * 9 + sr() * 6, y = by + sr() * 8 - i * 2, k = 0.7 + sr() * 0.5;
      d += `M${f(x)} ${f(y)}q${f(2 * k)} ${f(-2.2 * k)} ${f(4 * k)} 0q${f(2 * k)} ${f(-2.2 * k)} ${f(4 * k)} 0`;
    }
    s.add(sd(d, time === 'day' ? '#3a4058' : '#3a2440', 0.8));
  }

  // 2+3. landscape. Subject layout first so decor can avoid it.
  const subR = R('subject');
  const poi = combat ? undefined : o.poi;
  const lmDef = combat || !o.landmark ? undefined : LM[o.landmark];
  const lmCentre = !!lmDef && (!poi || poi === 'wild');
  const [pHalf, pk] = POI_SIZE[poi ?? 'wild'];
  const pSpan = pHalf * pk;
  const lk = lmDef ? lmDef[1] * (lmCentre ? 1 : 0.7) : 1;
  const lSpan = lmDef ? lmDef[0] * lk : 0;
  let cx = 180 + (subR() - 0.5) * 36, lmx = cx;
  if (lmDef && !lmCentre) {
    // POI and landmark side by side, the pair centred
    const left = 180 - (pSpan + lSpan + 5);
    if (subR() < 0.5) { cx = left + pSpan; lmx = cx + pSpan + 10 + lSpan; } else { lmx = left + lSpan; cx = lmx + lSpan + 10 + pSpan; }
  }
  if (pSpan) s.busy.push([cx - pSpan, cx + pSpan]);
  if (lmDef) s.busy.push([lmx - lSpan, lmx + lSpan]);
  const hasSubject = s.busy.length > 0 || poi === 'wild';
  s.add('<g transform="translate(0 -7)">');
  s.snowy = o.biome === 'snow';
  const land = landscape(s, o.biome, R, cx, hasSubject);

  // 4. subject
  const gy = land.water ? 106 : Math.min(108, Math.max(104, land.groundTop + 5));
  if (!land.water && ((poi && poi !== 'grove') || lmCentre)) {
    const pr = R('path');
    const wild = poi === 'wild' && !lmDef;
    const ty = wild ? land.groundTop + 1 : gy + 2;
    const pts = pathPoly(pr, 180 + (pr() - 0.5) * 60, cx, ty, 52, wild ? 2 : 10, wild ? 34 : 20);
    s.add(poly(pts, s.c(land.path)), poly(pts.map((v, i) => (i % 2 ? v : v + (i < pts.length / 2 ? 1.2 : -1.2))), s.c(mix(land.path, '#ffffff', 0.25)), op(0.5)));
  }
  if (land.water && ((poi && poi !== 'wild') || lmDef)) {
    const deep = o.biome === 'deep';
    const span = Math.max(pSpan, lmCentre ? lSpan : 0, 30) + 8;
    s.add(ell(cx, gy + 2, span + 6, 8, s.c(deep ? '#4e4a52' : '#c9a86a')), ell(cx, gy, span, 6, s.c(deep ? '#6e6a72' : '#ecd49a')));
    if (!deep && pSpan) s.add(ell(cx, gy - 1, span - 8, 4, s.c('#8dbf58')));
    if (lmDef && !lmCentre) s.add(ell(lmx, gy + 1, lSpan + 6, 5, s.c(deep ? '#6e6a72' : '#ecd49a')));
  }
  P = 10;
  if (poi && poi !== 'wild') s.add(g(cx, gy, pk, POI[poi](s, R('poi'))));
  if (lmDef) s.add(g(lmx, gy + (lmCentre ? 0 : 1), lk, lmDef[2](s, R('lm'))));
  P = 1;

  // 5. atmosphere overlays
  const fx = R('fx');
  if (o.biome === 'swamp' || omen === 'still-air') {
    for (let i = 0; i < 4; i++) s.add(ell(fx() * W, 96 + i * 7, 60 + fx() * 60, 3 + fx() * 2, time === 'night' ? '#8a9ac0' : '#f4f6f0', op(0.22)));
  }
  if (time !== 'day' && !combat && ['grass', 'forest', 'swamp'].includes(o.biome)) s.add(fireflies(s, fx, 8, 0, W, 90, 130));
  if (o.biome === 'snow') {
    const p: number[] = [];
    for (let i = 0; i < 30; i++) p.push(fx() * W, fx() * H);
    s.add(dots(p, '#ffffff', 1.4, op(0.75)));
  }
  if (omen === 'market-day' && (poi === 'village' || poi === 'camp')) {
    const cols = ['#c84a4a', '#d4a64a', '#4a8ac8', '#5aa05a'];
    const y0 = gy - 44, x0 = cx - pSpan * 0.85, wd = pSpan * 1.7;
    let o2 = sd(`M${f(x0)} ${f(y0)}Q${f(cx)} ${f(y0 + 16)} ${f(x0 + wd)} ${f(y0)}`, '#5a3b22', 0.5);
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12, x = x0 + wd * t, y = y0 + 16 * 2 * t * (1 - t);
      o2 += poly([x - 2.4, y, x + 2.4, y, x, y + 4.5], cols[i % 4]);
    }
    s.add(o2);
  }
  s.add('</g>');
  if (combat) s.add(rect(0, 0, W, H, s.lin([['#0f1222', 0, 0.05], ['#0f1222', 1, 0.35]])));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${s.defs.join('')}</defs>${s.out.join('')}</svg>`;
}

/** Wide illustrated banner (360×140) for the top of an event card. */
export function sceneArt(o: SceneOptions): string {
  return render(o, false);
}

/** The same landscape with no subject, darker; meant for ~35% opacity behind combat UI. */
export function combatBackdrop(o: { biome: Biome; seed: number; time?: SceneTime }): string {
  return render({ biome: o.biome, seed: o.seed, time: o.time }, true);
}

/** Landmark keys this module can draw. */
export const SCENE_LANDMARKS: readonly string[] = Object.keys(LM);
