// A real 3D twenty-sided die, drawn as SVG: an icosahedron whose faces are lit
// from above-left, numbered like a real d20 (opposite faces add up to 21), that
// tumbles end over end, bounces with a shadow, and settles with the rolled
// number facing you, upright. No libraries; ~20 polygons a frame.
//
// Space: x right, y down, z toward the viewer. Faces with normal.z > 0 are seen.

export type V3 = [number, number, number];
export type M3 = [V3, V3, V3]; // rows

const PHI = (1 + Math.sqrt(5)) / 2;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
export const mul = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const mmul = (a: M3, b: M3): M3 => {
  const col = (j: number): V3 => [b[0][j], b[1][j], b[2][j]];
  return [0, 1, 2].map((i) => [dot(a[i], col(0)), dot(a[i], col(1)), dot(a[i], col(2))]) as M3;
};
/** Rotation by `ang` radians about unit axis `a` (Rodrigues). */
export function rot(a: V3, ang: number): M3 {
  const [x, y, z] = norm(a), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

export interface Face {
  /** vertex indices, wound so the normal points outward */
  v: [number, number, number];
  n: V3;
  c: V3;
  /** in-face axes for the number: right and down (r = d × n) */
  r: V3;
  d: V3;
  num: number;
}

export const VERTS: V3[] = ([
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
] as V3[]).map(norm);

export const FACES: Face[] = (() => {
  const edge = Math.min(...VERTS.slice(1).map((v) => Math.hypot(...sub(v, VERTS[0]))));
  const adj = (i: number, j: number) => Math.abs(Math.hypot(...sub(VERTS[i], VERTS[j])) - edge) < 1e-6;
  const faces: Face[] = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (!adj(i, j) || !adj(j, k) || !adj(i, k)) continue;
    const a = VERTS[i], b = VERTS[j], cc = VERTS[k];
    const c: V3 = [(a[0] + b[0] + cc[0]) / 3, (a[1] + b[1] + cc[1]) / 3, (a[2] + b[2] + cc[2]) / 3];
    let v: [number, number, number] = [i, j, k];
    let n = norm(cross(sub(b, a), sub(cc, a)));
    if (dot(n, c) < 0) { v = [i, k, j]; n = [-n[0], -n[1], -n[2]]; }
    const up = norm(sub(VERTS[v[0]], c));
    const d: V3 = [-up[0], -up[1], -up[2]];
    faces.push({ v, n, c, d, r: cross(d, n), num: 0 });
  }
  // Number them like a real d20: opposite faces sum to 21.
  let next = 1;
  for (const f of faces) {
    if (f.num) continue;
    const opp = faces.find((g) => dot(g.n, f.n) < -0.999)!;
    f.num = next;
    opp.num = 21 - next;
    next++;
  }
  return faces;
})();

/** The orientation that shows `num` facing the viewer, upright. */
export function faceUp(num: number): M3 {
  const f = FACES.find((x) => x.num === num) ?? FACES[0];
  return [f.r, f.d, f.n];
}

const LIGHT = norm([-0.45, -0.7, 0.6]);
const SVGNS = 'http://www.w3.org/2000/svg';
const R = 46; // circumradius in viewBox units

interface FaceEls { base: SVGPolygonElement; shade: SVGPolygonElement; text: SVGTextElement }

/** One die drawn into a host element; `roll()` animates it. */
export class Die3D {
  private svg: SVGSVGElement;
  private body: SVGGElement;
  private shadow: SVGEllipseElement;
  private els: FaceEls[] = [];
  private m: M3;
  private raf = 0;
  private idle: boolean;

  constructor(private host: HTMLElement, show = 20, opts: { idle?: boolean } = {}) {
    this.idle = opts.idle ?? true;
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('viewBox', '-60 -60 120 120');
    this.svg.setAttribute('class', 'd20 d3');
    this.shadow = document.createElementNS(SVGNS, 'ellipse');
    this.shadow.setAttribute('class', 'd3-shadow');
    this.body = document.createElementNS(SVGNS, 'g');
    for (const f of FACES) {
      const base = document.createElementNS(SVGNS, 'polygon');
      base.setAttribute('class', 'd3-face');
      const shade = document.createElementNS(SVGNS, 'polygon');
      shade.setAttribute('class', 'd3-shade');
      const text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('class', 'd3-num');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', f.num >= 10 ? '14' : '16');
      text.textContent = f.num === 6 || f.num === 9 ? `${f.num}.` : String(f.num);
      this.body.append(base, shade, text);
      this.els.push({ base, shade, text });
    }
    this.svg.append(this.shadow, this.body);
    host.replaceChildren(this.svg);
    host.classList.add('d3');
    this.m = this.rest(show);
    this.draw(this.m, 0, 0);
    if (this.idle) this.sway();
  }

  /** A pleasing three-quarter view of a face: you can tell it's a solid. */
  private rest(num: number): M3 {
    // a slight tilt only, so the rolled face stays the one nearest you
    return mmul(rot([1, 0, 0], -0.17), mmul(rot([0, 1, 0], 0.2), faceUp(num)));
  }

  private draw(m: M3, x: number, lift: number) {
    const P = VERTS.map((v) => mul(m, v));
    this.body.setAttribute('transform', `translate(${x.toFixed(2)} ${(-lift).toFixed(2)})`);
    const k = Math.max(0.35, 1 - lift / 70);
    this.shadow.setAttribute('cx', x.toFixed(2));
    this.shadow.setAttribute('cy', '50');
    this.shadow.setAttribute('rx', (34 * k).toFixed(2));
    this.shadow.setAttribute('ry', (7 * k).toFixed(2));
    this.shadow.setAttribute('opacity', (0.5 * k).toFixed(2));
    FACES.forEach((f, i) => {
      const e = this.els[i];
      const n = mul(m, f.n);
      if (n[2] <= 0.001) {
        e.base.setAttribute('visibility', 'hidden');
        e.shade.setAttribute('visibility', 'hidden');
        e.text.setAttribute('visibility', 'hidden');
        return;
      }
      const pts = f.v.map((vi) => `${(P[vi][0] * R).toFixed(2)},${(P[vi][1] * R).toFixed(2)}`).join(' ');
      e.base.setAttribute('points', pts);
      e.shade.setAttribute('points', pts);
      e.base.setAttribute('visibility', 'visible');
      e.shade.setAttribute('visibility', 'visible');
      // Lambert light plus a little rim: dark faces get a black wash, lit faces a white one.
      const b = 0.3 + 0.7 * Math.max(0, dot(n, LIGHT));
      if (b < 0.72) { e.shade.setAttribute('fill', '#000'); e.shade.setAttribute('opacity', ((0.72 - b) * 1.15).toFixed(3)); }
      else { e.shade.setAttribute('fill', '#fff'); e.shade.setAttribute('opacity', ((b - 0.72) * 1.3).toFixed(3)); }
      // The number lies in the face plane, so it foreshortens as the face turns away.
      const c = mul(m, f.c), r = mul(m, f.r), d = mul(m, f.d);
      e.text.setAttribute('transform', `matrix(${r[0].toFixed(3)} ${r[1].toFixed(3)} ${d[0].toFixed(3)} ${d[1].toFixed(3)} ${(c[0] * R).toFixed(2)} ${(c[1] * R).toFixed(2)})`);
      e.text.setAttribute('opacity', Math.min(1, (n[2] - 0.08) * 2.2).toFixed(3));
      e.text.setAttribute('visibility', n[2] > 0.1 ? 'visible' : 'hidden');
    });
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Gentle sway while waiting to be thrown. */
  private sway() {
    this.stop();
    const base = this.m, t0 = performance.now();
    let waited = 0;
    const tick = (t: number) => {
      // not on the page yet (being built) or gone (overlay closed)
      if (!this.host.isConnected) {
        if (waited++ > 30) return this.stop();
        this.raf = requestAnimationFrame(tick);
        return;
      }
      waited = 31;
      const s = (t - t0) / 1000;
      this.draw(mmul(rot([0, 1, 0], 0.22 * Math.sin(s * 0.9)), mmul(rot([1, 0, 0], 0.14 * Math.sin(s * 1.3 + 1)), base)), 0, 2 + 2 * Math.sin(s * 1.6));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Throw the die: it tumbles, bounces and comes to rest showing `num`. */
  roll(num: number, ms: number, onBounce?: () => void): Promise<void> {
    this.stop();
    const end = this.rest(num);
    // Mostly end over end (like rolling across a table), with a twist.
    const sgn = Math.random() < 0.5 ? -1 : 1;
    const a1 = norm([1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4]);
    const a2 = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const turns1 = sgn * Math.PI * 2 * (1.6 + Math.random() * 0.9) * Math.min(1.4, ms / 1000);
    const turns2 = Math.PI * (0.5 + Math.random());
    const drift = (Math.random() < 0.5 ? -1 : 1) * 26;
    const hops = 3;
    let lastHop = -1;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const ease = 1 - (1 - t) ** 3;
        const m = mmul(rot(a1, turns1 * (1 - ease)), mmul(rot(a2, turns2 * (1 - ease)), end));
        // Bounces that get lower and quicker; the die slides to the middle.
        const phase = hops * Math.sqrt(t);
        const hop = Math.floor(phase);
        if (hop !== lastHop) { if (lastHop >= 0) onBounce?.(); lastHop = hop; }
        const lift = 44 * Math.abs(Math.sin(Math.PI * phase)) * (1 - t) ** 1.6;
        this.draw(m, drift * (1 - ease), lift);
        if (t < 1 && this.host.isConnected) this.raf = requestAnimationFrame(tick);
        else { this.m = end; this.draw(end, 0, 0); this.raf = 0; resolve(); }
      };
      this.raf = requestAnimationFrame(tick);
    });
  }
}

const dice = new WeakMap<HTMLElement, Die3D>();

/** Put a 3D d20 in `host` (replacing what's there). */
export function mountD20(host: HTMLElement, show = 20, opts: { idle?: boolean } = {}): Die3D {
  const d = new Die3D(host, show, opts);
  dice.set(host, d);
  return d;
}

export const die3dOf = (host: HTMLElement) => dice.get(host);
