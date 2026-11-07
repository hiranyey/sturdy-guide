// Ambient soundscapes: wind, birds, crickets, waves, a crackling fire, cave
// drips, a market crowd… Each layer is synthesised live (noise beds plus little
// randomised events), and layers crossfade as the scene changes.
import { audioCtx, ambienceOut, ambienceVerbIn, noise } from './audio';
import { settings } from '../ai/settings';
import type { Biome, PoiKind } from '../core/types';

export type Amb =
  | 'breeze' | 'wind' | 'gale' | 'leaves' | 'birds' | 'crickets' | 'owls' | 'insects'
  | 'waves' | 'gulls' | 'river' | 'fire' | 'drips' | 'cavehum' | 'crowd' | 'frogs' | 'chimes' | 'bubbles';

export interface SceneCtx {
  biome: Biome;
  poi?: PoiKind | 'market' | null;
  time?: 'day' | 'dusk' | 'night';
  river?: boolean;
}

/** What you hear in a place. */
export function ambienceFor(sc: SceneCtx): Amb[] {
  const night = sc.time === 'night', dusk = sc.time === 'dusk';
  const evening = (day: Amb[], late: Amb[]) => (night ? late : dusk ? [...day.slice(0, 1), ...late.slice(0, 1)] : day);
  let out: Amb[];
  switch (sc.poi) {
    case 'village': out = night ? ['crickets', 'fire', 'owls'] : ['crowd', 'birds', 'breeze']; break;
    case 'market': out = ['crowd', 'chimes', 'breeze']; break;
    case 'ruin': case 'cave': out = ['drips', 'cavehum', 'breeze']; break;
    case 'shrine': case 'grove': out = ['chimes', 'leaves', night ? 'crickets' : 'birds']; break;
    case 'tower': out = ['wind', 'chimes', 'cavehum']; break;
    default:
      switch (sc.biome) {
        case 'forest': out = ['leaves', ...evening(['birds'], ['owls', 'crickets'])]; break;
        case 'swamp': out = ['frogs', 'insects', 'bubbles']; break;
        case 'hills': out = ['wind', ...evening(['birds'], ['crickets'])]; break;
        case 'mountain': case 'snow': out = ['gale']; break;
        case 'desert': out = ['wind', night ? 'crickets' : 'insects']; break;
        case 'sand': out = ['waves', 'breeze', ...(night ? [] : ['gulls'] as Amb[])]; break;
        case 'water': case 'deep': out = ['waves', ...(night ? [] : ['gulls'] as Amb[])]; break;
        default: out = ['breeze', ...evening(['birds'], ['crickets', 'owls'])];
      }
  }
  if (sc.river && !out.includes('river')) out.push('river');
  return out;
}

/** The camp at night. */
export const CAMP_AMBIENCE: Amb[] = ['fire', 'crickets', 'owls'];
export const TITLE_AMBIENCE: Amb[] = ['breeze', 'birds'];

// ---------------- Layer machinery ----------------

interface Layer { gain: GainNode; stops: (() => void)[] }

const active = new Map<Amb, Layer>();
let wanted: Amb[] = [];

export function setAmbience(list: Amb[]) {
  wanted = list;
  if (!settings.ambience) { for (const k of [...active.keys()]) drop(k); return; }
  const c = audioCtx();
  const out = ambienceOut();
  if (!c || !out) return;
  for (const k of [...active.keys()]) if (!list.includes(k)) drop(k);
  for (const k of list) if (!active.has(k)) active.set(k, make(c, out, k));
}

export function refreshAmbience() { setAmbience(wanted); }

function drop(k: Amb) {
  const l = active.get(k);
  active.delete(k);
  const c = audioCtx();
  if (!l || !c) return;
  l.gain.gain.cancelScheduledValues(c.currentTime);
  l.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.7);
  setTimeout(() => { l.stops.forEach((s) => s()); l.gain.disconnect(); }, 3500);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function make(c: AudioContext, out: AudioNode, k: Amb): Layer {
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(1, c.currentTime, 0.9);
  gain.connect(out);
  const verb = ambienceVerbIn();
  const wet = c.createGain();
  wet.gain.value = 0.35;
  if (verb) gain.connect(wet).connect(verb);
  const l: Layer = { gain, stops: [] };
  BUILD[k](c, l);
  return l;
}

/** Looping filtered noise with optional slow wobble on the filter and the volume. */
function bed(c: AudioContext, l: Layer, o: { type: BiquadFilterType; freq: number; q?: number; vol: number; fRate?: number; fDepth?: number; gRate?: number; gDepth?: number }) {
  const buf = noise();
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.type;
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 0.7;
  const g = c.createGain();
  g.gain.value = o.vol;
  src.connect(f).connect(g).connect(l.gain);
  const oscs: OscillatorNode[] = [];
  const lfo = (rate: number, depth: number, param: AudioParam) => {
    const x = c.createOscillator();
    x.frequency.value = rate * rnd(0.8, 1.2);
    const xg = c.createGain();
    xg.gain.value = depth;
    x.connect(xg).connect(param);
    x.start();
    oscs.push(x);
  };
  if (o.fRate && o.fDepth) lfo(o.fRate, o.fDepth, f.frequency);
  if (o.gRate && o.gDepth) lfo(o.gRate, o.gDepth, g.gain);
  src.start(0, Math.random() * 1.5);
  l.stops.push(() => { try { src.stop(); oscs.forEach((x) => x.stop()); } catch { /* stopped */ } });
}

/** Run `fn` again and again at random intervals until the layer stops. */
function every(l: Layer, min: number, max: number, fn: (t: number) => void) {
  let alive = true;
  let timer: ReturnType<typeof setTimeout>;
  const loop = () => {
    if (!alive) return;
    const c = audioCtx();
    if (c && c.state === 'running') fn(c.currentTime + 0.05);
    timer = setTimeout(loop, rnd(min, max) * 1000);
  };
  timer = setTimeout(loop, rnd(0.2, min) * 1000);
  l.stops.push(() => { alive = false; clearTimeout(timer); });
}

/** One short synthesised note into a layer. */
function blip(c: AudioContext, l: Layer, o: { f: number; to?: number; type?: OscillatorType; t: number; dur: number; vol: number; attack?: number; trem?: number; lp?: number }) {
  const x = c.createOscillator();
  x.type = o.type ?? 'sine';
  x.frequency.setValueAtTime(o.f, o.t);
  if (o.to) x.frequency.exponentialRampToValueAtTime(o.to, o.t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.exponentialRampToValueAtTime(o.vol, o.t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  let node: AudioNode = x;
  if (o.lp) { const f = c.createBiquadFilter(); f.frequency.value = o.lp; node = x.connect(f); }
  if (o.trem) {
    const am = c.createGain();
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = o.trem;
    const lg = c.createGain();
    lg.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur + 0.05);
    node = node.connect(am);
  }
  node.connect(g).connect(l.gain);
  x.start(o.t);
  x.stop(o.t + o.dur + 0.05);
}

/** A short noise burst (crackles, splashes, footsteps in the crowd). */
function puff(c: AudioContext, l: Layer, o: { t: number; dur: number; vol: number; type?: BiquadFilterType; freq: number; to?: number; q?: number }) {
  const buf = noise();
  if (!buf) return;
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, o.t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.exponentialRampToValueAtTime(o.vol, o.t + Math.min(0.01, o.dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  s.connect(f).connect(g).connect(l.gain);
  s.start(o.t, Math.random() * 1.5);
  s.stop(o.t + o.dur + 0.05);
}

const BUILD: Record<Amb, (c: AudioContext, l: Layer) => void> = {
  breeze: (c, l) => bed(c, l, { type: 'lowpass', freq: 500, vol: 0.12, fRate: 0.08, fDepth: 250, gRate: 0.05, gDepth: 0.05 }),
  wind: (c, l) => bed(c, l, { type: 'bandpass', freq: 700, q: 0.8, vol: 0.2, fRate: 0.1, fDepth: 400, gRate: 0.07, gDepth: 0.1 }),
  gale: (c, l) => {
    bed(c, l, { type: 'bandpass', freq: 900, q: 4, vol: 0.14, fRate: 0.13, fDepth: 500, gRate: 0.09, gDepth: 0.08 });
    bed(c, l, { type: 'lowpass', freq: 350, vol: 0.25, gRate: 0.06, gDepth: 0.12 });
  },
  leaves: (c, l) => bed(c, l, { type: 'highpass', freq: 3200, vol: 0.035, gRate: 0.18, gDepth: 0.03 }),
  insects: (c, l) => bed(c, l, { type: 'bandpass', freq: 5200, q: 8, vol: 0.05, gRate: 0.25, gDepth: 0.04 }),
  river: (c, l) => {
    bed(c, l, { type: 'bandpass', freq: 1100, q: 0.6, vol: 0.09, gRate: 0.3, gDepth: 0.02 });
    bed(c, l, { type: 'highpass', freq: 4000, vol: 0.025 });
    every(l, 0.15, 0.6, (t) => blip(c, l, { f: rnd(600, 1500), to: rnd(1600, 2600), t, dur: 0.03, vol: 0.012 }));
  },
  birds: (c, l) => every(l, 1.4, 5, (t) => {
    const n = Math.floor(rnd(2, 6));
    const base = rnd(2200, 3800);
    const style = Math.floor(rnd(0, 3));
    for (let k = 0; k < n; k++) {
      const w = t + k * rnd(0.08, 0.16);
      if (style === 0) blip(c, l, { f: base, to: base * 1.35, t: w, dur: 0.07, vol: 0.08 });
      else if (style === 1) blip(c, l, { f: base * 1.3, to: base * 0.8, t: w, dur: 0.1, vol: 0.07 });
      else blip(c, l, { f: base * (k % 2 ? 1.2 : 1), t: w, dur: 0.05, vol: 0.07 });
    }
  }),
  crickets: (c, l) => {
    const p1 = rnd(4300, 4700), p2 = rnd(3900, 4200);
    every(l, 0.7, 1.4, (t) => { for (let k = 0; k < 3; k++) blip(c, l, { f: p1, t: t + k * 0.06, dur: 0.035, vol: 0.04, trem: 60 }); });
    every(l, 0.9, 1.8, (t) => { for (let k = 0; k < 4; k++) blip(c, l, { f: p2, t: t + k * 0.05, dur: 0.03, vol: 0.028, trem: 70 }); });
  },
  owls: (c, l) => every(l, 7, 15, (t) => {
    blip(c, l, { f: 390, to: 370, t, dur: 0.35, vol: 0.05, attack: 0.06 });
    blip(c, l, { f: 380, to: 350, t: t + 0.55, dur: 0.22, vol: 0.04, attack: 0.04 });
    blip(c, l, { f: 380, to: 340, t: t + 0.82, dur: 0.45, vol: 0.045, attack: 0.05 });
  }),
  waves: (c, l) => {
    bed(c, l, { type: 'lowpass', freq: 400, vol: 0.05 });
    every(l, 4.5, 8, (t) => puff(c, l, { t, dur: rnd(3.5, 5.5), vol: rnd(0.12, 0.2), type: 'lowpass', freq: 300, to: rnd(1200, 2000) }));
  },
  gulls: (c, l) => every(l, 6, 14, (t) => {
    const n = Math.floor(rnd(2, 4));
    for (let k = 0; k < n; k++) blip(c, l, { f: rnd(1500, 1800), to: rnd(850, 1000), type: 'triangle', t: t + k * 0.32, dur: 0.24, vol: 0.08, lp: 2500 });
  }),
  fire: (c, l) => {
    bed(c, l, { type: 'lowpass', freq: 380, vol: 0.12, gRate: 0.5, gDepth: 0.04 });
    every(l, 0.05, 0.35, (t) => puff(c, l, { t, dur: rnd(0.01, 0.04), vol: rnd(0.04, 0.16), freq: rnd(1500, 5000), q: 2 }));
  },
  drips: (c, l) => every(l, 1.1, 4, (t) => {
    const f = rnd(900, 1900);
    blip(c, l, { f, to: f * 0.7, t, dur: 0.12, vol: 0.06 });
    if (Math.random() < 0.4) blip(c, l, { f: f * 1.3, to: f, t: t + 0.18, dur: 0.08, vol: 0.025 });
  }),
  cavehum: (c, l) => {
    for (const [f, v] of [[55, 0.05], [82.4, 0.03], [110.6, 0.015]] as const) {
      const x = c.createOscillator();
      x.frequency.value = f;
      const g = c.createGain();
      g.gain.value = v;
      x.connect(g).connect(l.gain);
      x.start();
      l.stops.push(() => { try { x.stop(); } catch { /* stopped */ } });
    }
    bed(c, l, { type: 'lowpass', freq: 200, vol: 0.08, gRate: 0.04, gDepth: 0.04 });
  },
  crowd: (c, l) => {
    bed(c, l, { type: 'bandpass', freq: 650, q: 1.2, vol: 0.06, gRate: 0.4, gDepth: 0.02 });
    // Murmured syllables: formant-filtered buzz with a little pitch fall.
    every(l, 0.12, 0.5, (t) => {
      const f = rnd(110, 260);
      const x = c.createOscillator();
      x.type = 'sawtooth';
      x.frequency.setValueAtTime(f, t);
      x.frequency.exponentialRampToValueAtTime(f * rnd(0.8, 1.1), t + 0.2);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rnd(500, 1300);
      bp.Q.value = 5;
      const g = c.createGain();
      const d = rnd(0.12, 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rnd(0.008, 0.02), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      x.connect(bp).connect(g).connect(l.gain);
      x.start(t);
      x.stop(t + d + 0.05);
    });
    // Cups and coins.
    every(l, 2, 6, (t) => blip(c, l, { f: rnd(2400, 3600), t, dur: 0.12, vol: 0.012 }));
  },
  frogs: (c, l) => every(l, 0.7, 2.8, (t) => {
    const f = rnd(100, 170);
    const n = Math.floor(rnd(1, 4));
    for (let k = 0; k < n; k++) blip(c, l, { f, to: f * 0.85, type: 'square', t: t + k * 0.22, dur: 0.16, vol: 0.06, trem: 32, lp: 800 });
  }),
  chimes: (c, l) => every(l, 2.5, 7, (t) => {
    const pent = [0, 2, 4, 7, 9];
    const n = Math.floor(rnd(1, 4));
    for (let k = 0; k < n; k++) {
      const f = 1046.5 * 2 ** (pent[Math.floor(rnd(0, 5))] / 12) * (Math.random() < 0.3 ? 2 : 1);
      blip(c, l, { f, t: t + k * rnd(0.15, 0.4), dur: 2.6, vol: 0.02, attack: 0.003 });
      blip(c, l, { f: f * 2.76, t: t + k * 0.2, dur: 0.8, vol: 0.006, attack: 0.003 });
    }
  }),
  bubbles: (c, l) => every(l, 0.9, 3, (t) => {
    const n = Math.floor(rnd(2, 5));
    for (let k = 0; k < n; k++) { const f = rnd(250, 600); blip(c, l, { f, to: f * 1.8, t: t + k * rnd(0.05, 0.12), dur: 0.06, vol: 0.06 }); }
  }),
};
