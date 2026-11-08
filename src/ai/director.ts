// The "AI Dungeon Master". Every function returns validated, clamped data and
// silently falls back to hand-written content if the model is unavailable.
import { chatJson, type ChatMessage } from './openrouter';
import { aiEnabled, settings } from './settings';
import { CLASSES } from '../core/rules';
import { party, chapterLog, turnsIn } from '../core/state';
import { BIOME_INFO } from '../core/world';
import {
  fallbackEvent, fallbackOutcome, fallbackQuest, regionName, regionBlurb, PREMISES, HOOKS, CAMP_BANTER, KIND_EMOJI,
} from '../core/content';
import { pick } from '../core/rng';
import { STATS } from '../core/types';
import { LANDMARKS, type LandmarkKind } from '../core/terrain';
import { talent } from '../core/talents';
import { weatherAt, WEATHER_INFO } from '../core/weather';
import { BLOCK_KINDS, blocksNear, type BlockKind } from '../core/blocks';
import type {
  Biome, Choice, ClassId, EnemyKind, EventContext, GameEvent, GameState, NpcSpec, RegionInfo, RewardKind, Stat, Tone,
} from '../core/types';

const TONE_GUIDE: Record<Tone, string> = {
  heroic: 'bright high-fantasy adventure, hopeful and bold, with moments of wonder',
  grim: 'dark low-fantasy, eerie and tense, but never gratuitous; PG-13',
  whimsical: 'playful fairy-tale whimsy, witty and absurd, like a cosy storybook with teeth',
};

/**
 * How the story reads. Players drop the game when the text is hard work, so by
 * default the storyteller writes plain, easy English; "rich" keeps the old
 * vivid prose for those who switch it on in Settings.
 */
export const PLAIN_STYLE = `Style: PLAIN, EASY English, like a good adventure book for 12-year-olds that adults enjoy too. Many players read English as a second language.
- Short sentences: most under 12 words, never over 18. One idea per sentence. No semicolons.
- Everyday words only. No old-fashioned, poetic or rare words (not "thee", "wrought", "gloaming", "eldritch", "visage", "beckons", "ethereal", "myriad", "amidst").
- No piles of adjectives. At most one comparison or metaphor per reply.
- Say clearly who is there, what is happening, and what is at stake.
- Speech is short and natural, the way people really talk.
- Names are short and easy to say.`;
const RICH_STYLE = 'Style: vivid and concrete, with a sense of wonder; still clear enough to read at a glance.';

export const styleGuide = () => (settings.plainStory === false ? RICH_STYLE : PLAIN_STYLE);

function system(s: { tone: Tone; world: { name: string } }) {
  return `You are the Dungeon Master of HEXBOUND, a turn-based fantasy RPG played in short 5-minute sessions on a phone.
World: "${s.world.name}". Tone: ${TONE_GUIDE[s.tone]}.
Write in second person ("you"), present tense, SHORT. Mobile screens are small: never exceed the word limits.
${styleGuide()}
The game engine rolls all dice and decides all mechanical outcomes. You only narrate and propose options.
Reuse names, places and facts from the story so far whenever it fits — continuity makes the world feel alive.
Reply with ONLY a single JSON object, no markdown.`;
}

function storyContext(s: GameState) {
  const p = s.player;
  return {
    hero: { name: p.name, class: CLASSES[p.cls].name, level: p.level, hp: `${p.hp}/${p.maxHp}`, talents: (p.talents ?? []).map((t) => talent(t)?.name).filter(Boolean) },
    day: s.day,
    quest: s.quest ? { title: s.quest.title, goal: s.quest.description, place: s.quest.place } : null,
    story_so_far: s.summary.slice(-900),
    world_facts: s.flags.slice(-8),
    companions: party(s).map((n) => ({
      name: n.name, role: n.role, personality: n.personality, memories: n.memories.slice(-3),
      ...(n.hero ? { class: CLASSES[n.hero.cls].name, level: n.hero.level, talents: n.hero.talents.map((t) => talent(t)?.name).filter(Boolean) } : {}),
    })),
    recent_events: s.log.slice(-6).map((l) => l.text),
    // the hero's own choices that changed the world: honour them
    turning_points: (s.turns ?? []).slice(-5).map((t) => `${t.title}: ${t.text} (${t.where}, day ${t.day})`),
    blocked_ways_nearby: blocksNear(s),
  };
}

const clip = (v: unknown, n: number, dflt = '') => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : dflt);

/**
 * Light clean-up of story text in plain mode: models still like joining
 * sentences with semicolons, so split those into separate sentences.
 */
export function plain(text: string): string {
  if (settings.plainStory === false || !text) return text;
  return text
    .replace(/\s*;\s+([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\s*;\s+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
const clipPlain = (v: unknown, n: number, dflt = '') => plain(clip(v, n, dflt));

async function ask<T>(s: GameState | { tone: Tone; world: { name: string } }, user: string, maxTokens = 500): Promise<T> {
  const messages: ChatMessage[] = [{ role: 'system', content: system(s) }, { role: 'user', content: user }];
  return chatJson<T>(messages, { maxTokens });
}

// ---------- Premise ----------
export async function genPremise(tone: Tone, heroName: string, cls: ClassId): Promise<{ name: string; hook: string }> {
  const fb = pick(PREMISES[tone]);
  if (!aiEnabled()) return fb;
  try {
    const out = await ask<{ name: string; hook: string }>({ tone, world: { name: 'a brand-new world' } },
      `Invent a fresh fantasy world and the opening hook for ${heroName}, a ${CLASSES[cls].name}.
JSON: {"name": "world/region name, 2-4 easy words", "hook": "opening premise in 35-55 words: a clear mystery or goal that pulls the hero out into the wilds today"}`, 300);
    return { name: clip(out.name, 40, fb.name), hook: clipPlain(out.hook, 500, fb.hook) };
  } catch (e) {
    console.warn('premise fallback', e);
    return fb;
  }
}

// ---------- Region ----------
export async function genRegion(s: GameState, biome: Biome): Promise<RegionInfo> {
  const fb = { name: regionName(biome), blurb: regionBlurb(biome) };
  if (!aiEnabled()) return fb;
  try {
    const out = await ask<RegionInfo>(s, `The hero enters a new region whose terrain is mostly ${BIOME_INFO[biome].name}.
Context: ${JSON.stringify({ story_so_far: s.summary.slice(-400), known_regions: Object.values(s.regions).map((r) => r.name).slice(-6) })}
JSON: {"name": "region name, 2-4 words, starting with The", "blurb": "one short, simple sentence about what it's like there, max 14 words"}`, 120);
    return { name: clip(out.name, 36, fb.name), blurb: clipPlain(out.blurb, 140, fb.blurb) };
  } catch {
    return fb;
  }
}

// ---------- Quest ----------
export async function genQuest(s: GameState, targetBiome: Biome, direction: string, dist: number) {
  const fb = fallbackQuest(s.questsDone);
  if (!aiEnabled()) return fb;
  try {
    const out = await ask<{ title: string; description: string; place: string }>(s,
      `Create the hero's next main quest, chapter ${s.questsDone + 1} of their saga. It must grow out of the story so far.
The destination is ${dist} hexes to the ${direction}, in ${BIOME_INFO[targetBiome].name} terrain.
Context: ${JSON.stringify(storyContext(s))}
If a recent turning point opened a new thread, the quest may follow it.
JSON: {"title": "quest title, 2-5 words", "description": "the goal and why it matters, in plain words, max 28 words", "place": "name of the destination, 2-4 words"}`, 200);
    return { title: clip(out.title, 40, fb.title), description: clipPlain(out.description, 220, fb.description), place: clip(out.place, 40, fb.place) };
  } catch {
    return fb;
  }
}

// ---------- Events ----------
const POI_GUIDE: Record<string, string> = {
  start: 'the hero\'s starting campsite',
  village: 'a small settlement with people, rumours and a market. Include one "trade" choice.',
  ruin: 'ancient ruins hiding treasure and danger',
  cave: 'a cave or underground place',
  shrine: 'a sacred or magical shrine. A "rest" choice fits here.',
  camp: 'a campsite — bandits, hunters, or a lone traveller',
  tower: 'a strange tower or watchpoint',
  grove: 'a magical grove or fey place. A "rest" choice fits here.',
  stranger: 'a chance meeting with a memorable NPC on the road',
  wild: 'a small wilderness moment: hazard, oddity, discovery or ambush',
  quest: 'THE CLIMAX of the current quest at its destination. Make it dramatic. Do not include "leave".',
};

const VALID_KINDS = ['check', 'fight', 'trade', 'rest', 'leave'];
const VALID_REWARDS: RewardKind[] = ['gold', 'item', 'ally', 'heal', 'lore', 'xp'];
const VALID_ENEMY: EnemyKind[] = ['beast', 'humanoid', 'undead', 'monster', 'spirit'];

/** Hand-written fallback, preferring the landmark's own scene when there is one. */
export function baseFallback(ctx: EventContext): GameEvent {
  const lm = ctx.landmark ? LANDMARKS[ctx.landmark as LandmarkKind] : undefined;
  return lm?.event ? lm.event(ctx) : fallbackEvent(ctx);
}

export function sanitizeEvent(raw: any, ctx: EventContext): GameEvent {
  const fb = baseFallback(ctx);
  const ev: GameEvent = {
    title: clip(raw?.title, 40, fb.title),
    text: clipPlain(raw?.text, 520, fb.text),
    npc: null,
    choices: [],
    ...(raw?.open === true ? { open: true } : {}),
  };
  if (raw?.npc && typeof raw.npc === 'object' && clip(raw.npc.name, 40)) {
    ev.npc = { name: clip(raw.npc.name, 40), role: clip(raw.npc.role, 40, 'traveller'), look: clip(raw.npc.look, 100), personality: clip(raw.npc.personality, 80) } as NpcSpec;
    const cls = String(raw.npc.class ?? raw.npc.cls ?? '').toLowerCase();
    if (cls in CLASSES) ev.npc.cls = cls as ClassId;
  }
  const maxDc = Math.min(20, 12 + ctx.tier * 2);
  for (const c of Array.isArray(raw?.choices) ? raw.choices : []) {
    if (!c || !VALID_KINDS.includes(c.kind)) continue;
    const choice: Choice = { label: clip(c.label, 48, 'Act'), kind: c.kind };
    if (c.kind === 'check') {
      choice.stat = (STATS as string[]).includes(String(c.stat).toLowerCase()) ? (String(c.stat).toLowerCase() as Stat) : 'wis';
      const dc = Number(c.dc);
      choice.dc = Math.max(8, Math.min(maxDc, Number.isFinite(dc) ? Math.round(dc) : 10 + ctx.tier));
      choice.reward = VALID_REWARDS.includes(c.reward) ? c.reward : 'xp';
      if (choice.reward === 'ally' && !ev.npc) choice.reward = 'xp';
    }
    if (c.kind === 'fight') {
      const kind = VALID_ENEMY.includes(c.enemy?.kind) ? c.enemy.kind : 'monster';
      const emoji = typeof c.enemy?.emoji === 'string' && [...c.enemy.emoji].length <= 3 && c.enemy.emoji.trim() ? c.enemy.emoji.trim() : KIND_EMOJI[kind];
      choice.enemy = { name: clip(c.enemy?.name, 32, 'Foe'), kind, emoji };
    }
    if (c.kind === 'trade' && ctx.poi !== 'village' && ctx.poi !== 'stranger') continue;
    ev.choices.push(choice);
    if (ev.choices.length >= 4) break;
  }
  if (ev.choices.filter((c) => c.kind !== 'leave').length === 0) return fb;
  if (ctx.poi === 'village' && !ev.choices.some((c) => c.kind === 'trade')) {
    if (ev.choices.length >= 4) ev.choices.splice(2, 1);
    ev.choices.splice(Math.max(0, ev.choices.length - 1), 0, { label: 'Visit the market', kind: 'trade' });
  }
  if (ctx.poi !== 'quest' && !ev.choices.some((c) => c.kind === 'leave')) {
    if (ev.choices.length >= 4) ev.choices.pop();
    ev.choices.push({ label: 'Move on', kind: 'leave' });
  }
  return ev;
}

export async function genEvent(s: GameState, ctx: EventContext): Promise<GameEvent> {
  if (!aiEnabled()) return baseFallback(ctx);
  try {
    return await genEventAi(s, ctx);
  } catch (e) {
    console.warn('event fallback', e);
    return baseFallback(ctx);
  }
}

/** One AI-written encounter. Throws when the model can't be reached (no fallback). */
export async function genEventAi(s: GameState, ctx: EventContext): Promise<GameEvent> {
  const returning = ctx.returningNpc
    ? `Feature this RETURNING character, who remembers the hero: ${JSON.stringify({ name: ctx.returningNpc.name, role: ctx.returningNpc.role, personality: ctx.returningNpc.personality, affinity: ctx.returningNpc.affinity, memories: ctx.returningNpc.memories })}. Put them in "npc" with the same name.`
    : '';
  {
    const raw = await ask<any>(s, `Create the next encounter.
Location: ${POI_GUIDE[ctx.poi] ?? POI_GUIDE.wild}. Terrain: ${ctx.terrain ?? BIOME_INFO[ctx.biome].name}. Region: ${ctx.regionName}. Danger tier ${ctx.tier}/5.
Weather: ${WEATHER_INFO[weatherAt(s.seed, s.day, ctx.hex)].prompt}. Unless it's clear, let it colour the scene.
${turnsIn(s, ctx.regionName).length ? `Turning points the hero caused in this region (the world has changed because of them; let this scene show it where it fits): ${turnsIn(s, ctx.regionName).slice(-3).map((t) => `${t.title}: ${t.text}`).join(' | ')}` : ''}
${ctx.landmark ? `The scene is built around a landmark standing here: ${LANDMARKS[ctx.landmark as LandmarkKind].name} — ${LANDMARKS[ctx.landmark as LandmarkKind].lore[0]} Make the landmark central to the encounter and its choices.` : ''}
${returning}
Context: ${JSON.stringify(storyContext(s))}
Return JSON:
{"title": "2-5 words",
 "text": "the scene, 30-60 words, ending with a clear choice to make",
 "npc": null or {"name": "...", "role": "...", "look": "short visual description", "personality": "3-6 words", "class": "warrior|rogue|mage|bard" (how they'd fight if they joined the party)},
 "open": true only if this is a turning point where the hero might well try something of their own (a tense negotiation, a mystery, a moral choice, a strange power); at most 1 scene in 4,
 "choices": [ 3 or 4 options, each:
   {"label": "imperative, max 6 simple words, so the player knows exactly what it does", "kind": "check" | "fight" | "trade" | "rest" | "leave",
    "stat": "str|dex|con|int|wis|cha" (check only), "dc": 8-${Math.min(20, 12 + ctx.tier * 2)} (check only; 10 easy, 13 fair, 16 hard),
    "reward": "gold|item|ally|heal|lore|xp" (check only; "ally" only if there is an npc to befriend),
    "enemy": {"name": "...", "kind": "beast|humanoid|undead|monster|spirit", "emoji": "one emoji"} (fight only)} ]}
Rules: offer genuinely different approaches using DIFFERENT stats; make choices specific to the scene and easy to tell apart; include "leave" unless this is the quest climax.`, 650);
    return sanitizeEvent(raw, ctx);
  }
}

// ---------- Outcome ----------
export interface Outcome {
  text: string; memory: string | null; flag: string | null;
  turn?: { title: string; text: string } | null;
  /** a way the turning point physically closed */
  block?: { kind: BlockKind; reason: string; here: boolean } | null;
}

/**
 * Narration for a check's result. With `approx`, it's being written before the
 * dice land (one version for success, one for failure), so the effects are a
 * close guess and the text must stay general about them.
 */
export async function genOutcome(s: GameState, ev: GameEvent, choice: Choice, result: { success: boolean; crit: boolean; fumble: boolean; effects: string[] }, approx = false): Promise<Outcome> {
  const fb: Outcome = { text: fallbackOutcome(choice.reward, result.success, result.crit, result.fumble), memory: null, flag: null };
  if (!aiEnabled()) return fb;
  try {
    const out = await ask<any>(s, `Narrate the result of the hero's choice.
Scene: ${JSON.stringify({ title: ev.title, text: ev.text, npc: ev.npc?.name ?? null })}
Choice: "${choice.custom ?? choice.label}"${choice.custom ? ' (the player\'s own idea: honour its specifics)' : ''} (${choice.stat?.toUpperCase() ?? ''} check vs DC ${choice.dc ?? '-'}).
Dice result (FINAL, do not contradict): ${result.crit ? 'CRITICAL SUCCESS (natural 20)' : result.fumble ? 'CRITICAL FAILURE (natural 1)' : result.success ? 'SUCCESS' : 'FAILURE'}.
${approx
  ? `Likely mechanical effects (exact amounts and items may differ, so mention them only in general terms: no numbers, no item names): ${result.effects.join(', ') || 'none'}.`
  : `Mechanical effects already applied: ${result.effects.join(', ') || 'none'}.`}
Context: ${JSON.stringify({ story_so_far: s.summary.slice(-300), companions: party(s).map((n) => n.name), weather: WEATHER_INFO[weatherAt(s.seed, s.day, s.pos)].prompt })}
JSON: {"text": "25-50 words narrating what happens, consistent with the result and effects", "memory": ${ev.npc ? `"what ${ev.npc.name} will remember about this, max 12 words"` : 'null'}, "flag": "a lasting world fact this created, max 10 words, or null"${choice.custom ? `,
 "turn": {"title": "2-5 words naming this turning point", "consequence": "max 22 words: what is different in the world from now on because of what the hero did (success or failure); something that can matter later"},
 "block": null, or ONLY if what happened would physically close a way through the land (a bridge burned, a garrison now bars the road, a tunnel caved in, a ward raised, a fire spreading): {"kind": "rockfall|fire|flood|guards|thorns|ice|curse|barricade|collapse", "reason": "max 14 words, what now blocks the way", "where": "here|nearby"}. Usually null.` : ''}}`, choice.custom ? 380 : 260);
    const turn = choice.custom && clip(out.turn?.consequence, 160) ? { title: clip(out.turn?.title, 40, ev.title), text: clipPlain(out.turn?.consequence, 160) } : null;
    const block = choice.custom && BLOCK_KINDS.includes(out.block?.kind) && clip(out.block?.reason, 120)
      ? { kind: out.block.kind as BlockKind, reason: clip(out.block.reason, 120), here: out.block.where === 'here' } : null;
    return { text: clipPlain(out.text, 420, fb.text), memory: clip(out.memory, 100) || null, flag: clip(out.flag, 90) || null, turn, block };
  } catch {
    return fb;
  }
}

// ---------- Chapter end ----------
export interface ChapterEnd { summary: string; recap: string; hook: string; banter: string; flags: string[] }

export function fallbackChapterEnd(s: GameState): ChapterEnd {
  const events = chapterLog(s).filter((l) => l.kind !== 'info').map((l) => l.text.replace(/\.$/, ''));
  const highlights = events.slice(-4);
  const name = s.player.name.split(' ')[0];
  const linkers = ['Then', 'Later', 'After that'];
  const recap = highlights.length
    ? highlights.map((h, i) => `${i === 0 ? `On day ${s.day}, ${name}` : `${i === highlights.length - 1 && i > 1 ? 'Finally' : linkers[(i - 1) % linkers.length]}, ${name}`} ${h.charAt(0).toLowerCase() + h.slice(1)}.`).join(' ')
    : `Day ${s.day} passed quietly as ${s.player.name} wandered ${Object.values(s.regions).slice(-1)[0]?.name ?? 'the wilds'}.`;
  const comp = party(s)[0];
  return {
    summary: (s.summary + ' ' + recap).slice(-1200),
    recap,
    hook: pick(HOOKS),
    banter: comp ? pick(CAMP_BANTER).replace('{c}', comp.name) : 'The fire crackles. You are alone with your thoughts, and the stars.',
    flags: [],
  };
}

export async function genChapterEnd(s: GameState): Promise<ChapterEnd> {
  const fb = fallbackChapterEnd(s);
  if (!aiEnabled()) return fb;
  const comp = party(s)[0];
  try {
    const out = await ask<ChapterEnd>(s, `The hero makes camp; day ${s.day} (one play session) ends. Write the end-of-chapter material.
Previous story summary: ${s.summary.slice(-1000)}
Today's events in order: ${JSON.stringify(chapterLog(s).map((l) => l.text))}
Current quest: ${s.quest ? s.quest.title + ' — ' + s.quest.description : 'none'}
Companions: ${JSON.stringify(party(s).map((n) => ({ name: n.name, personality: n.personality, memories: n.memories.slice(-2) })))}
JSON: {"summary": "UPDATED full story summary, max 140 words, keeping key names, places, promises and mysteries",
 "recap": "'Previously on…' recap of TODAY ONLY, 25-45 words, exciting but in plain words",
 "hook": "a one-sentence cliffhanger teasing tomorrow, max 18 words",
 "banter": ${comp ? `"campfire line spoken by ${comp.name}, in character, max 25 words, include their name"` : '"one quiet campfire sentence, max 20 words"'},
 "flags": ["0-3 short lasting world facts learned today"]}`, 700);
    return {
      summary: clipPlain(out.summary, 1200, fb.summary),
      recap: clipPlain(out.recap, 400, fb.recap),
      hook: clipPlain(out.hook, 200, fb.hook),
      banter: clipPlain(out.banter, 220, fb.banter),
      flags: Array.isArray(out.flags) ? out.flags.filter((f) => typeof f === 'string').map((f) => f.slice(0, 90)).slice(0, 3) : [],
    };
  } catch {
    return fb;
  }
}
