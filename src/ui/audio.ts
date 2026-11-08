// Tiny WebAudio synth so the game has satisfying sound with zero asset weight.
// Three buses with independent volumes: sound effects, music and ambience.
// Music and ambience each get a reverb send so they sit in a space.
import { settings } from '../ai/settings';
import type { Biome, ClassId, EnemyKind } from '../core/types';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let sfxVerb: GainNode | null = null;
let musicVerb: GainNode | null = null;
let ambVerb: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** A generated impulse response: decaying stereo noise. */
function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

/** bus <- reverb(send): returns the send input. */
function reverbInto(c: AudioContext, bus: GainNode, seconds: number, level: number) {
  const send = c.createGain();
  const conv = c.createConvolver();
  conv.buffer = impulse(c, seconds, 2.6);
  const wet = c.createGain();
  wet.gain.value = level;
  send.connect(conv).connect(wet).connect(bus);
  return send;
}

/** Shared context; created lazily (browsers only allow audio after a user gesture). */
export function audioCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      ambBus = ctx.createGain();
      for (const b of [sfxBus, musicBus, ambBus]) b.connect(ctx.destination);
      sfxVerb = reverbInto(ctx, sfxBus, 1.2, 0.6);
      musicVerb = reverbInto(ctx, musicBus, 3.2, 0.9);
      ambVerb = reverbInto(ctx, ambBus, 2.4, 0.8);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
      unlockOnGesture();
      pauseWhenHidden();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  return ctx;
}

/** Contexts made before the first tap start suspended: resume on the first gesture. */
function unlockOnGesture() {
  const go = () => { ctx?.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, go, { once: true, capture: true });
}

/** Silence (and save battery) while the app is in the background. */
function pauseWhenHidden() {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export function applyVolumes() {
  if (!ctx || !sfxBus || !musicBus || !ambBus) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sound ? settings.sfxVol : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? settings.musicVol * 0.55 : 0, t, 0.3);
  ambBus.gain.setTargetAtTime(settings.ambience ? settings.ambVol * 0.7 : 0, t, 0.3);
}

export function musicOut(): GainNode | null { audioCtx(); return musicBus; }
export function musicVerbIn(): GainNode | null { audioCtx(); return musicVerb; }
export function ambienceOut(): GainNode | null { audioCtx(); return ambBus; }
export function ambienceVerbIn(): GainNode | null { audioCtx(); return ambVerb; }
export function noise(): AudioBuffer | null { audioCtx(); return noiseBuf; }

function sfx_ctx() {
  if (!settings.sound || settings.sfxVol <= 0) return null;
  return audioCtx();
}

interface ToneOpts { attack?: number; wet?: number; vibrato?: number; filter?: number }

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', vol = 0.15, when = 0, slide = 0, o: ToneOpts = {}) {
  const c = sfx_ctx();
  if (!c || !sfxBus) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vibrato;
    lg.gain.value = freq * 0.03;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    node = osc.connect(f);
  }
  node.connect(g).connect(sfxBus);
  if (o.wet && sfxVerb) {
    const w = c.createGain();
    w.gain.value = o.wet;
    g.connect(w).connect(sfxVerb);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function click(when: number, vol = 0.25, freq = 2400) {
  const c = sfx_ctx();
  if (!c || !sfxBus) return;
  const t = c.currentTime + when;
  const len = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.5;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

interface NoiseOpts { vol?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; attack?: number; wet?: number }

/** A filtered noise burst: footsteps, whooshes, splashes, fire. */
function hiss(when: number, dur: number, o: NoiseOpts = {}) {
  const c = sfx_ctx();
  if (!c || !sfxBus || !noiseBuf) return;
  const t = c.currentTime + when;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  if (o.wet && sfxVerb) {
    const w = c.createGain();
    w.gain.value = o.wet;
    g.connect(w).connect(sfxVerb);
  }
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

/** A soft brass note (sawtooth through a closing filter). */
function horn(freq: number, when: number, dur: number, vol = 0.09) {
  tone(freq, dur, 'sawtooth', vol, when, 0, { attack: 0.06, filter: 1200, wet: 0.5 });
  tone(freq * 0.5, dur, 'triangle', vol * 0.6, when, 0, { attack: 0.06 });
}

/** A bell: sine with inharmonic partials. */
function bell(freq: number, when: number, vol = 0.08, dur = 1.4) {
  tone(freq, dur, 'sine', vol, when, 0, { wet: 0.6 });
  tone(freq * 2.76, dur * 0.5, 'sine', vol * 0.35, when, 0, { wet: 0.6 });
  tone(freq * 5.4, dur * 0.25, 'sine', vol * 0.15, when);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const sfx = {
  roll(duration = 1.0) {
    let t = 0, gap = 0.04;
    while (t < duration) {
      click(t, 0.18 + Math.random() * 0.12, 1800 + Math.random() * 1600);
      t += gap;
      gap *= 1.13;
    }
    click(duration, 0.4, 1200);
  },
  success() { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.07)); },
  crit() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.13, i * 0.06)); tone(2093, 0.6, 'sine', 0.05, 0.3); },
  fail() { tone(220, 0.35, 'sawtooth', 0.06, 0, -80); tone(165, 0.4, 'triangle', 0.1, 0.12, -40); },
  fumble() { tone(200, 0.6, 'sawtooth', 0.08, 0, -150); tone(90, 0.7, 'square', 0.05, 0.15, -30); },
  /** Footsteps that sound like the ground: grass, crunching snow, sand, splashing water… */
  step(biome: Biome = 'grass', river = false) {
    if (river || biome === 'water' || biome === 'deep') {
      hiss(0, 0.22, { freq: 500, to: 2200, q: 2, vol: 0.18 });
      tone(rnd(500, 700), 0.08, 'sine', 0.04, 0.05, 400);
      return;
    }
    switch (biome) {
      case 'snow':
        for (let i = 0; i < 5; i++) click(i * 0.018, rnd(0.08, 0.16), rnd(1500, 3200));
        hiss(0, 0.12, { freq: 2200, q: 0.8, vol: 0.06 });
        break;
      case 'sand': case 'desert':
        hiss(0, 0.16, { type: 'highpass', freq: 2600, vol: 0.07, attack: 0.03 });
        break;
      case 'swamp':
        hiss(0, 0.14, { type: 'lowpass', freq: 500, vol: 0.2 });
        tone(rnd(150, 190), 0.16, 'sine', 0.07, 0.03, -70);
        break;
      case 'forest':
        hiss(0, 0.08, { type: 'lowpass', freq: 900, vol: 0.18 });
        if (Math.random() < 0.6) { click(0.03, 0.12, 3200); click(0.05, 0.08, 2600); }
        break;
      case 'mountain': case 'hills':
        click(0, 0.22, rnd(1800, 2600));
        hiss(0, 0.06, { type: 'lowpass', freq: 1200, vol: 0.12 });
        break;
      default:
        hiss(0, 0.09, { type: 'lowpass', freq: rnd(700, 1000), vol: 0.18 });
    }
  },
  hit() { click(0, 0.5, 400); tone(110, 0.15, 'square', 0.06, 0, -40); },
  coin() { tone(1319, 0.08, 'square', 0.05); tone(1760, 0.18, 'square', 0.05, 0.06); },
  /** Paying for something: coins counted out. */
  buy() { [0, 0.07, 0.13].forEach((w, i) => { tone(1568 + i * 90, 0.06, 'square', 0.035, w); }); tone(2093, 0.25, 'sine', 0.04, 0.2, 0, { wet: 0.3 }); },
  /** Selling: a handful of coins poured into the purse. */
  sell() { for (let i = 0; i < 6; i++) tone(rnd(1300, 2100), 0.07, 'square', 0.03, i * rnd(0.04, 0.07)); },
  level() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, i * 0.1)); },
  tap() { click(0, 0.08, 3000); },
  /** A die striking the table: a knock and a click, softer with each bounce. */
  clack(power = 1) { click(0, 0.22 * power, 1300 + Math.random() * 500); tone(170 + Math.random() * 40, 0.05, 'sine', 0.07 * power); click(0.03, 0.1 * power, 3200); },
  /** A switch flipped. */
  toggle(on = true) { click(0, 0.12, on ? 3600 : 2200); tone(on ? 880 : 660, 0.05, 'sine', 0.03, 0.01); },
  /** Not allowed: two low blips. */
  deny() { tone(155, 0.09, 'square', 0.04); tone(130, 0.12, 'square', 0.04, 0.1); },
  heal() { [440, 554, 659].forEach((f, i) => tone(f, 0.4, 'sine', 0.1, i * 0.08)); },
  /** Drinking a potion: three gulps and a fizz. */
  potion() {
    for (let i = 0; i < 3; i++) tone(rnd(180, 230), 0.09, 'sine', 0.09, i * 0.14, 90);
    for (let i = 0; i < 6; i++) tone(rnd(900, 1800), 0.05, 'sine', 0.025, 0.45 + i * 0.05, 300);
    [523, 659, 784].forEach((f, i) => tone(f, 0.35, 'sine', 0.06, 0.6 + i * 0.07, 0, { wet: 0.4 }));
  },
  achievement() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.45, 'triangle', 0.11, i * 0.09)); tone(1976, 0.8, 'sine', 0.04, 0.38); },
  whoosh() { click(0, 0.2, 900); click(0.05, 0.15, 700); },
  /** Parchment: a sheet slides open. */
  open() { hiss(0, 0.16, { freq: 3400, to: 1600, q: 0.7, vol: 0.05, attack: 0.03 }); },
  /** Turning a page. */
  page() { hiss(0, 0.12, { freq: 2600, to: 4200, q: 0.8, vol: 0.06, attack: 0.02 }); hiss(0.1, 0.1, { freq: 3800, to: 1800, q: 0.8, vol: 0.04 }); },
  /** Gear buckled on: a metallic clink. */
  equip() { tone(1830, 0.18, 'sine', 0.05); tone(2650, 0.14, 'sine', 0.035, 0.005); click(0, 0.2, 4200); click(0.09, 0.12, 3000); },
  /** Something sparkly: learning a talent. */
  talent() {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.6, 'sine', 0.06, i * 0.05, 0, { wet: 0.6 }));
    hiss(0, 0.6, { type: 'highpass', freq: 6000, vol: 0.03, attack: 0.1 });
    tone(392, 0.8, 'triangle', 0.06, 0, 0, { attack: 0.05 });
  },
  /** A horn call: a new quest. */
  quest() { horn(196, 0, 0.45); horn(294, 0.38, 0.8); },
  /** Fanfare: quest complete. */
  questDone() {
    horn(262, 0, 0.22); horn(330, 0.18, 0.22); horn(392, 0.36, 0.22);
    horn(523, 0.54, 1.1, 0.1); horn(659, 0.54, 1.1, 0.05);
    bell(1047, 0.6, 0.05);
  },
  /** A landmark or region found: chiming bells. */
  discover() { [0, 0.12, 0.24].forEach((w, i) => bell([880, 1109, 1319][i], w, 0.06)); hiss(0, 0.9, { type: 'highpass', freq: 5000, vol: 0.025, attack: 0.3 }); },
  /** Someone joins the party: a warm chord. */
  join() { [262, 330, 392, 494].forEach((f, i) => tone(f, 1.2, 'triangle', 0.06, i * 0.06, 0, { attack: 0.08, wet: 0.5 })); },
  /** Someone leaves: falling minor notes. */
  part() { [392, 311, 262].forEach((f, i) => tone(f, 0.6, 'triangle', 0.06, i * 0.2, 0, { wet: 0.5 })); },
  /** Making camp: fire catches and crackles. */
  camp() {
    hiss(0, 0.7, { type: 'lowpass', freq: 300, to: 2400, vol: 0.12, attack: 0.25 });
    for (let i = 0; i < 9; i++) click(0.4 + Math.random() * 1.4, rnd(0.1, 0.25), rnd(1500, 4000));
  },
  /** Dawn: birdsong. */
  dawn() {
    for (let i = 0; i < 4; i++) {
      const w = i * 0.22 + Math.random() * 0.08;
      const f = rnd(2400, 3200);
      tone(f, 0.09, 'sine', 0.04, w, 900);
      tone(f * 1.1, 0.07, 'sine', 0.03, w + 0.1, -500);
    }
    [392, 494, 587].forEach((f, i) => tone(f, 1.4, 'sine', 0.04, 0.2 + i * 0.1, 0, { attack: 0.3, wet: 0.5 }));
  },
  /** Class ability: steel rings, daggers flick, fire roars, a lute strums. */
  cast(cls: ClassId) {
    switch (cls) {
      case 'warrior':
        hiss(0, 0.25, { type: 'highpass', freq: 4000, to: 7000, vol: 0.08 });
        tone(2400, 0.7, 'sine', 0.04, 0.05, 0, { wet: 0.4 }); tone(3610, 0.5, 'sine', 0.02, 0.05);
        break;
      case 'rogue':
        hiss(0, 0.09, { freq: 1500, to: 4500, q: 1.5, vol: 0.12 });
        hiss(0.11, 0.09, { freq: 1800, to: 5000, q: 1.5, vol: 0.1 });
        break;
      case 'mage':
        hiss(0, 0.55, { freq: 300, to: 3000, q: 0.9, vol: 0.16, attack: 0.08 });
        tone(110, 0.5, 'sawtooth', 0.04, 0, 220, { filter: 900 });
        break;
      case 'bard':
        [392, 494, 587, 784].forEach((f, i) => tone(f, 0.7, 'triangle', 0.06, i * 0.03, 0, { wet: 0.4 }));
        break;
    }
  },
  /** Shield or guard catches a blow. */
  block() { [820, 1230, 1650].forEach((f) => tone(f, 0.3, 'sine', 0.04)); click(0, 0.35, 2000); },
  /** Stunned: birdies circling. */
  stun() { for (let i = 0; i < 3; i++) tone(2800, 0.07, 'sine', 0.035, i * 0.12, 600); },
  /** A buff lands: rising shimmer. */
  buff() { tone(400, 0.5, 'sine', 0.06, 0, 800, { wet: 0.5 }); hiss(0.1, 0.5, { type: 'highpass', freq: 5000, vol: 0.03, attack: 0.2 }); },
  /** Chains of force snap shut. */
  chains() { for (let i = 0; i < 4; i++) { click(i * 0.06, 0.25, rnd(2500, 4500)); tone(rnd(1200, 1600), 0.08, 'square', 0.02, i * 0.06); } },
  /** A foe announces itself, by kind. */
  roar(kind: EnemyKind) {
    switch (kind) {
      case 'beast':
        tone(85, 0.8, 'sawtooth', 0.09, 0, -25, { attack: 0.08, vibrato: 23, filter: 700 });
        hiss(0, 0.7, { type: 'lowpass', freq: 600, vol: 0.08, attack: 0.1 });
        break;
      case 'undead':
        tone(310, 1.2, 'sine', 0.06, 0, -140, { attack: 0.3, vibrato: 5, wet: 0.7 });
        tone(318, 1.2, 'sine', 0.04, 0.05, -150, { attack: 0.3, vibrato: 6, wet: 0.7 });
        break;
      case 'spirit':
        tone(660, 1.3, 'sine', 0.05, 0, 330, { attack: 0.4, vibrato: 7, wet: 0.9 });
        hiss(0, 1.2, { freq: 1400, to: 700, q: 4, vol: 0.05, attack: 0.4, wet: 0.8 });
        break;
      case 'monster':
        tone(60, 1.0, 'sawtooth', 0.1, 0, -15, { attack: 0.1, vibrato: 12, filter: 500 });
        hiss(0, 0.9, { type: 'lowpass', freq: 900, to: 300, vol: 0.12, attack: 0.15 });
        break;
      default:
        tone(180, 0.35, 'sawtooth', 0.07, 0, 30, { attack: 0.03, filter: 1100 });
        tone(200, 0.4, 'sawtooth', 0.05, 0.25, -40, { attack: 0.03, filter: 1100 });
        click(0.02, 0.3, 2400);
    }
  },
  /** You fall: a low, darkening tone. */
  downed() { tone(220, 1.6, 'sine', 0.08, 0, -150, { attack: 0.1, wet: 0.7 }); tone(110, 1.8, 'triangle', 0.06, 0.1, -60, { wet: 0.7 }); },
  /** A blade or claw cutting air past its target. */
  swish() { click(0, 0.18, 1800); click(0.04, 0.12, 1200); click(0.08, 0.08, 800); },
  /** Heavy impact: a critical blow. */
  smash() { click(0, 0.7, 300); tone(80, 0.3, 'square', 0.08, 0, -40); tone(160, 0.2, 'sawtooth', 0.05, 0.02, -90); },
  /** A foe falls. */
  slay() { click(0, 0.6, 250); tone(196, 0.5, 'sawtooth', 0.06, 0, -120); [392, 494, 587, 784].forEach((f, i) => tone(f, 0.45, 'triangle', 0.1, 0.22 + i * 0.08)); },
};
