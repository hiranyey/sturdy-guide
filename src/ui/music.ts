// Procedural scene music. Each mood is a little generative band: a pad that
// follows a chord progression, a bass line, an arpeggio, an improvised lead
// melody and (for lively scenes) hand drums — all scheduled ahead on the audio
// clock so timing stays tight. Moods crossfade as you travel.
import { audioCtx, musicOut, musicVerbIn } from './audio';
import { settings } from '../ai/settings';
import { setAmbience, ambienceFor, type SceneCtx } from './ambience';

export type { SceneCtx } from './ambience';

export type Mood =
  | 'title' | 'plains' | 'forest' | 'swamp' | 'highlands' | 'snow' | 'desert' | 'coast'
  | 'village' | 'market' | 'depths' | 'sacred' | 'arcane' | 'night'
  | 'combat' | 'boss' | 'camp';

type Inst = 'pluck' | 'lute' | 'harp' | 'bell' | 'kalimba' | 'flute' | 'brass';

interface MoodDef {
  bpm: number;
  /** tonic, Hz (around the third octave) */
  root: number;
  /** melody scale, semitones from the root */
  scale: number[];
  /** chords as semitones from the root; one per `chordBars` bars */
  prog: number[][];
  chordBars: number;
  pad?: { wave: OscillatorType; vol: number; cutoff: number };
  /** 16 steps: x = chord root, o = fifth, h = octave */
  bass?: { pat: string; wave: OscillatorType; vol: number };
  /** chord tones on each x, rising and falling */
  arp?: { inst: Inst; pat: string; vol: number; oct: number };
  /** density: chance a bar has a phrase; rhythm: chance of a note on each eighth */
  lead?: { inst: Inst; density: number; rhythm: number; oct: number; vol: number };
  drums?: { kick?: string; snare?: string; hat?: string; frame?: string; vol: number };
  /** reverb send */
  wet: number;
}

// Scales
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PENTA = [0, 2, 4, 7, 9];
const MPENTA = [0, 3, 5, 7, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
// Chords
const I = [0, 4, 7], ii = [2, 5, 9], iii = [4, 7, 11], IV = [5, 9, 12], V = [7, 11, 14], vi = [9, 12, 16];
const i = [0, 3, 7], iv = [5, 8, 12], III = [3, 7, 10], VI = [8, 12, 15], VII = [10, 14, 17];
const II = [2, 6, 9], bII = [1, 5, 8], Vmaj = [7, 11, 14], dim2 = [2, 5, 8];

export const MOODS: Record<Mood, MoodDef> = {
  title: {
    bpm: 72, root: 146.8, scale: MAJOR, prog: [I, vi, IV, V], chordBars: 2,
    pad: { wave: 'sawtooth', vol: 0.05, cutoff: 900 },
    bass: { pat: 'x.......o.......', wave: 'sine', vol: 0.12 },
    arp: { inst: 'harp', pat: 'x...x...x...x...', vol: 0.05, oct: 1 },
    lead: { inst: 'flute', density: 0.7, rhythm: 0.35, oct: 1, vol: 0.06 },
    wet: 0.6,
  },
  plains: {
    bpm: 84, root: 196, scale: PENTA, prog: [I, IV, I, V], chordBars: 2,
    pad: { wave: 'triangle', vol: 0.05, cutoff: 1400 },
    bass: { pat: 'x.......x.......', wave: 'sine', vol: 0.1 },
    arp: { inst: 'pluck', pat: 'x..x..x.x..x..x.', vol: 0.035, oct: 0 },
    lead: { inst: 'flute', density: 0.55, rhythm: 0.4, oct: 1, vol: 0.055 },
    wet: 0.45,
  },
  forest: {
    bpm: 70, root: 220, scale: DORIAN, prog: [i, IV, i, VII], chordBars: 2,
    pad: { wave: 'sine', vol: 0.06, cutoff: 1000 },
    bass: { pat: 'x...............', wave: 'sine', vol: 0.1 },
    arp: { inst: 'harp', pat: 'x...x...x...x.x.', vol: 0.04, oct: 0 },
    lead: { inst: 'kalimba', density: 0.5, rhythm: 0.45, oct: 1, vol: 0.05 },
    wet: 0.65,
  },
  swamp: {
    bpm: 60, root: 164.8, scale: HIJAZ, prog: [i, bII, i, VII], chordBars: 2,
    pad: { wave: 'triangle', vol: 0.06, cutoff: 600 },
    bass: { pat: 'x.....x.........', wave: 'triangle', vol: 0.1 },
    lead: { inst: 'bell', density: 0.3, rhythm: 0.3, oct: 0, vol: 0.04 },
    drums: { frame: 'x.......x..x....', vol: 0.5 },
    wet: 0.7,
  },
  highlands: {
    bpm: 76, root: 146.8, scale: DORIAN, prog: [i, VII, IV, i], chordBars: 2,
    pad: { wave: 'sawtooth', vol: 0.045, cutoff: 800 },
    bass: { pat: 'x.......o.......', wave: 'triangle', vol: 0.1 },
    lead: { inst: 'flute', density: 0.65, rhythm: 0.5, oct: 1, vol: 0.06 },
    drums: { frame: 'x...x...x...x.x.', vol: 0.4 },
    wet: 0.65,
  },
  snow: {
    bpm: 56, root: 164.8, scale: MINOR, prog: [i, VI, III, VII], chordBars: 2,
    pad: { wave: 'sine', vol: 0.06, cutoff: 1800 },
    bass: { pat: 'x...............', wave: 'sine', vol: 0.07 },
    lead: { inst: 'bell', density: 0.4, rhythm: 0.3, oct: 1, vol: 0.04 },
    wet: 0.85,
  },
  desert: {
    bpm: 80, root: 146.8, scale: HIJAZ, prog: [I, bII, I, iv], chordBars: 2,
    pad: { wave: 'triangle', vol: 0.04, cutoff: 1100 },
    bass: { pat: 'x...............', wave: 'triangle', vol: 0.11 },
    lead: { inst: 'lute', density: 0.65, rhythm: 0.55, oct: 1, vol: 0.06 },
    drums: { frame: 'x..x..x.x...x...', vol: 0.5 },
    wet: 0.5,
  },
  coast: {
    bpm: 66, root: 220, scale: LYDIAN, prog: [I, V, vi, IV], chordBars: 2,
    pad: { wave: 'sine', vol: 0.06, cutoff: 1200 },
    bass: { pat: 'x.......x.......', wave: 'sine', vol: 0.09 },
    arp: { inst: 'harp', pat: 'x.x.x.x.x.x.x.x.', vol: 0.03, oct: 0 },
    lead: { inst: 'flute', density: 0.35, rhythm: 0.3, oct: 1, vol: 0.05 },
    wet: 0.75,
  },
  village: {
    bpm: 104, root: 261.6, scale: MAJOR, prog: [I, IV, V, I], chordBars: 1,
    pad: { wave: 'triangle', vol: 0.035, cutoff: 1300 },
    bass: { pat: 'x...o...x...o...', wave: 'triangle', vol: 0.1 },
    arp: { inst: 'lute', pat: 'x.xx.xx.x.xx.xx.', vol: 0.03, oct: 0 },
    lead: { inst: 'flute', density: 0.75, rhythm: 0.55, oct: 1, vol: 0.055 },
    drums: { frame: 'x...x...x...x...', hat: '..x...x...x...x.', vol: 0.4 },
    wet: 0.4,
  },
  market: {
    bpm: 120, root: 174.6, scale: MAJOR, prog: [I, vi, ii, V], chordBars: 1,
    pad: { wave: 'triangle', vol: 0.03, cutoff: 1400 },
    bass: { pat: 'x..xo...x..xo...', wave: 'triangle', vol: 0.1 },
    arp: { inst: 'lute', pat: 'x.x.x.x.x.x.x.x.', vol: 0.03, oct: 1 },
    lead: { inst: 'pluck', density: 0.8, rhythm: 0.65, oct: 1, vol: 0.05 },
    drums: { kick: 'x.......x.......', frame: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', vol: 0.45 },
    wet: 0.35,
  },
  depths: {
    bpm: 54, root: 130.8, scale: HARM, prog: [i, dim2, i, Vmaj], chordBars: 2,
    pad: { wave: 'triangle', vol: 0.07, cutoff: 500 },
    bass: { pat: 'x...............', wave: 'sine', vol: 0.12 },
    lead: { inst: 'bell', density: 0.25, rhythm: 0.25, oct: 0, vol: 0.035 },
    drums: { kick: 'x.......x.......', vol: 0.35 },
    wet: 0.9,
  },
  sacred: {
    bpm: 60, root: 174.6, scale: LYDIAN, prog: [I, II, I, iii], chordBars: 2,
    pad: { wave: 'sawtooth', vol: 0.04, cutoff: 1000 },
    arp: { inst: 'harp', pat: 'x.......x...x...', vol: 0.04, oct: 1 },
    lead: { inst: 'bell', density: 0.45, rhythm: 0.3, oct: 1, vol: 0.04 },
    wet: 0.9,
  },
  arcane: {
    bpm: 66, root: 233.1, scale: LYDIAN, prog: [I, II, iii, II], chordBars: 2,
    pad: { wave: 'sine', vol: 0.06, cutoff: 1600 },
    bass: { pat: 'x.......x.......', wave: 'sine', vol: 0.08 },
    arp: { inst: 'kalimba', pat: 'x.x.x.x.x.x.x.x.', vol: 0.035, oct: 1 },
    lead: { inst: 'bell', density: 0.3, rhythm: 0.3, oct: 1, vol: 0.035 },
    wet: 0.85,
  },
  night: {
    bpm: 56, root: 220, scale: MPENTA, prog: [i, VI, III, VII], chordBars: 2,
    pad: { wave: 'sine', vol: 0.06, cutoff: 900 },
    bass: { pat: 'x...............', wave: 'sine', vol: 0.08 },
    lead: { inst: 'harp', density: 0.35, rhythm: 0.3, oct: 1, vol: 0.045 },
    wet: 0.8,
  },
  combat: {
    bpm: 132, root: 146.8, scale: MINOR, prog: [i, VI, VII, i], chordBars: 1,
    pad: { wave: 'sawtooth', vol: 0.035, cutoff: 1300 },
    bass: { pat: 'x.x.x.x.x.x.x.xo', wave: 'sawtooth', vol: 0.09 },
    lead: { inst: 'brass', density: 0.6, rhythm: 0.45, oct: 1, vol: 0.05 },
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: '..x...x...x...x.', vol: 0.55 },
    wet: 0.4,
  },
  boss: {
    bpm: 142, root: 130.8, scale: HARM, prog: [i, VI, iv, Vmaj], chordBars: 1,
    pad: { wave: 'sawtooth', vol: 0.045, cutoff: 1500 },
    bass: { pat: 'xxx.x.x.xxx.x.xo', wave: 'sawtooth', vol: 0.1 },
    arp: { inst: 'pluck', pat: 'x.x.x.x.x.x.x.x.', vol: 0.025, oct: 1 },
    lead: { inst: 'brass', density: 0.75, rhythm: 0.55, oct: 1, vol: 0.055 },
    drums: { kick: 'x.x.x..xx.x.x..x', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', vol: 0.6 },
    wet: 0.45,
  },
  camp: {
    bpm: 70, root: 196, scale: PENTA, prog: [I, vi, IV, I], chordBars: 2,
    pad: { wave: 'triangle', vol: 0.045, cutoff: 800 },
    bass: { pat: 'x.......o.......', wave: 'sine', vol: 0.08 },
    arp: { inst: 'lute', pat: 'x..x..x.x..x..x.', vol: 0.035, oct: 0 },
    lead: { inst: 'flute', density: 0.4, rhythm: 0.35, oct: 1, vol: 0.045 },
    wet: 0.6,
  },
};

/** Which music suits a place: special places first, then night, then the land itself. */
export function moodFor(sc: SceneCtx): Mood {
  switch (sc.poi) {
    case 'village': return 'village';
    case 'market': return 'market';
    case 'ruin': case 'cave': return 'depths';
    case 'shrine': case 'grove': return 'sacred';
    case 'tower': return 'arcane';
  }
  if (sc.time === 'night') return 'night';
  switch (sc.biome) {
    case 'forest': return 'forest';
    case 'swamp': return 'swamp';
    case 'hills': case 'mountain': return 'highlands';
    case 'snow': return 'snow';
    case 'desert': return 'desert';
    case 'sand': case 'water': case 'deep': return 'coast';
    default: return 'plains';
  }
}

/** Set the music and the ambience for a place. */
export function scene(sc: SceneCtx) {
  setMood(moodFor(sc));
  setAmbience(ambienceFor(sc));
}

const semi = (f: number, n: number) => f * 2 ** (n / 12);

// ---------------- Instruments ----------------

function env(c: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function osc(c: AudioContext, type: OscillatorType, f: number, t: number, end: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.start(t);
  o.stop(end);
  return o;
}

function playInst(c: AudioContext, out: AudioNode, inst: Inst, f: number, t: number, dur: number, vol: number) {
  switch (inst) {
    case 'pluck': {
      const g = env(c, t, vol, 0.005, Math.max(0.3, dur * 1.4));
      const lp = c.createBiquadFilter();
      lp.frequency.value = 3200;
      osc(c, 'triangle', f, t, t + dur * 1.5 + 0.4).connect(lp).connect(g).connect(out);
      break;
    }
    case 'lute': {
      const g = env(c, t, vol, 0.004, 0.9);
      const lp = c.createBiquadFilter();
      lp.frequency.setValueAtTime(3500, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
      lp.Q.value = 2;
      osc(c, 'sawtooth', f, t, t + 1).connect(lp).connect(g).connect(out);
      break;
    }
    case 'harp': {
      const g = env(c, t, vol, 0.005, 1.6);
      osc(c, 'triangle', f, t, t + 1.7).connect(g).connect(out);
      const g2 = env(c, t, vol * 0.3, 0.005, 0.8);
      osc(c, 'sine', f * 2, t, t + 0.9).connect(g2).connect(out);
      break;
    }
    case 'bell': {
      const g = env(c, t, vol, 0.004, 2.2);
      osc(c, 'sine', f, t, t + 2.3).connect(g).connect(out);
      const g2 = env(c, t, vol * 0.3, 0.004, 1);
      osc(c, 'sine', f * 2.76, t, t + 1.1).connect(g2).connect(out);
      break;
    }
    case 'kalimba': {
      const g = env(c, t, vol, 0.003, 0.9);
      osc(c, 'sine', f, t, t + 1).connect(g).connect(out);
      const g2 = env(c, t, vol * 0.25, 0.003, 0.12);
      osc(c, 'sine', f * 5.4, t, t + 0.2).connect(g2).connect(out);
      break;
    }
    case 'flute': {
      const len = Math.max(0.2, dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
      g.gain.setValueAtTime(vol, t + len);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.18);
      const o = osc(c, 'sine', f, t, t + len + 0.25);
      const lfo = osc(c, 'sine', 5.2, t, t + len + 0.25);
      const lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.25);
      lfo.connect(lg).connect(o.frequency);
      o.connect(g).connect(out);
      const g2 = c.createGain();
      g2.gain.value = 0.25;
      osc(c, 'triangle', f, t, t + len + 0.25).connect(g2).connect(g);
      break;
    }
    case 'brass': {
      const len = Math.max(0.15, dur);
      const lp = c.createBiquadFilter();
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(2200, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(1100, t + len);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
      g.gain.setValueAtTime(vol * 0.8, t + len);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.12);
      osc(c, 'sawtooth', f, t, t + len + 0.2).connect(lp).connect(g).connect(out);
      break;
    }
  }
}

let noiseBuf: AudioBuffer | null = null;
function noiseHit(c: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, vol: number, decay: number) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = env(c, t, vol, 0.002, decay);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + decay + 0.05);
}

function drum(c: AudioContext, out: AudioNode, kind: 'kick' | 'snare' | 'hat' | 'frame', t: number, vol: number) {
  switch (kind) {
    case 'kick': {
      const o = osc(c, 'sine', 150, t, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      o.connect(env(c, t, 0.5 * vol, 0.003, 0.25)).connect(out);
      break;
    }
    case 'snare':
      noiseHit(c, out, t, 'bandpass', 1800, 0.25 * vol, 0.15);
      osc(c, 'triangle', 200, t, t + 0.1).connect(env(c, t, 0.12 * vol, 0.002, 0.08)).connect(out);
      break;
    case 'hat':
      noiseHit(c, out, t, 'highpass', 7000, 0.08 * vol, 0.04);
      break;
    case 'frame': {
      const o = osc(c, 'sine', 120, t, t + 0.35);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      o.connect(env(c, t, 0.3 * vol, 0.003, 0.3)).connect(out);
      noiseHit(c, out, t, 'lowpass', 900, 0.08 * vol, 0.08);
      break;
    }
  }
}

// ---------------- The band ----------------

class Song {
  private out: GainNode;
  private step = 0;
  private next: number;
  private timer: ReturnType<typeof setInterval>;
  private deg: number;
  private notes = new Map<number, { deg: number; len: number }>();
  private arpIdx = 0;
  private ducked = 1;

  constructor(private c: AudioContext, readonly mood: Mood, private def: MoodDef, dest: AudioNode, verb: AudioNode | null) {
    this.out = c.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(dest);
    if (verb) {
      const send = c.createGain();
      send.gain.value = def.wet;
      this.out.connect(send).connect(verb);
    }
    this.out.gain.setTargetAtTime(1, c.currentTime, 1.0);
    this.deg = def.scale.length + 2;
    this.next = c.currentTime + 0.15;
    this.timer = setInterval(() => this.tick(), 60);
  }

  private get stepDur() { return 60 / this.def.bpm / 4; }

  private tick() {
    while (this.next < this.c.currentTime + 0.3) {
      this.play(this.step, this.next);
      this.next += this.stepDur;
      this.step++;
    }
  }

  stop(fade = 1.6) {
    clearInterval(this.timer);
    this.out.gain.cancelScheduledValues(this.c.currentTime);
    this.out.gain.setTargetAtTime(0.0001, this.c.currentTime, fade / 3);
    const out = this.out;
    setTimeout(() => out.disconnect(), (fade + 4) * 1000);
  }

  /** Dip under a stinger, then come back. */
  duck(seconds: number) {
    const t = this.c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.25 * this.ducked, t, 0.1);
    this.out.gain.setTargetAtTime(this.ducked, t + seconds, 0.6);
  }

  private chordAt(bar: number) {
    const d = this.def;
    return d.prog[Math.floor(bar / d.chordBars) % d.prog.length];
  }

  private play(step: number, t: number) {
    const d = this.def, c = this.c, out = this.out;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = this.chordAt(bar);
    const sd = this.stepDur;

    // Pad: a new chord every `chordBars` bars, overlapping the last one.
    if (s16 === 0 && bar % d.chordBars === 0 && d.pad) {
      const len = sd * 16 * d.chordBars;
      for (const n of chord) {
        for (const det of [-6, 6]) {
          const o = osc(c, d.pad.wave, semi(d.root, n), t, t + len + 1.8);
          o.detune.value = det;
          const lp = c.createBiquadFilter();
          lp.frequency.value = d.pad.cutoff;
          const g = c.createGain();
          const v = d.pad.vol / chord.length;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + Math.min(1.2, len / 3));
          g.gain.setValueAtTime(v, t + len);
          g.gain.exponentialRampToValueAtTime(0.0001, t + len + 1.6);
          o.connect(lp).connect(g).connect(out);
        }
      }
    }

    // Bass
    if (d.bass) {
      const ch = d.bass.pat[s16];
      if (ch !== '.' && ch !== undefined) {
        let f = semi(d.root, chord[0] + (ch === 'o' ? 7 : ch === 'h' ? 12 : 0)) / 2;
        if (f < 65) f *= 2;
        const g = env(c, t, d.bass.vol, 0.01, sd * 3.2);
        const o = osc(c, d.bass.wave, f, t, t + sd * 3.5);
        if (d.bass.wave === 'sawtooth') {
          const lp = c.createBiquadFilter();
          lp.frequency.value = 500;
          o.connect(lp).connect(g).connect(out);
        } else o.connect(g).connect(out);
      }
    }

    // Arpeggio: up through the chord and back down.
    if (d.arp && d.arp.pat[s16] === 'x') {
      const seq = [...chord, chord[0] + 12, ...chord.slice(1).reverse()];
      const n = seq[this.arpIdx++ % seq.length];
      playInst(c, out, d.arp.inst, semi(d.root, n + 12 * d.arp.oct), t, sd * 2, d.arp.vol);
    }

    // Lead: a fresh phrase at the top of each bar (or a rest).
    if (d.lead) {
      if (s16 === 0) this.notes = this.phrase(chord);
      const nt = this.notes.get(s16);
      if (nt) {
        const sc = d.scale;
        const semis = sc[((nt.deg % sc.length) + sc.length) % sc.length] + 12 * Math.floor(nt.deg / sc.length);
        playInst(c, out, d.lead.inst, semi(d.root, semis + 12 * (d.lead.oct - 1)), t, nt.len * sd, d.lead.vol);
      }
    }

    // Drums
    if (d.drums) {
      for (const k of ['kick', 'snare', 'hat', 'frame'] as const) {
        const pat = d.drums[k];
        if (pat && pat[s16] === 'x') drum(c, out, k, t, d.drums.vol * (s16 % 4 === 0 ? 1 : 0.75));
      }
    }
  }

  /** A short improvised phrase: a random walk on the scale that starts and ends near chord tones. */
  private phrase(chord: number[]) {
    const d = this.def, lead = d.lead!;
    const notes = new Map<number, { deg: number; len: number }>();
    if (Math.random() > lead.density) return notes;
    const sc = d.scale, n = sc.length;
    const chordPcs = chord.map((x) => ((x % 12) + 12) % 12);
    const isChordTone = (deg: number) => chordPcs.includes(sc[((deg % n) + n) % n] % 12);
    const lo = n, hi = n * 2 + 2;
    const snap = () => {
      for (const off of [0, 1, -1, 2, -2]) if (isChordTone(this.deg + off)) { this.deg += off; return; }
    };
    const steps: number[] = [];
    for (let s = 0; s < 16; s += 2) if (s === 0 ? Math.random() < 0.85 : Math.random() < lead.rhythm) steps.push(s);
    // Occasional pickup sixteenth for life.
    if (steps.length > 2 && Math.random() < 0.3) steps.splice(1, 0, steps[0] + 1);
    steps.forEach((s, k) => {
      if (k === 0) snap();
      else this.deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      if (this.deg < lo) this.deg = lo + 1;
      if (this.deg > hi) this.deg = hi - 1;
      if (k === steps.length - 1) snap();
      const nextS = steps[k + 1] ?? 16;
      notes.set(s, { deg: this.deg, len: Math.min(6, nextS - s) });
    });
    return notes;
  }
}

let song: Song | null = null;
let wanted: Mood = 'title';

export function setMood(m: Mood) {
  wanted = m;
  if (!settings.music) return;
  if (song?.mood === m) return;
  start(m);
}

export function currentMood() { return wanted; }

export function refreshMusic() {
  if (settings.music) start(wanted, true);
  else stop();
}

function stop() {
  song?.stop();
  song = null;
}

function start(m: Mood, force = false) {
  const c = audioCtx();
  const out = musicOut();
  if (!c || !out) return;
  if (song?.mood === m && !force) return;
  stop();
  song = new Song(c, m, MOODS[m], out, musicVerbIn());
}

/** Short musical cues over the current song: a victory fanfare or a defeat lament. */
export function stinger(kind: 'victory' | 'defeat') {
  if (!settings.music) return;
  const c = audioCtx();
  const out = musicOut();
  if (!c || !out) return;
  song?.duck(kind === 'victory' ? 2.2 : 3);
  const g = c.createGain();
  g.gain.value = 1;
  g.connect(out);
  const verb = musicVerbIn();
  if (verb) { const w = c.createGain(); w.gain.value = 0.6; g.connect(w).connect(verb); }
  const t = c.currentTime + 0.05;
  if (kind === 'victory') {
    const root = 261.6;
    [[0, 0.14], [4, 0.14], [7, 0.14], [12, 0.9]].forEach(([n, d], k) => playInst(c, g, 'brass', semi(root, n), t + k * 0.15, d, 0.07));
    [0, 4, 7, 12].forEach((n) => playInst(c, g, 'harp', semi(root, n + 12), t + 0.45, 1, 0.04));
  } else {
    const root = 220;
    [[7, 0.5], [3, 0.5], [2, 0.5], [0, 1.6]].forEach(([n, d], k) => playInst(c, g, 'flute', semi(root, n), t + k * 0.5, d, 0.06));
  }
  setTimeout(() => g.disconnect(), 5000);
}
