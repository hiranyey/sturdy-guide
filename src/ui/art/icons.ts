// The interface icon set. Same storybook look as the item, hero and monster art: an ink
// outline, two or three flat tones and a light rim. Every icon is a 32-unit square SVG with
// no gradients, text, fonts or filters, so it is cheap, crisp at 14–64px and safe to inline
// many times on a page.
//
// Emoji used as icons in UI text ("-1 🔥", "🎒") are swapped for these when they are added
// to the page (`iconize`, called from `h()` in dom.ts), so the look no longer depends on
// the phone's emoji font. An emoji with no icon here is left as it is.

const OL = '#1b1b24';
// light, base, dark
const GOLD = ['#ffe9a8', '#edb949', '#a8761e'] as const;
const RED = ['#ff9a8a', '#e04a3c', '#8a1e1e'] as const;
const GREEN = ['#a6e89a', '#52b25a', '#256b34'] as const;
const BLUE = ['#b4dcff', '#4f8fe0', '#27488a'] as const;
const VIOLET = ['#d2c2ff', '#8b6cf0', '#4a30a8'] as const;
const STEEL = ['#f0f3f8', '#b9c4d6', '#6f7b92'] as const;
const WOOD = ['#dcae7c', '#a06c3c', '#5a3a1e'] as const;
const PAPER = ['#fff7df', '#f0deb0', '#c9a768'] as const;
const SKIN = '#f2c9a0';
const DARK = '#2a2438';

const n = (v: number) => Math.round(v * 10) / 10;

/** A filled, ink-outlined shape. */
const p = (d: string, fill: string, sw = 2, stroke = OL) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
/** A fill with no outline (inner tones). */
const f = (d: string, fill: string, o = 1) => `<path d="${d}" fill="${fill}"${o < 1 ? ` opacity="${o}"` : ''}/>`;
/** A stroke with no fill (details, highlights). */
const l = (d: string, stroke = OL, sw = 1.6, o = 1) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${o < 1 ? ` opacity="${o}"` : ''}/>`;
/** A thick coloured line with an ink edge (blades, chains, wind). */
const tube = (d: string, c: string, w = 3, edge = 2.2) => l(d, OL, w + edge) + l(d, c, w);
const c = (cx: number, cy: number, r: number, fill: string, sw = 2) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${sw ? ` stroke="${OL}" stroke-width="${sw}"` : ''}/>`;
const hi = (d: string, o = 0.7, sw = 1.5) => l(d, '#ffffff', sw, o);

function star(cx: number, cy: number, ro: number, ri: number, pts = 5): string {
  let d = '';
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts, r = i % 2 ? ri : ro;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}
function hexagon(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}
function cog(cx: number, cy: number, ro: number, ri: number, teeth = 8): string {
  let d = '';
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - step / 2;
    const pts: [number, number][] = [[a + step * 0.14, ri], [a + step * 0.26, ro], [a + step * 0.74, ro], [a + step * 0.86, ri]];
    for (const [ang, r] of pts) d += `${d ? 'L' : 'M'}${n(cx + Math.cos(ang) * r)} ${n(cy + Math.sin(ang) * r)}`;
  }
  return d + 'Z';
}
/** A four-point sparkle. */
const twinkle = (cx: number, cy: number, r: number, k = 0.22) =>
  `M${cx} ${cy - r}Q${n(cx + r * k)} ${n(cy - r * k)} ${cx + r} ${cy}Q${n(cx + r * k)} ${n(cy + r * k)} ${cx} ${cy + r}Q${n(cx - r * k)} ${n(cy + r * k)} ${cx - r} ${cy}Q${n(cx - r * k)} ${n(cy - r * k)} ${cx} ${cy - r}Z`;

const SWORD = (blade: string = STEEL[0]) =>
  p('M4 4L9 5L21.5 17.5L17.5 21.5L5 9Z', blade) + l('M6.5 6.5L18 18', STEEL[2], 1.2, 0.7) +
  tube('M15.5 23.5L23.5 15.5', GOLD[1], 2.6) + tube('M21.5 21.5L25.5 25.5', WOOD[1], 2.4) + c(27, 27, 2.1, GOLD[1], 1.8);
const CLOUD = 'M9 19Q4 19 4 14.5Q4 10 9 10Q10 5 16 5Q22 5 23 10Q28 10 28 14.5Q28 19 23 19Z';
const HEART = 'M16 27.5C6 20.5 3.5 15 3.5 10.5C3.5 6.5 6.6 4 10 4C12.6 4 14.8 5.5 16 7.6C17.2 5.5 19.4 4 22 4C25.4 4 28.5 6.5 28.5 10.5C28.5 15 26 20.5 16 27.5Z';
const FLAME = 'M16 2C22 8 27 13 27 19.5C27 25.5 22 30 16 30C10 30 5 25.5 5 19.5C5 15 8 12.5 9.5 9C11 11.5 12 13 13.5 13C13 9 14 5.5 16 2Z';

const ART = {
  // ----- dock -----
  pack: () =>
    l('M12.5 8Q12.5 3.5 16 3.5Q19.5 3.5 19.5 8', OL, 4.6) + l('M12.5 8Q12.5 3.5 16 3.5Q19.5 3.5 19.5 8', WOOD[0], 2.2) +
    p('M7 14Q7 7 16 7Q25 7 25 14V26Q25 28.5 22.5 28.5H9.5Q7 28.5 7 26Z', WOOD[1]) +
    p('M7 14Q7 7 16 7Q25 7 25 14V16.5Q16 20.5 7 16.5Z', RED[1]) +
    p('M11 21.5H21V25.5Q21 26.5 20 26.5H12Q11 26.5 11 25.5Z', WOOD[0], 1.6) +
    p('M14.5 15.5H17.5V20H14.5Z', GOLD[1], 1.5) + hi('M10 12Q11 9.5 14 9.2'),
  party: () =>
    p('M14 27V25Q14 18 21.5 18Q29 18 29 25V27Z', BLUE[1]) + c(21.5, 11.5, 4.6, SKIN) +
    p('M3 28V26Q3 19 11 19Q19 19 19 26V28Z', RED[1]) + c(11, 12.5, 5.2, SKIN) +
    hi('M6 23.5Q7 21.5 9.5 21.2'),
  scroll: () =>
    p('M8.5 6.5H24.5V25.5H8.5Z', PAPER[0]) + l('M12 12H21M12 16H21M12 20H17.5', WOOD[1], 1.6) +
    p('M6.5 6Q6.5 3.5 9 3.5H24Q26.5 3.5 26.5 6Q26.5 8.5 24 8.5H9Q6.5 8.5 6.5 6Z', PAPER[2]) +
    p('M5.5 26Q5.5 23.5 8 23.5H23Q25.5 23.5 25.5 26Q25.5 28.5 23 28.5H8Q5.5 28.5 5.5 26Z', PAPER[2]) +
    hi('M9.5 5.4H22', 0.6, 1.2),
  camp: () =>
    l('M2 27.5H30', OL, 2) + p('M2.5 27L13.5 7L24.5 27Z', GREEN[1]) + f('M13.5 7L24.5 27H19Z', GREEN[2], 0.55) +
    p('M13.5 14.5L8.5 27H18.5Z', DARK, 1.6) + l('M13.5 7L11.5 3.5M13.5 7L15.5 3.5', OL, 1.8) +
    p('M26 16Q30.5 21.5 29 25Q28.2 27.5 26 27.5Q23.8 27.5 23 25Q21.5 21.5 26 16Z', '#ff8a2a', 1.6, '#7a1e10') +
    f('M26 21.5Q27.8 24 27 25.6Q26.6 26.4 26 26.4Q25.4 26.4 25 25.6Q24.2 24 26 21.5Z', GOLD[0]),
  gear: () => p(cog(16, 16, 13, 9.6), STEEL[1]) + c(16, 16, 4.2, DARK, 1.8) + hi('M9.5 12Q11.5 8.6 15 8.2', 0.75),

  // ----- resources -----
  heart: () =>
    p(HEART, RED[1]) +
    hi('M7.5 10Q8 7 11 6.8', 0.8, 1.8),
  star: () => p(star(16, 17, 13, 5.6), GOLD[1]) + hi('M12.5 12.5L15 7.5', 0.75),
  spark: () => p(twinkle(15, 17, 13), GOLD[0]) + f(twinkle(15, 17, 5.5, 0.3), '#ffffff', 0.9) + p(twinkle(25.5, 6.5, 4.5), PAPER[0], 1.4),
  coin: () => c(16, 16, 12, GOLD[1]) + l(hexagon(16, 16, 6.2), GOLD[2], 1.8) + hi('M7.5 13Q9.5 7.5 15 6.6', 0.8),
  pouch: () =>
    p('M11 11.5Q3.5 18 5.5 24Q7 28.5 16 28.5Q25 28.5 26.5 24Q28.5 18 21 11.5Z', WOOD[1]) +
    p('M11 11.5L9 5.5Q12.5 7.6 16 5.5Q19.5 7.6 23 5.5L21 11.5Z', WOOD[0]) + l('M11 11.5H21', GOLD[2], 2.2) +
    c(16, 20.5, 4.2, GOLD[1], 1.6) + hi('M8.5 19Q9 16 11.5 14'),
  flame: () =>
    p(FLAME, '#ff7a2a', 2, '#7a1e10') +
    f('M16 12C19.5 16 22 19 22 22.5C22 26 19.3 28 16 28C12.7 28 10 26 10 22.5C10 20 11.5 18.5 12.5 16.5C13.3 18 14 18.6 15 18.6C14.8 16 15 14 16 12Z', '#ffc04a') +
    f('M16 20C18 22.5 18.5 24 18 25.5C17.6 27 14.4 27 14 25.5C13.5 24 14.5 22 16 20Z', '#fff4c0'),
  potion: () =>
    f('M13 4.5H19V11.5Q26 14.5 26 21Q26 29 16 29Q6 29 6 21Q6 14.5 13 11.5Z', '#dff1f8') +
    f('M7.2 19Q11.5 17 16 19Q20.5 21 24.8 19Q25 20 25 21Q25 28 16 28Q7 28 7 21Q7 20 7.2 19Z', RED[1]) +
    l('M7.2 19Q11.5 17 16 19Q20.5 21 24.8 19', RED[0], 1.2) +
    l('M13 4.5H19V11.5Q26 14.5 26 21Q26 29 16 29Q6 29 6 21Q6 14.5 13 11.5Z', OL, 2) +
    p('M12 2H20V5.5H12Z', WOOD[1], 1.6) + hi('M9.5 18Q9 22 11.5 25', 0.75),
  leaf: () =>
    l('M16 29.5V9', GREEN[2], 2.4) + p('M16 23Q7 23.5 4.5 14.5Q13.5 14 16 23Z', GREEN[1]) +
    p('M16 19Q25 19.5 27.5 10.5Q18.5 10 16 19Z', GREEN[1]) + p('M16 12.5Q10.5 8 16 2Q21.5 8 16 12.5Z', GREEN[0]) +
    l('M16 23Q11 20 8 16.5M16 19Q21 16 24 12.5', GREEN[2], 1.2, 0.8),
  aid: () =>
    p('M8.5 4.5H23.5Q27.5 4.5 27.5 8.5V23.5Q27.5 27.5 23.5 27.5H8.5Q4.5 27.5 4.5 23.5V8.5Q4.5 4.5 8.5 4.5Z', PAPER[0]) +
    p('M13.2 9H18.8V13.2H23V18.8H18.8V23H13.2V18.8H9V13.2H13.2Z', GREEN[1], 1.6),
  chest: () =>
    p('M4 14H28V27H4Z', WOOD[1]) + p('M4 14Q4 6 10.5 6H21.5Q28 6 28 14Z', WOOD[0]) +
    l('M4 14H28', GOLD[1], 2.4) + l('M9.5 6.4V27M22.5 6.4V27', WOOD[2], 1.6, 0.8) +
    p('M13.2 12H18.8V18.5H13.2Z', GOLD[1], 1.6) + c(16, 15.2, 1.1, OL, 0) + hi('M7 10.5Q8 8.4 10.5 8'),
  map: () =>
    p('M3.5 8.5L11.5 5.5L20.5 8.5L28.5 5.5V23.5L20.5 26.5L11.5 23.5L3.5 26.5Z', PAPER[1]) +
    f('M11.5 5.5L20.5 8.5V26.5L11.5 23.5Z', PAPER[0]) + l('M11.5 5.5V23.5M20.5 8.5V26.5', PAPER[2], 1.4) +
    l('M7 21Q10 15 14 17.5T22 13', RED[1], 1.8) + l('M22.5 10.5L25.5 13.5M25.5 10.5L22.5 13.5', RED[2], 1.8),

  // ----- map signs and blocks -----
  signpost: () =>
    p('M14.5 3H17.5V29.5H14.5Z', WOOD[2], 1.8) + p('M8 5H22L26.5 9L22 13H8Z', WOOD[0]) +
    p('M24 15H10L5.5 19L10 23H24Z', WOOD[1]) + hi('M10 7.4H20', 0.6, 1.3),
  quest: () =>
    l('M10.5 11Q10.5 4.8 16 4.8Q21.5 4.8 21.5 10.4Q21.5 13.8 18 15.8Q16 17 16 20', OL, 7.4) +
    l('M10.5 11Q10.5 4.8 16 4.8Q21.5 4.8 21.5 10.4Q21.5 13.8 18 15.8Q16 17 16 20', PAPER[0], 4) + c(16, 26.2, 2.6, PAPER[0]),
  swords: () => SWORD() + `<g transform="matrix(-1 0 0 1 32 0)">${SWORD()}</g>`,
  sword: () => `<g transform="translate(1 1)">${SWORD()}</g>` + hi('M7 6L12 11', 0.6, 1.2),
  skull: () =>
    p('M16 3Q27.5 3 27.5 13.5Q27.5 18.5 23.5 20.5V26H8.5V20.5Q4.5 18.5 4.5 13.5Q4.5 3 16 3Z', PAPER[0]) +
    c(11.3, 14, 3.2, OL, 0) + c(20.7, 14, 3.2, OL, 0) + f('M16 17L14.2 20.4H17.8Z', OL) +
    l('M12.5 22V26M16 22V26M19.5 22V26', OL, 1.6),
  shield: () =>
    p('M16 3L27.5 6.5V15Q27.5 24 16 29.5Q4.5 24 4.5 15V6.5Z', BLUE[1]) + f('M16 4L26.5 7.2V15Q26.5 23.2 16 28.4Z', BLUE[2], 0.6) +
    c(16, 15, 3.6, GOLD[1], 1.8) + hi('M7.5 12V8.6L12 7.2', 0.7),
  rock: () =>
    p('M3.5 26.5L6.5 14.5L14 7L23.5 9L28.5 19.5L26.5 26.5Z', '#9399a8') + f('M14 7L16.5 16.5L6.5 14.5Z', '#b9bfcc') +
    f('M16.5 16.5L28.5 19.5L26.5 26.5H19Z', '#6f7584') + l('M14 7L16.5 16.5L6.5 14.5M16.5 16.5L23.5 9M16.5 16.5L19 26.5', OL, 1.3, 0.55),
  wave: () =>
    p('M2 21Q6 9 15 10.5Q21 11.5 20 17.5Q18 14.5 14.5 16Q11.5 18 15 21Q21 25 30 20V29H2Z', BLUE[1]) +
    l('M5 22Q8.5 13 15 13', '#ffffff', 1.6, 0.75) + l('M6 26Q11 24 16 26T26 26', BLUE[0], 1.5, 0.8),
  ice: () =>
    p('M16 3L27.5 9.5V22.5L16 29L4.5 22.5V9.5Z', '#c4ecff') + f('M16 16L27.5 9.5V22.5L16 29Z', '#7fc4ee', 0.8) +
    l('M16 3V16M4.5 9.5L16 16L27.5 9.5M16 16V29', BLUE[1], 1.3) + hi('M8 11.5L12 9.2'),
  barrier: () =>
    tube('M7.5 19V28.5M24.5 19V28.5', WOOD[1], 2.8) + p('M3 10H29V19H3Z', GOLD[0]) +
    f('M6 10H11L7 19H3V16.5Z', RED[1]) + f('M15 10H20L16 19H11Z', RED[1]) + f('M24 10H29L25 19H20Z', RED[1]) +
    l('M3 10H29V19H3Z', OL, 2),
  pit: () =>
    `<ellipse cx="16" cy="19" rx="13" ry="8" fill="${WOOD[1]}" stroke="${OL}" stroke-width="2"/>` +
    `<ellipse cx="16" cy="20" rx="9.6" ry="5.4" fill="#15101e"/>` + l('M6 12.5L4 9M26 12.5L28 9M16 10V6.5', OL, 1.8),

  // ----- actions -----
  chat: () =>
    p('M6 5.5H26Q29 5.5 29 8.5V19.5Q29 22.5 26 22.5H15.5L9 28.5V22.5H6Q3 22.5 3 19.5V8.5Q3 5.5 6 5.5Z', PAPER[0]) +
    c(10, 14, 1.7, WOOD[2], 0) + c(16, 14, 1.7, WOOD[2], 0) + c(22, 14, 1.7, WOOD[2], 0),
  boot: () =>
    p('M11 13.5Q5 12 3 5.5Q7.5 7.5 11 7.5Z', PAPER[0], 1.8) + l('M3 28.5H28.5', OL, 4.4) + l('M9 28.5H28', WOOD[2], 2.2) +
    p('M11 4.5H19.5V16.5Q26 17.5 28 22V26.5H9V20.5Q11 17.5 11 13.5Z', WOOD[1]) + l('M11 9.5H19.5', WOOD[2], 1.5, 0.8) + hi('M13.2 7V14', 0.5),
  quill: () =>
    p('M27.5 3Q14.5 4.5 9.5 16.5L7.5 24.5L15.5 22.5Q27.5 17.5 27.5 3Z', PAPER[0]) + l('M7.5 24.5L22 9.5', PAPER[2], 1.5) +
    l('M13 13L11.5 17.5M17.5 9L15.5 13.5', PAPER[2], 1.2) + l('M7.5 24.5L4 28.5', OL, 2.4),
  bed: () =>
    l('M3.5 7V27.5M28.5 17V27.5', OL, 4.4) + l('M3.5 7V27.5M28.5 17V27.5', WOOD[1], 2.2) +
    p('M3.5 17H28.5V23.5H3.5Z', BLUE[1]) + p('M5.5 12.5H12.5Q14 12.5 14 14V17H5.5Z', PAPER[0], 1.6) +
    l('M15.5 20.2H26.5', BLUE[0], 1.4, 0.8),
  dizzy: () =>
    l('M5 18Q5 8 15 8Q24 8 24 16Q24 22.5 17.5 22.5Q12.5 22.5 12.5 17.5', OL, 5) +
    l('M5 18Q5 8 15 8Q24 8 24 16Q24 22.5 17.5 22.5Q12.5 22.5 12.5 17.5', GOLD[0], 2.6) +
    p(star(25.5, 24.5, 4.6, 2), GOLD[1], 1.4) + p(star(6.5, 25.5, 3.6, 1.6), GOLD[1], 1.3),
  chain: () =>
    `<g transform="rotate(-45 16 16)"><rect x="1.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${OL}" stroke-width="5.4"/><rect x="1.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${STEEL[1]}" stroke-width="3"/>` +
    `<rect x="15.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${OL}" stroke-width="5.4"/><rect x="15.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${STEEL[0]}" stroke-width="3"/></g>`,
  link: () =>
    `<g transform="rotate(-45 16 16)"><rect x="1.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${OL}" stroke-width="5.4"/><rect x="1.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${GOLD[1]}" stroke-width="3"/>` +
    `<rect x="15.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${OL}" stroke-width="5.4"/><rect x="15.5" y="11.5" width="15" height="9" rx="4.5" fill="none" stroke="${GOLD[0]}" stroke-width="3"/></g>`,
  target: () => c(16, 16, 12.5, PAPER[0]) + c(16, 16, 8.4, RED[1], 1.6) + c(16, 16, 4.2, PAPER[0], 1.6) + c(16, 16, 1.3, RED[2], 0),
  warn: () => p('M16 3.5L29.5 27.5H2.5Z', GOLD[0]) + l('M16 12V19.5', OL, 3) + c(16, 23.6, 1.7, OL, 0),
  bolt: () => p('M18.5 2L6 18H14L12 30L26 13H17.5Z', GOLD[0]) + hi('M16.5 5.5L10 14.5', 0.7, 1.3),
  clover: () =>
    l('M16 18Q17 25 21 29', GREEN[2], 2.4) + c(11, 11, 5.4, GREEN[1]) + c(21, 11, 5.4, GREEN[1]) + c(11, 20, 5.4, GREEN[1]) + c(21, 20, 5.4, GREEN[1]) +
    c(16, 15.5, 3, GREEN[2], 0) + hi('M8 9.5Q9 7.6 11 7.4'),
  die: () =>
    p('M16 2.5L27.7 9.3V22.7L16 29.5L4.3 22.7V9.3Z', VIOLET[2]) + f('M16 2.5L27.7 9.3L16 8.6L4.3 9.3Z', VIOLET[0], 0.85) +
    p('M16 8.6L24.2 22.4H7.8Z', VIOLET[1], 1.5) + l('M4.3 9.3L16 8.6L27.7 9.3M4.3 9.3L7.8 22.4L4.3 22.7M27.7 9.3L24.2 22.4L27.7 22.7M7.8 22.4L16 29.5L24.2 22.4', VIOLET[0], 1.1, 0.75),
  crown: () =>
    p('M4.5 24L3 9.5L10 15.5L16 5L22 15.5L29 9.5L27.5 24Z', GOLD[1]) + p('M4.5 23.5H27.5V28H4.5Z', GOLD[2], 1.8) +
    c(16, 18.5, 2, RED[1], 1.4) + c(9.5, 20, 1.4, BLUE[1], 1.2) + c(22.5, 20, 1.4, BLUE[1], 1.2),

  // ----- menus -----
  trophy: () =>
    l('M9 7H4.5Q4.5 14 10.5 15M23 7H27.5Q27.5 14 21.5 15', OL, 4.6) + l('M9 7H4.5Q4.5 14 10.5 15M23 7H27.5Q27.5 14 21.5 15', GOLD[2], 2.2) +
    p('M8.5 4H23.5V12Q23.5 19.5 16 19.5Q8.5 19.5 8.5 12Z', GOLD[1]) + p('M14 19.5H18V23.5H14Z', GOLD[2], 1.8) +
    p('M9.5 23.5H22.5V28H9.5Z', WOOD[1]) + hi('M11.5 7V12.5Q11.6 14.5 13 16'),
  share: () => p('M4 18H9.5V23H22.5V18H28V28.5H4Z', STEEL[1]) + p('M16 2.5L23.5 11H18.8V19.5H13.2V11H8.5Z', GOLD[1]),
  save: () => p('M4 18H9.5V23H22.5V18H28V28.5H4Z', STEEL[1]) + p('M16 21L8.5 12.5H13.2V3.5H18.8V12.5H23.5Z', GREEN[1]),
  bulb: () =>
    p('M16 3Q24.5 3 24.5 11.5Q24.5 15.5 21 18.5V21.5H11V18.5Q7.5 15.5 7.5 11.5Q7.5 3 16 3Z', GOLD[0]) +
    p('M11.5 21.5H20.5V26Q20.5 28.5 18 28.5H14Q11.5 28.5 11.5 26Z', STEEL[1], 1.8) + l('M13.5 17L15 12L17 12L18.5 17', GOLD[2], 1.4) +
    hi('M10.5 10.5Q11 6.6 14.5 6'),
  phone: () =>
    p('M10.5 2.5H21.5Q24 2.5 24 5V27Q24 29.5 21.5 29.5H10.5Q8 29.5 8 27V5Q8 2.5 10.5 2.5Z', '#4a4466') +
    p('M10.5 6.5H21.5V24H10.5Z', BLUE[0], 1.4) + l('M16 10V19.5M12.4 16L16 19.6L19.6 16', BLUE[2], 2.2),
  home: () =>
    p('M7 15H25V28H7Z', PAPER[1]) + p('M13.5 20H18.5V28H13.5Z', WOOD[1], 1.6) + p('M2.5 16L16 4L29.5 16H25L16 8.6L7 16Z', RED[1]) ,
  lock: () =>
    l('M10.5 14V10Q10.5 4.5 16 4.5Q21.5 4.5 21.5 10V14', OL, 5.4) + l('M10.5 14V10Q10.5 4.5 16 4.5Q21.5 4.5 21.5 10V14', STEEL[1], 3) +
    p('M6.5 13.5H25.5V26.5Q25.5 28.5 23.5 28.5H8.5Q6.5 28.5 6.5 26.5Z', GOLD[1]) + c(16, 19.5, 2.2, OL, 0) + l('M16 20V24', OL, 2.2) + hi('M9 16H14', 0.6),
  clipboard: () =>
    p('M6.5 5.5H25.5V28.5H6.5Z', WOOD[1]) + p('M9 8.5H23V26H9Z', PAPER[0], 1.4) + p('M11.5 3H20.5V8H11.5Z', STEEL[1], 1.6) +
    l('M12 13.5H20M12 17.5H20M12 21.5H17', WOOD[1], 1.5),

  // ----- sky -----
  sun: () =>
    l('M16 1.8V5.4M16 26.6V30.2M1.8 16H5.4M26.6 16H30.2M6 6L8.5 8.5M23.5 23.5L26 26M6 26L8.5 23.5M23.5 8.5L26 6', OL, 4.4) +
    l('M16 1.8V5.4M16 26.6V30.2M1.8 16H5.4M26.6 16H30.2M6 6L8.5 8.5M23.5 23.5L26 26M6 26L8.5 23.5M23.5 8.5L26 6', GOLD[1], 2.2) +
    c(16, 16, 7.4, GOLD[0]) + hi('M11.5 14.5Q12.5 11.5 15.5 11'),
  moon: () => p('M19 4A12.4 12.4 0 1 0 27.6 20.5A10.2 10.2 0 0 1 19 4Z', '#f6ecc0') + hi('M8 13Q9.5 9 13 7.4') + p(twinkle(24.5, 9, 3.6), PAPER[0], 1.2),
  fullmoon: () => c(16, 16, 12, '#f6ecc0') + c(11.5, 12, 2.6, '#dccf9a', 0) + c(20, 19.5, 3.2, '#dccf9a', 0) + c(20.5, 10, 1.5, '#dccf9a', 0) + hi('M7.5 12.5Q9.5 7.8 14 6.6'),
  sunrise: () =>
    l('M16 3V6.4M5.6 9.6L8 12M26.4 9.6L24 12', OL, 4.4) + l('M16 3V6.4M5.6 9.6L8 12M26.4 9.6L24 12', GOLD[1], 2.2) +
    p('M6 21.5A10 10 0 0 1 26 21.5Z', GOLD[0]) + l('M2 21.5H30', OL, 2.2) + l('M7 25.6H25M11 29H21', '#ffb86a', 2),
  rain: () => l('M10.5 22.5L9 27M16.5 22.5L15 27M22.5 22.5L21 27', OL, 4.4) + l('M10.5 22.5L9 27M16.5 22.5L15 27M22.5 22.5L21 27', BLUE[1], 2.2) + p(CLOUD, STEEL[0]) + f('M6.5 16.5H25.5Q23 18 9 18Q7 17.6 6.5 16.5Z', STEEL[1], 0.8),
  storm: () => p(CLOUD, '#8f98ad') + f('M6.5 16.5H25.5Q23 18 9 18Q7 17.6 6.5 16.5Z', '#6f7890', 0.9) + p('M17.5 15.5L11.5 23H15.5L13.5 30.5L21.5 21H17Z', GOLD[0], 1.7),
  snow: () => p(CLOUD, STEEL[0]) + c(9.5, 24, 1.9, '#ffffff', 1.3) + c(16, 27, 1.9, '#ffffff', 1.3) + c(22.5, 24, 1.9, '#ffffff', 1.3),
  fog: () => tube('M4 9Q8.5 6 13 9T22 9T28 8', STEEL[0], 2.6) + tube('M3 16Q7.5 13 12 16T21 16T29 15', STEEL[1], 2.6) + tube('M5 23Q9.5 20 14 23T23 23T27 22', STEEL[0], 2.6),
  heat: () =>
    c(16, 12, 7, '#ff9a3a') + hi('M11.5 10.5Q12.5 7.6 15.5 7') +
    tube('M5 23Q8.5 20.5 12 23T19 23T27 22.5', '#ff7a2a', 2.4) + tube('M8 28.5Q10.8 26.6 13.5 28.5T19 28.5T24 28', GOLD[1], 2),
  wind: () =>
    tube('M3 11.5H19Q23 11.5 23 8.2Q23 5.2 20 5.2Q17.6 5.2 17.4 7.6', STEEL[0], 2.4) +
    tube('M3 18H25Q29 18 29 21.5Q29 25 25.6 25Q23.2 25 23 22.6', STEEL[1], 2.4) + tube('M3 24.5H14', STEEL[0], 2.4),
  comet: () => tube('M4 27L17 14', GOLD[2], 2.2) + tube('M3 19L12 10', GOLD[2], 1.8) + p(star(21, 10.5, 8.5, 3.6), GOLD[0]),
  cart: () =>
    l('M2.5 5H7L10.5 20H24.5', OL, 2.4) + p('M8 9.5H28L25.5 18H10Z', GOLD[1]) + l('M14 9.5V18M20 9.5V18', GOLD[2], 1.4) +
    c(12.5, 25, 2.6, STEEL[1], 1.8) + c(22.5, 25, 2.6, STEEL[1], 1.8),

  // ----- talents and abilities -----
  burst: () => p(star(16, 16, 14.5, 7.5, 8), '#ff8a2a', 2, '#7a1e10') + f(star(16, 16, 9, 4.6, 8), GOLD[0]) + c(16, 16, 2.4, '#ffffff', 0),
  volcano: () =>
    l('M16 10V3.5M11.5 9L8.5 4.5M20.5 9L23.5 4.5', OL, 4.4) + l('M16 10V3.5M11.5 9L8.5 4.5M20.5 9L23.5 4.5', '#ff8a2a', 2.2) +
    p('M2.5 28.5L11 12H21L29.5 28.5Z', '#7a5c50') + f('M21 12L29.5 28.5H21.5L17 19Z', '#5a4038', 0.7) +
    p('M11 12Q13 15.5 16 12.6Q19 15.5 21 12L19.6 18Q17.6 16 16 19.5Q14.4 16 12.4 18Z', '#ff7a2a', 1.6, '#7a1e10'),
  horn: () =>
    p('M3 8.5L6.5 6Q17.5 9.5 21.5 19.5L27.5 18L29.5 26.5L19.5 29.5Q16 19 4.5 12.5Z', PAPER[1]) +
    l('M9.8 8L7.6 12.6M20.6 18.4L16.4 21', GOLD[2], 2.2) + hi('M9 9.6Q16 13 19 19', 0.6, 1.3),
  vanish: () =>
    `<circle cx="16" cy="16" r="11.5" fill="rgba(255,255,255,0.14)" stroke="${OL}" stroke-width="4.6" stroke-dasharray="4.4 3.6" stroke-linecap="round"/>` +
    `<circle cx="16" cy="16" r="11.5" fill="none" stroke="${STEEL[0]}" stroke-width="2.4" stroke-dasharray="4.4 3.6" stroke-linecap="round"/>` +
    c(12, 14, 1.7, STEEL[0], 1.2) + c(20, 14, 1.7, STEEL[0], 1.2) + tube('M12.5 20.5H19.5', STEEL[0], 1.6, 1.6),
  hand: () =>
    p('M9 17V8.6Q9 6.6 10.8 6.6Q12.5 6.6 12.5 8.6V5.5Q12.5 3.5 14.3 3.5Q16 3.5 16 5.5V5Q16 3 17.8 3Q19.5 3 19.5 5V7.2Q19.5 5.4 21.3 5.4Q23 5.4 23 7.4V19Q23 29.5 15.5 29.5Q10 29.5 7.5 23.5L4.6 16.6Q4 14.6 5.6 14Q7 13.6 8 15.2Z', SKIN) +
    l('M12.5 8.6V15.5M16 5.5V15.5M19.5 7.2V15.5', OL, 1.3, 0.45),
  fireball: () =>
    p('M3 3L18.5 9L9 18.5Z', '#ffb02e', 1.8, '#7a1e10') + c(19.5, 19.5, 9.5, '#ff7a2a', 0) +
    `<circle cx="19.5" cy="19.5" r="9.5" fill="none" stroke="#7a1e10" stroke-width="2"/>` + c(19.5, 19.5, 5.4, GOLD[0], 0) + c(18.5, 18.5, 2, '#ffffff', 0),
  orb: () =>
    p('M8.5 25.5Q16 21.5 23.5 25.5L25 29.5H7Z', GOLD[1]) + c(16, 14, 11, VIOLET[1]) +
    l('M10.5 15.5Q12.5 9.5 17 12.5Q20.5 14.8 22 11.5', VIOLET[0], 1.8) + hi('M8.5 11Q10 7 13.5 5.8', 0.8),
  mask: () =>
    p('M4.5 6Q16 2.5 27.5 6V15Q27.5 26 16 29.5Q4.5 26 4.5 15Z', PAPER[0]) + f('M9 12.5Q12 9.5 15 12.5Q12 14.6 9 12.5Z', OL) + f('M17 12.5Q20 9.5 23 12.5Q20 14.6 17 12.5Z', OL) +
    p('M9.5 19Q16 26.5 22.5 19Q16 21.6 9.5 19Z', RED[1], 1.5),
  laugh: () =>
    c(16, 16, 12.8, GOLD[1]) + l('M8.5 13.5Q11 10 13.5 13.5M18.5 13.5Q21 10 23.5 13.5', OL, 2) +
    p('M9.5 17.5H22.5Q22 25.5 16 25.5Q10 25.5 9.5 17.5Z', '#7a1e10', 1.6) + f('M12 22.5Q16 20.5 20 22.5Q18.5 24.6 16 24.6Q13.5 24.6 12 22.5Z', RED[0]) +
    p('M5.5 14.5Q3 18 4.6 20.2Q7 19 5.5 14.5Z', BLUE[0], 1.2),
  heal: () => p(HEART, GREEN[1]) + f('M14.2 10H17.8V13.4H21.2V17H17.8V20.4H14.2V17H10.8V13.4H14.2Z', '#ffffff', 0.92) + hi('M7.5 10Q8 7 11 6.8', 0.7, 1.6),
  trumpet: () =>
    tube('M9.5 18Q9.5 23 13.5 23H16.5Q20 23 20 19', GOLD[2], 2.2) + p('M2.5 13.4H5.5V18.6H2.5Z', GOLD[2], 1.6) +
    p('M5.5 14.4H19L28.5 8.5V23.5L19 17.6H5.5Z', GOLD[1]) + tube('M10 10.5V14M13.5 10.5V14M17 10.5V14', GOLD[0], 1.8, 1.8) + hi('M21 12.2L26.5 9', 0.6, 1.3),
  flag: () => tube('M7 3.5V29.5', WOOD[1], 2.4) + p('M8.2 5Q13 2.6 18 5T27.5 5V17Q22.8 19.4 18 17T8.2 17Z', RED[1]) + hi('M10.5 7.5Q14 6 17.5 7.5', 0.55, 1.3),
  anger: () => tube('M13 4Q13 13 4 13M19 4Q19 13 28 13M13 28Q13 19 4 19M19 28Q19 19 28 19', RED[1], 3),
  repeat: () => tube('M6 14.5Q6 8 12.5 8H23M19.5 4.5L23.5 8L19.5 11.5M26 17.5Q26 24 19.5 24H9M12.5 20.5L8.5 24L12.5 27.5', BLUE[0], 2.6),
  moai: () =>
    p('M10 3.5H21Q23.5 3.5 23.5 6V13.5L26 19.5L23.5 20.5V29H9.5V15.5L8.5 6Q8.5 3.5 10 3.5Z', '#9399a8') + f('M9.5 15.5L9 10H23.5V13.5L21 12.5H16Z', '#6f7584', 0.8) +
    l('M9.2 10H23M17.5 11.5V19.5H21M12.5 24H20', OL, 1.7) + hi('M11 5.6H16', 0.5, 1.3),
  medal: () => p('M9.5 3H22.5L19.5 14.5H12.5Z', RED[1]) + f('M14.4 3H17.6L17 14.5H15Z', PAPER[0]) + p(star(16, 21, 9, 4), GOLD[1]) + hi('M13.5 18L15.5 14', 0.7, 1.2),
  cards: () =>
    `<g transform="rotate(14 16 18)">${p('M11 4H23Q25 4 25 6V26Q25 28 23 28H11Q9 28 9 26V6Q9 4 11 4Z', VIOLET[1])}</g>` +
    `<g transform="rotate(-10 16 18)">${p('M9 4H21Q23 4 23 6V26Q23 28 21 28H9Q7 28 7 26V6Q7 4 9 4Z', PAPER[0])}${p('M15 10L19.5 16L15 22L10.5 16Z', RED[1], 1.4)}</g>`,
  swirl: () => tube('M16.5 16.5Q16.5 13.5 19.5 13.5Q23 13.5 23 17.5Q23 23 16.5 23Q9 23 9 15.5Q9 7.5 17.5 7.5Q25.5 7.5 27 14.5', BLUE[0], 2.8),
  ruler: () => p('M4.5 27.5V5L27.5 27.5Z', GOLD[0]) + p('M10 22.5V16L16.8 22.5Z', PAPER[2], 1.4) + l('M4.5 11H7.5M4.5 15.5H7.5M4.5 20H7.5M11 27.5V24.8M16 27.5V24.8M21 27.5V24.8', OL, 1.4),
  eye: () =>
    p('M2.5 16Q9 6 16 6Q23 6 29.5 16Q23 26 16 26Q9 26 2.5 16Z', PAPER[0]) + c(16, 16, 6.4, VIOLET[1], 1.8) + c(16, 16, 2.8, OL, 0) + c(13.8, 13.8, 1.4, '#ffffff', 0),
  galaxy: () =>
    c(16, 16, 12.8, '#2a2466') + l('M16 16Q16 11 21 11Q26 12 25 18M16 16Q16 21 11 21Q6 20 7 14', VIOLET[0], 2) + c(16, 16, 2.4, PAPER[0], 0) +
    c(10, 9.5, 1, '#ffffff', 0) + c(22.5, 22, 1, '#ffffff', 0) + c(22, 7.5, 0.8, '#ffffff', 0) + c(9, 23.5, 0.8, '#ffffff', 0),
  gem: () =>
    p('M16 2.5L28.5 13.5L16 29.5L3.5 13.5Z', BLUE[1]) + f('M16 2.5L10.5 13.5L16 29.5L3.5 13.5Z', BLUE[2], 0.55) + f('M16 2.5L21.5 13.5H10.5Z', BLUE[0], 0.9) +
    l('M3.5 13.5H28.5M10.5 13.5L16 2.5L21.5 13.5L16 29.5Z', BLUE[0], 1.2, 0.9),
  books: () =>
    p('M5 21.5H27V28.5H5Z', RED[1]) + p('M7 14.5H26V21.5H7Z', BLUE[1]) + p('M5.5 7.5H25V14.5H5.5Z', GREEN[1]) +
    l('M9 21.5V28.5M11 14.5V21.5M9.5 7.5V14.5', OL, 1.4, 0.6) + f('M22 9H25V13H22ZM23 16H26V20H23ZM24 23H27V27H24Z', PAPER[0], 0.9),
  scope: () =>
    tube('M15 19L9.5 29.5M15 19L20.5 29.5', WOOD[1], 2) +
    `<g transform="rotate(-28 16 14)">${p('M3 11H19V17.5H3Z', STEEL[1])}${p('M18.5 9H28.5V19.5H18.5Z', GOLD[1])}${hi('M5 13H16', 0.6, 1.2)}</g>`,
  scissors: () =>
    tube('M9.5 3.5L18.5 19.5M22.5 3.5L13.5 19.5', STEEL[0], 2.6) +
    `<circle cx="11" cy="24" r="4.2" fill="none" stroke="${OL}" stroke-width="5"/><circle cx="11" cy="24" r="4.2" fill="none" stroke="${RED[1]}" stroke-width="2.6"/>` +
    `<circle cx="21" cy="24" r="4.2" fill="none" stroke="${OL}" stroke-width="5"/><circle cx="21" cy="24" r="4.2" fill="none" stroke="${RED[1]}" stroke-width="2.6"/>` + c(16, 15, 1.3, OL, 0),
  notes: () =>
    l('M12.5 8.5V22.5M25 5.5V19.5', OL, 2.6) + p('M12.5 6.5L25 3.5V9L12.5 12Z', GOLD[1], 1.8) +
    `<ellipse cx="8.8" cy="23.5" rx="4.6" ry="3.6" fill="${GOLD[1]}" stroke="${OL}" stroke-width="2" transform="rotate(-18 8.8 23.5)"/>` +
    `<ellipse cx="21.3" cy="20.5" rx="4.6" ry="3.6" fill="${GOLD[1]}" stroke="${OL}" stroke-width="2" transform="rotate(-18 21.3 20.5)"/>`,
  hearts: () => `<g transform="translate(13 0) scale(0.58)">${p(HEART, '#ff9ab0', 3)}</g><g transform="translate(-1 6.5) scale(0.76)">${p(HEART, RED[1], 2.6)}${hi('M7.5 10Q8 7 11 6.8', 0.8, 2)}</g>`,
  dove: () =>
    p('M3 15.5Q8.5 11.5 14 13.5L19.5 4.5Q25 11 22.5 16L29.5 15.5Q27.5 23 20 24.5Q12 26 8.5 21Q5 19.5 3 15.5Z', '#ffffff') +
    l('M14 13.5Q16.5 17 22.5 16', STEEL[2], 1.4) + c(7.8, 15.6, 1.1, OL, 0) + f('M3 15.5L0.8 16.8L3.6 17.4Z', GOLD[1]),
  book: () =>
    p('M2.5 7Q10 4.5 16 8V27.5Q10 24.5 2.5 26.5Z', PAPER[0]) + p('M29.5 7Q22 4.5 16 8V27.5Q22 24.5 29.5 26.5Z', PAPER[1]) +
    l('M6 11.5Q9.5 10.5 13 12M6 15.5Q9.5 14.5 13 16M6 19.5Q9.5 18.5 13 20M19 12Q22.5 10.5 26 11.5M19 16Q22.5 14.5 26 15.5M19 20Q22.5 18.5 26 19.5', WOOD[1], 1.3),

  // ----- deeds -----
  compass: () => c(16, 16, 13, GOLD[1]) + c(16, 16, 9.4, PAPER[0], 1.6) + p('M16 8.5L19 16H13Z', RED[1], 1.3) + p('M16 23.5L13 16H19Z', STEEL[1], 1.3) + c(16, 16, 1.3, OL, 0),
  calendar: () =>
    p('M7 5.5H25Q28.5 5.5 28.5 9V25Q28.5 28.5 25 28.5H7Q3.5 28.5 3.5 25V9Q3.5 5.5 7 5.5Z', PAPER[0]) + p('M3.5 13V9Q3.5 5.5 7 5.5H25Q28.5 5.5 28.5 9V13Z', RED[1]) +
    l('M10 3V8M22 3V8', OL, 2.6) + f('M8 16.5H11.5V19.5H8ZM14.2 16.5H17.8V19.5H14.2ZM20.5 16.5H24V19.5H20.5ZM8 22H11.5V25H8ZM14.2 22H17.8V25H14.2Z', WOOD[1], 0.75),
  snake: () =>
    tube('M22 8Q13 4.5 10.5 9.5Q8.5 14.5 16 16Q24 17.5 21.5 23Q19 28 7 25', GREEN[1], 4) + c(23.5, 8.2, 3.6, GREEN[1]) + c(24.6, 7.4, 0.9, OL, 0) +
    l('M26.8 9.6L30 10.6M30 10.6L31 9.4M30 10.6L30.8 12', RED[1], 1.2),
  bow: () =>
    l('M9 3.5V28.5', PAPER[0], 1.4) + tube('M9 3.5Q27 16 9 28.5', WOOD[1], 2.8) + tube('M3 16H25', STEEL[0], 1.8, 1.8) +
    p('M24 11.5L30.5 16L24 20.5Z', STEEL[1], 1.6) + l('M3 16L1.5 13M3 16L1.5 19', RED[1], 1.6),
  handshake: () =>
    p('M1.5 10H9L14.5 14V21L9 23.5H1.5Z', BLUE[1]) + p('M30.5 10H23L17.5 14V21L23 23.5H30.5Z', RED[1]) +
    p('M10.5 12.5Q16 9 21.5 12.5V20.5Q16 24.5 10.5 20.5Z', SKIN) + l('M13.5 15.2H18.5M13.5 18.2H18.5', OL, 1.4, 0.55),
  peak: () =>
    p('M1.5 28.5L12 7.5L17.5 17L21.5 11L30.5 28.5Z', '#8f98ad') + f('M12 7.5L15.4 13.6L12.8 12.4L10.6 14.6L9.2 13.2Z', '#ffffff') +
    f('M21.5 11L24.2 16.2L22 15.4L20.4 16.8L19.6 14Z', '#ffffff') + f('M12 7.5L17.5 17L15 28.5H9Z', '#6f7890', 0.45),
  cap: () =>
    p('M8 15V22.5Q16 27.5 24 22.5V15L16 19Z', '#4a4466') + p('M2 12L16 5.5L30 12L16 18.5Z', '#3a3550') + tube('M27 13V21', GOLD[1], 1.6, 1.8) + c(27, 22.5, 2, GOLD[1], 1.4) + hi('M8 11.5L16 7.8', 0.4, 1.2),
  temple: () =>
    p('M3 26H29V29.5H3Z', PAPER[2]) + tube('M7.5 13V25M13.2 13V25M18.8 13V25M24.5 13V25', PAPER[0], 2.6, 2) +
    p('M4 10.5H28V13.5H4Z', PAPER[1], 1.8) + p('M3 10.5L16 3L29 10.5Z', PAPER[0]),
  globe: () =>
    c(16, 16, 13, BLUE[1]) + f('M9 7.5Q13 5.5 16.5 8Q17.5 11.5 13.5 12.5Q11.5 16 8 14.5Q5.5 11.5 9 7.5Z', GREEN[1]) +
    f('M18.5 15Q23.5 13.5 26.5 17.5Q26 23 21.5 25.5Q18.5 23 19.5 19.5Q17 17.5 18.5 15Z', GREEN[1]) + f('M9.5 20Q12.5 19.5 13 23Q11.5 25.5 9.5 23.5Z', GREEN[1]) + hi('M7 12Q9 7.5 13.5 6', 0.6, 1.3),
  autumn: () =>
    p('M5 27Q3.5 14 13 8Q20 4 28.5 4.5Q29 13 25 20Q19 29.5 5 27Z', '#e0842e') + l('M5 27Q15 17 26.5 7M11.5 20.5L11 14M16.5 15.5L16.5 9.5M12.5 20L19 21.5M17.5 15L24 16', '#8a4a14', 1.4),

  // ----- interface glyphs: drawn in the surrounding text colour -----
  plus: () => l('M16 6V26M6 16H26', 'currentColor', 3.2),
  minus: () => l('M6 16H26', 'currentColor', 3.2),
  aim: () => `<circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="16" cy="16" r="2.6" fill="currentColor"/>` + l('M16 2.5V7M16 25V29.5M2.5 16H7M25 16H29.5', 'currentColor', 2.6),
  arrow: () => `<path d="M28 16L7 6.5L11.5 16L7 25.5Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  chevron: () => l('M12 6L22 16L12 26', 'currentColor', 3.2),
  close: () => l('M8 8L24 24M24 8L8 24', 'currentColor', 3.2),
} satisfies Record<string, () => string>;

export type IconId = keyof typeof ART;

const LABEL: Partial<Record<IconId, string>> = {
  flame: 'torch', coin: 'gold', pouch: 'gold', potion: 'potion', heart: 'heart', spark: 'inspiration', star: 'star',
  skull: 'danger', swords: 'fight', map: 'map', aid: 'healing', chest: 'item', leaf: 'herbs',
};

/** Emoji (and a few symbols) that have an icon. Variation selectors are ignored. */
const EMOJI: Record<string, IconId> = {
  '🎒': 'pack', '👥': 'party', '📜': 'scroll', '🏕': 'camp', '⚙': 'gear',
  '♥': 'heart', '❤': 'heart', '★': 'star', '🌟': 'star', '✨': 'spark',
  '🪙': 'coin', '💰': 'pouch', '🔥': 'flame', '🧪': 'potion', '🌿': 'leaf', '✚': 'aid', '🩹': 'aid', '🎁': 'chest', '🗺': 'map',
  '👣': 'signpost', '❔': 'quest', '❓': 'quest', '⚔': 'swords', '🗡': 'sword', '☠': 'skull', '💀': 'skull', '🛡': 'shield',
  '🪨': 'rock', '🌊': 'wave', '🧊': 'ice', '🚧': 'barrier', '🕳': 'pit',
  '💬': 'chat', '🏃': 'boot', '🥾': 'boot', '✍': 'quill', '✎': 'quill', '🛏': 'bed', '💫': 'dizzy', '⛓': 'chain', '🔗': 'link',
  '🎯': 'target', '⚠': 'warn', '⚡': 'bolt', '🍀': 'clover', '🎲': 'die', '👑': 'crown',
  '🏆': 'trophy', '📤': 'share', '📥': 'save', '⬇': 'save', '💡': 'bulb', '📲': 'phone', '🏠': 'home', '🔒': 'lock', '📋': 'clipboard',
  '☀': 'sun', '🌑': 'moon', '🌘': 'moon', '🌙': 'moon', '🌕': 'fullmoon', '🌅': 'sunrise', '🌧': 'rain', '⛈': 'storm', '🌨': 'snow',
  '🌫': 'fog', '🥵': 'heat', '🌬': 'wind', '🍃': 'wind', '💨': 'wind', '🌠': 'comet', '🛒': 'cart',
  '💥': 'burst', '🌋': 'volcano', '📯': 'horn', '🫥': 'vanish', '🫳': 'hand', '🤚': 'hand', '🌩': 'storm', '☄': 'fireball', '🔮': 'orb',
  '🎭': 'mask', '🤣': 'laugh', '💚': 'heal', '🎺': 'trumpet', '🚩': 'flag', '💢': 'anger', '🔁': 'repeat', '🗿': 'moai', '🎖': 'medal',
  '🃏': 'cards', '🌀': 'swirl', '📐': 'ruler', '👁': 'eye', '🌌': 'galaxy', '💠': 'gem', '📚': 'books', '🔭': 'scope', '🤺': 'sword',
  '✂': 'scissors', '🎼': 'notes', '🎶': 'notes', '💞': 'hearts', '🕊': 'dove', '📖': 'book',
  '🧭': 'compass', '📅': 'calendar', '🐍': 'snake', '🏹': 'bow', '🤝': 'handshake', '🏔': 'peak', '🎓': 'cap', '🏛': 'temple', '🌍': 'globe', '🍂': 'autumn',
};

const cache = new Map<IconId, string>();
const body = (id: IconId): string => {
  let b = cache.get(id);
  if (b === undefined) cache.set(id, (b = ART[id]()));
  return b;
};

/** One icon as an SVG string. Without a size it follows the text size (see `.ic` in style.css). */
export function icon(id: IconId, size?: number): string {
  const dim = size ? ` width="${size}" height="${size}"` : '';
  const a11y = LABEL[id] ? ` role="img" aria-label="${LABEL[id]}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="ic ic-${id}"${dim}${a11y}>${body(id)}</svg>`;
}

/** One icon as an element. */
export function iconEl(id: IconId, size?: number): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = icon(id, size);
  return t.content.firstChild as SVGElement;
}

/** The icon that stands in for an emoji, if there is one. */
export function iconFor(emoji: string): IconId | undefined {
  return EMOJI[emoji.replace(/️/g, '')];
}

const EMOJI_RE = new RegExp(`(${Object.keys(EMOJI).join('|')})\\uFE0F?`, 'gu');
/** Quick test so plain text skips the split. */
export const hasIcon = (text: string): boolean => {
  EMOJI_RE.lastIndex = 0;
  return EMOJI_RE.test(text);
};

/** Split text into plain runs and icons: "-1 🔥" → ["-1 ", <svg flame>]. */
export function iconize(text: string): (string | SVGElement)[] {
  const out: (string | SVGElement)[] = [];
  let last = 0;
  EMOJI_RE.lastIndex = 0;
  for (let m = EMOJI_RE.exec(text); m; m = EMOJI_RE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(iconEl(EMOJI[m[1]]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const ICON_IDS = Object.keys(ART) as IconId[];
