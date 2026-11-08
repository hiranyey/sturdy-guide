import { key, spiral, type Hex } from './hex';
import { newPlayer } from './rules';
import { visionRadius } from './world';
import { omenFor } from './content';
import { partyMods, migrateSave } from './companions';
import type { ClassId, GameState, LogEntry, NPC, NpcSpec, Tone, Turn } from './types';

const SAVE_KEY = 'hexbound.save.v1';

export function createGame(name: string, cls: ClassId, tone: Tone, world: { name: string; hook: string }): GameState {
  const seed = (Math.random() * 2 ** 31) | 0;
  const s: GameState = {
    version: 1, seed, createdAt: Date.now(), lastPlayed: Date.now(), tone, world,
    player: newPlayer(name, cls),
    pos: { q: 0, r: 0 }, day: 1, stamina: 12, maxStamina: 12,
    tiles: { '0,0': { v: 1 } }, revealed: {}, regions: {}, npcs: {},
    quest: null, questsDone: 0, log: [],
    summary: world.hook, recap: '', hook: '', flags: [], chapters: [],
    stats: { kills: 0, friends: 0, explored: 1, crits: 0, fumbles: 0, chapterStartGold: 15, chapterKills: 0, chapterExplored: 0 },
  };
  startDay(s);
  reveal(s, s.pos);
  return s;
}

export function reveal(s: GameState, h: Hex, extra = 0) {
  const bonus = (s.omen === 'clear-skies' ? 1 : 0) + (partyMods(s).reveal ?? 0);
  for (const t of spiral(h, visionRadius(h, s.seed) + extra + bonus)) s.revealed[key(t)] = 1;
}

/** Roll today's omen and apply its dawn effects. */
export function startDay(s: GameState) {
  const o = omenFor(s.seed, s.day);
  s.omen = o.id;
  const m = partyMods(s);
  s.stamina = s.maxStamina + (o.id === 'fair-winds' ? 3 : 0) + (m.torches ?? 0);
  if (o.id === 'lucky-stars' || m.dawnInsp) s.player.inspiration = true;
  return o;
}

export const hasOmen = (s: GameState, id: string) => s.omen === id;

/**
 * Once the save slot has been replaced (import) or deleted (abandon), the page reloads.
 * Locking stops the outgoing page's save-on-hide from writing the old game back.
 */
let locked = false;
export function lockSaves() {
  locked = true;
}

export function save(s: GameState) {
  if (locked) return;
  s.lastPlayed = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? migrateSave(s) : null;
  } catch {
    return null;
  }
}

export function wipe() {
  lockSaves();
  localStorage.removeItem(SAVE_KEY);
}

export function log(s: GameState, text: string, kind: LogEntry['kind'] = 'info') {
  s.log.push({ day: s.day, text, kind });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

/** Remember a turning point (the newest dozen are kept). */
export function addTurn(s: GameState, t: Turn) {
  (s.turns ??= []).push(t);
  if (s.turns.length > 12) s.turns.splice(0, s.turns.length - 12);
}

/** Turning points that happened in a region, newest last. */
export const turnsIn = (s: GameState, region: string) => (s.turns ?? []).filter((t) => t.where === region);

export function chapterLog(s: GameState) {
  return s.log.filter((l) => l.day === s.day);
}

export function addNpc(s: GameState, spec: NpcSpec, where: string): NPC {
  const existing = Object.values(s.npcs).find((n) => n.name === spec.name);
  if (existing) {
    if (!existing.voice && spec.voice) existing.voice = spec.voice;
    return existing;
  }
  const id = `n${Object.keys(s.npcs).length + 1}`;
  const npc: NPC = {
    id, name: spec.name, role: spec.role || 'traveller', look: spec.look || '', personality: spec.personality || '',
    affinity: 0, memories: [], metDay: s.day, where, inParty: false,
  };
  if (spec.cls) npc.cls = spec.cls;
  if (spec.voice) npc.voice = spec.voice;
  s.npcs[id] = npc;
  return npc;
}

export function party(s: GameState): NPC[] {
  return Object.values(s.npcs).filter((n) => n.inParty);
}

export function remember(npc: NPC, memory: string) {
  if (!memory) return;
  npc.memories.push(memory);
  if (npc.memories.length > 6) npc.memories.shift();
}
