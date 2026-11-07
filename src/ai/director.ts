// The "AI Dungeon Master". Every function returns validated, clamped data and
// silently falls back to hand-written content if the model is unavailable.
import { chatJson, type ChatMessage } from './openrouter';
import { aiEnabled } from './settings';
import { CLASSES } from '../core/rules';
import { party, chapterLog } from '../core/state';
import { BIOME_INFO } from '../core/world';
import {
  fallbackEvent, fallbackOutcome, fallbackQuest, regionName, regionBlurb, PREMISES, HOOKS, CAMP_BANTER, KIND_EMOJI,
} from '../core/content';
import { pick } from '../core/rng';
import { STATS } from '../core/types';
import { LANDMARKS, type LandmarkKind } from '../core/terrain';
import { talent } from '../core/talents';
import type {
  Biome, Choice, ClassId, EnemyKind, EventContext, GameEvent, GameState, NpcSpec, RegionInfo, RewardKind, Stat, Tone,
} from '../core/types';

const TONE_GUIDE: Record<Tone, string> = {
  heroic: 'bright high-fantasy adventure, hopeful and bold, with moments of wonder',
  grim: 'dark low-fantasy, eerie and tense, but never gratuitous; PG-13',
  whimsical: 'playful fairy-tale whimsy, witty and absurd, like a cosy storybook with teeth',
};

function system(s: { tone: Tone; world: { name: string } }) {
  return `You are the Dungeon Master of HEXBOUND, a turn-based fantasy RPG played in short 5-minute sessions on a phone.
World: "${s.world.name}". Tone: ${TONE_GUIDE[s.tone]}.
Style: second person ("you"), present tense, vivid and concrete, SHORT. Mobile screens are small: never exceed the word limits.
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
  };
}

const clip = (v: unknown, n: number, dflt = '') => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : dflt);

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
JSON: {"name": "evocative world/region name, 2-4 words", "hook": "opening premise in 45-65 words: a mystery or goal that pulls the hero out into the wilds today"}`, 300);
    return { name: clip(out.name, 40, fb.name), hook: clip(out.hook, 500, fb.hook) };
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
JSON: {"name": "region name, 2-4 words, starting with The", "blurb": "one atmospheric sentence, max 16 words"}`, 120);
    return { name: clip(out.name, 36, fb.name), blurb: clip(out.blurb, 140, fb.blurb) };
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
JSON: {"title": "quest title, 2-5 words", "description": "the goal and why it matters, max 30 words", "place": "name of the destination, 2-4 words"}`, 200);
    return { title: clip(out.title, 40, fb.title), description: clip(out.description, 220, fb.description), place: clip(out.place, 40, fb.place) };
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
    text: clip(raw?.text, 520, fb.text),
    npc: null,
    choices: [],
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
${ctx.landmark ? `The scene is built around a landmark standing here: ${LANDMARKS[ctx.landmark as LandmarkKind].name} — ${LANDMARKS[ctx.landmark as LandmarkKind].lore[0]} Make the landmark central to the encounter and its choices.` : ''}
${returning}
Context: ${JSON.stringify(storyContext(s))}
Return JSON:
{"title": "2-5 words",
 "text": "the scene, 35-70 words, ending on a moment of decision",
 "npc": null or {"name": "...", "role": "...", "look": "short visual description", "personality": "3-6 words", "class": "warrior|rogue|mage|bard" (how they'd fight if they joined the party)},
 "choices": [ 3 or 4 options, each:
   {"label": "imperative, max 6 words", "kind": "check" | "fight" | "trade" | "rest" | "leave",
    "stat": "str|dex|con|int|wis|cha" (check only), "dc": 8-${Math.min(20, 12 + ctx.tier * 2)} (check only; 10 easy, 13 fair, 16 hard),
    "reward": "gold|item|ally|heal|lore|xp" (check only; "ally" only if there is an npc to befriend),
    "enemy": {"name": "...", "kind": "beast|humanoid|undead|monster|spirit", "emoji": "one emoji"} (fight only)} ]}
Rules: offer genuinely different approaches using DIFFERENT stats; make choices flavourful and specific to the scene; include "leave" unless this is the quest climax.`, 650);
    return sanitizeEvent(raw, ctx);
  }
}

// ---------- Outcome ----------
export interface Outcome { text: string; memory: string | null; flag: string | null }

export async function genOutcome(s: GameState, ev: GameEvent, choice: Choice, result: { success: boolean; crit: boolean; fumble: boolean; effects: string[] }): Promise<Outcome> {
  const fb: Outcome = { text: fallbackOutcome(choice.reward, result.success, result.crit, result.fumble), memory: null, flag: null };
  if (!aiEnabled()) return fb;
  try {
    const out = await ask<Outcome>(s, `Narrate the result of the hero's choice.
Scene: ${JSON.stringify({ title: ev.title, text: ev.text, npc: ev.npc?.name ?? null })}
Choice: "${choice.label}" (${choice.stat?.toUpperCase() ?? ''} check vs DC ${choice.dc ?? '-'}).
Dice result (FINAL, do not contradict): ${result.crit ? 'CRITICAL SUCCESS (natural 20)' : result.fumble ? 'CRITICAL FAILURE (natural 1)' : result.success ? 'SUCCESS' : 'FAILURE'}.
Mechanical effects already applied: ${result.effects.join(', ') || 'none'}.
Context: ${JSON.stringify({ story_so_far: s.summary.slice(-300), companions: party(s).map((n) => n.name) })}
JSON: {"text": "25-55 words narrating what happens, consistent with the result and effects", "memory": ${ev.npc ? `"what ${ev.npc.name} will remember about this, max 12 words"` : 'null'}, "flag": "a lasting world fact this created, max 10 words, or null"}`, 260);
    return { text: clip(out.text, 420, fb.text), memory: clip(out.memory, 100) || null, flag: clip(out.flag, 90) || null };
  } catch {
    return fb;
  }
}

// ---------- Chapter end ----------
export interface ChapterEnd { summary: string; recap: string; hook: string; banter: string; flags: string[] }

export function fallbackChapterEnd(s: GameState): ChapterEnd {
  const events = chapterLog(s).filter((l) => l.kind !== 'info').map((l) => l.text.replace(/\.$/, ''));
  const highlights = events.slice(-4);
  const recap = highlights.length
    ? `On day ${s.day}, ${s.player.name} ${highlights.map((h) => h.charAt(0).toLowerCase() + h.slice(1)).join('; ')}.`
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
 "recap": "'Previously on…' recap of TODAY ONLY, 25-45 words, dramatic TV-recap style",
 "hook": "a one-sentence cliffhanger teasing tomorrow, max 22 words",
 "banter": ${comp ? `"campfire line spoken by ${comp.name}, in character, max 25 words, include their name"` : '"one quiet campfire sentence, max 20 words"'},
 "flags": ["0-3 short lasting world facts learned today"]}`, 700);
    return {
      summary: clip(out.summary, 1200, fb.summary),
      recap: clip(out.recap, 400, fb.recap),
      hook: clip(out.hook, 200, fb.hook),
      banter: clip(out.banter, 220, fb.banter),
      flags: Array.isArray(out.flags) ? out.flags.filter((f) => typeof f === 'string').map((f) => f.slice(0, 90)).slice(0, 3) : [],
    };
  } catch {
    return fb;
  }
}
