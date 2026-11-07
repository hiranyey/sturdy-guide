// The screen's top and bottom edges (behind the iPhone status bar and home
// indicator) take on the colour of the scene: green in the forest, sand in the
// desert, deep blue at sea, darker at night, red in a fight, ember-orange at
// camp. The same colour feeds <meta name="theme-color"> for Safari and Android.
import type { Biome } from '../core/types';
import type { SceneCtx } from './ambience';

type RGB = [number, number, number];
export type EdgeMood = 'title' | 'combat' | 'boss' | 'camp';

const BIOME: Record<Biome, RGB> = {
  deep: [12, 42, 86], water: [18, 64, 104], sand: [104, 88, 52], grass: [38, 82, 44],
  forest: [20, 64, 38], swamp: [48, 64, 38], hills: [76, 78, 42], mountain: [62, 62, 78],
  snow: [78, 96, 124], desert: [122, 84, 36],
};
const PLACE: Record<string, RGB> = {
  village: [104, 70, 34], market: [122, 88, 30], ruin: [44, 30, 58], cave: [38, 30, 44],
  shrine: [70, 52, 108], grove: [34, 84, 62], tower: [66, 38, 116],
};
const MOOD: Record<EdgeMood, RGB> = {
  title: [24, 28, 58], combat: [128, 22, 26], boss: [138, 16, 46], camp: [130, 62, 18],
};
const BASE: RGB = [17, 20, 42]; // the app's navy
const NIGHT: RGB = [10, 14, 38];
const DUSK: RGB = [92, 46, 70];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c.join(',')})` : `rgba(${c.join(',')},${a})`);

/** Edge colour for a place at a time of day. */
export function edgeColor(sc: SceneCtx): RGB {
  const tint = (sc.poi && PLACE[sc.poi]) || BIOME[sc.biome] || BASE;
  let c = mix(BASE, tint, 0.6);
  if (sc.time === 'dusk') c = mix(c, DUSK, 0.3);
  if (sc.time === 'night') c = mix(c, NIGHT, 0.6);
  return c;
}

let meta: HTMLMetaElement | null = null;

function apply(c: RGB, alert: boolean) {
  const root = document.documentElement.style;
  root.setProperty('--edge-bg', css(c, 0.74));
  root.setProperty('--edge-fade', css(c, 0.5));
  root.setProperty('--edge-line', css(mix(c, [255, 215, 140], 0.35), 0.45));
  root.setProperty('--edge-deep', css(mix(c, [0, 0, 0], 0.55)));
  document.body.classList.toggle('edge-alert', alert);
  meta ??= document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', css(mix(c, [0, 0, 0], 0.25)));
}

/** Tint the edges for where you are. */
export function edgeScene(sc: SceneCtx) {
  apply(edgeColor(sc), false);
}

/** Tint the edges for a moment: the title, a fight (pulsing red), camp. */
export function edgeMood(m: EdgeMood) {
  apply(mix(BASE, MOOD[m], 0.6), m === 'combat' || m === 'boss');
}
