// Procedural storybook-style monster portraits for combat. Pure SVG strings, deterministic from the name.
import type { EnemyKind } from '../../core/types';
import { hashString, mulberry32, pick } from '../../core/rng';

type Pt = [number, number];
interface Pal { b: string; d: string; l: string }
interface C {
  id: string;
  nm: string;
  m: Pal;
  s: Pal;
  eye: string;
  ol: string;
  tier: number;
  r: () => number;
}
interface Out {
  svg: string;
  /** Crown anchor: x, y (bottom of crown) and width. */
  top: [number, number, number];
  scar?: Pt;
  sh?: Pt;
}
interface Tune { base?: string; sec?: string; eye?: string }
interface Arch {
  base: string;
  sec: string;
  eye: string;
  draw: (c: C, k: Kit) => Out;
  tune?: (nm: string, r: () => number) => Tune;
  fade?: boolean;
  /** Use the modifier colour for the secondary palette too (glowing things). */
  tintSec?: boolean;
}

let uid = 0;

// ---------- colour ----------
function rgb(h: string): number[] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('');
}
const pal = (b: string): Pal => ({ b, d: mix(b, '#140f1e', 0.42), l: mix(b, '#fff4dc', 0.4) });
const INK = '#1b1b24';
const IVORY = '#f3ecd8';
const MOUTH = '#3a1220';
const VOID = '#120e18';
const SKIN = ['#e8b796', '#d29a73', '#b07650', '#8a5638', '#f0c8a8'];

// ---------- drawing kit ----------
function kit(c: C) {
  const ol = c.ol;
  const op = (o: number) => (o < 1 ? ` opacity="${o}"` : '');
  const p = (d: string, fill: string, w = 2.5) =>
    `<path d="${d}" fill="${fill}"${w ? ` stroke="${ol}" stroke-width="${w}"` : ''}/>`;
  const f = (d: string, fill: string, o = 1) => `<path d="${d}" fill="${fill}"${op(o)}/>`;
  const e = (x: number, y: number, rx: number, ry: number, fill: string, w = 2.5) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${w ? ` stroke="${ol}" stroke-width="${w}"` : ''}/>`;
  const fe = (x: number, y: number, rx: number, ry: number, fill: string, o = 1) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${op(o)}/>`;
  const ln = (d: string, stroke: string, w = 2, o = 1) =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${op(o)}/>`;
  const tube = (d: string, fill: string, w: number) => ln(d, ol, w + 5) + ln(d, fill, w);
  const fang = (x: number, y: number, len: number, up = false) =>
    p(`M${x - 1.7} ${y}L${x} ${y + (up ? -len : len)}L${x + 1.7} ${y}Z`, IVORY, 1);
  const mir = (s: string) => `<g transform="matrix(-1 0 0 1 100 0)">${s}</g>`;
  const brows = (x1: number, y1: number, x2: number, y2: number, w = 3) =>
    ln(`M${x1} ${y1}L${x2} ${y2}M${100 - x1} ${y1}L${100 - x2} ${y2}`, ol, w);
  const rim = (d: string, o = 0.75) => ln(d, c.m.l, 1.6, o);
  const eyes = (pts: Pt[], r: number, o: { slant?: number; slit?: boolean; dark?: boolean; ry?: number } = {}) => {
    let s = '';
    const gr = r * (1.9 + c.tier * 0.22), go = Math.min(0.95, 0.42 + c.tier * 0.1);
    for (const [x, y] of pts) {
      const rot = o.slant ? (x <= 50 ? o.slant : -o.slant) : 0;
      if (!o.dark) s += `<circle cx="${x}" cy="${y}" r="${gr.toFixed(1)}" fill="url(#${c.id}g)" opacity="${go.toFixed(2)}"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${((o.ry ?? 0.78) * r).toFixed(1)}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''} fill="${o.dark ? INK : c.eye}"/>`;
      if (o.slit) s += `<ellipse cx="${x}" cy="${y}" rx="${(r * 0.24).toFixed(1)}" ry="${(r * 0.7).toFixed(1)}" fill="${INK}"/>`;
      s += `<circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.3).toFixed(1)}" r="${(r * 0.28).toFixed(1)}" fill="#fff" opacity="0.9"/>`;
    }
    return s;
  };
  return {
    p, f, e, fe, ln, tube, fang, mir, brows, rim, eyes, ol,
    M: `url(#${c.id}m)`, S: `url(#${c.id}s)`, K: `url(#${c.id}k)`, G: `url(#${c.id}g)`, O: `url(#${c.id}o)`,
  };
}
type Kit = ReturnType<typeof kit>;
const has = (c: C, re: RegExp) => re.test(c.nm);

// ---------- archetypes ----------
function wolf(c: C, k: Kit, gnoll = false): Out {
  const { p, f, ln, M, S } = k;
  let s = '';
  if (gnoll) {
    s += p('M14 100C14 80 26 66 50 64C74 66 86 80 86 100Z', '#6a4a30');
    s += ln('M24 76L70 100', '#3a2a1c', 5) + k.e(30, 80, 3, 3, k.K, 1.5);
  } else {
    s += p('M18 100C16 80 26 64 38 60L62 60C74 64 84 80 82 100Z', M);
    s += p('M34 62L40 82L45 72L50 88L55 72L60 82L66 62Z', S, 2);
  }
  const ear = gnoll ? 'M30 40C16 28 18 10 32 14C40 18 44 24 46 28Z' : 'M30 40L22 6L47 26Z';
  s += p(ear, M) + k.mir(p(ear, M));
  s += f('M31 34L26 15L40 27Z', c.m.d, 0.8) + k.mir(f('M31 34L26 15L40 27Z', c.m.d, 0.8));
  if (gnoll) s += p('M42 22L45 6L50 15L55 5L58 22Z', '#2e221a', 2);
  s += p('M50 19C63 19 72 27 74 39L87 49L74 54C70 64 60 72 50 76C40 72 30 64 26 54L13 49L26 39C28 27 37 19 50 19Z', M);
  s += f('M74 39L87 49L74 54C70 64 60 72 50 76L50 62C60 60 70 52 74 39Z', c.m.d, 0.45);
  if (gnoll) s += k.fe(35, 30, 2.5, 2, c.m.d) + k.fe(66, 32, 3, 2.2, c.m.d) + k.fe(58, 24, 2, 1.6, c.m.d);
  else s += f('M50 20L45 32L50 42L55 32Z', c.m.d, 0.5);
  s += p('M40 48C41 43 59 43 60 48L58 66C56 73 44 73 42 66Z', S);
  s += p('M44 51C44 48 56 48 56 51C56 55 52 57 50 57C48 57 44 55 44 51Z', INK, 1.5);
  s += ln('M43 66Q50 61 57 66', k.ol, 2) + k.fang(45.5, 64.5, 6) + k.fang(54.5, 64.5, 6);
  s += k.eyes([[37, 41], [63, 41]], 3.4, { slant: 22 });
  s += k.brows(30, 35, 43, 39, 3.2);
  s += k.rim('M27 38C29 28 37 21 47 20');
  return { svg: s, top: [50, 21, 22], scar: [62, 36], sh: [24, 74] };
}

function boar(c: C, k: Kit): Out {
  const { p, f, M, S } = k;
  let s = p('M12 100C12 78 28 66 50 66C72 66 88 78 88 100Z', M);
  s += p('M29 32L29 12L37 22L43 5L50 17L57 5L63 22L71 12L71 32Z', c.m.d);
  const ear = 'M30 34L9 22L18 46Z';
  s += p(ear, M) + k.mir(p(ear, M));
  s += p('M50 19C70 19 80 33 78 51C76 70 66 82 50 84C34 82 24 70 22 51C20 33 30 19 50 19Z', M);
  s += f('M78 51C76 70 66 82 50 84L50 76C62 74 72 64 78 51Z', c.m.d, 0.45);
  s += k.e(50, 68, 14, 10, S);
  s += k.fe(47, 64, 6, 2.5, '#fff', 0.25);
  s += k.fe(45, 68, 2.4, 3.4, MOUTH) + k.fe(55, 68, 2.4, 3.4, MOUTH);
  const tusk = 'M37 73C27 73 23 62 26 51C29 59 34 64 40 65Z';
  s += p(tusk, IVORY, 2) + k.mir(p(tusk, IVORY, 2));
  s += k.eyes([[38, 46], [62, 46]], 2.8, { slant: 25 });
  s += k.brows(29, 39, 44, 44, 3.6);
  s += k.rim('M27 36C31 26 40 21 49 20');
  return { svg: s, top: [50, 18, 24], scar: [36, 56], sh: [20, 80] };
}

function bear(c: C, k: Kit): Out {
  const { p, f, M, S } = k;
  let s = p('M8 100C8 76 26 62 50 62C74 62 92 76 92 100Z', M);
  s += k.e(27, 25, 10, 10, M) + k.e(73, 25, 10, 10, M);
  s += k.fe(27, 26, 5, 5, c.m.d) + k.fe(73, 26, 5, 5, c.m.d);
  s += p('M50 17C70 17 80 31 80 47C80 65 68 78 50 78C32 78 20 65 20 47C20 31 30 17 50 17Z', M);
  s += f('M80 47C80 65 68 78 50 78L50 70C64 68 74 60 80 47Z', c.m.d, 0.45);
  s += k.e(50, 60, 14, 11, S);
  s += p('M44 53C44 50 56 50 56 53C56 57 52 59 50 59C48 59 44 57 44 53Z', INK, 1.5);
  s += p('M42 64Q50 61 58 64Q56 72 50 72Q44 72 42 64Z', MOUTH, 1.8);
  s += k.fang(45, 63.5, 5) + k.fang(55, 63.5, 5);
  s += k.eyes([[38, 42], [62, 42]], 2.9, { slant: 22 });
  s += k.brows(30, 35, 44, 40, 3.4);
  // raised paw with claws
  s += p('M10 96C8 84 14 76 24 76C34 76 38 86 34 96Z', M);
  for (const x of [15, 22, 29]) s += p(`M${x - 2} 77L${x} 69L${x + 2} 77Z`, IVORY, 1.2);
  s += k.rim('M23 40C25 28 36 19 48 18');
  return { svg: s, top: [50, 17, 24], scar: [62, 33], sh: [74, 80] };
}

function owlbear(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = p('M8 100C8 76 26 62 50 62C74 62 92 76 92 100Z', M);
  for (const y of [74, 84, 94]) s += ln(`M36 ${y}L43 ${y + 5}L50 ${y}L57 ${y + 5}L64 ${y}`, c.m.d, 2);
  const tuft = 'M30 32L18 4L42 22Z';
  s += p(tuft, M) + k.mir(p(tuft, M));
  s += p('M50 17C70 17 80 31 80 47C80 65 68 78 50 78C32 78 20 65 20 47C20 31 30 17 50 17Z', M);
  s += f('M80 47C80 65 68 78 50 78L50 70C64 68 74 60 80 47Z', c.m.d, 0.45);
  s += k.e(38, 45, 13, 13, S, 2) + k.e(62, 45, 13, 13, S, 2);
  s += k.eyes([[38, 45], [62, 45]], 5, { ry: 1 });
  s += k.fe(38, 45, 2, 2, INK) + k.fe(62, 45, 2, 2, INK);
  s += ln('M24 31L50 43L76 31', k.ol, 3.5);
  s += p('M43 53C45 48 55 48 57 53L52 69C51 71 49 71 48 69Z', '#e8b23a', 2);
  s += k.rim('M23 40C25 28 36 19 48 18');
  return { svg: s, top: [50, 17, 24], scar: [24, 56], sh: [76, 82] };
}

function spider(c: C, k: Kit): Out {
  const { p, M } = k;
  let legs = '';
  for (const d of ['M42 54L23 29L7 50', 'M42 58L15 43L4 67', 'M43 63L17 63L9 85', 'M45 68L27 79L23 95']) {
    legs += k.tube(d, c.m.b, 3.6) + k.ln(d, c.m.l, 1, 0.5);
  }
  let s = legs + k.mir(legs);
  s += k.e(50, 35, 25, 21, M);
  s += p('M43 24L57 24L52.5 34L57 44L43 44L47.5 34Z', '#c8323c', 1.5);
  s += k.rim('M30 30C33 21 41 16 50 15');
  s += k.e(50, 62, 15, 13, M);
  const fangD = 'M43 70C40 76 42 81 46 83C46 79 47 75 48 72Z';
  s += p(fangD, c.m.d, 2) + k.mir(p(fangD, c.m.d, 2));
  s += k.eyes([[45, 60], [55, 60]], 3.1, { ry: 1 });
  s += k.eyes([[40, 55], [60, 55], [45, 53.5], [55, 53.5]], 1.5, { ry: 1 });
  return { svg: s, top: [50, 15, 20], scar: [38, 38], sh: [62, 66] };
}

function serpent(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const body = 'M12 88C10 74 32 72 50 76C68 80 88 78 84 64C80 52 64 54 58 44C55 39 54 36 53 32';
  let s = k.tube(body, c.m.b, 14);
  s += `<path d="${body}" fill="none" stroke="${c.m.d}" stroke-width="14" stroke-dasharray="2 5" opacity="0.55"/>`;
  s += ln('M14 84C14 76 32 74 50 78C68 82 86 78 82 66', c.m.l, 2.5, 0.55);
  s += k.tube('M26 94C42 99 64 98 80 90', c.m.b, 12) + ln('M28 92C44 96 62 95 78 88', c.m.l, 2.4, 0.55);
  s += f('M44 70C50 72 58 74 64 74', S);
  s += p('M52 11C65 11 73 19 71 30C69 38 60 42 52 42C44 42 35 38 33 30C31 19 39 11 52 11Z', M);
  s += f('M71 30C69 38 60 42 52 42L52 34C60 34 66 32 71 30Z', c.m.d, 0.45);
  s += ln('M44 18L52 22L60 18M46 13L52 16L58 13', c.m.d, 1.8, 0.8);
  s += p('M39 34C43 46 61 46 65 34C59 38 45 38 39 34Z', MOUTH, 2);
  s += k.fang(43.5, 36, 5) + k.fang(60.5, 36, 5);
  s += ln('M52 42L52 52M52 52L48 57M52 52L56 57', '#e0405a', 2);
  s += k.eyes([[43, 26], [61, 26]], 3.4, { slant: 22, slit: true });
  s += k.brows(37, 21, 47, 24, 2.6);
  s += k.rim('M35 24C37 16 44 12 52 12');
  return { svg: s, top: [52, 13, 18], scar: [62, 20], sh: [70, 70] };
}

function bird(c: C, k: Kit): Out {
  const { p, ln, M, S } = k;
  const wing = 'M42 58C30 54 18 46 10 32L5 16L13 23L12 12L20 21L21 9L28 20L31 11L34 25C37 33 42 40 46 44Z';
  let w = p(wing, M) + ln('M13 23L30 42M21 21L34 38M28 20L37 34', c.m.d, 1.8, 0.8);
  w += k.rim('M6 17L12 30C18 42 28 50 40 56', 0.5);
  let s = w + k.mir(w);
  s += k.e(50, 70, 17, 24, M);
  for (const y of [60, 70, 80]) s += ln(`M40 ${y}L45 ${y + 4}L50 ${y}L55 ${y + 4}L60 ${y}`, c.m.d, 1.8, 0.8);
  s += p('M36 40C34 28 42 20 52 20C62 21 67 29 64 40C62 48 56 52 50 52C44 52 37 48 36 40Z', S);
  s += p('M44 38L56 38C58 45 54 51 50 56C46 51 42 45 44 38Z', '#f2b632', 2);
  s += k.f('M48 52L50 56L52 52Z', INK);
  s += k.eyes([[43, 33], [57, 33]], 2.5, { slant: 25 });
  s += k.brows(37, 27, 46, 31, 3.2);
  for (const x of [42, 58]) s += p(`M${x - 5} 96L${x - 4} 89L${x + 4} 89L${x + 5} 96Z`, '#f2b632', 1.8);
  return { svg: s, top: [51, 20, 18], scar: [58, 64], sh: [36, 62] };
}

function harpy(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const wing = 'M38 70C26 66 14 54 8 36L5 22L13 28L13 17L21 27L23 15L30 28L34 20L36 36C38 46 40 56 44 62Z';
  let s = p(wing, M) + k.mir(p(wing, M));
  s += ln('M13 28L32 52M21 27L35 46', c.m.d, 1.8) + k.mir(ln('M13 28L32 52M21 27L35 46', c.m.d, 1.8));
  const hair = '#2e2236';
  s += p('M50 13C30 13 23 30 26 46L17 60L29 57L25 72L37 63L41 74L50 64L59 74L63 63L75 72L71 57L83 60L74 46C77 30 70 13 50 13Z', hair);
  s += p('M30 100C30 82 38 72 50 72C62 72 70 82 70 100Z', M);
  for (const y of [82, 92]) s += ln(`M38 ${y}L44 ${y + 4}L50 ${y}L56 ${y + 4}L62 ${y}`, c.m.d, 1.8);
  s += p('M50 26C60 26 64 34 63 44C62 54 56 62 50 62C44 62 38 54 37 44C36 34 40 26 50 26Z', S);
  s += f('M63 44C62 54 56 62 50 62L50 56C56 54 60 50 63 44Z', c.s.d, 0.45);
  s += p('M36 36C40 22 60 22 64 36C58 28 52 30 50 34C46 28 42 30 36 36Z', hair, 1.5);
  s += k.e(50, 53, 3.6, 4.6, MOUTH, 1.5) + k.fang(48, 49.5, 3) + k.fang(52, 49.5, 3);
  s += k.eyes([[44, 43], [56, 43]], 2.4, { slant: 24 });
  s += k.brows(39, 37, 47, 40, 2.4);
  return { svg: s, top: [50, 15, 20], scar: [58, 48], sh: [34, 84] };
}

function bat(c: C, k: Kit): Out {
  const { p, ln, M, S } = k;
  const wing = 'M45 50C36 38 22 30 6 32C10 40 8 50 4 60C12 56 18 58 21 66C25 59 31 60 34 68C37 60 42 59 46 61Z';
  let w = p(wing, S) + ln('M44 50L7 33M44 52L5 59M44 54L21 65M45 56L34 67', c.s.d, 1.6, 0.9);
  w += k.rim('M44 48C35 38 22 32 8 33', 0.5);
  let s = w + k.mir(w);
  const ear = 'M41 46L36 23L48 38Z';
  s += p(ear, M) + k.mir(p(ear, M));
  s += k.e(50, 60, 12, 16, M);
  s += k.e(50, 45, 11, 10, M);
  s += p('M47 47L50 43L53 47L50 50Z', c.m.d, 1.2);
  s += k.fang(47, 51, 4) + k.fang(53, 51, 4);
  s += k.eyes([[45.5, 42.5], [54.5, 42.5]], 2.3, { slant: 22 });
  s += p('M44 75L45 80L47 76L48 80L49 75Z', IVORY, 1) + k.mir(p('M44 75L45 80L47 76L48 80L49 75Z', IVORY, 1));
  return { svg: s, top: [50, 36, 14], scar: [56, 60], sh: [40, 58] };
}

function rat(c: C, k: Kit): Out {
  const { p, ln, M, S } = k;
  let s = k.tube('M62 84C82 90 92 78 86 64C83 57 76 59 78 65', '#d9a0a0', 3.2);
  s += p('M50 44C67 44 74 62 72 79C70 92 30 92 28 79C26 62 33 44 50 44Z', M);
  s += k.f('M72 79C70 92 50 92 50 92L50 84C60 84 68 82 72 79Z', c.m.d, 0.45);
  s += k.e(50, 74, 11, 13, S, 0);
  s += k.e(33, 28, 10, 10, M) + k.e(67, 28, 10, 10, M);
  s += k.fe(33, 29, 6, 6, '#e2a2a8') + k.fe(67, 29, 6, 6, '#e2a2a8');
  s += p('M50 21C62 21 68 31 66 41C64 51 56 59 50 62C44 59 36 51 34 41C32 31 38 21 50 21Z', M);
  s += p('M47 59C47 56 53 56 53 59C53 61 51 62 50 62C49 62 47 61 47 59Z', '#e2a2a8', 1.4);
  s += p('M48 62L52 62L52 67L48 67Z', IVORY, 1.2);
  s += ln('M45 56L29 53M45 58L30 60M55 56L71 53M55 58L70 60', c.m.l, 1, 0.8);
  s += k.eyes([[43, 40], [57, 40]], 2.7, { slant: 20 });
  s += k.brows(38, 35, 46, 37, 2.4);
  s += p('M38 68C38 63 44 63 44 68Z', c.s.b, 1.5) + p('M56 68C56 63 62 63 62 68Z', c.s.b, 1.5);
  s += k.rim('M36 34C38 26 44 22 50 22');
  return { svg: s, top: [50, 22, 16], scar: [60, 48], sh: [32, 64] };
}

function scorpion(c: C, k: Kit): Out {
  const { p, M } = k;
  let legs = '';
  for (const d of ['M38 70L22 62L13 73', 'M40 74L24 75L17 88', 'M42 78L31 86L28 96']) legs += k.tube(d, c.m.b, 3);
  let s = legs + k.mir(legs);
  const seg: [number, number, number][] = [[60, 56, 8], [67, 44, 7.5], [67, 32, 7], [62, 21, 6.5], [53, 15, 6], [44, 17, 5.5]];
  for (const [x, y, r] of seg) s += k.e(x, y, r, r * 0.9, M);
  s += p('M42 13C34 15 32 24 37 31L40 39L42 30C46 26 47 19 42 13Z', c.m.d, 2);
  s += `<circle cx="40" cy="39" r="3" fill="${k.G}"/>`;
  const arm = 'M40 68L28 58L24 47';
  s += k.tube(arm, c.m.b, 5.5) + k.mir(k.tube(arm, c.m.b, 5.5));
  const claw = 'M26 49C12 49 7 36 13 27C17 31 21 33 25 31C21 27 21 22 25 17C34 20 36 35 30 44Z';
  s += p(claw, M) + k.mir(p(claw, M));
  s += k.e(50, 75, 18, 13, M);
  s += k.ln('M34 78Q50 84 66 78M36 84Q50 89 64 84', c.m.d, 1.6);
  s += k.e(50, 66, 12, 8, M);
  s += k.eyes([[45.5, 65], [54.5, 65]], 2, { slant: 20 });
  s += k.rim('M36 70C40 64 46 62 52 62');
  return { svg: s, top: [50, 59, 14], scar: [58, 74], sh: [64, 70] };
}

function crab(c: C, k: Kit): Out {
  const { p, M } = k;
  let legs = '';
  for (const d of ['M34 68L18 66L10 78', 'M34 72L20 77L16 90', 'M37 76L27 86L27 96']) legs += k.tube(d, c.m.b, 3.2);
  let s = legs + k.mir(legs);
  const arm = 'M33 62L24 52L23 42';
  s += k.tube(arm, c.m.b, 5.5) + k.mir(k.tube(arm, c.m.b, 5.5));
  const claw = 'M23 44C9 42 6 24 15 14L22 27L24 12C35 14 36 34 28 43Z';
  s += p(claw, M) + k.mir(p(claw, M));
  s += k.tube('M44 54L42 41M56 54L58 41', c.m.b, 2.4);
  s += p('M50 50C72 50 82 59 80 71C78 82 64 86 50 86C36 86 22 82 20 71C18 59 28 50 50 50Z', M);
  s += p('M28 54L26 49L32 52ZM72 54L74 49L68 52Z', M, 1.5);
  s += k.f('M80 71C78 82 64 86 50 86L50 80C62 80 74 78 80 71Z', c.m.d, 0.45);
  s += k.e(42, 39, 4, 4, IVORY, 2) + k.e(58, 39, 4, 4, IVORY, 2);
  s += k.eyes([[42, 39], [58, 39]], 2, { ry: 1 });
  s += k.ln('M42 72L46 70L50 72L54 70L58 72', k.ol, 2);
  s += k.ln('M38 62L46 65M62 62L54 65', k.ol, 2.4);
  s += k.rim('M26 60C32 53 40 51 50 51', 0.8);
  return { svg: s, top: [50, 50, 16], scar: [64, 66], sh: [70, 64] };
}

function bandit(c: C, k: Kit): Out {
  const { p, f, ln, M, S, K } = k;
  let s = p('M8 100C10 78 26 66 50 64C74 66 90 78 92 100Z', M);
  s += ln('M24 78L74 100', '#3d2c20', 5);
  s += p('M50 9C70 12 78 32 76 52C74 64 68 72 62 74L38 74C32 72 26 64 24 52C22 32 30 12 50 9Z', M);
  s += f('M76 52C74 64 68 72 62 74L58 74C66 66 70 56 70 44C70 32 64 20 56 14C70 18 78 34 76 52Z', c.m.d, 0.55);
  s += p('M50 25C62 25 66 37 65 49C64 61 58 69 50 69C42 69 36 61 35 49C34 37 38 25 50 25Z', VOID, 1.5);
  s += p('M35 51C42 55 58 55 65 51L64 62C60 70 40 70 36 62Z', S, 2);
  s += ln('M39 58Q50 61 61 58', c.s.d, 1.5);
  s += k.eyes([[43, 44], [57, 44]], 2.6, { slant: 16 });
  s += k.rim('M27 44C27 28 36 14 49 11');
  // dagger
  s += p('M68 76L86 44L90 46L73 79Z', K, 1.8);
  s += ln('M64 72L76 82', '#3d2c20', 4) + k.e(68, 80, 5, 5, '#c9936a', 2);
  return { svg: s, top: [50, 11, 20], scar: [60, 40], sh: [24, 80] };
}

function pirate(c: C, k: Kit): Out {
  const { p, f, ln, M } = k;
  const skin = pick(SKIN, c.r), beard = pick(['#2a1d18', '#5a3420', '#7a2a1d', '#3a3f58'], c.r);
  let s = p('M8 100C10 78 26 68 50 66C74 68 90 78 92 100Z', M);
  s += p('M42 67L50 84L58 67Z', IVORY, 2) + ln('M30 74L42 100M70 74L58 100', '#d4a64a', 2.4);
  s += p('M50 30C62 30 66 40 65 50C64 62 58 70 50 70C42 70 36 62 35 50C34 40 38 30 50 30Z', skin);
  s += f('M65 50C64 62 58 70 50 70L50 64C58 62 62 56 65 50Z', '#00000033');
  s += p('M35 52C37 72 45 81 50 81C55 81 63 72 65 52C61 61 56 63 50 63C44 63 39 61 35 52Z', beard);
  s += p('M41 59C45 55 55 55 59 59C55 58 45 58 41 59Z', beard, 1.6);
  s += ln('M44 63Q50 66 56 63', MOUTH, 2) + k.fe(52, 64, 1.5, 1.3, '#ffd76a');
  s += ln('M36 40L66 52', INK, 1.6) + k.e(58, 47, 4.6, 4, INK, 0);
  s += k.eyes([[43, 47]], 2.4, { dark: true, ry: 1 });
  s += k.brows(39, 42, 47, 44, 2.6);
  s += k.e(66, 56, 2, 2, '#ffd76a', 1);
  s += p('M31 31C33 13 67 13 69 31Z', '#24212e');
  s += p('M16 36C24 25 36 30 50 19C64 30 76 25 84 36C70 33 60 38 50 36C40 38 30 33 16 36Z', '#24212e');
  s += ln('M17 35C28 32 40 37 50 35C60 37 72 32 83 35', '#d4a64a', 1.8);
  s += k.e(50, 25, 3, 2.6, IVORY, 0) + ln('M46 30L54 32M54 30L46 32', IVORY, 1.2);
  // cutlass
  s += p('M72 98C77 76 84 60 92 47C93 60 87 78 79 98Z', k.K, 1.8);
  s += ln('M68 92L84 96', '#d4a64a', 3);
  return { svg: s, top: [50, 18, 18], scar: [40, 54], sh: [24, 80] };
}

function knight(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = p('M8 100C8 80 20 68 36 66L64 66C80 68 92 80 92 100Z', M);
  s += p('M39 70L61 70L63 100L37 100Z', S, 2);
  s += p('M44 80L50 88L56 80L56 84L50 92L44 84Z', '#d4a64a', 1.2);
  const pd = 'M8 86C8 72 20 64 33 66C38 72 37 82 31 88C24 92 13 92 8 86Z';
  s += p(pd, M) + k.mir(p(pd, M));
  s += ln('M12 80C18 74 26 72 32 74', c.m.d, 1.6) + k.mir(ln('M12 80C18 74 26 72 32 74', c.m.d, 1.6));
  s += p('M50 6C53 10 54 14 52 16L48 16C46 14 47 10 50 6Z', c.s.b, 1.8);
  s += p('M50 14C66 14 72 26 72 42L72 61C72 68 64 72 50 72C36 72 28 68 28 61L28 42C28 26 34 14 50 14Z', M);
  s += f('M72 42L72 61C72 68 64 72 50 72L50 14C66 14 72 26 72 42Z', c.m.d, 0.32);
  s += ln('M50 16L50 40', c.m.l, 2, 0.8);
  s += p('M31 41L69 41L67 48L33 48Z', VOID, 1.8);
  s += k.eyes([[42, 44.5], [58, 44.5]], 1.9, { slant: 12 });
  for (const [x, y] of [[57, 56], [61, 56], [59, 60], [63, 60], [61, 64]] as Pt[]) s += k.fe(x, y, 1, 1, VOID);
  s += k.rim('M30 40C30 26 38 16 49 15');
  return { svg: s, top: [50, 15, 22], scar: [38, 56], sh: [76, 74] };
}

function cultist(c: C, k: Kit): Out {
  const { p, f, ln, M } = k;
  let s = p('M8 100C10 78 24 66 50 62C76 66 90 78 92 100Z', M);
  s += p('M43 66L57 66L61 100L39 100Z', c.m.d, 2) + ln('M43 66L39 100M57 66L61 100', '#d4a64a', 2);
  if (has(c, /witch|hag/)) {
    const skin = '#9ec27a';
    s += p('M24 40C20 60 26 76 34 80L66 80C74 76 80 60 76 40Z', '#3a2a2a');
    s += p('M50 30C62 30 66 40 65 50C64 62 58 70 50 70C42 70 36 62 35 50C34 40 38 30 50 30Z', skin);
    s += p('M49 46C52 52 58 58 53 61C51 61 49 58 48 56Z', skin, 1.8);
    s += p('M42 63Q50 69 58 63Q50 66 42 63Z', MOUTH, 1.6) + k.fang(46, 64, 2.6) + k.fang(54, 64.5, 2.6);
    s += k.eyes([[43, 46], [57, 46]], 2.4, { slant: 16 });
    s += k.brows(38, 40, 47, 43, 2.4);
    s += p('M30 34C38 22 46 12 62 4C58 14 64 24 70 34Z', M);
    s += p('M12 36C26 30 74 30 88 36C74 42 26 42 12 36Z', M);
    s += ln('M33 32L67 32', '#d4a64a', 3);
    return { svg: s, top: [52, 14, 14], scar: [56, 56], sh: [22, 82] };
  }
  s += p('M50 4C58 12 73 28 74 50C74 62 68 70 60 72L40 72C32 70 26 62 26 50C27 28 42 12 50 4Z', M);
  s += f('M74 50C74 62 68 70 60 72L56 72C64 64 68 54 67 42C66 30 60 18 54 9C64 18 74 32 74 50Z', c.m.d, 0.55);
  s += p('M50 28C60 28 64 40 63 52C62 62 56 68 50 68C44 68 38 62 37 52C36 40 40 28 50 28Z', VOID, 1.5);
  s += k.eyes([[44, 48], [56, 48]], 2.4, { slant: 16 });
  s += k.rim('M29 44C31 28 40 16 49 7');
  // orb or skull in hand
  s += `<circle cx="24" cy="76" r="13" fill="${k.G}" opacity="0.8"/>`;
  if (has(c, /necro|lich|bone|death/)) {
    s += p('M24 68C30 68 32 72 31 76C30 79 28 80 28 82L20 82C20 80 18 79 17 76C16 72 18 68 24 68Z', IVORY, 1.8);
    s += k.fe(21, 75, 1.8, 2, c.eye) + k.fe(27, 75, 1.8, 2, c.eye);
  } else {
    s += k.e(24, 75, 6.5, 6.5, c.eye, 1.6) + k.fe(22, 73, 2.2, 2.2, '#fff', 0.8);
  }
  s += p('M16 88C16 82 32 82 32 88C30 92 18 92 16 88Z', '#c9a080', 1.8);
  s += ln('M50 76L46 82L54 82Z', c.eye, 1.4, 0.8);
  return { svg: s, top: [50, 7, 12], scar: [60, 30], sh: [76, 80] };
}

function goblin(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = p('M18 100C20 82 30 72 50 70C70 72 80 82 82 100Z', S);
  s += ln('M26 80L66 100', c.s.d, 4);
  const ear = 'M31 45L7 33C12 46 19 53 32 55Z';
  s += p(ear, M) + k.mir(p(ear, M));
  s += f('M30 47L14 38C18 46 22 50 30 52Z', c.m.d, 0.6) + k.mir(f('M30 47L14 38C18 46 22 50 30 52Z', c.m.d, 0.6));
  if (has(c, /\bimp|demon|devil|kobold|fiend/)) {
    const horn = 'M39 29C34 21 35 14 39 9C41 16 44 22 45 27Z';
    s += p(horn, '#2a1d22', 2) + k.mir(p(horn, '#2a1d22', 2));
  }
  s += p('M50 24C65 24 73 34 72 46C71 60 62 72 50 74C38 72 29 60 28 46C27 34 35 24 50 24Z', M);
  s += f('M72 46C71 60 62 72 50 74L50 66C60 64 68 56 72 46Z', c.m.d, 0.45);
  s += k.eyes([[40, 45], [60, 45]], 4.2, { slant: 14 });
  s += k.fe(40, 45, 1.4, 2.6, INK) + k.fe(60, 45, 1.4, 2.6, INK);
  s += k.brows(33, 38, 46, 42, 3);
  s += p('M50 46C55 50 57 56 53 59C51 60 47 59 46 57Z', M, 1.8);
  s += p('M37 62Q50 74 63 62Q50 67 37 62Z', MOUTH, 2);
  for (const x of [42, 47, 53, 58]) s += k.fang(x, 63.6 + (x === 47 || x === 53 ? 0.9 : 0), 3);
  s += k.fe(64, 38, 1.6, 1.6, c.m.d) + k.fe(35, 56, 1.2, 1.2, c.m.d);
  s += k.rim('M30 40C32 30 40 25 49 25');
  return { svg: s, top: [50, 25, 18], scar: [60, 34], sh: [74, 82] };
}

function lizardfolk(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = ln('M86 98L88 22', '#6a4a30', 3.5) + p('M88 10L92 24L84 24Z', k.K, 1.6);
  s += p('M12 100C14 80 28 70 46 68C66 68 80 78 84 100Z', M);
  s += ln('M22 78L70 100', '#6a4a30', 4.5);
  s += p('M40 58L62 58L64 76L40 78Z', M);
  s += p('M58 22L62 7L67 19L75 10L75 27L86 23L77 39Z', S, 2);
  s += p('M58 21C70 23 77 33 75 43C73 52 67 56 60 58L27 64C19 64 15 58 17 52C19 46 25 44 33 42C38 31 46 21 58 21Z', M);
  s += f('M75 43C73 52 67 56 60 58L27 64C24 64 21 63 19 61C34 58 60 56 75 43Z', c.m.d, 0.5);
  s += p('M20 57Q40 58 62 54L58 62L27 64C22 64 19 61 20 57Z', MOUTH, 1.8);
  for (const x of [26, 32, 38, 44, 50]) s += k.fang(x, 57.5 - (x - 26) * 0.1, 3.2);
  s += k.fe(22, 50, 1.4, 1, INK);
  for (const [x, y] of [[50, 30], [56, 28], [62, 32], [46, 36]] as Pt[]) s += k.fe(x, y, 2, 1.4, c.m.l, 0.6);
  s += k.eyes([[44, 39]], 3.4, { slant: 18, slit: true }) + k.eyes([[64, 37]], 2.6, { slant: -18, slit: true });
  s += ln('M38 33L50 36M60 33L69 31', k.ol, 2.8);
  s += k.rim('M34 42C38 31 46 22 57 22');
  return { svg: s, top: [56, 22, 16], scar: [56, 46], sh: [24, 80] };
}

function brute(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const yeti = has(c, /yeti|sasquatch|bigfoot/);
  const troll = has(c, /troll/);
  let s = '';
  if (has(c, /ogre|giant|cyclops|troll/)) s += p('M74 98L88 46C90 38 99 42 96 50L81 99Z', '#6a4a30', 2.2) + k.e(92, 45, 6, 6, '#7a5638', 2);
  s += p('M2 100C2 74 22 58 50 58C78 58 98 74 98 100Z', M);
  s += f('M98 100C98 74 78 58 50 58C70 66 80 80 82 100Z', c.m.d, 0.4);
  if (yeti) s += ln('M10 78L16 72L20 80L26 70L30 78M90 78L84 72L80 80L74 70L70 78', c.m.l, 2, 0.7);
  else s += p('M22 100C24 84 34 74 50 74C66 74 76 84 78 100Z', '#5a4030', 2) + ln('M14 70L36 100', '#3d2c20', 5);
  const ear = troll ? 'M27 46L5 49L27 57Z' : 'M27 44L14 34L24 56Z';
  if (!yeti) s += p(ear, M) + k.mir(p(ear, M));
  if (has(c, /demon|devil|fiend|minotaur/)) {
    const horn = 'M34 26C24 22 18 12 20 4C26 12 32 16 40 20Z';
    s += p(horn, IVORY, 2) + k.mir(p(horn, IVORY, 2));
  }
  const head = yeti
    ? 'M50 14L58 18L66 16L70 24L77 28L76 38L82 46L76 54L80 62L72 70L66 78L50 80L34 78L28 70L20 62L24 54L18 46L24 38L23 28L30 24L34 16L42 18Z'
    : 'M50 20C64 20 72 28 72 40L77 58C75 70 65 78 50 78C35 78 25 70 23 58L28 40C28 28 36 20 50 20Z';
  s += p(head, M);
  s += f('M72 40L77 58C75 70 65 78 50 78L50 70C62 68 70 58 72 40Z', c.m.d, 0.4);
  if (yeti) s += p('M50 32C62 32 68 42 67 54C66 66 58 72 50 72C42 72 34 66 33 54C32 42 38 32 50 32Z', S, 2);
  if (has(c, /giant/) && !yeti) s += p('M28 58C30 76 42 88 50 88C58 88 70 76 72 58C64 66 56 68 50 68C44 68 36 66 28 58Z', '#7a4a2a');
  s += p('M28 41C36 35 45 38 50 42C55 38 64 35 72 41L72 46C64 41 56 45 50 47C44 45 36 41 28 46Z', yeti ? c.s.d : c.m.d, 1.8);
  s += k.eyes([[40, 47], [60, 47]], 2.5, { slant: 14 });
  const nose = troll ? 'M46 46C46 58 43 64 50 67C57 64 54 58 54 46Z' : 'M46 49C46 54 43 57 46 59L54 59C57 57 54 54 54 49Z';
  s += p(nose, yeti ? c.s.d : M, 1.8);
  s += ln('M36 65Q50 71 64 65', k.ol, 2.4);
  const tusk = 'M38 67L36 55L43 66Z';
  s += p(tusk, IVORY, 1.6) + k.mir(p(tusk, IVORY, 1.6));
  if (troll) s += p('M40 23C38 14 44 8 46 13C48 6 54 6 54 12C58 8 64 14 60 23C54 19 46 19 40 23Z', '#3a3a30', 2);
  s += k.rim('M26 40C28 28 37 21 48 21');
  return { svg: s, top: [50, yeti ? 16 : 21, 24], scar: [62, 40], sh: [18, 74] };
}

function skeleton(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = p('M8 100C10 80 24 70 50 68C76 70 90 80 92 100Z', S);
  s += f('M8 100L14 92L18 100L24 90L28 100ZM92 100L86 92L82 100L76 90L72 100Z', VOID, 0.8);
  const ribs = 'M36 80Q50 74 64 80M38 87Q50 81 62 87M40 94Q50 88 60 94';
  s += ln(ribs, k.ol, 5.5) + ln(ribs, c.m.b, 3);
  s += ln('M50 70L50 100', k.ol, 6.5) + ln('M50 70L50 100', c.m.d, 3.5);
  s += ln('M28 74L46 72M72 74L54 72', k.ol, 5.5) + ln('M28 74L46 72M72 74L54 72', c.m.b, 3);
  if (has(c, /wight|wraith|lich/)) {
    s += p('M50 6C70 8 80 26 80 46L84 66L72 60L66 70L50 62L34 70L28 60L16 66L20 46C20 26 30 8 50 6Z', S);
  }
  s += p('M50 15C66 15 74 27 74 41C74 51 70 57 64 59L64 67L36 67L36 59C30 57 26 51 26 41C26 27 34 15 50 15Z', M);
  s += f('M74 41C74 51 70 57 64 59L64 67L56 67C62 60 68 52 68 40C68 30 62 20 54 16C66 18 74 28 74 41Z', c.m.d, 0.45);
  const sock = 'M33 40C35 33 46 33 46 41C46 47 38 50 34 46Z';
  s += f(sock, VOID) + k.mir(f(sock, VOID));
  s += k.eyes([[40, 42], [60, 42]], 2.3, { ry: 1 });
  s += f('M50 47L46 54L54 54Z', VOID);
  s += ln('M38 59L62 59M42 59L42 66M46 59L46 67M50 59L50 67M54 59L54 67M58 59L58 66', k.ol, 1.4);
  s += ln('M58 17L56 25L60 29', c.m.d, 1.5);
  if (has(c, /warden|guard|soldier|knight/)) {
    s += p('M23 37C23 19 36 11 50 11C64 11 77 19 77 37L71 35C69 25 60 21 50 21C40 21 31 25 29 35Z', k.K, 2.2);
    s += ln('M50 21L50 46', k.ol, 6) + ln('M50 21L50 46', '#9a8a78', 3);
  }
  s += k.rim('M28 36C30 24 39 16 50 16');
  return { svg: s, top: [50, 13, 22], scar: [62, 26], sh: [22, 80] };
}

function zombie(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const mummy = has(c, /mumm/), drowned = has(c, /drown|sailor|sea|tide/);
  let s = p('M10 100C12 80 26 70 50 68C74 70 88 80 90 100Z', S);
  if (!mummy) s += p('M42 70L48 82L44 88L52 100L58 100L54 88L60 78L56 70Z', M, 2);
  else s += ln('M14 84L86 76M16 94L84 86', c.m.d, 2);
  s += p('M41 60L59 60L58 72L42 72Z', M);
  s += p('M48 18C64 16 74 28 72 44C72 58 66 70 52 74C38 74 28 64 28 48C28 32 34 20 48 18Z', M);
  s += f('M72 44C72 58 66 70 52 74L52 66C62 64 68 56 72 44Z', c.m.d, 0.45);
  if (mummy) {
    s += ln('M29 34L72 28M28 46L72 40M30 56L71 52M34 66L66 62', c.m.d, 2);
    s += p('M33 39L67 35L68 45L33 50Z', VOID, 0);
    s += k.eyes([[41, 44], [59, 41.5]], 2.6, { slant: 10 });
  } else {
    s += ln('M35 30L44 27M37 27L38 31M40 26L41 30M43 25L43 29', c.m.d, 1.6);
    s += k.eyes([[40, 44]], 3.6) + k.eyes([[60, 46]], 2.3);
    s += ln('M33 37L46 39M55 41L66 39', k.ol, 2.6);
    s += p('M40 60C44 55 58 55 62 60C60 69 44 70 40 60Z', MOUTH, 2);
    s += k.fang(46, 58, 3) + k.fang(55, 58, 3);
    s += f('M48 50L46 55L51 55Z', c.m.d);
    if (has(c, /ghoul|ghast|vampire/)) s += k.fang(44, 59, 5) + k.fang(58, 59, 5);
  }
  if (drowned) {
    s += ln('M34 22C30 32 34 42 30 52M62 20C68 28 66 38 70 46M44 18C42 26 46 30 44 36', '#3f7a3a', 3, 0.9);
    s += k.fe(66, 64, 1.6, 2.4, '#a8e0f0', 0.8) + k.fe(32, 60, 1.4, 2, '#a8e0f0', 0.8);
    s += k.e(60, 30, 2.4, 2, '#d8d0c0', 1.2) + k.e(64, 33, 1.6, 1.4, '#d8d0c0', 1);
  } else if (!mummy) {
    s += ln('M40 20C38 14 42 10 45 8M48 18C49 12 54 10 54 6', '#3a2a24', 2.2);
  }
  s += k.rim('M30 40C31 28 38 20 47 19');
  return { svg: s, top: [49, 18, 20], scar: [60, 32], sh: [22, 80] };
}

function ghost(c: C, k: Kit): Out {
  const { p, f, M } = k;
  let s = `<circle cx="50" cy="46" r="34" fill="${k.G}" opacity="0.35"/>`;
  if (has(c, /banshee/)) s += p('M50 8C28 8 18 28 22 48L10 60L24 58L30 70L40 60L50 66L60 60L70 70L76 58L90 60L78 48C82 28 72 8 50 8Z', c.m.d, 2);
  s += p('M50 9C70 9 80 25 80 45C80 61 84 73 90 83C80 81 76 87 70 93C66 85 60 87 54 95C50 87 44 87 38 95C34 87 28 85 22 91C22 81 18 75 11 73C19 63 20 55 20 45C20 25 30 9 50 9Z', M);
  const claw = 'M24 58C16 62 9 60 5 54L10 55L7 49L13 53L13 46L18 54C20 56 22 56 24 54Z';
  s += p(claw, M, 2) + k.mir(p(claw, M, 2));
  s += p('M50 22C62 22 68 34 67 46C66 57 58 64 50 64C42 64 34 57 33 46C32 34 38 22 50 22Z', VOID, 1.5);
  s += k.eyes([[43, 43], [57, 43]], 3.2, { slant: 16 });
  s += k.fe(50, 55, 2.6, 4, c.eye, 0.55);
  s += f('M80 45C80 61 84 73 90 83C80 81 76 87 70 93L66 70C72 62 74 52 72 40Z', c.m.d, 0.35);
  s += k.rim('M23 40C24 22 36 11 49 10', 0.9);
  return { svg: s, top: [50, 10, 22], scar: [62, 30], sh: [24, 70] };
}

function wisp(c: C, k: Kit): Out {
  const { p, M, S } = k;
  let s = `<circle cx="50" cy="50" r="42" fill="${k.G}" opacity="0.7"/>`;
  for (const [x, y, r] of [[36, 84, 2.2], [62, 88, 1.6], [48, 92, 1.3], [70, 80, 1.2]]) s += k.fe(x, y, r, r, c.s.l, 0.85);
  s += p('M50 10C55 24 68 26 72 42C76 58 66 76 50 76C34 76 24 60 28 44C30 34 38 30 40 18C44 26 47 22 50 10Z', M, 2);
  s += p('M50 32C54 40 62 44 62 54C62 64 56 70 50 70C44 70 38 64 38 54C38 46 46 42 50 32Z', S, 0);
  s += k.eyes([[44, 52], [56, 52]], 2.8, { slant: 18, dark: true, ry: 0.9 });
  s += k.p('M43 60Q50 66 57 60Q50 63 43 60Z', INK, 0);
  return { svg: s, top: [50, 16, 14], scar: [60, 44], sh: [60, 64] };
}

function dryad(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const bark = '#6a4a30';
  const antler = 'M40 24L30 8M34 16L24 14M32 11L34 4';
  let s = k.tube(antler, bark, 2.6) + k.mir(k.tube(antler, bark, 2.6));
  s += p('M50 12C66 12 80 20 82 34C88 46 84 60 76 68C80 80 70 90 60 86L40 86C30 90 20 80 24 68C16 60 12 46 18 34C20 20 34 12 50 12Z', M);
  for (const [x, y, a] of [[22, 40, -40], [80, 42, 40], [26, 64, -70], [76, 66, 70], [36, 18, -20], [64, 18, 20]] as [number, number, number][]) {
    s += `<path d="M${x} ${y - 6}C${x + 4} ${y - 2} ${x + 4} ${y + 2} ${x} ${y + 6}C${x - 4} ${y + 2} ${x - 4} ${y - 2} ${x} ${y - 6}Z" transform="rotate(${a} ${x} ${y})" fill="${c.m.l}" stroke="${k.ol}" stroke-width="1.5"/>`;
  }
  s += p('M26 100C28 84 38 76 50 74C62 76 72 84 74 100Z', S);
  s += p('M50 26C62 26 66 36 65 48C64 60 58 68 50 70C42 68 36 60 35 48C34 36 38 26 50 26Z', S);
  s += f('M65 48C64 60 58 68 50 70L50 62C58 60 62 54 65 48Z', c.s.d, 0.45);
  s += ln('M38 54L41 60M62 54L59 60M50 74L50 86', c.s.d, 1.4);
  s += p('M36 38C40 26 60 26 64 38C56 32 44 32 36 38Z', M, 1.6);
  s += k.eyes([[43, 46], [57, 46]], 2.4, { slant: 18 });
  s += k.brows(38, 40, 47, 43, 2.2);
  s += ln('M45 62Q50 60 55 62', MOUTH, 1.8);
  for (const [x, y] of [[30, 30], [72, 54], [28, 54]] as Pt[]) s += k.fe(x, y, 2.6, 2.6, '#f29ac0') + k.fe(x, y, 1, 1, '#ffd76a');
  return { svg: s, top: [50, 13, 18], scar: [58, 56], sh: [30, 86] };
}

function golem(c: C, k: Kit): Out {
  const { p, f, ln, M } = k;
  let s = p('M5 100L8 76L22 63L37 66L40 74L60 74L63 66L78 63L92 76L95 100Z', M);
  s += f('M92 76L95 100L72 100L70 76L78 63Z', c.m.d, 0.4);
  s += `<circle cx="50" cy="88" r="9" fill="${k.G}" opacity="0.8"/>`;
  s += ln('M50 81L56 92L44 92Z', c.eye, 2) + `<circle cx="50" cy="88" r="7.5" fill="none" stroke="${c.eye}" stroke-width="1.6"/>`;
  s += p('M32 21L50 15L68 21L72 44L66 65L34 65L28 44Z', M);
  s += f('M50 15L68 21L72 44L50 40Z', c.m.l, 0.35) + f('M72 44L66 65L50 65L50 40Z', c.m.d, 0.4);
  s += f('M30 21L50 15L68 21L60 18L50 17L40 18Z', '#5a8a3a', 0.9);
  s += p('M29 35L71 35L69 42L31 42Z', c.m.d, 2);
  s += k.eyes([[41, 47], [59, 47]], 4, { ry: 0.45 });
  s += ln('M41 57L45 59L50 56L55 59L59 57', c.eye, 2.2);
  s += ln('M36 24L40 30L37 34M64 52L68 56M20 70L26 76L24 82', c.m.d, 1.5);
  s += k.rim('M31 40L33 22L50 16');
  return { svg: s, top: [50, 16, 22], scar: [62, 26], sh: [80, 72] };
}

function slime(c: C, k: Kit): Out {
  const { p, f, M } = k;
  let s = k.fe(50, 90, 32, 5, INK, 0.35);
  s += p('M50 20C60 20 64 31 70 41C82 49 86 65 82 77C80 86 70 90 50 90C30 90 20 86 18 77C14 65 18 49 30 41C36 31 40 20 50 20Z', M);
  s += k.ln('M33 80L45 73', IVORY, 2.6, 0.5) + k.fe(32, 81, 2, 2, IVORY, 0.5) + k.fe(46, 72, 2, 2, IVORY, 0.5);
  for (const [x, y, r] of [[66, 72, 3], [30, 66, 2], [62, 48, 1.8], [72, 60, 1.4]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c.m.l}" stroke-width="1.2" opacity="0.8"/>`;
  s += f('M28 54C28 46 34 39 41 36C37 42 35 48 35 55Z', '#fff', 0.55) + k.fe(45, 30, 2, 2.6, '#fff', 0.6);
  s += k.eyes([[40, 58], [60, 58]], 4.4, { dark: true, slant: 14, ry: 0.85 });
  s += k.brows(33, 50, 46, 54, 2.6);
  s += p('M38 68Q50 78 62 68Q50 73 38 68Z', c.m.d, 1.8);
  s += f('M28 88C28 94 32 95 32 88ZM70 89C70 96 75 96 75 89Z', c.m.b);
  return { svg: s, top: [50, 21, 16], scar: [64, 42], sh: [76, 68] };
}

function dragon(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  let s = p('M62 62L76 18L82 30L90 26L89 40L96 44L82 58Z', S);
  s += ln('M76 18L74 56M90 26L78 56M96 44L80 58', c.s.d, 1.8);
  s += p('M56 100C54 84 56 70 62 60L82 64C78 76 78 88 82 100Z', M);
  for (const y of [72, 80, 88, 96]) s += ln(`M${60 - (y - 72) * 0.08} ${y}L${76 - (y - 72) * 0.05} ${y + 2}`, c.s.b, 3);
  s += p('M82 64L90 66L84 72L90 76L82 80Z', S, 1.8);
  s += p('M64 24C70 12 80 7 90 9C82 13 77 20 73 28Z', IVORY, 2);
  s += p('M56 24C56 14 60 8 66 4C64 12 63 18 63 26Z', IVORY, 2);
  s += p('M62 22C74 24 80 34 78 46C76 56 68 61 60 63L58 66L25 66C18 66 13 60 15 54C17 48 23 46 29 46L34 40C40 30 50 22 62 22Z', M);
  s += f('M78 46C76 56 68 61 60 63L58 66L40 66C56 60 70 54 78 46Z', c.m.d, 0.5);
  s += p('M58 61L24 66C21 72 24 77 31 77L58 72Z', M);
  s += p('M57 62L26 66L30 72L57 69Z', MOUTH, 1.5);
  for (const x of [30, 36, 42, 48]) s += k.fang(x, 65.4 - (x - 30) * 0.12, 3.5) + k.fang(x + 3, 71.5 - (x - 30) * 0.06, 3, true);
  s += k.fe(21, 52, 1.6, 1.2, INK);
  s += ln('M36 40L52 35M60 31L72 30', k.ol, 3);
  s += k.eyes([[46, 41]], 3.6, { slant: 16, slit: true }) + k.eyes([[66, 37]], 2.6, { slant: -16, slit: true });
  for (const [x, y] of [[54, 52], [62, 48], [68, 54]] as Pt[]) s += ln(`M${x - 3} ${y}Q${x} ${y + 3} ${x + 3} ${y}`, c.m.d, 1.4);
  s += k.rim('M34 40C40 30 50 23 61 23');
  return { svg: s, top: [60, 22, 18], scar: [52, 48], sh: [70, 82] };
}

function elemental(c: C, k: Kit): Out {
  const { p, M, S } = k;
  let s = `<circle cx="50" cy="52" r="38" fill="${k.G}" opacity="0.45"/>`;
  s += p('M50 7C58 17 54 24 62 30C72 36 74 46 70 56C78 60 87 70 84 83L76 78C72 87 64 93 50 94C36 93 28 87 24 78L16 83C13 70 22 60 30 56C26 46 28 36 38 30C42 24 44 17 50 7Z', M);
  s += k.ln('M24 76C30 70 30 64 34 60M76 76C70 70 70 64 66 60M58 20C62 26 66 30 66 36', c.m.l, 2, 0.7);
  s += p('M50 30C56 36 62 40 62 52C62 66 58 78 50 84C42 78 38 66 38 52C38 42 46 38 50 30Z', S, 0);
  s += k.eyes([[44, 48], [56, 48]], 3, { dark: true, slant: 20, ry: 0.7 });
  s += k.p('M43 60L46 58L48 61L50 58L52 61L54 58L57 60C55 66 45 66 43 60Z', INK, 0);
  s += k.rim('M30 54C28 42 34 32 44 24', 0.8);
  return { svg: s, top: [50, 12, 16], scar: [58, 70], sh: [70, 64] };
}

function treant(c: C, k: Kit): Out {
  const { p, f, ln, M, S } = k;
  const br = 'M38 30L28 20L20 22M30 22L30 12M62 30L72 20L80 22M70 22L70 12';
  let s = k.tube(br, c.m.b, 4.5);
  for (const [x, y, r] of [[20, 24, 11], [34, 12, 11], [50, 9, 9], [66, 12, 11], [80, 24, 11]]) s += k.e(x, y, r, r * 0.85, S, 2);
  s += k.fe(30, 9, 4, 2.5, c.s.l, 0.6) + k.fe(62, 9, 4, 2.5, c.s.l, 0.6);
  const arm = 'M32 70C22 66 14 58 10 50M14 58L5 60';
  s += k.tube(arm, c.m.b, 5) + k.mir(k.tube(arm, c.m.b, 5));
  s += p('M28 100L32 60C30 44 33 30 42 25L58 25C67 30 70 44 68 60L72 100Z', M);
  s += f('M58 25C67 30 70 44 68 60L72 100L60 100L62 60C64 46 62 32 58 25Z', c.m.d, 0.45);
  s += ln('M38 30L36 42M62 32L64 40M36 72L38 92M46 76L45 98M56 78L57 96M64 72L62 90', c.m.d, 1.8);
  s += p('M33 42C38 38 46 40 49 46L33 47Z', c.m.d, 1.8) + k.mir(p('M33 42C38 38 46 40 49 46L33 47Z', c.m.d, 1.8));
  s += k.e(42, 51, 5, 4, VOID, 1.5) + k.e(58, 51, 5, 4, VOID, 1.5);
  s += k.eyes([[42, 51], [58, 51]], 2.4, { slant: 14 });
  s += p('M39 64L43 60L47 64L51 59L55 64L59 61L61 64C60 75 40 75 39 64Z', VOID, 1.8);
  s += f('M30 56C34 54 36 58 33 60Z', '#7ab84a', 0.9);
  s += k.rim('M32 58C30 44 34 31 42 26');
  return { svg: s, top: [50, 4, 18], scar: [62, 70], sh: [30, 66] };
}

function mimic(c: C, k: Kit): Out {
  const { p, f, ln, M, O } = k;
  let s = k.fe(50, 92, 36, 5, INK, 0.35);
  s += p('M14 46C16 20 84 20 86 46L82 52L18 52Z', M);
  s += ln('M30 25L30 50M70 25L70 50', k.ol, 6) + ln('M30 25L30 50M70 25L70 50', '#d4a64a', 3.5);
  s += p('M18 50L82 50L84 62L16 62Z', MOUTH, 2);
  for (const x of [24, 32, 40, 48, 56, 64, 72]) s += k.fang(x + 2, 51, 5);
  for (const x of [28, 36, 44, 52, 60, 68, 76]) s += k.fang(x, 61, 4.5, true);
  s += p('M16 60L84 60L81 91L19 91Z', M);
  s += f('M84 60L81 91L66 91L68 60Z', c.m.d, 0.45);
  s += ln('M30 60L30 91M70 60L70 91M18 75L82 75', k.ol, 6) + ln('M30 60L30 91M70 60L70 91M18 75L82 75', '#d4a64a', 3.5);
  s += p('M44 64L56 64L56 74L44 74Z', O, 1.8);
  s += k.fe(50, 68, 1.6, 2.2, INK);
  s += p('M34 58C28 70 32 82 42 85C49 85 50 78 46 76C42 74 40 66 43 58Z', '#d84a6a', 2);
  s += k.eyes([[38, 36], [62, 36]], 3.2, { slant: 18 });
  s += k.brows(32, 30, 43, 33, 2.6);
  s += k.rim('M18 44C20 30 32 24 50 24');
  return { svg: s, top: [50, 24, 22], scar: [76, 82], sh: [16, 66] };
}

// ---------- registry ----------
const A: Record<string, Arch> = {
  wolf: { base: '#7d8597', sec: '#e8e2d4', eye: '#ffd23a', draw: (c, k) => wolf(c, k), tune: (n) => (/hell|fire/.test(n) ? {} : /warg|worg/.test(n) ? { base: '#5a4a3e' } : /jackal|coyote|fox/.test(n) ? { base: '#c08a4a' } : {}) },
  gnoll: { base: '#b08a52', sec: '#e2cf9e', eye: '#ffb84a', draw: (c, k) => wolf(c, k, true) },
  boar: { base: '#6e4b3a', sec: '#d39a8c', eye: '#ff5a3a', draw: boar },
  bear: { base: '#7a5236', sec: '#c49a6c', eye: '#ffb84a', draw: bear, tune: (n) => (/polar|white/.test(n) ? { base: '#e6e8ec', sec: '#c8ccd4' } : {}) },
  owlbear: { base: '#8a6440', sec: '#e2cfa6', eye: '#ffb02e', draw: owlbear },
  spider: { base: '#4a3b52', sec: '#c8323c', eye: '#ff5a4a', draw: spider },
  serpent: { base: '#4f8a4a', sec: '#d8d08a', eye: '#ffd23a', draw: serpent, tune: (n) => (/\beel/.test(n) ? { base: '#3f6a7a' } : {}) },
  bird: {
    base: '#6b4a30', sec: '#f2efe6', eye: '#ffcf3a', draw: bird,
    tune: (n) => (/raven|crow|vulture/.test(n) ? { base: '#2e2a3a', sec: '#4a4458' } : /griffin|gryphon/.test(n) ? { base: '#c49a5a' } : /hawk|falcon/.test(n) ? { base: '#8a5a34', sec: '#e8d8b8' } : {}),
  },
  harpy: { base: '#7a5a6e', sec: '#d8c2a8', eye: '#ffd23a', draw: harpy },
  bat: { base: '#4a3a5c', sec: '#6a5378', eye: '#ff4a5a', draw: bat },
  rat: { base: '#7b6e66', sec: '#c9b8a6', eye: '#ff4a4a', draw: rat },
  scorpion: { base: '#b5713a', sec: '#e0a060', eye: '#ff5a3a', draw: scorpion },
  crab: { base: '#d0553a', sec: '#f0b090', eye: '#ffd23a', draw: crab },
  bandit: {
    base: '#4b5d4a', sec: '#a33a3a', eye: '#f4e6a0', draw: bandit,
    tune: (n, r) => (/assassin|shadow/.test(n) ? { base: '#2e2a3e', sec: '#2a2636', eye: '#ff5a5a' } : { base: pick(['#4b5d4a', '#5c4636', '#3f4a66', '#6a3b3b'], r) }),
  },
  pirate: { base: '#7a2632', sec: '#f3ecd8', eye: '#f4e6a0', draw: pirate, tune: (_n, r) => ({ base: pick(['#7a2632', '#2f3f6a', '#3a5a4a'], r) }) },
  knight: { base: '#9aa4b4', sec: '#2f4f8c', eye: '#ff6a4a', draw: knight, tune: (n, r) => (/black|dark|death|shadow/.test(n) ? { base: '#4a4658', sec: '#5a1f24' } : { sec: pick(['#2f4f8c', '#8c2f39', '#2f6a4a'], r) }) },
  cultist: {
    base: '#5a2a4a', sec: '#d4a64a', eye: '#d36bff', draw: cultist,
    tune: (n, r) => (/necro|lich|death/.test(n) ? { base: '#2a3a2e', eye: '#7dff8a' } : /mage|wizard|sorcer|conjur|enchant/.test(n) ? { base: '#2f4a8c', eye: '#7fe8ff' } : /witch|hag/.test(n) ? { base: '#3a2a4a', eye: '#d8ff6a' } : /druid|shaman/.test(n) ? { base: '#4a5a2a', eye: '#d8ff6a' } : { base: pick(['#5a2a4a', '#6a1f24', '#2a2a4a'], r) }),
  },
  goblin: {
    base: '#6f9a3e', sec: '#6a4a30', eye: '#ffd23a', draw: goblin,
    tune: (n) => (/\bimp|demon|devil|fiend/.test(n) ? { base: '#b8423a' } : /kobold/.test(n) ? { base: '#b8662e' } : /hobgoblin|bugbear/.test(n) ? { base: '#c0703a' } : {}),
  },
  lizardfolk: { base: '#4f8a5a', sec: '#d8763a', eye: '#ffd23a', draw: lizardfolk },
  brute: {
    base: '#5f8a3a', sec: '#7a8aa8', eye: '#ff5a3a', draw: brute,
    tune: (n) => (/yeti|sasquatch/.test(n) ? { base: '#e8eef4', sec: '#7a8aa8', eye: '#7fe8ff' } : /troll/.test(n) ? { base: '#6f8a7a' } : /ogre/.test(n) ? { base: '#b89a64' } : /giant|cyclops/.test(n) ? { base: '#c99a76' } : /demon|devil|fiend/.test(n) ? { base: '#a8322e', eye: '#ffd23a' } : /minotaur/.test(n) ? { base: '#7a4a30' } : /\borc|orcish/.test(n) ? {} : { base: '#8a6a50' }),
  },
  skeleton: { base: '#e2d8bf', sec: '#3a3446', eye: '#7dfcff', draw: skeleton, tune: (n) => (/wight|lich/.test(n) ? { eye: '#9dff7a' } : {}) },
  zombie: {
    base: '#8aa86a', sec: '#5a5a7a', eye: '#e8f07a', draw: zombie,
    tune: (n) => (/mumm/.test(n) ? { base: '#d8ccaa', sec: '#b8a880', eye: '#7dfcff' } : /drown|sailor/.test(n) ? { base: '#7aa8a0', sec: '#3f5a6a', eye: '#a8f0ff' } : /ghoul|ghast|vampire/.test(n) ? { base: '#a8a89a', sec: '#3a2a3a', eye: '#ff4a4a' } : {}),
  },
  ghost: { base: '#a8c4e8', sec: '#a8c4e8', eye: '#c8f8ff', draw: ghost, fade: true, tintSec: true },
  wisp: { base: '#7af0d0', sec: '#f6ffe8', eye: '#9affe0', draw: wisp, fade: true, tintSec: true },
  dryad: { base: '#4f9a4a', sec: '#b8d49a', eye: '#d8ff6a', draw: dryad },
  golem: { base: '#8a8478', sec: '#6a6458', eye: '#7ff2ff', draw: golem, tune: (n) => (/ancient|guardian|statue/.test(n) ? { base: '#a09a88', eye: '#ffc84a' } : /iron|construct|automaton/.test(n) ? { base: '#7a8494', eye: '#ff7a3a' } : {}) },
  slime: { base: '#6fcf5a', sec: '#a8f08a', eye: '#1b1b24', draw: slime, fade: true, tune: (n) => (/ooze|pudding/.test(n) ? { base: '#7a5a9a' } : {}) },
  dragon: { base: '#b8362e', sec: '#e0a050', eye: '#ffd23a', draw: dragon, tune: (n) => (/green/.test(n) ? { base: '#3f8a4a' } : /blue/.test(n) ? { base: '#3a5aa8' } : /black/.test(n) ? { base: '#3a3446' } : /gold/.test(n) ? { base: '#d4a64a' } : {}) },
  elemental: { base: '#e8662a', sec: '#ffe08a', eye: '#ffe08a', draw: elemental, fade: true, tintSec: true },
  treant: { base: '#7a5a3a', sec: '#5a9a3a', eye: '#d8ff6a', draw: treant },
  mimic: { base: '#8a5a34', sec: '#d4a64a', eye: '#ff5a3a', draw: mimic },
};

/** Ordered keyword rules; first match wins. Specific creatures before generic roles. */
const RULES: [string, RegExp][] = [
  ['mimic', /mimic|treasure|\bchest/],
  ['owlbear', /owl ?bear/],
  ['harpy', /harp(y|ies)|siren/],
  ['gnoll', /gnoll|hyena/],
  ['lizardfolk', /lizard|saurian|troglodyte|croc|gator|salamand(er)?folk/],
  ['wisp', /wisp|will-o|wil-o|corpse ?light|firefl/],
  ['dryad', /dryad|nymph|\bfey\b|\bfae\b|faerie|fairy|sprite|pixie|sylph/],
  ['elemental', /elemental|salamander|\bdjinn|genie|efreet|ifrit/],
  ['golem', /golem|guardian|statue|construct|automaton|colossus|gargoyle|animated|sentinel stone/],
  ['slime', /slime|ooze|jelly|blob|pudding|gelatin/],
  ['dragon', /dragon|drake|wyvern|wyrm|hydra/],
  ['spider', /spider|arachn|tarantula|widow|beetle|mantis|\bants?\b|wasp|hornet|centipede|scarab|locust|\btick|insect|\bbug\b/],
  ['scorpion', /scorpion/],
  ['crab', /crab|lobster|crustacean/],
  ['bat', /\bbats?\b|chiropter/],
  ['rat', /\brat\b|\brats\b|ratling|rat king|wererat|rodent|vermin|\bmice\b|\bmouse/],
  ['serpent', /serpent|snake|\beels?\b|viper|cobra|python|adder|\basp\b|basilisk|naga|\bworm|wurm|leviathan|kraken|tentacle|octopus|squid/],
  ['bird', /eagle|hawk|\bbird|griffin|gryphon|falcon|vulture|raven|\bcrows?\b|\broc\b|\bowl\b|condor|cockatrice|phoenix/],
  ['boar', /\bboars?\b|\bpig|\bhog|swine|warthog|razorback|\bbull\b|\bram\b|goat|\bstag|\belk\b|deer|moose|bison|\bhorse|\box\b|rhino/],
  ['bear', /\bbears?\b|grizzly|ursine|bugbear/],
  ['wolf', /wolf|wolves|hound|\bdogs?\b|jackal|warg|worg|coyote|\bfox|cerberus|\bcur\b|lion|tiger|panther|leopard|cougar|lynx|sabre|saber|\bcat\b|jaguar|manticore/],
  ['skeleton', /skelet|wight|warden|\bbones?\b|\blich|revenant|death knight|barrow/],
  ['zombie', /zombie|mumm|ghoul|ghast|drowned|corpse|draugr|risen|vampire|husk|undead/],
  ['ghost', /ghost|wraith|banshee|spirit|phantom|spectre|specter|\bshade\b|apparition|poltergeist|haunt|wisp/],
  ['goblin', /goblin|kobold|\bimps?\b|gremlin|redcap/],
  ['treant', /treant|\bent\b|tree|plant|vine|thorn|briar|bramble|shambler|myconid|fung|flytrap|mandrake/],
  ['brute', /\borcs?\b|orcish|ogre|troll|giant\b|yeti|sasquatch|brute|cyclops|minotaur|demon|devil|fiend|behemoth|bugbear/],
  ['knight', /knight|\bguards?\b|guardsman|soldier|sentinel|sentry|paladin|legion|templar|warrior|watchm|footman|mercenar|champion|gladiator|squire|militia|man-at-arms|crusader/],
  ['cultist', /\bcult|witch|\bhag\b|mage|wizard|sorcer|necromancer|warlock|shaman|druid|priest|acolyte|zealot|conjur|enchant|occult|magus|heretic|oracle/],
  ['pirate', /pirate|buccaneer|corsair|privateer|wrecker|sailor|deckhand|swashbuckl/],
  ['bandit', /bandit|raider|highway|brigand|thief|thieves|ambush|captain|assassin|rogue|cutthroat|outlaw|poacher|smuggler|thug|marauder|mugger|footpad|deserter|bounty|hunter|scout|stalker|reaver|pillager|\belf\b|\bdrow|ranger|archer|duelist/],
];
const FALLBACK: Record<EnemyKind, string> = { beast: 'wolf', humanoid: 'bandit', undead: 'skeleton', monster: 'brute', spirit: 'ghost' };

interface Mod { id: string; re: RegExp; base: string; eye: string }
const MODS: Mod[] = [
  { id: 'frost', re: /frost|\bice\b|\bicy|snow|winter|glacial|frozen|rime|blizzard|polar|tundra/, base: '#9fc9e8', eye: '#7fe8ff' },
  { id: 'fire', re: /fire|ember|flame|lava|magma|infern|burning|blaze|cinder|molten|\bash(en)?\b|hell|scorch|pyre/, base: '#c8462a', eye: '#ffd23a' },
  { id: 'shadow', re: /shadow|void|\bdark|\bnight|umbra|abyss|gloom|nether|dusk/, base: '#4b2f6e', eye: '#e07aff' },
  { id: 'bog', re: /\bbog|marsh|swamp|mire|\bfen\b|plague|\brot|blight|toxic|venom|poison/, base: '#6f8a3e', eye: '#d8f05a' },
  { id: 'sand', re: /sand|desert|dune|dust/, base: '#c9a26a', eye: '#ffb347' },
  { id: 'storm', re: /storm|lightning|thunder|tempest|\bwind|\bair\b/, base: '#8fa8e0', eye: '#fff6a0' },
  { id: 'water', re: /\bwater|\btide|\bsea\b|ocean|\bwave|deep/, base: '#3f8cc9', eye: '#a8f0ff' },
  { id: 'earth', re: /\bearth|\bstone|\brock|\bmud\b|\bclay|granite/, base: '#8f8170', eye: '#ffb84a' },
];
const BULK = /giant|dire|elder|ancient|great|huge|colossal|matron|alpha|brood|king|queen|greater|massive|old/;
const SMALL = /\bcub|\bpup|young|whelp|lesser|baby|small|hatchling|runt|tiny|little/;

function matchArch(nm: string): string | null {
  for (const [id, re] of RULES) if (re.test(nm)) return id;
  return null;
}

/** The archetype id chosen for a foe (name keywords first, then a per-kind fallback). */
export function foeArchetype(name: string, kind: EnemyKind): string {
  return matchArch(name.toLowerCase()) ?? FALLBACK[kind] ?? 'brute';
}

function particles(mod: string, r: () => number): string {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.92 + (i + r()) * 0.24);
    const rad = 33 + r() * 9;
    const x = +(50 + Math.cos(a) * rad).toFixed(1), y = +(50 + Math.sin(a) * rad).toFixed(1);
    const z = +(0.7 + r() * 0.7).toFixed(2);
    if (mod === 'frost') s += `<path d="M${x} ${y - 3 * z}L${x + 0.8 * z} ${y - 0.8 * z}L${x + 3 * z} ${y}L${x + 0.8 * z} ${y + 0.8 * z}L${x} ${y + 3 * z}L${x - 0.8 * z} ${y + 0.8 * z}L${x - 3 * z} ${y}L${x - 0.8 * z} ${y - 0.8 * z}Z" fill="#effcff" opacity="0.9"/>`;
    else if (mod === 'fire') s += `<circle cx="${x}" cy="${y}" r="${(1.6 * z).toFixed(1)}" fill="#ffb347"/><circle cx="${x}" cy="${y}" r="${(0.7 * z).toFixed(1)}" fill="#fff2b0"/>`;
    else if (mod === 'shadow') s += `<path d="M${x} ${y}q3 -4 0 -8" fill="none" stroke="#b07ae8" stroke-width="${(1.6 * z).toFixed(1)}" stroke-linecap="round" opacity="0.7"/>`;
    else if (mod === 'bog') s += `<circle cx="${x}" cy="${y}" r="${(2 * z).toFixed(1)}" fill="none" stroke="#c8e870" stroke-width="1.1" opacity="0.8"/>`;
    else if (mod === 'sand') s += `<circle cx="${x}" cy="${y}" r="${(1.1 * z).toFixed(1)}" fill="#ecd29a" opacity="0.7"/>`;
    else if (mod === 'storm') s += `<path d="M${x} ${y - 3}l-2 3h3l-2 3" fill="none" stroke="#fff6a0" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  return s;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
}

/** Illustrated monster portrait (SVG string, viewBox 0 0 100 100, transparent background). */
export function foeArt(spec: { name: string; kind: EnemyKind }, opts: { tier?: number; boss?: boolean } = {}): string {
  const nm = spec.name.toLowerCase();
  const archId = foeArchetype(spec.name, spec.kind);
  const arch = A[archId] ?? A.brute;
  const r = mulberry32(hashString(`${nm}|${spec.kind}`));
  const tier = Math.max(1, Math.min(5, Math.round(opts.tier ?? 1)));
  const boss = !!opts.boss;
  const t = arch.tune?.(nm, r) ?? {};
  let base = t.base ?? arch.base, sec = t.sec ?? arch.sec, eye = t.eye ?? arch.eye;
  const mod = MODS.find((m) => m.re.test(nm)) ?? null;
  if (mod) {
    base = mod.base;
    if (arch.tintSec) sec = mix(mod.base, '#ffffff', 0.55);
    if (archId !== 'slime') eye = mod.eye;
  }
  const id = `fa${(++uid).toString(36)}`;
  const c: C = { id, nm, m: pal(base), s: pal(sec), eye, ol: mix(base, '#14101c', 0.8), tier, r };
  const k = kit(c);
  const out = arch.draw(c, k);

  let extra = '';
  if (tier >= 2 && out.scar) {
    const [x, y] = out.scar;
    extra += k.ln(`M${x - 5} ${y - 5}L${x + 5} ${y + 5}`, '#ff9a8a', 2.2, 0.9) + k.ln(`M${x - 3.5} ${y + 0.5}L${x + 0.5} ${y - 3.5}M${x + 0.5} ${y + 4.5}L${x + 4.5} ${y + 0.5}`, '#ff9a8a', 1.3, 0.8);
  }
  if (tier >= 3 && out.sh) {
    const pauld = (x: number, y: number) =>
      k.p(`M${x - 10} ${y + 4}C${x - 10} ${y - 7} ${x + 10} ${y - 7} ${x + 10} ${y + 4}C${x + 4} ${y + 1} ${x - 4} ${y + 1} ${x - 10} ${y + 4}Z`, k.K, 2) +
      (tier >= 4 ? k.p(`M${x - 4} ${y - 3}L${x} ${y - 11}L${x + 4} ${y - 3}Z`, k.K, 1.6) : '');
    extra += pauld(out.sh[0], out.sh[1]);
  }
  const size = BULK.test(nm) ? ' transform="translate(50 70) scale(1.09 1.05) translate(-50 -70)"' : SMALL.test(nm) ? ' transform="translate(50 92) scale(0.84) translate(-50 -92)"' : '';
  let crown = '';
  if (boss) {
    const [x, y, w] = out.top, sc = (w / 19).toFixed(2);
    crown = `<g transform="translate(${x} ${y + 2}) rotate(-8) scale(${sc})">${k.p('M-12 0L-13 -11L-6 -5L0 -15L6 -5L13 -11L12 0Z', k.O, 2.4)}<circle cx="0" cy="-4" r="2.2" fill="#e0405a"/><circle cx="-7" cy="-3" r="1.3" fill="#5ad0ff"/><circle cx="7" cy="-3" r="1.3" fill="#5ad0ff"/></g>`;
  }
  const auraCol = boss ? '#ffd76a' : tier >= 5 ? '#e94057' : '';
  const aura = auraCol ? `<circle cx="50" cy="50" r="48" fill="url(#${id}a)"/>` : '';
  const fadeEnd = arch.fade ? '0.55' : '1';
  const defs =
    `<linearGradient id="${id}m" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${c.m.l}"/><stop offset="0.45" stop-color="${c.m.b}"/><stop offset="1" stop-color="${c.m.d}" stop-opacity="${fadeEnd}"/></linearGradient>` +
    `<linearGradient id="${id}s" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${c.s.l}"/><stop offset="0.5" stop-color="${c.s.b}"/><stop offset="1" stop-color="${c.s.d}"/></linearGradient>` +
    `<linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef3f8"/><stop offset="0.5" stop-color="#a8b2c2"/><stop offset="1" stop-color="#5c6676"/></linearGradient>` +
    `<linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset="0.5" stop-color="#ffd76a"/><stop offset="1" stop-color="#b8862e"/></linearGradient>` +
    `<radialGradient id="${id}g"><stop offset="0" stop-color="${eye === INK ? '#ffffff' : eye}"/><stop offset="1" stop-color="${eye === INK ? '#ffffff' : eye}" stop-opacity="0"/></radialGradient>` +
    (auraCol ? `<radialGradient id="${id}a"><stop offset="0.45" stop-color="${auraCol}" stop-opacity="${boss ? 0.5 : 0.3}"/><stop offset="1" stop-color="${auraCol}" stop-opacity="0"/></radialGradient>` : '') +
    `<clipPath id="${id}c"><circle cx="50" cy="50" r="47"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="foe-art" role="img" aria-label="${esc(spec.name)}"><defs>${defs}</defs>${aura}<g clip-path="url(#${id}c)" stroke-linejoin="round" stroke-linecap="round"><g${size}>${out.svg}${extra}${crown}</g>${mod ? particles(mod.id, r) : ''}</g></svg>`;
}
