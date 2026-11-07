// Procedural ambient music: a soft pad chord plus sparse pentatonic plucks.
// The mood follows the terrain you stand on, and shifts for combat and camp.
import { audioCtx, musicOut } from './audio';
import { settings } from '../ai/settings';
import type { Biome } from '../core/types';

export type Mood = 'calm' | 'mystic' | 'cold' | 'warm' | 'sea' | 'combat' | 'camp';

interface MoodDef { root: number; chord: number[]; scale: number[]; tempo: number; filter: number; wave: OscillatorType }

const MOODS: Record<Mood, MoodDef> = {
  calm: { root: 196, chord: [0, 4, 7, 11], scale: [0, 2, 4, 7, 9, 12, 14, 16], tempo: 2400, filter: 1400, wave: 'triangle' },
  mystic: { root: 174.6, chord: [0, 3, 7, 10], scale: [0, 2, 3, 7, 9, 12, 14, 15], tempo: 2800, filter: 1000, wave: 'sine' },
  cold: { root: 220, chord: [0, 7, 12, 15], scale: [0, 3, 5, 7, 10, 12, 15], tempo: 3200, filter: 1800, wave: 'sine' },
  warm: { root: 164.8, chord: [0, 1, 7, 10], scale: [0, 1, 4, 5, 7, 8, 12], tempo: 2600, filter: 1200, wave: 'triangle' },
  sea: { root: 146.8, chord: [0, 5, 9, 14], scale: [0, 2, 5, 7, 9, 12, 14], tempo: 3000, filter: 900, wave: 'sine' },
  combat: { root: 110, chord: [0, 3, 6, 10], scale: [0, 1, 3, 6, 7, 10, 12], tempo: 700, filter: 2200, wave: 'sawtooth' },
  camp: { root: 130.8, chord: [0, 4, 7, 9], scale: [0, 2, 4, 7, 9, 12], tempo: 3000, filter: 800, wave: 'triangle' },
};

export function moodForBiome(b: Biome): Mood {
  if (b === 'forest' || b === 'swamp') return 'mystic';
  if (b === 'snow' || b === 'mountain') return 'cold';
  if (b === 'desert') return 'warm';
  if (b === 'sand' || b === 'water' || b === 'deep') return 'sea';
  return 'calm';
}

const semi = (root: number, n: number) => root * 2 ** (n / 12);

let current: Mood | null = null;
let voices: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let wanted: Mood = 'calm';

export function setMood(m: Mood) {
  wanted = m;
  if (!settings.music) return;
  if (m === current) return;
  start(m);
}

export function refreshMusic() {
  if (settings.music) start(wanted, true);
  else stop();
}

function stop() {
  const c = audioCtx();
  if (timer) clearTimeout(timer);
  timer = null;
  if (voices && c) {
    const v = voices;
    v.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.6);
    setTimeout(() => v.oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 2500);
  }
  voices = null;
  current = null;
}

function start(m: Mood, force = false) {
  const c = audioCtx();
  const out = musicOut();
  if (!c || !out) return;
  if (m === current && !force) return;
  stop();
  current = m;
  const def = MOODS[m];
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = def.filter;
  gain.connect(filter).connect(out);
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = def.filter * 0.3;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  const oscs: OscillatorNode[] = [lfo];
  def.chord.forEach((n, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sine' : def.wave === 'sawtooth' ? 'triangle' : def.wave;
    o.frequency.value = semi(def.root, n) * (i === 0 ? 0.5 : 1);
    o.detune.value = (i - 1.5) * 4;
    const g = c.createGain();
    g.gain.value = 0.06 / def.chord.length;
    o.connect(g).connect(gain);
    o.start();
    oscs.push(o);
  });
  gain.gain.setTargetAtTime(1, c.currentTime, 1.2);
  voices = { oscs, gain };
  const pluck = () => {
    if (current !== m) return;
    const t = c.currentTime;
    const n = def.scale[Math.floor(Math.random() * def.scale.length)];
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = m === 'combat' ? 'square' : 'triangle';
    o.frequency.value = semi(def.root * 2, n);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(m === 'combat' ? 0.025 : 0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (m === 'combat' ? 0.4 : 1.8));
    o.connect(g).connect(filter);
    o.start(t);
    o.stop(t + 2);
    timer = setTimeout(pluck, def.tempo * (0.6 + Math.random() * 0.9));
  };
  timer = setTimeout(pluck, 800);
}
