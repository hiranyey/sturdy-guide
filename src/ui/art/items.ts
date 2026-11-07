// Procedural item icons: weapons, armour, charms and a few HUD glyphs.
// Storybook flat-vector to match the hero/monster art: bold silhouettes with ink outlines,
// 2–3 tone gradients, a light rim on the upper-left edges. Every icon is a 64-unit square SVG
// with a transparent background; weapons lie on the diagonal like classic RPG inventory icons.
// Deterministic (seeded from the item name) and self-contained: no images, text, fonts or filters.
import { hashString, mulberry32 } from '../../core/rng';
import type { Stat } from '../../core/types';

export interface ItemArtInput {
  slot: 'weapon' | 'armor' | 'charm';
  name: string;
  tier: number;
  plus: number;
  stat?: Stat;
  die?: number;
}

type Tone = readonly [string, string, string]; // light, base, dark
type Spot = readonly [number, number, number]; // x, y, scale: where material effects may go
type Rand = () => number;

const OL = '#1b1b24';
let seq = 0;

const n = (v: number) => Math.round(v * 10) / 10;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const tone = (c: string): Tone => [mix(c, '#ffffff', 0.5), c, mix(c, '#000000', 0.45)];

/** Collects <defs> for one SVG; ids are unique per call so many icons can share a page. */
class Art {
  private readonly p = `it${(seq++).toString(36)}_`;
  private k = 0;
  defs = '';
  private id(): string {
    return this.p + (this.k++).toString(36);
  }
  lin(t: Tone, dir: 'h' | 'v' | 'd' = 'd'): string {
    const id = this.id();
    const [x2, y2] = dir === 'h' ? [1, 0] : dir === 'v' ? [0, 1] : [1, 1];
    this.defs += `<linearGradient id="${id}" x2="${x2}" y2="${y2}"><stop stop-color="${t[0]}"/><stop offset=".45" stop-color="${t[1]}"/><stop offset="1" stop-color="${t[2]}"/></linearGradient>`;
    return `url(#${id})`;
  }
  /** Radial gradient; stops are [offset, colour, opacity?]. */
  rad(stops: readonly (readonly [number, string, number?])[], cx = 0.5, cy = 0.5, r = 0.5): string {
    const id = this.id();
    const s = stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${n(op * 100) / 100}"`}/>`).join('');
    this.defs += `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${s}</radialGradient>`;
    return `url(#${id})`;
  }
  pat(w: number, h: number, body: string): string {
    const id = this.id();
    this.defs += `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;
    return `url(#${id})`;
  }
  out(body: string, size: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="item-art" aria-hidden="true" stroke="${OL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${this.defs ? `<defs>${this.defs}</defs>` : ''}${body}</svg>`;
  }
}

// --- drawing primitives (the root <svg> supplies the ink outline) ---
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const line = (d: string, c: string, w = 1.2, op = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
const shade = (d: string, c: string, op = 0.35) => `<path d="${d}" fill="${c}" stroke="none" opacity="${op}"/>`;
const rope = (d: string, c: string, w: number) => line(d, OL, w + 2) + line(d, c, w);
const circ = (x: number, y: number, r: number, fill: string, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;
const ell = (x: number, y: number, rx: number, ry: number, fill: string, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`;
const NOSTROKE = ' stroke="none"';

function sparkle(x: number, y: number, s: number, fill = '#fffbe6', ink = '#b8862a', w = 0.8): string {
  const k = s * 0.22;
  const p = (dx: number, dy: number) => `${n(x + dx)} ${n(y + dy)}`;
  return `<path d="M${p(0, -s)}Q${p(k, -k)} ${p(s, 0)}Q${p(k, k)} ${p(0, s)}Q${p(-k, k)} ${p(-s, 0)}Q${p(-k, -k)} ${p(0, -s)}Z" fill="${fill}" stroke="${ink}" stroke-width="${w}"/>`;
}

function star5(cx: number, cy: number, ro: number, ri: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI * i) / 5 - Math.PI / 2, rr = i % 2 ? ri : ro;
    d += `${i ? 'L' : 'M'}${n(cx + rr * Math.cos(ang))} ${n(cy + rr * Math.sin(ang))}`;
  }
  return d + 'Z';
}

function gem(a: Art, x: number, y: number, r: number, c: string): string {
  return circ(x, y, r, a.rad([[0, mix(c, '#ffffff', 0.65)], [0.55, c], [1, mix(c, '#000000', 0.45)]], 0.35, 0.35, 0.7), ' stroke-width="1.5"') +
    circ(x - r * 0.35, y - r * 0.35, r * 0.28, '#fff', ' stroke="none" opacity=".85"');
}

const glow = (a: Art, x: number, y: number, r: number, c: string, op = 0.7) =>
  circ(x, y, r, a.rad([[0, c, op], [0.45, c, op * 0.45], [1, c, 0]]), NOSTROKE);

/** Map local "upright" weapon coordinates to the 45° inventory diagonal. */
const R45 = 'rotate(45 32 32)';
const rot45 = (x: number, y: number): [number, number] => [n(32 + (x - 32 - (y - 32)) * 0.7071), n(32 + (x - 32 + (y - 32)) * 0.7071)];

// --- materials ---
type MatKey = 'iron' | 'rusty' | 'fine' | 'runed' | 'moonlit' | 'dragonbone' | 'starforged';
interface Mat {
  key: MatKey;
  metal: Tone; // blades, plates, heads
  trim: Tone; // guards, fittings, rivets
  wood: Tone; // hafts, stocks
  grip: Tone; // wrapped handles
  cloth: Tone;
  leather: Tone;
  gem: string;
  glow: string;
}

const MATS: Record<MatKey, Mat> = {
  iron: {
    key: 'iron', metal: ['#e6ebf0', '#a9b3be', '#646e7a'], trim: ['#e8c084', '#a87a3e', '#6b4a22'],
    wood: ['#c39262', '#8a5a32', '#5a3a1e'], grip: ['#9a6a48', '#5e3a24', '#3a2416'],
    cloth: ['#8f9fc0', '#56658a', '#323c58'], leather: ['#d09a66', '#93613a', '#5e3c20'], gem: '#d64545', glow: '#ffd76a',
  },
  rusty: {
    key: 'rusty', metal: ['#dba070', '#a8683a', '#64391e'], trim: ['#ab8a68', '#7a5a3e', '#4e3826'],
    wood: ['#a8937a', '#76644c', '#4e4232'], grip: ['#86644a', '#5a4030', '#3a2a1e'],
    cloth: ['#a8987a', '#706048', '#4a3e2e'], leather: ['#b48e6c', '#7e5e44', '#54402c'], gem: '#a07a50', glow: '#d4a64a',
  },
  fine: {
    key: 'fine', metal: ['#ffffff', '#c6cfd9', '#76818f'], trim: ['#ffe39a', '#d4a64a', '#8f6a24'],
    wood: ['#d3a370', '#9a6a3e', '#643f20'], grip: ['#5a6ca0', '#2f3c66', '#1e2644'],
    cloth: ['#8aa8de', '#3f5f9a', '#26406a'], leather: ['#d29c66', '#9a6236', '#643c1e'], gem: '#4aa3ff', glow: '#ffd76a',
  },
  runed: {
    key: 'runed', metal: ['#e4eefa', '#9fb2cc', '#56688a'], trim: ['#a8dcff', '#4a8fd0', '#24548a'],
    wood: ['#9a8aac', '#5f5274', '#3e344e'], grip: ['#4a5a8e', '#26325a', '#161e3a'],
    cloth: ['#6a8ad0', '#34508f', '#1f3260'], leather: ['#8a7a9c', '#54486a', '#362c48'], gem: '#6fd3ff', glow: '#6fd3ff',
  },
  moonlit: {
    key: 'moonlit', metal: ['#ffffff', '#c9d6ee', '#7488b0'], trim: ['#f0f5ff', '#a9bde0', '#6a7fae'],
    wood: ['#7a80aa', '#4a4f78', '#2e3254'], grip: ['#5a60a0', '#30346a', '#1c1f44'],
    cloth: ['#6070b0', '#323f78', '#1e2650'], leather: ['#6a72a0', '#3e456e', '#272c4c'], gem: '#bfe0ff', glow: '#a9c8ff',
  },
  dragonbone: {
    key: 'dragonbone', metal: ['#fffaf0', '#e6d9bb', '#a8936a'], trim: ['#ff8a7a', '#c0392b', '#7a1e16'],
    wood: ['#f6eed8', '#d8c8a4', '#9a8660'], grip: ['#b83a30', '#7a1e16', '#4a1210'],
    cloth: ['#d0483a', '#8a2418', '#5a140e'], leather: ['#b84e44', '#7a2a22', '#4e1a14'], gem: '#ff4a3a', glow: '#ff6a4a',
  },
  starforged: {
    key: 'starforged', metal: ['#fff6c8', '#f0c25a', '#a0701a'], trim: ['#ffffff', '#ffe9a0', '#c8963a'],
    wood: ['#6a5a9a', '#3a2f6a', '#221a44'], grip: ['#4a3f7a', '#261e4e', '#150f30'],
    cloth: ['#4a44a0', '#26225c', '#16133a'], leather: ['#5a4a8a', '#322658', '#1e1638'], gem: '#ffffff', glow: '#ffd76a',
  },
};
const LADDER: MatKey[] = ['iron', 'fine', 'runed', 'moonlit', 'dragonbone', 'starforged'];
const PREFIXES: MatKey[] = ['rusty', 'fine', 'runed', 'moonlit', 'dragonbone', 'starforged'];

const STAT_COLOR: Record<Stat, string> = {
  str: '#e0583a', dex: '#47c08a', con: '#e8913a', int: '#4aa3ff', wis: '#b07cf5', cha: '#ff6fae',
};

function prefixOf(name: string): MatKey | undefined {
  const w = name.trim().split(/\s+/)[0].toLowerCase();
  return PREFIXES.find((p) => p === w);
}
/** The name without a material prefix, lower-cased (so "Dragonbone" never reads as "dragon"). */
function baseName(name: string): string {
  const s = name.trim().toLowerCase();
  return prefixOf(name) ? s.slice(s.indexOf(' ') + 1) : s;
}

function materialFor(it: ItemArtInput): Mat {
  const p = prefixOf(it.name);
  if (p) return MATS[p];
  const lvl = it.slot === 'weapon' ? Math.max(it.plus, it.tier - 1) : it.tier - 1;
  return MATS[LADDER[Math.max(0, Math.min(LADDER.length - 1, Math.floor(lvl)))]];
}

function element(name: string, m: Mat): string {
  if (/ember|fire|flame|blaze|inferno/.test(name)) return '#ff7a2a';
  if (/storm|thunder|lightning|spark/.test(name)) return '#5fc8ff';
  if (/frost|ice|winter/.test(name)) return '#bfe8ff';
  if (/shadow|void|night/.test(name)) return '#b07cf5';
  return m.key === 'rusty' || m.key === 'iron' ? '#6fd3ff' : m.gem === '#ffffff' ? '#ffe9a0' : m.gem;
}

// --- shape selection ---
const WEAPON_RULES: [RegExp, string][] = [
  [/twin dagger|daggers|twin blades/, 'twin-daggers'],
  [/hand ?crossbow/, 'hand-crossbow'], [/crossbow/, 'crossbow'], [/\bbow\b|longbow|shortbow/, 'bow'],
  [/lute/, 'lute-blade'], [/whip|lash/, 'whip'],
  [/rapier|foil|estoc/, 'rapier'], [/sabre|saber|scimitar|cutlass/, 'sabre'],
  [/kris/, 'kris'], [/stiletto/, 'stiletto'], [/dirk|dagger|knife/, 'dirk'], [/shortsword|short sword/, 'shortsword'],
  [/greatsword|claymore/, 'greatsword'], [/bastard/, 'bastard'],
  [/axe/, 'battleaxe'], [/mace|morningstar/, 'mace'], [/hammer|maul/, 'warhammer'],
  [/halberd|glaive|poleaxe/, 'halberd'], [/spear|pike|lance|trident/, 'spear'],
  [/wand/, 'wand'], [/staff|stave/, 'staff'], [/\brod\b|sceptre|scepter/, 'rod'],
  [/\borb\b|sphere/, 'orb'], [/grimoire|book|tome|codex/, 'grimoire'], [/focus|crystal|prism/, 'focus'],
  [/sword|blade|brand/, 'longsword'],
];
const ARMOR_RULES: [RegExp, string][] = [
  [/mage armou?r|robe|vestment/, 'mage-robe'], [/dragonscale/, 'dragonscale'], [/scale/, 'scale'],
  [/chain|mail|hauberk/, 'chain'], [/brigandine/, 'brigandine'], [/plate|cuirass|breastplate/, 'plate'],
  [/cloak|cape|mantle/, 'cloak'], [/vest|ironweave/, 'vest'], [/doublet|tunic/, 'doublet'],
  [/jerkin|studded/, 'jerkin'], [/coat|leather/, 'leather-coat'],
];
const CHARM_RULES: [RegExp, string][] = [
  [/tooth|fang/, 'bear-tooth'], [/ox-hide|bracer|\bband\b/, 'ox-band'], [/cat-eye|cat eye/, 'cat-eye-ring'],
  [/feather|anklet/, 'feather-anklet'], [/ironroot|root/, 'ironroot-amulet'], [/knuckle|bone/, 'troll-knuckle'],
  [/lens|monocle|owl/, 'owl-lens'], [/inkstone|\bink/, 'inkstone-pendant'], [/pebble|moonstone/, 'moon-pebble'],
  [/bell/, 'hermit-bell'], [/tongue|\bpin\b|brooch/, 'silver-tongue-pin'], [/locket|rose/, 'rose-locket'],
  [/ring/, 'ring'], [/amulet|pendant|talisman|necklace/, 'amulet'],
];
const CHARM_STAT: Record<string, Stat> = {
  'bear-tooth': 'str', 'ox-band': 'str', 'cat-eye-ring': 'dex', 'feather-anklet': 'dex', 'ironroot-amulet': 'con',
  'troll-knuckle': 'con', 'owl-lens': 'int', 'inkstone-pendant': 'int', 'moon-pebble': 'wis', 'hermit-bell': 'wis',
  'silver-tongue-pin': 'cha', 'rose-locket': 'cha',
};

/** Which drawing an item gets. Keys starting with "fallback-" mean the name was not recognised. */
export function itemArtShape(it: Pick<ItemArtInput, 'slot' | 'name' | 'stat'>): string {
  const s = baseName(it.name);
  const rules = it.slot === 'weapon' ? WEAPON_RULES : it.slot === 'armor' ? ARMOR_RULES : CHARM_RULES;
  for (const [re, key] of rules) if (re.test(s)) return key;
  if (it.slot === 'charm') return it.stat === 'str' || it.stat === 'dex' || it.stat === 'cha' ? 'fallback-ring' : 'fallback-amulet';
  return `fallback-${it.slot}`;
}

// --- material effects, drawn over the item at its spots ---
const RUNES: number[][][][] = [
  [[[0, 2], [0, -2]], [[0, -0.6], [1.3, -1.7]], [[0, 0.7], [1.3, -0.4]]],
  [[[-0.8, 2], [-0.8, -2], [0.9, -1], [-0.8, 0], [0.9, 2]]],
  [[[0, 2], [0, -2]], [[-1.3, -2], [0, -0.6], [1.3, -2]]],
  [[[-1.2, -2], [1.2, 2]], [[1.2, -2], [-1.2, 2]]],
  [[[1, -2], [-1, 0], [1, 2]]],
  [[[0, -2], [1.2, 0], [0, 2], [-1.2, 0], [0, -2]]],
];
function runeGlyphs(spots: readonly Spot[], c: string, r: Rand): string {
  let o = '';
  for (const [x, y, s] of spots) {
    const g = RUNES[Math.floor(r() * RUNES.length)];
    const d = g.map((pl) => 'M' + pl.map(([gx, gy]) => `${n(x + gx * s)} ${n(y + gy * s)}`).join('L')).join('');
    o += line(d, c, n(2.8 * s), 0.4) + line(d, mix(c, '#ffffff', 0.6), n(1 * s));
  }
  return o;
}

function fx(m: Mat, spots: readonly Spot[], r: Rand): string {
  let o = '';
  switch (m.key) {
    case 'rusty':
      for (const [x, y, s] of spots) {
        for (let i = 0; i < 3; i++) o += circ(x + (r() - 0.5) * 4 * s, y + (r() - 0.5) * 5 * s, (0.5 + r() * 0.6) * s, '#3e1e0c', ' stroke="none" opacity=".75"');
        o += circ(x + (r() - 0.5) * 3 * s, y + (r() - 0.5) * 4 * s, 0.7 * s, '#e8955a', ' stroke="none" opacity=".8"');
      }
      return o;
    case 'runed':
      return runeGlyphs(spots, '#6fd3ff', r);
    case 'moonlit':
      for (const [x, y, s] of spots) o += line(`M${n(x - 2 * s)} ${n(y + 2.2 * s)}L${n(x + 2 * s)} ${n(y - 2.2 * s)}`, '#eef6ff', n(1.6 * s), 0.75);
      return o;
    case 'dragonbone':
      for (const [x, y, s] of spots) o += line(`M${n(x - 1.8 * s)} ${n(y)}L${n(x + 1.8 * s)} ${n(y - 0.8 * s)}`, '#c0392b', n(1.3 * s), 0.9);
      return o;
    case 'starforged':
      for (const [x, y, s] of spots) o += sparkle(n(x), n(y), n(2.2 * s), '#ffffff', '#c8963a', 0.5);
      return o;
    default:
      return o;
  }
}

interface Built {
  body: string;
  spots: Spot[];
  tf: string; // transform of the drawing frame ('' = final coordinates)
  star?: Spot; // starforged sparkle, in final coordinates
  extra?: string; // drawn last, in final coordinates
}
interface X {
  a: Art;
  m: Mat;
  name: string;
  r: Rand;
  col: string; // stat colour for charms
}
const upright = (body: string, spots: Spot[], tipY: number, tipX = 32): Built => {
  const [sx, sy] = rot45(tipX, tipY);
  return { body, spots, tf: R45, star: [sx, sy, 5] };
};
const flat = (body: string, spots: Spot[], star?: Spot): Built => ({ body, spots, tf: '', star });

function grip(a: Art, t: Tone, y0: number, y1: number, hw = 2.4): string {
  let o = path(`M${n(32 - hw)} ${y0}H${n(32 + hw)}V${y1}H${n(32 - hw)}Z`, a.lin(t, 'h'));
  for (let y = y0 + 3; y < y1 - 0.5; y += 3) o += line(`M${n(32 - hw + 0.3)} ${y}L${n(32 + hw - 0.3)} ${y - 2}`, t[2], 0.9);
  return o;
}

// ===== weapons (drawn upright in local space, then rotated onto the diagonal) =====
interface SwordSpec { hw: number; tip: number; gy: number; gw: number; end: number }
function sword({ a, m }: X, s: SwordSpec): Built {
  const { hw, tip, gy, gw, end } = s;
  const L = n(32 - hw), R = n(32 + hw), t2 = n(tip + hw * 1.8);
  let b = path(`M${L} ${gy}L${L} ${t2}L32 ${tip}L${R} ${t2}L${R} ${gy}Z`, a.lin(m.metal, 'h'));
  b += shade(`M32 ${tip}L${R} ${t2}L${R} ${gy}L32 ${gy}Z`, m.metal[2], 0.3);
  b += line(`M32 ${n(t2 + 1)}L32 ${gy - 3}`, m.metal[2], 1.1, 0.8);
  b += line(`M${n(L + 1.2)} ${gy - 2}L${n(L + 1.2)} ${t2}L31.4 ${n(tip + 2.2)}`, m.metal[0], 1, 0.9);
  b += grip(a, m.grip, gy + 3, end);
  b += path(`M${32 - gw} ${gy - 2}Q32 ${gy - 3.5} ${32 + gw} ${gy - 2}L${32 + gw - 1.5} ${gy + 3}Q32 ${gy + 1.5} ${32 - gw + 1.5} ${gy + 3}Z`, a.lin(m.trim, 'v'));
  b += circ(32, gy + 0.3, 2, m.gem, ' stroke-width="1.2"');
  b += circ(32, end + 2.6, 3.2, a.lin(m.trim));
  const len = gy - t2;
  return upright(b, [[32, n(gy - len * 0.25), hw / 4], [32, n(gy - len * 0.55), hw / 4.4], [32, n(gy - len * 0.82), hw / 5]], tip);
}

function sabre({ a, m }: X): Built {
  let b = path('M27.6 45Q26 18 37 -1Q34.6 20 36.2 45Z', a.lin(m.metal, 'h'));
  b += shade('M37 -1Q34.6 20 36.2 45L32.5 45Q31.5 20 37 -1Z', m.metal[2], 0.3);
  b += line('M29 42Q28 20 35.5 2', m.metal[0], 1, 0.9);
  b += grip(a, m.grip, 47, 60);
  b += rope('M40 45Q47 54 34.5 61', m.trim[1], 2);
  b += path('M24 43Q32 41.5 40 43L39 48Q32 46.5 25 48Z', a.lin(m.trim, 'v'));
  b += circ(32, 62.6, 3, a.lin(m.trim));
  return upright(b, [[31.6, 34, 0.9], [32.3, 21, 0.8], [34, 9, 0.6]], -1, 37);
}

function rapier({ a, m }: X): Built {
  let b = path('M29.9 42L29.9 2.5L32 -4L34.1 2.5L34.1 42Z', a.lin(m.metal, 'h'));
  b += line('M31 40V1.5', m.metal[0], 0.9, 0.9);
  b += rope('M19 46.5H45', m.trim[1], 2.4);
  b += circ(19, 46.5, 2.2, m.trim[1]) + circ(45, 46.5, 2.2, m.trim[1]);
  b += grip(a, m.grip, 50, 60, 2.2);
  b += path('M24 50.5Q24 40.5 32 40.5Q40 40.5 40 50.5Z', a.lin(m.trim, 'd'));
  b += line('M26.5 48Q27 43 32 43', m.trim[0], 1.1, 0.9);
  b += rope('M39.5 50Q46 56 34.4 61.6', m.trim[1], 1.8);
  b += circ(32, 62.6, 2.9, a.lin(m.trim));
  return upright(b, [[32, 30, 0.55], [32, 17, 0.5]], -4);
}

type DagKind = 'dirk' | 'stiletto' | 'kris' | 'shortsword';
function daggerBody({ a, m }: X, kind: DagKind): string {
  const gy = kind === 'shortsword' ? 41 : 39;
  const blades: Record<DagKind, [string, string]> = {
    dirk: ['M27.5 39L28.3 13L32 4L35.7 13L36.5 39Z', 'M32 4L35.7 13L36.5 39L32 39Z'],
    stiletto: ['M29.2 39L32 2L34.8 39Z', 'M32 2L34.8 39L32 39Z'],
    kris: ['M28 39Q25 33.5 28 28T28 17T29 8L32 2L35 8Q33 12.5 36 17T36 28T36 39Z', 'M32 3L35 8Q33 12.5 36 17T36 28T36 39L32 39Z'],
    shortsword: ['M27.3 41Q26 21 32 1Q38 21 36.7 41Z', 'M32 1Q38 21 36.7 41L32 41Z'],
  };
  const [bl, sh] = blades[kind];
  let b = path(bl, a.lin(m.metal, 'h')) + shade(sh, m.metal[2], 0.3);
  b += line(`M32 ${kind === 'stiletto' ? 8 : 9}L32 ${gy - 3}`, m.metal[2], 1, 0.7);
  b += line(kind === 'kris' ? 'M29.5 36Q27.5 32 29.5 28' : `M${kind === 'stiletto' ? 30.5 : 29.3} ${gy - 3}L${kind === 'stiletto' ? 31.6 : 30.2} 13`, m.metal[0], 1, 0.9);
  b += grip(a, m.grip, gy + 3, 54);
  b += kind === 'kris'
    ? path(`M24 ${gy - 1}L39 ${gy - 3}Q42 ${gy} 39 ${gy + 3.5}L27 ${gy + 3.5}Z`, a.lin(m.trim, 'v'))
    : path(`M${kind === 'stiletto' ? 24 : 22} ${gy - 1.5}H${kind === 'stiletto' ? 40 : 42}L${kind === 'stiletto' ? 38.5 : 40.5} ${gy + 3.5}H${kind === 'stiletto' ? 25.5 : 23.5}Z`, a.lin(m.trim, 'v'));
  b += circ(32, 56.8, 3, a.lin(m.trim));
  return b;
}
const DAG_SPOTS: Spot[] = [[32, 31, 0.8], [32, 20, 0.7]];
const dagger = (x: X, kind: DagKind): Built => upright(daggerBody(x, kind), DAG_SPOTS, kind === 'shortsword' ? 1 : 3);

function twinDaggers(x: X): Built {
  const d = daggerBody(x, 'dirk');
  const t = `${R45} translate(32 32) scale(.86) translate(-32 -32)`;
  const one = (tf: string) => `<g transform="${tf}">${d}${fx(x.m, DAG_SPOTS, x.r)}</g>`;
  const [sx, sy] = rot45(32, 4);
  return flat(one(`translate(64 0) scale(-1 1) ${t}`) + one(t), [], [n(32 + (sx - 32) * 0.86), n(32 + (sy - 32) * 0.86), 4.5]);
}

function battleaxe({ a, m }: X): Built {
  let b = path('M29.8 8h4.4v54h-4.4Z', a.lin(m.wood, 'h'));
  b += line('M31.2 28V45', m.wood[2], 1, 0.6);
  b += grip(a, m.grip, 46, 58, 2.6);
  b += path('M29 61h6l-1 4h-4Z', a.lin(m.trim));
  b += path('M30 10L32 1L34 10Z', a.lin(m.metal, 'h'));
  for (const s of [1, -1]) {
    const X = (v: number) => n(32 + s * (v - 32));
    b += path(`M${X(36)} 12Q${X(42)} 10 ${X(47)} 4Q${X(56)} 16.5 ${X(47)} 29Q${X(42)} 24 ${X(36)} 22Z`, a.lin(m.metal, 'h'));
    b += line(`M${X(47.4)} 7.5Q${X(53.6)} 16.5 ${X(47.4)} 25.5`, s > 0 ? m.metal[0] : '#ffffff', 1.2, 0.85);
    b += shade(`M${X(36)} 18Q${X(43)} 18 ${X(52)} 22Q${X(50)} 26 ${X(47)} 29Q${X(42)} 24 ${X(36)} 22Z`, m.metal[2], 0.35);
  }
  b += path('M27.5 9h9v16h-9Z', a.lin(m.trim, 'h'));
  b += circ(32, 13, 1.1, m.trim[2], NOSTROKE) + circ(32, 21, 1.1, m.trim[2], NOSTROKE);
  return upright(b, [[44, 15, 0.8], [20, 15, 0.8]], 1);
}

function warhammer({ a, m, name }: X): Built {
  let b = path('M30 16h4v46h-4Z', a.lin(m.wood, 'h'));
  b += grip(a, m.grip, 46, 58, 2.5);
  b += path('M29 61h6l-1 3.5h-4Z', a.lin(m.trim));
  if (/mace|morningstar/.test(name)) {
    b += path('M29 24h6v5h-6Z', a.lin(m.trim));
    b += path('M32 -1L39 6L39 19L32 26L25 19L25 6Z', a.lin(m.metal, 'h'));
    b += path('M25 7L19 12.5L25 18Z', a.lin(m.metal, 'h')) + path('M39 7L45 12.5L39 18Z', a.lin(m.metal, 'h'));
    b += line('M32 1V24', m.metal[2], 1.2, 0.7) + line('M27 8V17', m.metal[0], 1.1, 0.9);
    return upright(b, [[29, 12, 0.7], [35, 14, 0.7]], -1);
  }
  b += path('M29.5 6L32 -2L34.5 6Z', a.lin(m.metal, 'h'));
  b += path('M42 9L54 13.5L42 18Z', a.lin(m.metal, 'v'));
  b += path('M21 6h21v15h-21Z', a.lin(m.metal, 'v'));
  b += path('M15 3h7v21h-7Z', a.lin(m.metal, 'h'));
  b += line('M16.8 5.5V21.5', '#ffffff', 1.1, 0.8) + line('M23 8.5H40', m.metal[0], 1, 0.8);
  b += path('M28.5 5h7v17h-7Z', a.lin(m.trim, 'h'));
  b += path('M29 22h6v4h-6Z', a.lin(m.trim));
  return upright(b, [[25, 14, 0.7], [38.5, 14, 0.6]], -2);
}

function polearm({ a, m }: X, halberd: boolean): Built {
  let b = path('M30.5 6h3v58h-3Z', a.lin(m.wood, 'h'));
  b += path('M30.5 63.5L32 67L33.5 63.5Z', a.lin(m.trim));
  b += grip(a, m.grip, 44, 52, 1.9);
  if (halberd) {
    b += path('M32 -5L35 4L33.5 9H30.5L29 4Z', a.lin(m.metal, 'h'));
    b += path('M34 11L45 5.5Q50.5 18 45 30.5L34 25Z', a.lin(m.metal, 'h'));
    b += line('M45.9 9Q49 18 45.9 27', '#ffffff', 1.1, 0.8);
    b += path('M30 13L19 16.5L30 21Z', a.lin(m.metal, 'v'));
    b += path('M29.5 9h5v18h-5Z', a.lin(m.trim, 'h'));
    return upright(b, [[40, 18, 0.8]], -5);
  }
  b += path('M32 -5Q38.5 5 34 15H30Q25.5 5 32 -5Z', a.lin(m.metal, 'h'));
  b += line('M32 -1V13', m.metal[2], 1, 0.7) + line('M30 2Q28.5 7 30.5 12', '#ffffff', 1, 0.8);
  b += path('M29.8 15h4.4v8h-4.4Z', a.lin(m.trim, 'h'));
  b += rope('M30 22Q24 27 25.5 33', '#c0392b', 1.8) + rope('M34 22Q39 26 38.5 32', '#c0392b', 1.8);
  return upright(b, [[32, 5, 0.8]], -5);
}

function crossbow({ a, m }: X, hand: boolean): Built {
  let b = '';
  if (hand) {
    b += path('M28.5 40H35.5L44 57L37 60.5Z', a.lin(m.wood, 'h'));
    b += path('M29 12H35L35.5 43H28.5Z', a.lin(m.wood, 'h'));
    b += rope('M35.5 44L38.5 47', m.trim[1], 1.6);
  } else {
    b += path('M29 10H35L36.5 50L39.5 62H24.5L27.5 50Z', a.lin(m.wood, 'h'));
    b += line('M26 57H38', m.wood[2], 1, 0.7);
    b += rope('M35.5 44L39 47.5', m.trim[1], 1.6);
  }
  b += line('M32 12V40', m.wood[2], 1, 0.6);
  const [x0, x1, py] = hand ? [12, 52, 25] : [7, 57, 27];
  const prod = `M${x0} ${py}Q32 ${py - 16} ${x1} ${py}`;
  const str = `M${x0 + 1} ${py}L32 ${py + 8}L${x1 - 1} ${py}`;
  b += line(str, OL, 2.4) + line(str, '#efe6d0', 1.1);
  b += rope(prod, m.metal[1], 3.6) + line(`M${x0 + 3} ${py - 2.2}Q32 ${py - 15.5} ${x1 - 3} ${py - 2.2}`, m.metal[0], 1, 0.9);
  b += path(`M28 ${py - 9}h8v6h-8Z`, a.lin(m.trim, 'h'));
  const by = py + 8;
  b += rope(`M32 ${by}V${hand ? 6 : 3}`, '#9a6a3e', 1.5);
  b += path(`M29.5 ${hand ? 7 : 4}L32 ${hand ? 0 : -3}L34.5 ${hand ? 7 : 4}Z`, a.lin(m.metal, 'h'));
  b += path(`M32 ${by - 5}L28.5 ${by}L32 ${by - 1.5}L35.5 ${by}Z`, '#c0392b', ' stroke-width="1.3"');
  b += circ(32, by, 2, m.trim[1], ' stroke-width="1.4"');
  return upright(b, [[x0 + 9, py - 6, 0.7], [x1 - 9, py - 6, 0.7]], hand ? 0 : -3);
}

function bow({ a, m }: X): Built {
  let b = line('M24 3V61', OL, 2.2) + line('M24 3V61', '#efe6d0', 1);
  b += rope('M24 2Q54 32 24 62', m.wood[1], 4) + line('M26.5 5Q50 32 26.5 59', m.wood[0], 1.1, 0.8);
  b += path('M36 27h5v10h-5Z', a.lin(m.grip, 'h'));
  b += circ(24, 2.5, 2, m.trim[1], ' stroke-width="1.4"') + circ(24, 61.5, 2, m.trim[1], ' stroke-width="1.4"');
  return upright(b, [[34, 15, 0.6], [34, 49, 0.6]], 8, 30);
}

function tipEffect(a: Art, x: number, y: number, c: string, fire: boolean): string {
  let o = glow(a, x, y, 11, c, 0.75);
  if (fire) {
    o += `<g transform="translate(${x} ${y})">${path('M0 -9C5 -4 7 0 4 4C2 6.5 -2 6.5 -4 4C-7 0 -3 -3 0 -9Z', '#ff7a2a', ' stroke="#7a1e10" stroke-width="1.4"')}${path('M0 -3C2.5 0 3 2 1.5 3.8C.5 4.6 -.5 4.6 -1.5 3.8C-3 2 -1.5 0 0 -3Z', '#ffe08a', NOSTROKE)}</g>`;
  } else o += sparkle(x, y, 6, mix(c, '#ffffff', 0.7), mix(c, '#000000', 0.4), 1);
  return o;
}

function wand({ a, m, name }: X): Built {
  let b = path('M29 62L30.6 12H33.4L35 62Z', a.lin(m.wood, 'h'));
  b += path('M29.3 47H34.7L34.9 62H29.1Z', a.lin(m.grip, 'h'));
  b += path('M29 44.5h6v3h-6Z', a.lin(m.trim)) + path('M30.4 11h3.2v3.5h-3.2Z', a.lin(m.trim));
  b += circ(32, 62.5, 2.2, m.trim[1], ' stroke-width="1.5"');
  const [tx, ty] = rot45(32, 8.5);
  const c = element(name, m);
  return { ...upright(b, [[32, 30, 0.5]], 8.5), extra: tipEffect(a, tx, ty, c, c === '#ff7a2a') };
}

function staff({ a, m, name, r }: X): Built {
  let b = path('M30 14Q28.5 26 30.3 38Q29 50 30 66H34Q35 50 33.7 38Q35.5 26 34 14Z', a.lin(m.wood, 'h'));
  b += line('M31 18Q30 28 31.3 36', m.wood[0], 0.9, 0.8);
  b += grip(a, m.grip, 41, 49, 2.2);
  const c = element(name, m);
  b += glow(a, 32, 5, 12, c, 0.6);
  b += rope('M30.5 15Q23.5 10 27 1.5', m.wood[1], 2.4) + rope('M33.5 15Q40.5 10 37 1.5', m.wood[1], 2.4);
  b += gem(a, 32, 6, 5.2, c);
  if (/rune/.test(name)) b += runeGlyphs([[32, 24, 0.75], [32, 32, 0.75], [32, 56, 0.75]], c, r);
  return upright(b, [[32, 26, 0.6], [32, 56, 0.6]], 0);
}

function rod({ a, m, name }: X): Built {
  let b = path('M30.6 16h2.8v45h-2.8Z', a.lin(m.metal, 'h'));
  b += path('M29.8 35h4.4v3h-4.4Z', a.lin(m.trim)) + path('M29.6 15h4.8v3.5h-4.8Z', a.lin(m.trim));
  b += circ(32, 62.4, 2.8, a.lin(m.trim));
  const c = element(name, m);
  const t = tone(c);
  b += glow(a, 32, 5, 13, c, 0.6);
  b += path('M32 -5L36.5 2L36.5 11L32 15.5L27.5 11L27.5 2Z', a.lin(t, 'h'));
  b += shade('M32 -5L36.5 2L36.5 11L32 15.5Z', t[2], 0.35);
  b += line('M27.5 2L32 4.5L36.5 2M32 4.5V15', t[0], 0.9, 0.9);
  b += rope('M29.4 16Q27 12 28 8.5', m.trim[1], 1.4) + rope('M34.6 16Q37 12 36 8.5', m.trim[1], 1.4);
  return upright(b, [[32, 27, 0.5], [32, 48, 0.5]], -5);
}

function orb({ a, m, name }: X): Built {
  const c = element(name, m);
  const t = tone(c);
  let b = glow(a, 32, 27, 26, c, 0.55);
  b += path('M19 59Q19 52.5 25 52H39Q45 52.5 45 59Z', a.lin(m.trim, 'v'));
  b += path('M27 44H37L35 52.5H29Z', a.lin(m.trim, 'h'));
  b += rope('M25 45Q15.5 37 19.5 25', m.trim[1], 2.6) + rope('M39 45Q48.5 37 44.5 25', m.trim[1], 2.6);
  b += circ(32, 27, 15, a.rad([[0, t[0]], [0.5, c], [1, t[2]]], 0.38, 0.35, 0.7));
  if (/storm|thunder|lightning/.test(name)) {
    const z = 'M28.5 15.5L35 24L28.5 27.5L35.5 38.5';
    b += line(z, '#ffffff', 4, 0.35) + line(z, '#fff7c0', 1.6);
  } else b += line('M23 30Q27 20 34 23Q39 27 33 31Q29 33 30 29', t[0], 1.6, 0.8);
  b += ell(25.5, 20, 4.5, 2.6, '#ffffff', ' stroke="none" opacity=".7" transform="rotate(-35 25.5 20)"');
  b += rope('M18.5 27Q19 33 22 35', m.trim[1], 2.2) + rope('M45.5 27Q45 33 42 35', m.trim[1], 2.2);
  return flat(b, [[32, 55.5, 0.7]], [43, 16, 4.5]);
}

function grimoire({ a, m, name }: X): Built {
  const cover: Tone = m.key === 'iron' ? ['#a87ad8', '#6a3fa0', '#3e2266'] : m.leather;
  let b = path('M15 11h35v47h-35Z', '#efe2c0');
  b += line('M47.5 14V55M44.5 14V55M18 55.5H46', '#b8a47e', 0.9);
  b += path('M12 10Q12 7 15 7H46V54H15Q12 54 12 51Z', a.lin(cover, 'd'));
  b += shade('M12 10Q12 7 15 7H18V54H15Q12 54 12 51Z', cover[2], 0.5);
  b += line('M13 14H18M13 47H18', m.trim[1], 1.6);
  b += line('M14.5 9.5Q14 30 14.5 52', cover[0], 1, 0.6);
  b += path('M40 7H46V13Z', a.lin(m.trim)) + path('M46 48V54H40Z', a.lin(m.trim));
  b += circ(31, 30.5, 8, a.lin(m.trim), ' stroke-width="1.6"');
  b += gem(a, 31, 30.5, 4, element(name, m));
  b += path('M42 26H51V35H42Z', a.lin(m.trim, 'v'));
  b += circ(47.5, 30.5, 1.1, m.trim[2], NOSTROKE);
  return { ...flat(b, [[24, 18, 0.8], [36, 45, 0.8]], [46, 9, 4]), tf: 'rotate(-7 32 32)' };
}

function focus({ a, m, name }: X): Built {
  const fire = /fire|ember|flame|bolt/.test(name);
  const t: Tone = fire ? ['#ffe08a', '#ff8a3a', '#b0301c'] : tone(element(name, m));
  let b = ell(32, 59, 11, 2.5, '#000000', ' stroke="none" opacity=".25"');
  b += glow(a, 32, 28, 26, t[1], 0.55);
  b += rope('M17 36A15 4.5 0 0 1 47 36', m.trim[1], 2.4);
  b += path('M32 3L42.5 15L40.5 41L32 51L23.5 41L21.5 15Z', a.lin(t, 'h'));
  b += shade('M32 3L42.5 15L40.5 41L32 51L31 26Z', t[2], 0.3);
  b += line('M32 3L31 26L32 51M21.5 15L31 26L40.5 41', t[0], 1, 0.75);
  b += line('M24 17L25.5 38', '#ffffff', 1.2, 0.7);
  b += rope('M17 36A15 4.5 0 0 0 47 36', m.trim[1], 2.4);
  b += circ(17, 36, 2.2, m.trim[1], ' stroke-width="1.4"') + circ(47, 36, 2.2, m.trim[1], ' stroke-width="1.4"');
  if (fire) b += sparkle(12, 18, 2.6, '#ffd76a', '#b0301c', 0.7) + sparkle(51, 12, 2.2, '#ffd76a', '#b0301c', 0.7) + sparkle(52, 50, 1.8, '#ffd76a', '#b0301c', 0.7);
  return flat(b, [[32, 20, 0.8], [33, 35, 0.7]], [32, 4, 4.5]);
}

function luteBlade({ a, m }: X): Built {
  const wood: Tone = ['#eab47a', '#b0743a', '#6a3e1c'];
  let b = path('M28.5 27L28.5 4L32 -4L35.5 4L35.5 27Z', a.lin(m.metal, 'h'));
  b += shade('M32 -4L35.5 4L35.5 27L32 27Z', m.metal[2], 0.3);
  b += line('M29.7 25V4.5L31.4 -1', m.metal[0], 1, 0.9);
  b += path('M29.5 29H34.5V39H29.5Z', a.lin(wood, 'h'));
  b += path('M32 36Q46 38 45 51Q44 64 32 64Q20 64 19 51Q18 38 32 36Z', a.lin(wood, 'h'));
  b += line('M22 44Q21.5 52 25 58', wood[0], 1.2, 0.8);
  b += circ(32, 48.5, 4, '#2a1a10', ` stroke="${m.trim[1]}" stroke-width="1.4"`);
  b += path('M27 56.5h10v2.5h-10Z', wood[2], ' stroke-width="1.2"');
  b += line('M30.8 57V29M32 57V29M33.2 57V29', '#f4e9cf', 0.5);
  b += path('M23 25.5H41L39.5 30H24.5Z', a.lin(m.trim, 'v'));
  return upright(b, [[32, 18, 0.7], [32, 8, 0.6]], -4);
}

function whip({ a, m, name }: X): Built {
  const lt = m.leather;
  let b = '';
  for (const [cx, cy, rx, ry] of [[36, 30, 17, 10.5], [37, 30.5, 13.5, 8], [38, 31, 10, 6]] as const) {
    b += ell(cx, cy, rx, ry, 'none', ' stroke-width="5.2"');
    b += ell(cx, cy, rx, ry, 'none', ` stroke="${lt[1]}" stroke-width="3.2"`);
    b += line(`M${cx - rx + 1.4} ${cy - 1}Q${cx - rx + 3} ${cy - ry + 1} ${cx} ${cy - ry + 0.6}`, lt[0], 1, 0.8);
  }
  b += rope('M53 29Q60 20 57 8', lt[1], 2.2) + line('M57 8Q55.5 4.5 51.5 5', OL, 2.4) + line('M57 8Q55.5 4.5 51.5 5', lt[0], 1.2);
  b += rope('M23.5 42Q21 37 19.6 31', lt[1], 3.2);
  b += rope('M9 57L22 44', m.grip[1], 5) + line('M10 54.6L19.6 45', m.grip[0], 1, 0.7);
  b += circ(8.5, 57.5, 3.2, a.lin(m.trim)) + circ(22.5, 43.5, 3, a.lin(m.trim));
  if (/verse|song|lyric/.test(name)) {
    b += ell(10, 26, 3.4, 2.5, '#ffd76a', ' stroke-width="1.6" transform="rotate(-20 10 26)"');
    b += line('M13 25V11', OL, 3.4) + line('M13 25V11', '#ffd76a', 1.4);
    b += path('M13 11Q19 13 18 18Q17 15 13 15Z', '#ffd76a', ' stroke-width="1.4"');
  }
  return flat(b, [[36, 19.5, 0.6], [53, 30, 0.6]], [57, 7, 4]);
}

// ===== armour (front view, final coordinates) =====
const TEE = 'M23 9L28 7.5Q32 12.5 36 7.5L41 9L52 15L57 29L48 32L45 25V53Q32 57 19 53V25L16 32L7 29L12 15Z';
const COAT = 'M23 7L28 6L32 13L36 6L41 7L51 13L58 39L51 41L46 24L48 59H16L18 24L13 41L6 39L13 13Z';
const VEST = 'M21 9L28 7Q29 16 32 20Q35 16 36 7L43 9Q47 14 46 22L46 52Q32 56 18 52L18 22Q17 14 21 9Z';

function belt(a: Art, m: Mat, y: number, x0: number, x1: number): string {
  return path(`M${x0} ${y}H${x1}V${y + 5}H${x0}Z`, a.lin(m.leather, 'v')) + path(`M29.5 ${y - 0.5}h5v6h-5Z`, 'none', ` stroke="${m.trim[1]}" stroke-width="1.8"`);
}

function mail({ a, m }: X, scales: boolean): Built {
  const tex = scales
    ? a.pat(6, 8, `<path d="M0 0Q0 4 3 4Q6 4 6 0M-3 4Q-3 8 0 8Q3 8 3 4M3 4Q3 8 6 8Q9 8 9 4" fill="none" stroke="${m.metal[2]}" stroke-width=".9"/>`)
    : a.pat(4, 3.4, `<circle cx="2" cy="1.7" r="1.3" fill="none" stroke="${m.metal[2]}" stroke-width=".7"/><circle cx="0" cy="0" r="1.3" fill="none" stroke="${m.metal[2]}" stroke-width=".7"/><circle cx="4" cy="0" r="1.3" fill="none" stroke="${m.metal[2]}" stroke-width=".7"/><circle cx="0" cy="3.4" r="1.3" fill="none" stroke="${m.metal[2]}" stroke-width=".7"/><circle cx="4" cy="3.4" r="1.3" fill="none" stroke="${m.metal[2]}" stroke-width=".7"/>`);
  let b = path(TEE, a.lin(m.metal, 'd'), NOSTROKE) + path(TEE, tex, ' stroke="none" opacity=".8"');
  b += shade('M41 9L52 15L57 29L48 32L45 25V53Q41 55 37 55.6V10Z', m.metal[2], 0.3);
  b += line('M13 16.5L9 27.5M21 12V40', m.metal[0], 1.4, 0.7);
  b += path(TEE, 'none');
  b += rope('M27.5 8Q32 14 36.5 8', m.leather[1], 2.2);
  b += belt(a, m, 42, 19, 45);
  b += line('M8 28.5L16 31.5M48 31.5L56 28.5', m.metal[2], 1.4);
  return flat(b, [[26, 22, 1], [38, 33, 1], [25, 50, 0.8]], [50, 14, 4]);
}

const CUIRASS = 'M21 12L27 9Q32 15 37 9L43 12Q46 22 46.5 30L45.5 52Q32 58 18.5 52L17.5 30Q18 22 21 12Z';
function cuirass({ a, m }: X, plate: boolean): Built {
  let b = path(CUIRASS, a.lin(plate ? m.metal : m.cloth, 'd'));
  if (plate) {
    b += shade('M32 14Q37 13 43 12Q46 22 46.5 30L45.5 52Q39 55 32 55.4Z', m.metal[2], 0.3);
    b += line('M32 15V54', m.metal[2], 1.2, 0.8) + line('M30.8 16V53', m.metal[0], 1, 0.8);
    b += line('M18.5 44Q32 49.5 45.5 44M18.4 48.5Q32 54 45.6 48.5', OL, 1.6);
    b += line('M21.5 16Q19.5 28 20.5 41', '#ffffff', 1.4, 0.7);
  } else {
    for (let y = 19; y <= 50; y += 6.2)
      for (let x = 21.5; x <= 43; x += 5.3) if (!(y < 22 && Math.abs(x - 32) < 6)) b += circ(x, y, 1.1, m.trim[0], ` stroke="${m.trim[2]}" stroke-width=".6"`);
    b += line('M21.5 16Q19.5 28 20.5 41', m.cloth[0], 1.4, 0.7);
  }
  for (const s of [1, -1]) {
    const X = (v: number) => n(32 + s * (v - 32));
    b += path(`M${X(9.5)} 29Q${X(5)} 18 ${X(12.5)} 14Q${X(17)} 11 ${X(22)} 11.5L${X(24.5)} 25Q${X(16)} 24 ${X(9.5)} 29Z`, a.lin(m.metal, s < 0 ? 'h' : 'd'));
    b += line(`M${X(9.5)} 23Q${X(10.5)} 16 ${X(19)} 13.6`, s > 0 ? m.metal[0] : m.metal[2], 1.2, 0.85);
  }
  b += rope('M27.5 9.5Q32 15.5 36.5 9.5', m.trim[1], 1.8);
  return flat(b, [[26, 26, 1], [38, 38, 1], [12, 21, 0.7]], [50, 12, 4]);
}

function leatherCoat({ a, m }: X): Built {
  let b = path(COAT, a.lin(m.leather, 'd'));
  b += path('M28.5 6.5L32 13L35.5 6.5Q32 8.5 28.5 6.5Z', '#efe2c0', ' stroke-width="1.4"');
  b += shade('M41 7L51 13L58 39L51 41L46 24L48 59H36V20Z', m.leather[2], 0.3);
  b += line('M28 6.5L31.2 21M36 6.5L32.8 21', m.leather[2], 1.4);
  b += line('M32 21V59', OL, 1.6);
  b += line('M14.5 15L8.5 37M20 26L18.5 56', m.leather[0], 1.3, 0.7);
  b += belt(a, m, 33, 18, 46.3);
  b += line('M6.6 37.5L13.6 39.6M50.4 39.6L57.4 37.5', m.leather[2], 1.6);
  return flat(b, [[24, 24, 1], [40, 48, 1], [24, 48, 0.8]], [52, 12, 4]);
}

function jerkin({ a, m }: X): Built {
  let b = path(VEST, a.lin(m.leather, 'd'));
  b += shade('M36 7L43 9Q47 14 46 22L46 52Q40 54.5 34 55V18Z', m.leather[2], 0.3);
  for (let y = 26; y <= 48; y += 5.5)
    for (const x of [21.5, 26.5, 37.5, 42.5]) if (!(y < 30 && (x === 26.5 || x === 37.5))) b += circ(x, y, 1.15, m.trim[0], ` stroke="${m.trim[2]}" stroke-width=".7"`);
  b += line('M30 21.5L34 24.5L30 27.5L34 30.5L30 33.5L34 36.5', '#efe2c0', 1.1);
  b += line('M32 20V54', OL, 1.4);
  b += line('M20.5 12Q18.5 30 19.5 50', m.leather[0], 1.3, 0.7);
  b += rope('M18.5 51.5Q32 56 45.5 51.5', m.leather[2], 1.4);
  return flat(b, [[23.5, 37, 0.9], [40.5, 37, 0.9]], [46, 10, 4]);
}

function doublet({ a, m, name }: X): Built {
  const t = /leather/.test(name) ? m.leather : m.cloth;
  const d = 'M24 9L29 8L32 12L35 8L40 9L49 13Q55 15 56 22L54 38L47 39L45 24V48Q32 52 19 48V24L17 39L10 38L8 22Q9 15 15 13Z';
  let b = path(d, a.lin(t, 'd'), NOSTROKE);
  b += path(d, a.pat(5, 5, `<path d="M0 0L5 5M5 0L0 5" stroke="${t[2]}" stroke-width=".8" opacity=".6"/>`), NOSTROKE);
  b += shade('M40 9L49 13Q55 15 56 22L54 38L47 39L45 24V48Q40 50 35 50.5V10Z', t[2], 0.25);
  b += path(d, 'none');
  b += ell(14, 17.5, 5.5, 5, t[0], ' stroke-width="1.6"') + ell(50, 17.5, 5.5, 5, t[1], ' stroke-width="1.6"');
  b += path('M28 8.5Q32 5 36 8.5L35 12Q32 9.5 29 12Z', a.lin(m.trim, 'v'), ' stroke-width="1.4"');
  for (let y = 17; y <= 44; y += 6.5) b += circ(32, y, 1.5, m.trim[1], ' stroke-width="1"');
  b += rope('M19 47.5Q32 51.5 45 47.5', m.trim[1], 1.4);
  b += line('M10 37.5L17 38.6M47 38.6L54 37.5', t[2], 1.6);
  return flat(b, [[25, 30, 0.9], [39, 30, 0.9]], [48, 9, 4]);
}

function vest({ a, m }: X): Built {
  let b = path(VEST, a.lin(m.metal, 'd'), NOSTROKE);
  b += path(VEST, a.pat(4, 4, `<path d="M0 2H4M2 0V4" stroke="${m.metal[2]}" stroke-width="1.1"/><circle cx="2" cy="2" r=".7" fill="${m.metal[0]}"/>`), ' stroke="none" opacity=".85"');
  b += shade('M36 7L43 9Q47 14 46 22L46 52Q40 54.5 34 55V18Z', m.metal[2], 0.3);
  b += path(VEST, 'none');
  b += rope('M28 7Q29 16 32 20Q35 16 36 7', m.leather[1], 2);
  b += rope('M18.5 51.5Q32 56 45.5 51.5', m.leather[1], 2);
  b += line('M32 20V53', OL, 1.4);
  for (const y of [27, 35, 43]) b += path(`M29.5 ${y - 1.5}h5v3h-5Z`, m.trim[1], ' stroke-width="1"');
  b += line('M20.5 12Q18.5 30 19.5 50', '#ffffff', 1.2, 0.5);
  return flat(b, [[24.5, 32, 0.9], [39.5, 42, 0.9]], [46, 10, 4]);
}

function cloak({ a, m, name, r }: X): Built {
  const d = 'M32 4Q45 4 46 18L55 55Q44 60 32 60Q20 60 9 55L18 18Q19 4 32 4Z';
  let b = path(d, a.lin(m.cloth, 'd'));
  b += shade('M32 4Q45 4 46 18L55 55Q44 60 32 60V26Z', m.cloth[2], 0.3);
  b += path('M32 9Q40 9.5 40.5 20Q32 25 23.5 20Q24 9.5 32 9Z', mix(m.cloth[2], '#000000', 0.55), ' stroke-width="1.6"');
  b += line('M24 30L20 56M40 30L44.5 56', m.cloth[2], 1.4) + line('M32 31V59', m.cloth[2], 1.2, 0.8);
  b += line('M18.5 21L11 53', m.cloth[0], 1.4, 0.75) + line('M22 8Q26 5 31 5', m.cloth[0], 1.2, 0.7);
  if (/ward/.test(name)) {
    b += circ(32, 42, 7, 'none', ' stroke="#6fd3ff" stroke-width="3" opacity=".35"') + circ(32, 42, 7, 'none', ' stroke="#c8f0ff" stroke-width="1"');
    b += runeGlyphs([[32, 42, 1.2]], '#6fd3ff', r);
  }
  b += circ(32, 25.5, 3, a.lin(m.trim)) + line('M27 24.5L29 25.5M35 25.5L37 24.5', m.trim[1], 1.2);
  return flat(b, [[24, 40, 1], [40, 48, 1]], [44, 10, 4]);
}

function dragonscale({ a, m }: X): Built {
  const t: Tone = ['#86e0a6', '#2f9a66', '#175a3c'];
  let b = path(COAT, a.lin(t, 'd'), NOSTROKE);
  b += path(COAT, a.pat(6, 8, `<path d="M0 0Q0 4 3 4Q6 4 6 0M-3 4Q-3 8 0 8Q3 8 3 4M3 4Q3 8 6 8Q9 8 9 4" fill="none" stroke="${t[2]}" stroke-width="1"/>`), NOSTROKE);
  b += shade('M41 7L51 13L58 39L51 41L46 24L48 59H36V20Z', t[2], 0.3);
  b += path(COAT, 'none');
  for (const s of [1, -1]) {
    const X = (v: number) => n(32 + s * (v - 32));
    b += path(`M${X(13)} 13L${X(13)} 6.5L${X(17)} 11L${X(19)} 4.5L${X(22)} 9.5L${X(25)} 5L${X(26)} 8Z`, a.lin(['#fffaf0', '#e6d9bb', '#a8936a'], 'v'), ' stroke-width="1.5"');
  }
  b += path('M28.5 6.5L32 13L35.5 6.5Q32 8.5 28.5 6.5Z', t[2], ' stroke-width="1.4"');
  b += line('M32 14V59', OL, 1.6);
  b += belt(a, m, 33, 18, 46.3);
  b += line('M14.5 15L8.5 37', t[0], 1.3, 0.8);
  return flat(b, [[24, 24, 1], [40, 48, 1]], [52, 12, 4]);
}

function mageRobe({ a, m, r }: X): Built {
  const t: Tone = ['#c4a4f6', '#7b5cd6', '#45308a'];
  const d = 'M25 7L32 12L39 7L47 10Q53 13 56 22L61 40L51 43L46 30L51 58Q32 62 13 58L18 30L13 43L3 40L8 22Q11 13 17 10Z';
  let b = glow(a, 32, 34, 32, '#9ad8ff', 0.45);
  b += path(d, a.lin(t, 'd'));
  b += shade('M39 7L47 10Q53 13 56 22L61 40L51 43L46 30L51 58Q42 60 35 60.4V12Z', t[2], 0.3);
  b += path('M29 13H35L37.5 59.5Q32 60 26.5 59.5Z', a.lin(['#e6d8ff', '#a88cf0', '#6a4fc0'], 'h'), ' stroke-width="1.4"');
  b += runeGlyphs([[32, 22, 0.95], [32, 31, 0.95], [32, 40, 0.95], [32, 49.5, 0.95]], '#6fd3ff', r);
  b += line('M14 56Q32 60 50 56', '#9ad8ff', 3.2, 0.4) + line('M14 56Q32 60 50 56', '#dff6ff', 1.2);
  b += line('M4 39L13 42M51 42L60 39', '#9ad8ff', 1.6);
  b += path('M25 7L32 12L39 7L37 6Q32 9.5 27 6Z', a.lin(m.key === 'iron' ? MATS.fine.trim : m.trim, 'v'), ' stroke-width="1.4"');
  b += line('M9.5 22L5 38M17 13Q12 16 10 21', t[0], 1.3, 0.8);
  return flat(b, [[22, 40, 0.9], [42, 40, 0.9]], [50, 11, 4]);
}

function shield({ a, m }: X): Built {
  const d = 'M32 5L52 11Q53 40 32 59Q11 40 12 11Z';
  let b = path(d, a.lin(m.metal, 'd'));
  b += path('M32 10L47.5 14.5Q48 37 32 53Q16 37 16.5 14.5Z', a.lin(m.cloth, 'd'), ' stroke-width="1.4"');
  b += path('M21 24L32 32L43 24V31L32 39L21 31Z', a.lin(m.trim, 'v'), ' stroke-width="1.4"');
  b += line('M15 14Q15 33 27 50', '#ffffff', 1.2, 0.6);
  return flat(b, [[24, 18, 0.8], [40, 44, 0.8]], [50, 11, 4]);
}

const WEAPONS: Record<string, (x: X) => Built> = {
  longsword: (x) => sword(x, { hw: 4.6, tip: -2, gy: 45, gw: 12, end: 60 }),
  greatsword: (x) => sword(x, { hw: 5.8, tip: -4, gy: 45, gw: 15, end: 61 }),
  bastard: (x) => sword(x, { hw: 5, tip: -3, gy: 45, gw: 13, end: 61 }),
  sabre, rapier,
  dirk: (x) => dagger(x, 'dirk'), stiletto: (x) => dagger(x, 'stiletto'), kris: (x) => dagger(x, 'kris'),
  shortsword: (x) => dagger(x, 'shortsword'), 'twin-daggers': twinDaggers,
  battleaxe, warhammer, mace: warhammer,
  halberd: (x) => polearm(x, true), spear: (x) => polearm(x, false),
  crossbow: (x) => crossbow(x, false), 'hand-crossbow': (x) => crossbow(x, true), bow,
  wand, staff, rod, orb, grimoire, focus, 'lute-blade': luteBlade, whip,
  'fallback-weapon': (x) => sword(x, { hw: 4.6, tip: -2, gy: 45, gw: 12, end: 60 }),
};
const ARMORS: Record<string, (x: X) => Built> = {
  chain: (x) => mail(x, false), scale: (x) => mail(x, true),
  brigandine: (x) => cuirass(x, false), plate: (x) => cuirass(x, true),
  'leather-coat': leatherCoat, jerkin, doublet, vest, cloak, dragonscale, 'mage-robe': mageRobe,
  'fallback-armor': shield,
};

// ===== charms (final coordinates, own palettes; the stat colour drives gems and glow) =====
const GOLD: Tone = ['#fff1b0', '#e0b04a', '#8f6a24'];
const SILVER: Tone = ['#ffffff', '#c8d0dc', '#6e7888'];
const cord = (d: string) => rope(d, '#8a5a32', 1.4);
const chain = (d: string) => rope(d, '#c9ced6', 1.3) + line(d, '#6e7888', 1.3, 0.8).replace('/>', ' stroke-dasharray="1.2 1.6"/>');

function ringBand(a: Art, t: Tone): string {
  return path('M15 40a17 14 0 1 0 34 0a17 14 0 1 0 -34 0ZM20.5 41.5a11.5 8.5 0 1 0 23 0a11.5 8.5 0 1 0 -23 0Z', a.lin(t, 'd'), ' fill-rule="evenodd"') +
    line('M17.6 35Q21 28 30 26.6', t[0], 1.3, 0.9);
}

const CHARMS: Record<string, (x: X) => string> = {
  'bear-tooth': ({ a }) => {
    let b = cord('M15 4Q17 21 32 22Q47 21 49 4');
    b += path('M27 24Q25.5 44 37 59Q44.5 44 38.5 24Z', a.lin(['#fffaf0', '#e8dcc0', '#a8946c'], 'h'));
    b += line('M29.5 28Q29.5 42 35 52', '#ffffff', 1.4, 0.85) + line('M36 30Q38 40 37 50', '#a8946c', 1, 0.8);
    b += path('M26.5 19H38.5V26H26.5Z', a.lin(['#c08a58', '#8f5f36', '#5e3c20'], 'v'));
    b += line('M27 22.5H38', '#5e3c20', 1);
    return b;
  },
  'ox-band': ({ a }) => {
    let b = path('M13 22Q32 14 51 22V42Q32 50 13 42Z', a.lin(['#d6a272', '#93613a', '#4e3018'], 'h'));
    b += path('M13 22Q32 30 51 22Q32 14 13 22Z', '#3a2414', ' stroke-width="1.6"');
    b += shade('M19 30Q23 26.5 28 30Q27 35 21 34.5Z', '#f4e9cf', 0.85) + shade('M40 37Q44 33.5 48 36.5Q46 41 41 40.5Z', '#f4e9cf', 0.85) + shade('M14 37Q16 35 18 38L17 41Q15 40.5 14 39Z', '#f4e9cf', 0.85);
    b += line('M14.5 26Q32 33.5 49.5 26M14.5 39Q32 46.5 49.5 39', '#f4e9cf', 1, 0.9).replace(/\/>/g, ' stroke-dasharray="2 2"/>');
    b += circ(32, 35.5, 4.2, a.lin(GOLD)) + line('M26 30Q27.5 35 32 35.5Q36.5 35 38 30', GOLD[2], 1.6);
    return b;
  },
  'cat-eye-ring': ({ a }) => {
    let b = ringBand(a, GOLD);
    b += ell(32, 22, 11, 8.5, a.lin(GOLD, 'v'));
    b += ell(32, 21.5, 8, 6.2, a.rad([[0, '#f6ff9a'], [0.55, '#a8d82a'], [1, '#3e6a10']], 0.4, 0.35, 0.7), ' stroke-width="1.2"');
    b += ell(32, 21.5, 1.4, 5, OL, NOSTROKE) + circ(29.2, 19.2, 1.3, '#ffffff', ' stroke="none" opacity=".9"');
    return b;
  },
  'feather-anklet': ({ a }) => {
    let b = ell(32, 17, 19, 8, 'none', ' stroke-width="3.4"') + ell(32, 17, 19, 8, 'none', ' stroke="#8a5a32" stroke-width="1.4"');
    b += line('M32 25V31', OL, 2.4);
    b += `<g transform="rotate(16 32 31)">${path('M32 31Q42.5 38 39.5 52Q37 59 32 62Q27 59 24.5 52Q21.5 38 32 31Z', a.lin(['#ffffff', '#cfeaf2', '#5aa0b4'], 'v'))}`;
    b += shade('M24.6 51Q32 55 39.4 51Q37 59 32 62Q27 59 24.6 51Z', '#2a6a80', 0.7);
    b += line('M32 32V61', '#5a6a7a', 1) + line('M32 41L38.5 45M32 47L26 51', '#5a8a9a', 0.9) + `</g>`;
    for (const [bx, by, c] of [[13.6, 19, '#3ab0a0'], [20, 23.6, '#e0583a'], [32, 25.2, '#3ab0a0'], [44, 23.6, '#e0583a'], [50.4, 19, '#3ab0a0']] as const) b += circ(bx, by, 2.3, c, ' stroke-width="1.2"');
    return b;
  },
  'ironroot-amulet': ({ a, col }) => {
    let b = chain('M16 4Q18 22 32 24Q46 22 48 4');
    b += circ(32, 40, 14, a.lin(['#b4bec8', '#6a747e', '#2f363d']));
    b += line('M21 33Q24 31 25 27', '#ffffff', 1.2, 0.5);
    for (const d of ['M32 40Q25 37 22 30', 'M32 40Q40 36 43 31', 'M32 40Q24 44 23 50', 'M32 40Q39 45 40 51', 'M32 40Q32 47 30 53'])
      b += rope(d, '#9a6a3e', 1.5);
    b += gem(a, 32, 40, 4.4, col);
    b += circ(32, 25, 2.6, 'none', ` stroke="${GOLD[1]}" stroke-width="1.6"`);
    return b;
  },
  'troll-knuckle': ({ a }) => {
    const cp = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    const bone = cp(26, 13, 7) + cp(38, 13, 7) + cp(26, 51, 7) + cp(38, 51, 7) + 'M26 12H38V52H26Z';
    const t: Tone = ['#eef2d2', '#a8b48a', '#5c6a44'];
    let b = `<g transform="rotate(45 32 32) translate(32 32) scale(.92) translate(-32 -32)">`;
    b += path(bone, OL, ' stroke-width="4"') + path(bone, a.lin(t, 'h'), NOSTROKE);
    b += line('M21.5 9.5Q20 14 23 17.5M23 46Q21 50 22.5 55', '#ffffff', 1.4, 0.75) + line('M33 21V43', t[2], 1.2, 0.6);
    b += circ(35, 26, 1.6, '#7e8c60', NOSTROKE) + circ(29, 40, 1.3, '#7e8c60', NOSTROKE) + circ(41, 50, 1.8, '#7e8c60', NOSTROKE) + circ(25, 52, 1.1, '#7e8c60', NOSTROKE);
    b += path('M25 28.5H39V34.5H25Z', a.lin(['#c08a58', '#8f5f36', '#5e3c20'], 'h'), ' stroke-width="1.6"') + line('M25.5 31.5H38.5', '#5e3c20', 0.9);
    b += '</g>' + cord('M33 33Q40 40 38 50');
    return b;
  },
  'owl-lens': ({ a }) => {
    let b = rope('M40.5 41L53 57', GOLD[1], 3.4);
    b += path('M19.5 21.5L15 7.5L26 16.5Z', a.lin(['#d8a870', '#a0703a', '#5e3c1c'], 'v')) + path('M40.5 21.5L45 7.5L34 16.5Z', a.lin(['#d8a870', '#a0703a', '#5e3c1c'], 'v'));
    b += circ(30, 30, 13.5, a.rad([[0, '#f2fbff'], [0.6, '#a8d4ec'], [1, '#5a88a8']], 0.4, 0.35, 0.7));
    b += circ(30, 30, 5.2, '#f0a830', ' stroke="none" opacity=".55"') + circ(30, 30, 2.2, OL, ' stroke="none" opacity=".6"');
    b += line('M21.5 26Q23.5 20.5 29 19.5', '#ffffff', 1.8, 0.9);
    b += circ(30, 30, 14, 'none', ' stroke-width="6"') + circ(30, 30, 14, 'none', ` stroke="${GOLD[1]}" stroke-width="3.6"`);
    b += line('M19.6 21Q24 16.6 30 16.4', GOLD[0], 1.2, 0.9);
    return b;
  },
  'inkstone-pendant': ({ a }) => {
    let b = cord('M16 4Q18 18 32 20Q46 18 48 4');
    b += path('M32 51Q36.5 56.5 34.5 59.5Q32 62 29.5 59.5Q27.5 56.5 32 51Z', '#2a3a9a', ' stroke-width="1.6"');
    b += `<rect x="21.5" y="21.5" width="21" height="29" rx="7" fill="${a.lin(['#6a7080', '#30343f', '#14161c'])}"/>`;
    const sw = 'M27 33Q31 25.5 36.5 30Q40 36 33.5 39Q28.5 40 29 36Q30 33 33 34';
    b += line(sw, '#7a9aff', 3.4, 0.35) + line(sw, '#a8c0ff', 1.4);
    b += line('M24.6 26Q23.8 34 24.6 44', '#ffffff', 1.2, 0.35);
    b += path('M27.5 18.5H36.5V23H27.5Z', a.lin(SILVER, 'v'), ' stroke-width="1.5"');
    return b;
  },
  'moon-pebble': ({ a }) => {
    let b = glow(a, 32, 34, 30, '#bfe0ff', 0.5);
    b += path('M13 37Q11 22 28 18.5Q46.5 15.5 51.5 30Q55 47 36 51Q15 53 13 37Z', a.rad([[0, '#f4f7fd'], [0.6, '#b8c2d6'], [1, '#6a7690']], 0.4, 0.35, 0.7));
    b += path('M30.6 25.1A9 9 0 1 0 40.1 37.9A8 8 0 0 1 30.6 25.1Z', '#fff6c8', ' stroke="#c9a640" stroke-width="1.2"');
    b += line('M17.5 33Q18 25 25 22', '#ffffff', 1.4, 0.8);
    b += circ(44, 43, 0.9, '#8a96ae', NOSTROKE) + circ(20, 43, 1.1, '#8a96ae', NOSTROKE) + circ(46, 26, 0.8, '#8a96ae', NOSTROKE);
    return b;
  },
  'hermit-bell': ({ a }) => {
    const bronze: Tone = ['#f6cc8a', '#c08a3a', '#6a4618'];
    let b = cord('M32 1V10');
    b += circ(32, 12.5, 3.4, 'none', ' stroke-width="4.4"') + circ(32, 12.5, 3.4, 'none', ` stroke="${bronze[1]}" stroke-width="2.4"`);
    b += circ(32, 54.5, 3.4, a.lin(bronze));
    b += path('M19 47Q19.5 23 32 17Q44.5 23 45 47L49 51Q32 56 15 51Z', a.lin(bronze, 'h'));
    b += line('M19.6 40.5Q32 44.5 44.4 40.5', bronze[2], 1.4) + line('M16 50.5Q32 55 48 50.5', bronze[2], 1.4);
    b += line('M23.5 44Q23.5 29 30 22', '#ffffff', 1.5, 0.7);
    return b;
  },
  'silver-tongue-pin': ({ a, col }) => {
    let b = rope('M9 55L50 14', SILVER[1], 2.4) + line('M9 55L13 51', OL, 1);
    b += circ(29, 35, 13, 'none', ' stroke-width="6.4"') + circ(29, 35, 13, 'none', ` stroke="${SILVER[1]}" stroke-width="4.2"`);
    b += line('M18.5 27.5Q22.5 23 28.5 22.2', '#ffffff', 1.4, 0.9);
    b += path('M46.5 17.5Q47 9 54 5.5Q60 3 60.5 8Q60 10.5 56.5 11L60 14.5Q55.5 18.5 50.5 20.5Z', a.lin(SILVER, 'd'), ' stroke-width="1.6"') + line('M49.5 17Q52 11 57 8', '#7a8494', 1, 0.8);
    b += gem(a, 29, 48, 3.2, col);
    return b;
  },
  'rose-locket': ({ a }) => {
    let b = chain('M16 4Q18 18 32 20Q46 18 48 4');
    b += circ(32, 21.8, 2.4, 'none', ` stroke="${GOLD[1]}" stroke-width="1.6"`);
    b += ell(32, 39, 13, 15, a.lin(GOLD));
    b += ell(32, 39, 10, 12, 'none', ` stroke="${GOLD[2]}" stroke-width="1"`);
    b += line('M21.5 33Q22.5 27.5 27 25.5', '#ffffff', 1.3, 0.85);
    b += path('M26.5 43.5Q22 44 22 47.5Q26.5 47.5 28.5 44.5Z', '#47a05a', ' stroke-width="1.2"') + path('M37.5 43.5Q42 44 42 47.5Q37.5 47.5 35.5 44.5Z', '#47a05a', ' stroke-width="1.2"');
    b += circ(32, 38.5, 6, a.rad([[0, '#ff8a9a'], [0.6, '#d0283a'], [1, '#7a0e1e']], 0.4, 0.35, 0.7), ' stroke-width="1.4"');
    b += line('M32 36.5Q34.5 37 33.2 39.6Q30.2 40.4 29.6 37.8Q30.2 34.4 33.8 34.6', '#7a0e1e', 0.9);
    return b;
  },
  ring: ({ a, col }) => ringBand(a, GOLD) + circ(32, 22, 8, a.lin(GOLD, 'v')) + gem(a, 32, 22, 5.6, col),
  amulet: ({ a, col }) => {
    let b = chain('M16 4Q18 20 32 22Q46 20 48 4');
    b += circ(32, 24, 2.4, 'none', ` stroke="${GOLD[1]}" stroke-width="1.6"`);
    b += circ(32, 40, 13, a.lin(GOLD));
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * i) / 4;
      b += circ(32 + Math.cos(ang) * 10.4, 40 + Math.sin(ang) * 10.4, 0.9, GOLD[2], NOSTROKE);
    }
    b += line('M22 34Q24 29 29 28', '#ffffff', 1.3, 0.8);
    b += gem(a, 32, 40, 6, col);
    return b;
  },
};
CHARMS['fallback-ring'] = CHARMS.ring;
CHARMS['fallback-amulet'] = CHARMS.amulet;

/** An illustrated inventory icon for an item (64-unit viewBox, transparent background). */
export function itemArt(it: ItemArtInput, size = 64): string {
  const a = new Art();
  const shape = itemArtShape(it);
  const name = baseName(it.name);
  const r = mulberry32(hashString(`${it.name}|${it.tier}|${it.plus}`));
  const m = materialFor(it);
  const col = STAT_COLOR[it.stat ?? CHARM_STAT[shape] ?? 'wis'];
  const x: X = { a, m, name, r, col };
  let body = '';
  if (it.slot === 'charm') {
    const k = clamp01((it.plus - 1) / 2);
    if (k > 0) body += glowRing(a, col, k);
    body += CHARMS[shape](x);
    if (it.tier >= 4) body += sparkle(52, 12, 4);
  } else {
    const b = (it.slot === 'weapon' ? WEAPONS : ARMORS)[shape](x);
    const k = it.slot === 'weapon' ? clamp01((it.plus - 1) / 4) : clamp01((it.tier - 2) / 3);
    if (k > 0) body += glowRing(a, m.glow, k);
    const inner = b.body + fx(m, b.spots, r);
    body += b.tf ? `<g transform="${b.tf}">${inner}</g>` : inner;
    if (b.extra) body += b.extra;
    if (m.key === 'starforged' && b.star) body += sparkle(b.star[0], b.star[1], b.star[2]);
  }
  return a.out(body, size);
}

function glowRing(a: Art, c: string, k: number): string {
  return circ(32, 32, 31.5, a.rad([[0, c, 0], [0.5, c, 0], [0.8, c, 0.42 * k], [1, c, 0]]), NOSTROKE);
}

// ===== HUD glyphs =====
const POTIONS: Record<'heal', Tone> = { heal: ['#ff9a8a', '#d8283a', '#7a0e1e'] };

/** A stoppered round flask; 'heal' is the red healing potion. */
export function potionArt(kind: 'heal' = 'heal', size = 64): string {
  const a = new Art();
  const t = POTIONS[kind];
  const flask = 'M27 14H37V24Q49 28 49 41Q49 57 32 57Q15 57 15 41Q15 28 27 24Z';
  let b = path(flask, a.rad([[0, '#ffffff', 0.5], [1, '#bfe0f0', 0.35]], 0.4, 0.4, 0.7), NOSTROKE);
  b += path('M16.6 35Q24 32 32 35Q40 38 47.4 35Q48 38 48 41Q48 56 32 56Q16 56 16 41Q16 38 16.6 35Z', a.rad([[0, t[0]], [0.55, t[1]], [1, t[2]]], 0.4, 0.3, 0.75), NOSTROKE);
  b += line('M16.6 35Q24 32 32 35Q40 38 47.4 35', t[0], 1.2, 0.9);
  b += circ(37, 44, 1.6, '#ffffff', ' stroke="none" opacity=".6"') + circ(41, 49, 1, '#ffffff', ' stroke="none" opacity=".6"') + circ(34, 50, 1.2, '#ffffff', ' stroke="none" opacity=".5"');
  b += line('M20.5 33Q18.5 43 23 50', '#ffffff', 2.2, 0.75) + line('M29.5 16V23', '#ffffff', 1.4, 0.7);
  b += path(flask, 'none', ' stroke-width="2.2"');
  b += path('M26.5 6H37.5L36.5 15H27.5Z', a.lin(['#e8c08a', '#b07a44', '#6a4420'], 'h'));
  b += path('M25 13.5H39V17H25Z', a.lin(['#ffffff', '#cfe6f0', '#7aa0b4'], 'v'), ' stroke-width="1.6"');
  return a.out(b, size);
}

/** A stack of gold coins. */
export function goldArt(size = 64): string {
  const a = new Art();
  const side = a.lin(GOLD, 'h'), face = a.lin(GOLD);
  const coin = (cx: number, y: number) =>
    path(`M${cx - 13} ${y}v4a13 5 0 0 0 26 0v-4`, side) + line(`M${cx - 9} ${y + 6.4}v2.6M${cx - 3} ${y + 7.5}v2.4M${cx + 3} ${y + 7.5}v2.4M${cx + 9} ${y + 6.4}v2.6`, GOLD[2], 0.9) +
    ell(cx, y, 13, 5, face) + ell(cx, y, 8.5, 3, 'none', ` stroke="${GOLD[2]}" stroke-width="1"`);
  let b = '';
  for (const y of [45, 40, 35]) b += coin(42, y);
  for (const y of [43, 38, 33, 28, 23]) b += coin(25, y);
  b += path(star5(25, 23, 3.4, 1.5), GOLD[0], ` stroke="${GOLD[2]}" stroke-width=".8"`);
  b += sparkle(40, 16, 4.5);
  return a.out(b, size);
}

/** A wooden torch, burning or snuffed. */
export function torchArt(lit = true, size = 64): string {
  const a = new Art();
  let b = lit ? glow(a, 32, 17, 28, '#ffb03a', 0.6) : '';
  let t = path('M29.5 30H34.5L33.6 61H30.4Z', a.lin(['#c39262', '#8a5a32', '#5a3a1e'], 'h'));
  t += path('M27 23H37L35.5 33H28.5Z', a.lin(lit ? ['#8a6a4a', '#5a4030', '#2e2018'] : ['#5a5050', '#3a3030', '#1e1818'], 'h'));
  t += line('M27.8 26.5H36.2M28.3 30H35.7', lit ? '#c8a070' : '#6a6060', 1.2);
  if (lit) {
    t += path('M32 0C38 6 42 12 39.5 18.5C38 23 35 24.5 32 24.5C29 24.5 26 23 24.5 18.5C22.5 13 26.5 10 28 5C29 9 30.5 10 31 10C30.5 6 31 3 32 0Z', '#ff7a2a', ' stroke="#7a1e10" stroke-width="1.6"');
    t += path('M32 7C35.5 11 37 15 35.5 19C34.5 21.5 33 22.5 32 22.5C30.5 22.5 29 21.5 28.5 19C27.5 15.5 30 13 30.5 10.5C31 12 31.5 12.5 32 12.5C31.8 10.5 31.7 9 32 7Z', '#ffc04a', NOSTROKE);
    t += path('M32 14C33.8 16.5 34.2 18.5 33.4 20.2C32.8 21.2 31.2 21.2 30.6 20.2C29.8 18.5 30.6 16.5 32 14Z', '#fff4c0', NOSTROKE);
  } else {
    t += line('M32 21Q28 16 32 11.5Q36 7 32 2', '#a0a8ba', 2.2, 0.7) + circ(33, 23.5, 1.2, '#ff7a2a', NOSTROKE);
  }
  b += `<g transform="rotate(14 32 44)">${t}</g>`;
  return a.out(b, size);
}

/** Inspiration: a golden four-point sparkle. */
export function inspirationArt(size = 64): string {
  const a = new Art();
  let b = glow(a, 32, 32, 30, '#ffd76a', 0.6);
  const s = 23, k = 4.6;
  b += path(`M32 ${32 - s}Q${32 + k} ${32 - k} ${32 + s} 32Q${32 + k} ${32 + k} 32 ${32 + s}Q${32 - k} ${32 + k} ${32 - s} 32Q${32 - k} ${32 - k} 32 ${32 - s}Z`, a.lin(['#fff6c8', '#ffd76a', '#c8962a']));
  b += line('M30.5 13Q30 28 16 30.5', '#ffffff', 1.4, 0.8);
  b += sparkle(32, 32, 8, '#ffffff', '#ffd76a', 0.6);
  b += sparkle(13, 13, 5, '#fff6c8', OL, 1.4) + sparkle(51, 50, 4.2, '#fff6c8', OL, 1.4) + sparkle(51, 13, 3, '#fff6c8', OL, 1.2);
  return a.out(b, size);
}

/** Experience: a star medal with ribbon tails. */
export function xpArt(size = 64): string {
  const a = new Art();
  const blue: Tone = ['#8aa8f6', '#3f5fc8', '#1e2f78'];
  let b = path('M23 38L16 59L24 55L28.5 61L33 44Z', a.lin(blue, 'v')) + path('M41 38L48 59L40 55L35.5 61L31 44Z', a.lin(blue, 'v'));
  b += circ(32, 27, 20, a.lin(GOLD));
  b += circ(32, 27, 15, a.lin(blue), ` stroke="${GOLD[2]}" stroke-width="1.4"`);
  b += path(star5(32, 27.5, 11, 4.6), a.lin(['#fff6c8', '#ffd76a', '#c8962a']), ' stroke-width="1.6"');
  b += line('M16.5 21Q19 12 28 9', '#ffffff', 1.4, 0.75);
  return a.out(b, size);
}
