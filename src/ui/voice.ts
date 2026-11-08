// Voiced story moments (Deepgram Aura text-to-speech).
//
// Only the moments that carry the story get a real voice: the opening of a
// journey, a new quest, the quest's climax, the result of the hero's own idea
// and its turning point, the "Previously…" recap, and the campfire at the end
// of a day (the narrator reads the recap, the companion speaks their own line).
// Everything else stays silent, or uses the browser's voice when "Read story
// aloud" is on. With no Deepgram key, or if a request fails, the browser voice
// takes over (if enabled).
//
// Voices are cast: the narrator suits the story's tone (or the player's pick),
// and each character has a lasting voice that fits how the storyteller says
// they sound (feminine or masculine, young or mature, deep). Lines in quotes are
// spoken by whoever says them; the narration around them stays with the narrator.
import { settings } from '../ai/settings';
import type { Tone, VoiceHint } from '../core/types';
import { hashString } from '../core/rng';
import { audioCtx, voiceOut, duck } from './audio';
import { speak, stopSpeech } from './prefs';
import { toast } from './dom';

/** Narrator voices that suit a storyteller (Deepgram Aura-2, English). "auto" follows the story's tone. */
export const NARRATORS: [string, string][] = [
  ['auto', 'Matches the story (heroic, grim or whimsical)'],
  ['draco', 'Draco · British, warm'],
  ['athena', 'Athena · calm, mature'],
  ['pandora', 'Pandora · British, soft'],
  ['pluto', 'Pluto · deep, calm'],
  ['zeus', 'Zeus · deep, smooth'],
  ['cora', 'Cora · melodic'],
  ['ophelia', 'Ophelia · bright, playful'],
];
/** The narrator for each tone when set to "auto". */
export const TONE_NARRATOR: Record<Tone, string> = { heroic: 'draco', grim: 'pluto', whimsical: 'ophelia' };

/** Character voices by how they sound (Deepgram's own descriptions). */
const CAST: Record<'masculine' | 'feminine', Record<'young' | 'adult' | 'mature', string[]>> = {
  masculine: {
    young: ['apollo', 'aries', 'arcas', 'orion'],
    adult: ['apollo', 'aries', 'arcas', 'hermes', 'hyperion', 'neptune', 'odysseus', 'orion', 'orpheus', 'saturn'],
    mature: ['atlas', 'jupiter', 'mars', 'zeus', 'draco', 'pluto'],
  },
  feminine: {
    young: ['cordelia', 'delia', 'iris', 'luna', 'amalthea'],
    adult: ['andromeda', 'asteria', 'aurora', 'callista', 'cora', 'harmonia', 'helena', 'janus', 'juno', 'minerva', 'ophelia', 'phoebe', 'selene', 'thalia', 'theia', 'vesta'],
    mature: ['athena', 'hera', 'helena', 'vesta', 'pandora'],
  },
};
const DEEP = ['jupiter', 'mars', 'pluto', 'zeus'];

let tone: Tone = 'heroic';
/** The journey's tone, for the "auto" narrator. */
export function setStoryTone(t: Tone) { tone = t; }

export const DG_MAX_CHARS = 2000;

/** A line to speak; no voice = the narrator. */
export interface Line { text: string; voice?: string }

export const voiceReady = () => settings.voiceMoments && settings.dgKey.trim().length > 0;
export function narrator(): string {
  const pick = settings.narrator;
  return pick !== 'auto' && NARRATORS.some(([v]) => v === pick) ? pick : TONE_NARRATOR[tone];
}

/** A character's own voice: the same every time for a name, fits how they sound, never the narrator's. */
export function voiceFor(name: string, hint: VoiceHint = {}): string {
  const genders = hint.gender ? [hint.gender] : (['masculine', 'feminine'] as const);
  let pool = hint.deep && hint.gender !== 'feminine'
    ? DEEP
    : genders.flatMap((g) => CAST[g][hint.age ?? 'adult']);
  pool = [...new Set(pool)];
  const free = pool.filter((v) => v !== narrator());
  const cast = free.length ? free : pool;
  return cast[hashString(name) % cast.length];
}

export interface Speaker { name: string; voice?: VoiceHint }

/** Best guess at how someone sounds from the pronouns a scene uses for them (for scenes written without a voice). */
export function guessVoice(text: string): VoiceHint | undefined {
  const she = (text.match(/\b(she|her|hers|herself)\b/gi) ?? []).length;
  const he = (text.match(/\b(he|him|his|himself)\b/gi) ?? []).length;
  const old = /\b(old|elder|aged|grey-haired|ancient|granny|grandfather|grandmother|crone|old nan)\b/i.test(text);
  const young = /\b(child|girl|boy|kid|apprentice|young|youth|urchin)\b/i.test(text);
  const out: VoiceHint = {};
  if (she > he) out.gender = 'feminine';
  else if (he > she) out.gender = 'masculine';
  if (old) out.age = 'mature';
  else if (young) out.age = 'young';
  return Object.keys(out).length ? out : undefined;
}

/**
 * Split story text into lines for the cast: quoted speech goes to whoever says
 * it (a speaker named in the same sentence, else `main`), narration to the
 * narrator. With `bare`, text without quotes is spoken by `main` (a campfire
 * line, "Bram: We did well.").
 */
export function castLines(text: string, speakers: Speaker[], main?: Speaker | null, bare = false): Line[] {
  const voiceOf = (sp: Speaker) => voiceFor(sp.name, sp.voice);
  const firstName = (n: string) => n.split(/[\s,]/)[0];
  const lines: Line[] = [];
  const push = (t: string, voice?: string) => {
    const clean = t.replace(/\s+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(clean)) return;
    const last = lines[lines.length - 1];
    if (last && last.voice === voice) last.text += ` ${clean}`;
    else lines.push(voice ? { text: clean, voice } : { text: clean });
  };
  const quote = /[“"]([^”"]+)[”"]/g;
  if (!quote.test(text)) {
    if (bare && main) {
      const m = text.match(new RegExp(`^\\W*${firstName(main.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:—]{0,30}[:—]\\s*(.+)$`, 's'));
      push(m ? m[1] : text, voiceOf(main));
    } else push(text);
    return lines;
  }
  quote.lastIndex = 0;
  let at = 0;
  for (let m: RegExpExecArray | null; (m = quote.exec(text)); ) {
    const before = text.slice(at, m.index);
    const after = text.slice(quote.lastIndex).split(/(?<=[.!?])\s/)[0] ?? '';
    const lead = before.trim().split(/(?<=[.!?])\s/).pop() ?? '';
    const near = `${lead} ${after}`;
    // the hero's own words stay with the narrator ("you say", "you ask")
    const hero = /\byou (say|ask|shout|call|reply|whisper|answer|tell|cry|mutter)/i.test(near);
    // whoever is named just before the quote, else just after it, else the scene's character
    const named = (t: string) => speakers.find((sp) => t.includes(firstName(sp.name)));
    const who = named(lead) ?? named(after) ?? (hero ? null : main ?? null);
    push(before);
    push(m[1], who ? voiceOf(who) : undefined);
    at = quote.lastIndex;
  }
  push(text.slice(at));
  return lines;
}

/** Text as it should be spoken: no emoji or symbols, no stage markup, within the API limit. */
export function speakable(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}★☆☠♥✓✗]/gu, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DG_MAX_CHARS);
}

const cache = new Map<string, Promise<AudioBuffer>>();
const MAX_CACHE = 24;

async function fetchVoice(text: string, voice: string): Promise<AudioBuffer> {
  const c = audioCtx();
  if (!c) throw new Error('no audio');
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=aura-2-${voice}-en`, {
    method: 'POST',
    headers: { Authorization: `Token ${settings.dgKey.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = new Error(`Deepgram ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return c.decodeAudioData(await res.arrayBuffer());
}

/** Start fetching a line's audio (reused if asked again). */
function load(line: Line): Promise<AudioBuffer> {
  const voice = line.voice ?? narrator();
  const k = `${voice}|${line.text}`;
  let p = cache.get(k);
  if (!p) {
    p = fetchVoice(line.text, voice);
    p.catch(() => cache.delete(k));
    cache.set(k, p);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return p;
}

let run = 0;
let playing: AudioBufferSourceNode | null = null;
let warned = false;

/** Stop any voice, Deepgram or browser. */
export function hush() {
  run++;
  try { playing?.stop(); } catch { /* already stopped */ }
  playing = null;
  duck(false);
  stopSpeech();
}

/** An ordinary line: browser voice only, and only with "Read story aloud" on. */
export function say(text: string) {
  hush();
  speak(text);
}

/**
 * A key story moment: voiced by Deepgram when set up, line by line in order
 * (all fetched at once so there are no gaps); otherwise the browser voice.
 */
export async function narrate(lines: (Line | string | null | undefined)[]): Promise<void> {
  const list = lines
    .map((l) => (typeof l === 'string' ? { text: l } : l))
    .filter((l): l is Line => !!l && !!speakable(l.text))
    .map((l) => ({ ...l, text: speakable(l.text) }))
    // one request per run of the same voice
    .reduce<Line[]>((out, l) => {
      const last = out[out.length - 1];
      if (last && (last.voice ?? '') === (l.voice ?? '') && last.text.length + l.text.length < DG_MAX_CHARS) last.text += ` ${l.text}`;
      else out.push({ ...l });
      return out;
    }, []);
  if (!list.length) return;
  hush();
  const fallback = () => speak(list.map((l) => l.text).join(' '));
  if (!voiceReady() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return fallback();
  const me = run;
  const jobs = list.map(load);
  try {
    duck(true);
    for (const job of jobs) {
      const buf = await job;
      if (me !== run) return;
      await play(buf, me);
      if (me !== run) return;
    }
  } catch (e) {
    if (me !== run) return;
    const status = (e as { status?: number }).status;
    if ((status === 401 || status === 403) && !warned) {
      warned = true;
      toast('Deepgram turned the key down. Check it in Settings → Voice.', 'bad', 4000);
    }
    fallback();
  } finally {
    if (me === run) duck(false);
  }
}

function play(buf: AudioBuffer, me: number): Promise<void> {
  const c = audioCtx();
  const out = voiceOut();
  if (!c || !out) return Promise.resolve();
  return new Promise((res) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.onended = () => { if (playing === src) playing = null; res(); };
    if (me !== run) return res();
    playing = src;
    src.start();
  });
}

/** Settings → "Test voice". Resolves with an error message, or null when it worked. */
export async function testVoice(): Promise<string | null> {
  hush();
  const line = { text: 'Welcome back, traveller. Your story is waiting.' };
  try {
    const buf = await load(line);
    duck(true);
    await play(buf, run);
    duck(false);
    return null;
  } catch (e) {
    const status = (e as { status?: number }).status;
    return status === 401 || status === 403 ? 'Deepgram turned the key down.' : `Couldn't reach Deepgram (${(e as Error).message}).`;
  }
}
