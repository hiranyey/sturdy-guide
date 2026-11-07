// Class-aware hero & companion portraits, plus class emblems.
// Storybook flat-vector: bold silhouettes, ink outlines, 2–3 tone shading, a soft rim light.
// Fully deterministic from the name; the face matches portrait.ts so companions stay recognisable.
import { hashString, mulberry32, pick } from '../../core/rng';
import { CLASSES } from '../../core/rules';
import type { ClassId } from '../../core/types';

const INK = '#1b1b24';
const GOLD = '#d4a64a';
const GOLD_HI = '#ffd76a';
const OL = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;

// Same tables (and draw order) as portrait.ts so a name yields the same face.
const SKIN = ['#f5d0b5', '#e8b796', '#d29a73', '#b07650', '#8a5638', '#5e3a24', '#c9d8b0', '#b8c4e0'];
const HAIR = ['#2b1d14', '#5a3b22', '#a0642c', '#d9a441', '#e8e0d0', '#7a2a1d', '#3a3f58', '#6b8f4e', '#9b5fc0'];

let uid = 0;

const n = (x: number) => Math.round(x * 10) / 10;

function hex(c: string): number {
  let s = c.slice(1);
  if (s.length === 3) s = s.replace(/./g, (ch) => ch + ch);
  return parseInt(s, 16);
}

/** Linear blend of two #rgb/#rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = hex(a), pb = hex(b);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const dark = (c: string, t: number) => mix(c, '#000000', t);
const light = (c: string, t: number) => mix(c, '#ffffff', t);

/** Elliptical arc path from angle a0 to a1 (degrees, 0 = right, 90 = down), clockwise. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): string {
  const p = (a: number) => `${n(cx + rx * Math.cos((a * Math.PI) / 180))} ${n(cy + ry * Math.sin((a * Math.PI) / 180))}`;
  return `M${p(a0)} A${n(rx)} ${n(ry)} 0 0 1 ${p(a1)}`;
}

function star(cx: number, cy: number, ro: number, ri: number, pts = 5): string {
  let d = '';
  for (let i = 0; i < pts * 2; i++) {
    const a = (Math.PI * i) / pts - Math.PI / 2, rr = i % 2 ? ri : ro;
    d += `${i ? 'L' : 'M'}${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  }
  return d + 'Z';
}

/** Sub-segment [t0,t1] of a quadratic Bézier, nudged by (dx,dy): rim lights that hug a curved edge. */
function qsub(p0: [number, number], c: [number, number], p2: [number, number], t0: number, t1: number, dx = 0, dy = 0): string {
  const at = (t: number, i: 0 | 1) => (1 - t) * (1 - t) * p0[i] + 2 * t * (1 - t) * c[i] + t * t * p2[i];
  const cp = (i: 0 | 1) => (1 - t0) * (1 - t1) * p0[i] + ((1 - t0) * t1 + t0 * (1 - t1)) * c[i] + t0 * t1 * p2[i];
  return `M${n(at(t0, 0) + dx)} ${n(at(t0, 1) + dy)} Q${n(cp(0) + dx)} ${n(cp(1) + dy)} ${n(at(t1, 0) + dx)} ${n(at(t1, 1) + dy)}`;
}

const mirror = (s: string) => `<g transform="matrix(-1 0 0 1 100 0)">${s}</g>`;

// ---------------------------------------------------------------- face

export interface Face {
  skin: string; hair: string; hairStyle: number; beard: boolean; beardLen: number;
  eyeY: number; eyeGap: number; fw: number; scar: boolean; earring: boolean; smile: number;
}

/** Face parameters, drawn from the name hash in exactly the order portrait.ts uses. */
export function faceOf(name: string): Face {
  const r = mulberry32(hashString(name));
  const skin = pick(SKIN, r), hair = pick(HAIR, r);
  r(); r(); // background & cloth picks in portrait.ts
  const hairStyle = Math.floor(r() * 5);
  const beard = r() < 0.3;
  r(); // hood flag in portrait.ts (class headgear decides here)
  const eyeY = n(46 + r() * 3);
  const eyeGap = n(9 + r() * 3);
  const fw = n(19 + r() * 4);
  const scar = r() < 0.15;
  const earring = r() < 0.25;
  const smile = r();
  const beardLen = beard ? n(84 + r() * 6) : 0;
  return { skin, hair, hairStyle, beard, beardLen, eyeY, eyeGap, fw, scar, earring, smile };
}

function hairSvg(f: Face): string {
  const { fw, hair } = f, L = 50 - fw, R = 50 + fw;
  const d = [
    `M${n(L - 2)} 46 Q${L} 20 50 20 Q${R} 20 ${n(R + 2)} 46 Q${n(R - 4)} 30 50 30 Q${n(L + 4)} 30 ${n(L - 2)} 46Z`,
    `M${n(L - 3)} 70 Q${n(L - 6)} 18 50 18 Q${n(R + 6)} 18 ${n(R + 3)} 70 L${n(R - 2)} 70 Q${R} 34 50 32 Q${L} 34 ${n(L + 2)} 70Z`,
    `M${L} 38 Q50 14 ${R} 38 Q50 28 ${L} 38Z`,
    `M${n(L - 2)} 44 Q${n(L - 2)} 22 50 22 Q${n(R + 2)} 22 ${n(R + 2)} 44 L${n(R - 3)} 36 L56 30 L46 34 L${n(L + 3)} 34Z`,
  ][f.hairStyle];
  return d ? `<path d="${d}" fill="${hair}" stroke="${dark(hair, 0.45)}" stroke-width="1.2" stroke-linejoin="round"/>` : '';
}

/** Hair glimpsed under a hood: a fringe, plus side locks for long hair. */
function fringeSvg(f: Face, top: number): string {
  if (f.hairStyle === 4) return '';
  const { fw, hair } = f, L = 50 - fw, R = 50 + fw;
  let d = `M${n(L + 3)} ${top + 9} Q${n(L + 5)} ${top} 50 ${top - 1} Q${n(R - 5)} ${top} ${n(R - 3)} ${top + 9} Q55 ${top + 3} 49 ${top + 6} Q43 ${top + 3} ${n(L + 3)} ${top + 9}Z`;
  if (f.hairStyle === 1) {
    d += `M${n(L + 2)} 44 Q${n(L + 1)} 60 ${n(L + 4)} 70 L${n(L + 7)} 66 Q${n(L + 5)} 54 ${n(L + 7)} 42Z`;
    d += `M${n(R - 2)} 44 Q${n(R - 1)} 60 ${n(R - 4)} 70 L${n(R - 7)} 66 Q${n(R - 5)} 54 ${n(R - 7)} 42Z`;
  }
  return `<path d="${d}" fill="${hair}" stroke="${dark(hair, 0.45)}" stroke-width="1.2" stroke-linejoin="round"/>`;
}

/** Neck + face oval with shading crescent and rim light. */
function faceBase(f: Face, rim: string): string {
  const sh = mix(f.skin, '#3a1f2a', 0.3);
  return `<path d="M41 60 L41 86 L59 86 L59 60Z" fill="${sh}" ${OL}/>` +
    `<ellipse cx="50" cy="50" rx="${f.fw}" ry="24" fill="${f.skin}" ${OL}/>` +
    `<path d="M50 27 A${n(f.fw - 1)} 23 0 0 1 50 73 A${n(f.fw * 0.5)} 23 0 0 0 50 27Z" fill="${sh}" opacity=".5"/>` +
    `<path d="${arc(50, 50, f.fw - 2, 22, 160, 250)}" stroke="${rim}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".55"/>`;
}

function featsSvg(f: Face, brows: boolean, lower: boolean): string {
  const { eyeY: y, eyeGap: g, fw, hair } = f;
  let s = `<ellipse cx="${n(50 - g)}" cy="${y}" rx="2.7" ry="3.1" fill="${INK}"/><ellipse cx="${n(50 + g)}" cy="${y}" rx="2.7" ry="3.1" fill="${INK}"/>` +
    `<circle cx="${n(50 - g + 0.9)}" cy="${n(y - 1)}" r="1" fill="#fff"/><circle cx="${n(50 + g + 0.9)}" cy="${n(y - 1)}" r="1" fill="#fff"/>`;
  if (brows) s += `<path d="M${n(50 - g - 4)} ${n(y - 6)} L${n(50 - g + 4)} ${n(y - 7)}M${n(50 + g - 4)} ${n(y - 7)} L${n(50 + g + 4)} ${n(y - 6)}" stroke="${dark(hair, 0.2)}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (lower) {
    s += `<path d="M50 ${n(y + 3)} Q47 ${n(y + 10)} 50 ${n(y + 11)}" stroke="#00000040" stroke-width="1.6" fill="none"/>` +
      `<ellipse cx="${n(50 - fw + 6)}" cy="58" rx="4" ry="2.5" fill="#ff6b6b" opacity=".2"/><ellipse cx="${n(50 + fw - 6)}" cy="58" rx="4" ry="2.5" fill="#ff6b6b" opacity=".2"/>`;
    if (f.beard) s += `<path d="M${n(50 - fw + 2)} 55 Q50 ${f.beardLen} ${n(50 + fw - 2)} 55 Q50 66 ${n(50 - fw + 2)} 55Z" fill="${hair}" stroke="${dark(hair, 0.45)}" stroke-width="1.2"/>`;
    const m = f.smile < 0.33 ? 'M43 62 Q50 67 57 62' : f.smile < 0.66 ? 'M44 63 L56 63' : 'M43 64 Q50 60 57 64';
    s += `<path d="${m}" stroke="#5a2a22" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  if (f.scar) s += `<path d="M${n(50 + g - 3)} ${n(y - 9)} L${n(50 + g + 3)} ${n(y + 8)}" stroke="#a33" stroke-width="1.4" opacity=".7"/>`;
  return s;
}

const earringSvg = (f: Face) => (f.earring ? `<circle cx="${f.fw + 50}" cy="58" r="2.2" fill="${GOLD_HI}" ${OL.replace('2"', '1"')}/>` : '');

// ---------------------------------------------------------------- outfits
// All drawn in "figure" space (face centred at 50,50, ry 24), later scaled into the disc.

const TORSO = 'M-2 120 L2 96 Q5 81 30 77 Q40 75 50 75 Q60 75 70 77 Q95 81 98 96 L102 120Z';
const SHOULDER_RIM = 'M3 98 Q6 83 28 78';

interface Ctx { f: Face; r: () => number; cc: string; rim: string; id: string }

const rimStroke = (d: string, rim: string) => `<path d="${d}" stroke="${rim}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>`;

function warrior({ f, r, cc, rim }: Ctx): string {
  const helm = r() < 0.55;
  const cloak = pick(['#a3302a', '#c2462e', '#7e2635', dark(cc, 0.3)], r);
  const plume = r() < 0.5;
  const steel = '#a3aeba', steelD = '#66717e', steelL = '#e3e9ef';
  const L = n(50 - f.fw - 4), R = n(50 + f.fw + 4);
  let s = `<path d="M-6 120 Q-4 84 22 76 L50 71 L78 76 Q104 84 106 120Z" fill="${dark(cloak, 0.35)}" ${OL}/>`;
  if (helm) {
    s += `<path d="${TORSO}" fill="${steel}" ${OL}/><path d="M50 76 Q72 76 90 84 L96 120 L50 120Z" fill="${steelD}" opacity=".55"/>` +
      `<path d="M50 84 L50 120" stroke="${steelL}" stroke-width="2"/><path d="M28 104 Q50 96 72 104" stroke="${steelD}" stroke-width="2" fill="none"/>`;
  } else {
    s += `<path d="${TORSO}" fill="${dark(cc, 0.15)}" ${OL}/><path d="M50 76 Q72 76 90 84 L96 120 L50 120Z" fill="#000" opacity=".2"/>` +
      `<path d="M36 120 L38 84 M64 120 L62 84" stroke="${GOLD}" stroke-width="3"/>`;
  }
  const drape = `<path d="M-4 120 L0 96 Q3 80 26 76 L35 76 Q27 92 29 120Z" fill="${cloak}" ${OL}/>`;
  s += drape + mirror(drape.replace(cloak, dark(cloak, 0.2))) + rimStroke(SHOULDER_RIM, rim);
  const pauldron = helm
    ? `<path d="M12 96 Q9 80 25 75 Q37 72 40 82 Q30 83 25 91Z" fill="${steel}" ${OL}/><path d="M15 88 Q22 79 35 78" stroke="${steelL}" stroke-width="1.8" fill="none"/>`
    : `<path d="M4 104 Q0 80 22 72 Q38 67 43 80 Q32 81 26 90 Q18 98 4 104Z" fill="${steel}" ${OL}/>` +
      `<path d="M8 96 Q14 84 28 80 M14 101 Q18 92 27 88" stroke="${steelD}" stroke-width="2" fill="none"/><path d="M7 88 Q12 76 26 73" stroke="${steelL}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M25 82 Q26 64 40 61 L60 61 Q74 64 75 82Z" fill="${dark(cloak, 0.15)}" ${OL}/>`;
  s += pauldron + mirror(pauldron.replace(steelL, steel));
  // chainmail collar
  let rings = '';
  for (const y of [76, 80, 84]) for (let x = 37; x < 63; x += 4) rings += `M${x} ${y}a2 2 0 0 0 4 0`;
  s += `<path d="M35 70 Q50 78 65 70 L67 85 Q50 93 33 85Z" fill="${steelD}" ${OL}/><path d="${rings}" stroke="${steelL}" stroke-width="1.1" fill="none" opacity=".8"/>` +
    `<circle cx="31" cy="84" r="3.4" fill="${GOLD}" ${OL}/><circle cx="69" cy="84" r="3.4" fill="${GOLD}" ${OL}/>`;
  s += faceBase(f, rim);
  if (!helm) return s + hairSvg(f) + featsSvg(f, true, true) + earringSvg(f);
  s += featsSvg(f, false, true);
  if (plume) s += `<path d="M46 12 Q44 -10 70 -10 Q84 -8 88 6 Q76 -2 66 2 Q58 6 56 12Z" fill="${dark(cc, 0.1)}" ${OL}/><path d="M50 8 Q54 -4 70 -5" stroke="${light(cc, 0.35)}" stroke-width="1.8" fill="none"/>`;
  const hp = `M${L} 64 L${L} 36 Q${L} 9 50 8 Q${R} 9 ${R} 36 L${R} 64 Q${n(R - 4)} 68 ${n(R - 7)} 62 L${n(R - 7)} 46 Q56 38 50 40 Q44 38 ${n(L + 7)} 46 L${n(L + 7)} 62 Q${n(L + 4)} 68 ${L} 64Z`;
  s += `<path d="${hp}" fill="${steel}" ${OL}/>` +
    `<path d="M50 9 Q${R} 9 ${R} 36 L${R} 64 Q${n(R - 4)} 68 ${n(R - 7)} 62 L${n(R - 7)} 46 Q${n(R - 9)} 20 50 9Z" fill="${steelD}" opacity=".6"/>` +
    `<path d="M${L} 38 Q50 27 ${R} 38 L${R} 44 Q50 33 ${L} 44Z" fill="${steelD}" ${OL}/>` +
    `<path d="M50 9 L50 31" stroke="${steelL}" stroke-width="2.4"/><path d="M${n(L + 4)} 32 Q${n(L + 5)} 15 44 12" stroke="${steelL}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="${n(L + 4)}" cy="40" r="1.4" fill="${steelL}"/><circle cx="${n(R - 4)}" cy="40" r="1.4" fill="${steelL}"/>` +
    `<path d="M47.4 34 L52.6 34 L52.2 ${n(f.eyeY + 10)} L50 ${n(f.eyeY + 12)} L47.8 ${n(f.eyeY + 10)}Z" fill="${steel}" ${OL}/>`;
  return s;
}

function rogue({ f, r, cc, rim }: Ctx): string {
  const scarf = r() < 0.5;
  const dagger = r() < 0.6;
  const hood = pick(['#2b3531', '#262a3c', '#1f3a2e', '#3a2c26'], r);
  const cloth = pick([INK, dark(cc, 0.5), '#4a2230', '#3b404c'], r);
  const leather = pick(['#7a4a2a', '#5e3d27', '#86592f'], r);
  const L = n(50 - f.fw), R = n(50 + f.fw), y = f.eyeY;
  let s = '';
  if (dagger) s += `<g transform="rotate(30 80 74)"><rect x="77" y="44" width="6" height="28" rx="1.5" fill="#4a2e1c" ${OL}/><path d="M77 52 L83 50 M77 58 L83 56 M77 64 L83 62" stroke="#7a5236" stroke-width="1.4"/>` +
    `<rect x="69" y="70" width="22" height="5" rx="2" fill="${GOLD}" ${OL}/><circle cx="80" cy="42" r="4.2" fill="${GOLD}" ${OL}/></g>`;
  s += `<path d="${TORSO}" fill="${leather}" ${OL}/><path d="M50 76 Q72 76 90 84 L96 120 L50 120Z" fill="#000" opacity=".22"/>` +
    `<path d="M45 86 L55 90 M55 86 L45 90 M45 94 L55 98 M55 94 L45 98" stroke="${dark(leather, 0.55)}" stroke-width="1.6"/>` +
    `<path d="M14 82 L26 77 L88 120 L72 120Z" fill="${dark(leather, 0.5)}" ${OL}/><rect x="49" y="94" width="8" height="8" rx="1" fill="none" stroke="${GOLD}" stroke-width="2.2" transform="rotate(35 53 98)"/>`;
  // hood + mantle (behind face)
  const outer = `M${n(L - 13)} 88 Q${n(L - 16)} 38 ${n(L - 5)} 20 Q50 -2 ${n(R + 5)} 20 Q${n(R + 16)} 38 ${n(R + 13)} 88 Q50 98 ${n(L - 13)} 88Z`;
  s += `<path d="M2 106 Q4 84 26 78 Q50 72 74 78 Q96 84 98 106 L84 99 L72 104 L62 98 L50 103 L38 98 L28 104 L16 99Z" fill="${hood}" ${OL}/>` + rimStroke(SHOULDER_RIM, rim);
  s += `<path d="${outer}" fill="${dark(hood, 0.35)}" ${OL}/>`;
  s += faceBase(f, rim) + fringeSvg(f, 32) + featsSvg(f, true, false);
  // lower-face cover
  if (scarf) {
    s += `<path d="M${n(L - 2)} ${n(y + 7)} Q50 ${n(y + 11)} ${n(R + 2)} ${n(y + 7)} L${n(R + 4)} 86 Q50 96 ${n(L - 4)} 86Z" fill="${cloth}" ${OL}/>` +
      `<path d="M${n(L)} ${n(y + 16)} Q50 ${n(y + 21)} ${n(R)} ${n(y + 16)} M${n(L + 1)} ${n(y + 25)} Q50 ${n(y + 30)} ${n(R - 1)} ${n(y + 25)}" stroke="${light(cloth, 0.22)}" stroke-width="2.2" fill="none"/>` +
      `<path d="M${n(L + 2)} 82 Q${n(L - 6)} 96 ${n(L - 10)} 110 L${n(L - 1)} 112 Q${n(L + 3)} 98 ${n(L + 9)} 86Z" fill="${cloth}" ${OL}/>`;
  } else {
    s += `<path d="M${n(L - 1)} ${n(y + 5)} Q44 ${n(y + 9)} 50 ${n(y + 5)} Q56 ${n(y + 9)} ${n(R + 1)} ${n(y + 5)} L${n(R + 2)} 84 Q50 92 ${n(L - 2)} 84Z" fill="${cloth}" ${OL}/>` +
      `<path d="M50 ${n(y + 6)} L50 ${n(y + 14)} M42 ${n(y + 16)} Q50 ${n(y + 20)} 58 ${n(y + 16)}" stroke="${light(cloth, 0.2)}" stroke-width="1.6" fill="none"/>`;
  }
  // hood front: outer silhouette with the face opening cut out
  const hole = `M${n(L + 1)} 82 Q${n(L - 1)} 33 50 30 Q${n(R + 1)} 33 ${n(R - 1)} 82`;
  s += `<path d="${hole}" stroke="#000" stroke-opacity=".4" stroke-width="8" fill="none"/>` +
    `<path d="${outer}${hole}Z" fill="${hood}" fill-rule="evenodd" ${OL}/>` +
    `<path d="M${n(L - 7)} 30 Q${n(L - 4)} 60 ${n(L - 2)} 84 M${n(R + 7)} 30 Q${n(R + 4)} 60 ${n(R + 2)} 84" stroke="${dark(hood, 0.45)}" stroke-width="1.8" fill="none"/>` +
    rimStroke(qsub([L - 13, 88], [L - 16, 38], [L - 5, 20], 0.2, 1, 2.4, 0.4), rim);
  return s;
}

function mage({ f, r, rim, id }: Ctx): string {
  const hat = r() < 0.55;
  const robe = pick(['#4338a0', '#2e3a8c', '#5b2f8f', '#28407a'], r);
  const hatC = pick([robe, dark(robe, 0.25), '#262a66'], r);
  const staff = r() < 0.5;
  const glow = pick(['#9fe8ff', '#d4c8ff', '#ffe28a'], r);
  const L = n(50 - f.fw), R = n(50 + f.fw);
  const rune = ['M0 -4 L0 4 M0 -4 L3 -1 M0 0 L3 -3', 'M-3 -4 L0 4 L3 -4', 'M-2 4 L-2 -4 L3 0 L-2 4', 'M0 -4 L0 4 M-3 -1 L3 1', 'M-3 4 L0 -4 L3 4 M-2 1 L2 1'];
  let s = `<defs><radialGradient id="${id}g"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset=".35" stop-color="${glow}" stop-opacity=".45"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>`;
  if (staff) s += `<path d="M10 120 L19 26" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="M10 120 L19 26" stroke="#7a4f2c" stroke-width="4.5" stroke-linecap="round"/>` +
    `<path d="M14 30 Q12 20 19 14 M24 30 Q26 20 19 14" stroke="${GOLD}" stroke-width="2.4" fill="none"/>`;
  s += `<path d="${TORSO}" fill="${robe}" ${OL}/><path d="M50 76 Q72 76 90 84 L96 120 L50 120Z" fill="#000" opacity=".25"/>` + rimStroke(SHOULDER_RIM, rim) +
    `<path d="M35 76 L50 102 L65 76Z" fill="${dark(robe, 0.45)}"/><path d="M35 76 L50 102 L65 76" stroke="${GOLD}" stroke-width="3.2" fill="none" stroke-linejoin="round"/>` +
    `<g stroke="${light(glow, 0.2)}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".9">` +
    [[26, 92], [74, 92], [20, 106], [80, 106]].map(([x, yy], i) => `<path transform="translate(${x} ${yy})" d="${rune[(i + Math.floor(r() * 5)) % 5]}"/>`).join('') + '</g>';
  const outer = `M${n(L - 15)} 90 Q${n(L - 18)} 32 50 10 Q${n(R + 18)} 32 ${n(R + 15)} 90 Q50 98 ${n(L - 15)} 90Z`;
  if (!hat) s += `<path d="${outer}" fill="${dark(hatC, 0.4)}" ${OL}/>`;
  s += faceBase(f, rim) + (hat ? hairSvg(f) : fringeSvg(f, 32)) + featsSvg(f, true, true) + (hat ? earringSvg(f) : '');
  if (hat) {
    s += `<ellipse cx="50" cy="31" rx="${n(f.fw + 15)}" ry="6.5" fill="${hatC}" ${OL}/>` +
      `<path d="M${n(L - 4)} 31 Q${n(L + 1)} 12 44 -1 Q48 -9 60 -12 Q67 -13 72 -8 Q61 -7 57 0 Q${n(R - 2)} 12 ${n(R + 4)} 31Z" fill="${hatC}" ${OL}/>` +
      `<path d="M50 -4 Q${n(R - 3)} 12 ${n(R + 4)} 31 L${n(R - 4)} 31 Q${n(R - 6)} 14 50 -4Z" fill="#000" opacity=".25"/>` +
      `<path d="M${n(L - 3)} 30 Q50 35 ${n(R + 3)} 30 L${n(R + 1)} 24 Q50 29 ${n(L - 1)} 24Z" fill="${GOLD}" ${OL}/>` +
      `<path d="${star(48, 11, 6.5, 2.8)}" fill="${GOLD_HI}" ${OL.replace('2"', '1.4"')}/>` +
      rimStroke(`M${n(L - 2)} 28 Q${n(L + 2)} 12 44 0`, rim);
  } else {
    const hole = `M${n(L + 1)} 82 Q${n(L - 2)} 33 50 29 Q${n(R + 2)} 33 ${n(R - 1)} 82`;
    s += `<path d="${hole}" stroke="#000" stroke-opacity=".4" stroke-width="8" fill="none"/>` +
      `<path d="${outer}${hole}Z" fill="${hatC}" fill-rule="evenodd" ${OL}/>` +
      `<path d="${hole}" stroke="${GOLD}" stroke-width="2.6" fill="none"/>` +
      rimStroke(qsub([L - 15, 90], [L - 18, 32], [50, 10], 0.18, 0.62, 2.6, 0.6), rim);
  }
  if (staff) s += `<circle cx="19" cy="20" r="14" fill="url(#${id}g)"/><path d="M19 9 L24.5 20 L19 31 L13.5 20Z" fill="${glow}" ${OL.replace('2"', '1.5"')}/><path d="M19 11 L16 20 L19 20Z" fill="#fff" opacity=".8"/>`;
  else s += `<circle cx="84" cy="22" r="13" fill="url(#${id}g)"/><path d="${star(84, 22, 7, 1.8, 4)}" fill="#fff"/><circle cx="84" cy="22" r="2.6" fill="${glow}"/>` +
    `<circle cx="75" cy="36" r="1.6" fill="${glow}"/><circle cx="92" cy="10" r="1.2" fill="${glow}"/>`;
  return s;
}

function bard({ f, r, rim }: Ctx): string {
  const beret = r() < 0.5;
  const [base, slash] = pick([['#b0303e', '#ffd76a'], ['#2f6fb5', '#e8b33a'], ['#6a3a9c', '#47c08a'], ['#2f8c6a', '#e0583a'], ['#c0602a', '#5aa0e0']], r);
  const capC = pick(['#7a2a3a', '#2a4a7a', '#2f5a2a', '#e8b33a', base], r);
  const feather = pick(['#f2ece0', '#e0583a', '#47c08a', '#7bc8f5', '#ffd76a'], r);
  const L = n(50 - f.fw), R = n(50 + f.fw);
  const wood = '#8a5530';
  let s = `<g transform="rotate(-30 26 96)"><rect x="21" y="24" width="10" height="80" rx="2" fill="${wood}" ${OL}/><rect x="23.5" y="28" width="5" height="76" fill="#2a1a12"/>` +
    `<path d="M23.5 40 h5 M23.5 50 h5 M23.5 60 h5 M23.5 70 h5" stroke="${GOLD}" stroke-width="1"/><path d="M25 28 V104 M27 28 V104" stroke="#eee" stroke-width=".6" opacity=".8"/>` +
    `<path d="M20 26 L32 26 L35 6 L24 8Z" fill="#5e381a" ${OL}/><path d="M22 12 h-4 M22 19 h-4 M33 10 h4 M34 17 h4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`;
  s += `<path d="${TORSO}" fill="${base}" ${OL}/><path d="M50 76 Q72 76 90 84 L96 120 L50 120Z" fill="#000" opacity=".22"/>`;
  for (const x of [32, 42, 58, 68]) s += `<ellipse cx="${x}" cy="102" rx="2.8" ry="9" fill="${slash}" ${OL.replace('2"', '1.5"')}/>`;
  const puff = `<ellipse cx="13" cy="92" rx="14" ry="12" fill="${base}" ${OL}/><path d="M6 86 Q8 96 10 102 M14 82 Q16 92 17 103 M21 84 Q23 92 23 100" stroke="${slash}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  s += puff + mirror(puff) + rimStroke('M2 90 Q4 82 14 80', rim);
  s += `<circle cx="50" cy="94" r="2" fill="${GOLD_HI}"/><circle cx="50" cy="103" r="2" fill="${GOLD_HI}"/>` +
    `<path d="M34 75 Q50 84 66 75 L69 84 Q60 90 50 85 Q40 90 31 84Z" fill="#f2ece0" ${OL}/><path d="M40 82 L42 87 M50 85 L50 89 M60 82 L58 87" stroke="#c9c0b0" stroke-width="1.4"/>`;
  s += faceBase(f, rim) + hairSvg(f) + featsSvg(f, true, true) + earringSvg(f);
  const fq = `<path d="M${n(L)} 26 Q${n(L - 22)} 14 ${n(L - 16)} -12 Q${n(L - 6)} 6 ${n(L + 4)} 22Z" fill="${feather}" ${OL}/><path d="M${n(L + 1)} 24 Q${n(L - 12)} 10 ${n(L - 15)} -9" stroke="${dark(feather, 0.4)}" stroke-width="1.4" fill="none"/>` +
    `<path d="M${n(L - 12)} 14 l-4 2 M${n(L - 9)} 4 l-5 1" stroke="${dark(feather, 0.3)}" stroke-width="1.2"/>`;
  if (beret) {
    s += fq + `<path d="M${n(L - 7)} 35 Q${n(L - 9)} 15 48 11 Q${n(R + 12)} 8 ${n(R + 17)} 25 Q${n(R + 13)} 33 ${n(R + 4)} 33 Q50 28 ${n(L - 7)} 35Z" fill="${capC}" ${OL}/>` +
      `<path d="M58 12 Q${n(R + 12)} 12 ${n(R + 16)} 25 Q${n(R + 12)} 32 ${n(R + 4)} 33 Q${n(R + 8)} 24 58 12Z" fill="#000" opacity=".22"/>` +
      `<path d="M${n(L - 7)} 35 Q50 27 ${n(R + 4)} 33" stroke="${dark(capC, 0.45)}" stroke-width="3" fill="none"/><circle cx="${n(L - 1)}" cy="29" r="3" fill="${GOLD_HI}" ${OL.replace('2"', '1.2"')}/>` +
      rimStroke(`M${n(L - 6)} 30 Q${n(L - 7)} 17 44 12`, rim);
  } else {
    s += `<path d="M${n(L - 7)} 35 Q${n(L - 4)} 12 50 6 Q58 3 ${n(R + 17)} 20 Q${n(R + 10)} 26 ${n(R + 5)} 33 Q50 28 ${n(L - 7)} 35Z" fill="${capC}" ${OL}/>` +
      `<path d="M56 6 Q${n(R + 10)} 10 ${n(R + 17)} 20 Q${n(R + 10)} 26 ${n(R + 5)} 33 Q${n(R + 2)} 18 56 6Z" fill="#000" opacity=".22"/>` +
      `<path d="M${n(L - 9)} 37 Q50 26 ${n(R + 7)} 34 L${n(R + 5)} 29 Q50 22 ${n(L - 6)} 31Z" fill="${dark(capC, 0.35)}" ${OL}/>` + fq +
      rimStroke(`M${n(L - 6)} 30 Q${n(L - 3)} 14 48 7`, rim);
  }
  return s;
}

const DRAW: Record<ClassId, (c: Ctx) => string> = { warrior, rogue, mage, bard };

/** Class-aware bust portrait. Face from the name (same as portraitSvg); outfit from class + name. */
export function heroPortraitSvg(name: string, cls: ClassId, size = 64, extra = ''): string {
  const id = `hp${++uid}`;
  const cc = CLASSES[cls].color;
  const f = faceOf(name);
  const r = mulberry32(hashString(`${cls}:${name}`));
  const rim = light(cc, 0.55);
  const fig = DRAW[cls]({ f, r, cc, rim, id });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="portrait ${extra}">` +
    `<defs><radialGradient id="${id}b" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${mix(cc, '#11131f', 0.25)}"/><stop offset="1" stop-color="#11131f"/></radialGradient>` +
    `<clipPath id="${id}c"><circle cx="50" cy="50" r="48"/></clipPath></defs>` +
    `<circle cx="50" cy="50" r="49" fill="url(#${id}b)"/>` +
    `<g clip-path="url(#${id}c)"><g transform="translate(50 55) scale(.8) translate(-50 -50)">${fig}</g></g>` +
    `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${GOLD}" stroke-width="2.5"/><path d="${arc(50, 50, 46.6, 46.6, 200, 250)}" stroke="${GOLD_HI}" stroke-width="1" fill="none" opacity=".6"/></svg>`;
}

export function heroPortraitEl(name: string, cls: ClassId, size = 64, extra = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = 'portrait-wrap';
  span.innerHTML = heroPortraitSvg(name, cls, size, extra);
  return span;
}

// ---------------------------------------------------------------- emblems

function emblemArt(cls: ClassId, cc: string): string {
  const ccD = dark(cc, 0.35), ccL = light(cc, 0.35);
  const steel = '#c9d2dc', steelD = '#7c8794';
  const ol = (w: number) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  switch (cls) {
    case 'warrior': {
      const sword = `<path d="M47 82 L47 14 L50 6 L53 14 L53 82Z" fill="${steel}" ${ol(2.5)}/><path d="M50 10 L50 80 L53 80 L53 14Z" fill="${steelD}"/>` +
        `<rect x="38" y="80" width="24" height="6" rx="3" fill="${GOLD}" ${ol(2.5)}/><rect x="47" y="86" width="6" height="8" fill="#5a3420" ${ol(2)}/><circle cx="50" cy="97" r="3.6" fill="${GOLD}" ${ol(2)}/>`;
      return `<path d="M24 22 L76 22 L76 48 Q76 76 50 90 Q24 76 24 48Z" fill="${cc}" stroke="${GOLD}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M24 22 L76 22 L76 48 Q76 76 50 90 Q24 76 24 48Z" fill="none" ${ol(2)}/><path d="M50 24.5 L73.5 24.5 L73.5 48 Q73.5 74 50 87Z" fill="${ccD}" opacity=".6"/>` +
        `<path d="M29 28 L29 48 Q29 64 37 74" stroke="${ccL}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<g transform="rotate(-40 50 54)">${sword}</g><g transform="rotate(40 50 54)">${sword}</g>`;
    }
    case 'rogue':
      return `<g transform="translate(50 54) scale(.8) translate(-50 -50)"><path d="M20 86 Q16 40 32 22 Q50 2 68 22 Q84 40 80 86 Q50 96 20 86Z" fill="${ccD}" stroke="${GOLD}" stroke-width="4.5" stroke-linejoin="round"/>` +
        `<path d="M20 86 Q16 40 32 22 Q50 2 68 22 Q84 40 80 86 Q50 96 20 86Z" fill="none" ${ol(2)}/>` +
        `<path d="M32 80 Q28 44 50 34 Q72 44 68 80Z" fill="#11131f" ${ol(2)}/><path d="M32 62 Q50 56 68 62 L68 80 Q50 86 32 80Z" fill="${cc}" ${ol(2)}/>` +
        `<path d="M36 50 Q42 46 46 51 Q41 54 36 50Z M64 50 Q58 46 54 51 Q59 54 64 50Z" fill="${GOLD_HI}"/><path d="M26 76 Q22 44 36 28" stroke="${ccL}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>` +
        `<g transform="translate(10 14) rotate(45 50 50)"><path d="M44.5 70 L50 14 L55.5 70Z" fill="${steel}" ${ol(2.5)}/><path d="M50 18 L50 70 L54.5 70Z" fill="${steelD}"/>` +
        `<rect x="38" y="68" width="24" height="6" rx="3" fill="${GOLD}" ${ol(2.5)}/><rect x="46.5" y="74" width="7" height="14" rx="1.5" fill="#4a2e1c" ${ol(2)}/><circle cx="50" cy="92" r="4" fill="${GOLD}" ${ol(2)}/></g>`;
    case 'mage':
      return `<path d="M46 94 L46 38 L54 38 L54 94Z" fill="#7a4f2c" ${ol(2.5)}/><path d="M44 52 h12 M44 76 h12" stroke="${GOLD}" stroke-width="4"/><path d="M44 52 h12 M44 76 h12" stroke="${INK}" stroke-width="1" transform="translate(0 2.5)"/>` +
        `<path d="M40 44 Q30 30 38 18 M60 44 Q70 30 62 18" stroke="${GOLD}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
        `<circle cx="50" cy="28" r="22" fill="${cc}" opacity=".3"/><path d="${star(50, 28, 19, 8)}" fill="${cc}" stroke="${GOLD}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="${star(50, 28, 19, 8)}" fill="none" ${ol(1.8)}/><path d="${star(50, 29, 9, 4)}" fill="${ccL}"/><circle cx="50" cy="29" r="3" fill="#fff"/>` +
        `<path d="${star(18, 18, 6, 1.6, 4)}${star(82, 46, 5, 1.4, 4)}${star(80, 12, 3.5, 1, 4)}" fill="${GOLD_HI}"/>`;
    case 'bard':
      return `<g transform="rotate(35 46 60)"><rect x="41" y="8" width="10" height="44" rx="2" fill="#6a3e1e" ${ol(2.5)}/><path d="M40 10 L52 10 L54 -2 L42 0Z" fill="#4a2a14" ${ol(2)}/>` +
        `<path d="M46 12 V60" stroke="#f2ece0" stroke-width="1"/><ellipse cx="46" cy="68" rx="20" ry="24" fill="${cc}" stroke="${GOLD}" stroke-width="4"/><ellipse cx="46" cy="68" rx="20" ry="24" fill="none" ${ol(2)}/>` +
        `<path d="M46 44 A20 24 0 0 1 46 92 A12 24 0 0 0 46 44Z" fill="${ccD}" opacity=".55"/><circle cx="46" cy="64" r="6" fill="${INK}" stroke="${GOLD}" stroke-width="2"/>` +
        `<rect x="38" y="80" width="16" height="4" rx="1" fill="#4a2a14"/><path d="M44 50 V82 M48 50 V82" stroke="#f2ece0" stroke-width=".8"/><path d="M30 58 Q32 50 38 47" stroke="${ccL}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>` +
        `<g fill="${GOLD_HI}" stroke="${INK}" stroke-width="1.6"><path d="M72 30 V10 L86 6 V26" fill="none" stroke="${GOLD_HI}" stroke-width="3.2"/><ellipse cx="69" cy="31" rx="5" ry="3.8" transform="rotate(-20 69 31)"/><ellipse cx="83" cy="27" rx="5" ry="3.8" transform="rotate(-20 83 27)"/>` +
        `<path d="M18 22 V6 Q24 8 26 14" fill="none" stroke="${GOLD_HI}" stroke-width="3"/><ellipse cx="15" cy="23" rx="4.4" ry="3.4" transform="rotate(-20 15 23)"/></g>`;
  }
}

/** Crest icon for a class (class-picker cards, small badges). */
export function classEmblemSvg(cls: ClassId, size = 48): string {
  const id = `ce${++uid}`;
  const cc = CLASSES[cls].color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="class-emblem emblem-${cls}">` +
    `<defs><radialGradient id="${id}g"><stop offset="0" stop-color="${cc}" stop-opacity=".45"/><stop offset="1" stop-color="${cc}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="50" cy="50" r="48" fill="url(#${id}g)"/>${emblemArt(cls, cc)}</svg>`;
}
