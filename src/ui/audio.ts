// Tiny WebAudio synth so the game has satisfying sound with zero asset weight.
// Sound effects and music each have their own gain bus, so volumes are independent.
import { settings } from '../ai/settings';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

/** Shared context; created lazily (browsers only allow audio after a user gesture). */
export function audioCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(ctx.destination);
      musicBus.connect(ctx.destination);
      applyVolumes();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function applyVolumes() {
  if (!ctx || !sfxBus || !musicBus) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sound ? settings.sfxVol : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? settings.musicVol * 0.5 : 0, t, 0.3);
}

export function musicOut(): GainNode | null {
  audioCtx();
  return musicBus;
}

function sfx_ctx() {
  if (!settings.sound || settings.sfxVol <= 0) return null;
  return audioCtx();
}

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', vol = 0.15, when = 0, slide = 0) {
  const c = sfx_ctx();
  if (!c || !sfxBus) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
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
  step() { click(0, 0.12, 600 + Math.random() * 200); },
  hit() { click(0, 0.5, 400); tone(110, 0.15, 'square', 0.06, 0, -40); },
  coin() { tone(1319, 0.08, 'square', 0.05); tone(1760, 0.18, 'square', 0.05, 0.06); },
  level() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, i * 0.1)); },
  tap() { click(0, 0.08, 3000); },
  heal() { [440, 554, 659].forEach((f, i) => tone(f, 0.4, 'sine', 0.1, i * 0.08)); },
  achievement() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.45, 'triangle', 0.11, i * 0.09)); tone(1976, 0.8, 'sine', 0.04, 0.38); },
  whoosh() { click(0, 0.2, 900); click(0.05, 0.15, 700); },
};
