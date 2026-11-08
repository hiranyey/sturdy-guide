import type { Hex } from './hex';

export type Stat = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const STATS: Stat[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const STAT_NAMES: Record<Stat, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export type Biome =
  | 'deep' | 'water' | 'sand' | 'grass' | 'forest'
  | 'swamp' | 'hills' | 'mountain' | 'snow' | 'desert';

export type PoiKind =
  | 'village' | 'ruin' | 'cave' | 'shrine' | 'camp'
  | 'tower' | 'grove' | 'stranger' | 'start';

export type ClassId = 'warrior' | 'rogue' | 'mage' | 'bard';
export type Tone = 'heroic' | 'grim' | 'whimsical';

export type ItemSlot = 'weapon' | 'armor' | 'charm';
export interface Item {
  id: string;
  name: string;
  slot: ItemSlot;
  tier: number;
  /** weapon: damage die sides */
  die?: number;
  /** weapon: +hit/+dmg, armor: +AC, charm: +check bonus */
  plus: number;
  /** charm: which stat it boosts */
  stat?: Stat;
  desc?: string;
}

/**
 * Everything that fights: the player and every companion share this shape,
 * so the same rules (AC, attack, checks, levelling, talents) apply to both.
 */
export interface Hero {
  cls: ClassId;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  stats: Record<Stat, number>;
  weapon: Item;
  armor: Item;
  charm: Item | null;
  /** learned talent node ids */
  talents: string[];
  /** unspent talent points */
  points: number;
  /** pending ability score increases (+2 to a stat) still to be chosen */
  asi: number;
}

export interface Player extends Hero {
  name: string;
  gold: number;
  potions: number;
  bag: Item[];
  inspiration: boolean;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  look: string;
  personality: string;
  affinity: number; // -100..100
  memories: string[];
  metDay: number;
  where: string;
  inParty: boolean;
  /** combat sheet: class, level, HP, gear and talents (created when they first join) */
  hero?: Hero;
  /** class they'll have when they join (from the story, or guessed from their role) */
  cls?: ClassId;
  /** how they sound when voiced */
  voice?: VoiceHint;
  /** @deprecated pre-talent saves: companion strength, migrated into `hero` */
  power?: number;
}

export interface Quest {
  title: string;
  description: string;
  place: string;
  target: Hex;
  stage: number;
}

export interface RegionInfo { name: string; blurb: string }

export interface TileMem {
  /** visited */
  v?: 1;
  /** point of interest resolved */
  done?: 1;
  /** short memory note, shown on journal/map */
  note?: string;
  /** landmark already discovered */
  lm?: 1;
  /** day its map sign (foe, scene, find…) was used up (src/core/encounters.ts) */
  e?: number;
}

export interface LogEntry { day: number; text: string; kind: 'event' | 'fight' | 'friend' | 'quest' | 'loot' | 'info' }

export interface Chapter { day: number; recap: string }

export interface GameState {
  version: 1;
  seed: number;
  createdAt: number;
  lastPlayed: number;
  tone: Tone;
  world: { name: string; hook: string };
  player: Player;
  pos: Hex;
  day: number;
  stamina: number;
  maxStamina: number;
  tiles: Record<string, TileMem>;
  revealed: Record<string, 1>;
  regions: Record<string, RegionInfo>;
  npcs: Record<string, NPC>;
  quest: Quest | null;
  questsDone: number;
  log: LogEntry[];
  summary: string;
  recap: string;
  hook: string;
  flags: string[];
  chapters: Chapter[];
  omen?: string;
  /** unlocked achievements: id -> unlock time */
  ach?: Record<string, number>;
  /** counters used by achievements */
  track?: Track;
  /** an event that was open when the app closed; reopened on resume */
  pending?: { ctx: EventContext; ev: GameEvent } | null;
  /** a fight that was in progress when the app closed; restarted on resume */
  pendingFight?: PendingFight | null;
  /** hexes closed for story reasons, by "q,r" (src/core/blocks.ts) */
  blocks?: Record<string, import('./blocks').Block>;
  /** turning points: lasting consequences of the hero's own ideas at special moments */
  turns?: Turn[];
  /** encounters written ahead of time for nearby tiles, plus spares to reuse (src/ai/foresight.ts) */
  foresight?: ForesightStore;
  stats: { kills: number; friends: number; explored: number; crits: number; fumbles: number; chapterStartGold: number; chapterKills: number; chapterExplored: number };
}

export type ChoiceKind = 'check' | 'fight' | 'trade' | 'rest' | 'leave';
export type RewardKind = 'gold' | 'item' | 'ally' | 'heal' | 'lore' | 'xp';
export type EnemyKind = 'beast' | 'humanoid' | 'undead' | 'monster' | 'spirit';

export interface EnemySpec { name: string; kind: EnemyKind; emoji?: string }

export interface Choice {
  label: string;
  kind: ChoiceKind;
  stat?: Stat;
  dc?: number;
  reward?: RewardKind;
  enemy?: EnemySpec;
  /** the player's own words, when they wrote this action themselves */
  custom?: string;
  /** rolled with advantage (a clever idea) */
  adv?: 1;
  /** paid up front when chosen (gold, torches or HP) */
  cost?: Cost;
  /** a bold move: harder, but the reward is doubled */
  bold?: 1;
  /** no roll: pay the cost and it simply works */
  sure?: 1;
}

/** An up-front price for a choice. */
export interface Cost { gold?: number; torch?: number; hp?: number }

/** How a character sounds, for voiced story moments (src/ui/voice.ts). */
export interface VoiceHint { gender?: 'masculine' | 'feminine'; age?: 'young' | 'adult' | 'mature'; deep?: boolean }

export interface NpcSpec { name: string; role: string; look: string; personality: string; cls?: ClassId; voice?: VoiceHint }

export interface GameEvent {
  title: string;
  text: string;
  npc: NpcSpec | null;
  choices: Choice[];
  /** a turning point: the hero may write their own action (src/ai/freeform.ts) */
  open?: boolean;
  /** prices and bold/sure options already added (src/core/choices.ts) */
  shaped?: 1;
}

/** A turning point: something the hero chose to do that changes the story from then on. */
export interface Turn {
  day: number;
  /** 2-5 words, e.g. "The Troll's Bargain" */
  title: string;
  /** what is different now */
  text: string;
  /** region it happened in */
  where: string;
  /** did the hero's idea work? */
  good: boolean;
  /** when it happened (ms) */
  at?: number;
}

/** An encounter the AI wrote before the hero got there. */
export interface Foreseen {
  ctx: EventContext;
  ev: GameEvent;
  /** day it was written, to let stale ones go */
  day: number;
  /** companions in the party when it was written */
  party: string[];
  /** quest it was written for (quest climaxes only) */
  quest?: string;
  /** weather on that tile when it was written (the scene may describe it) */
  weather?: string;
  /** when it was written (ms), to spot turning points that came after */
  written?: number;
}

export interface ForesightStore {
  /** written for one particular tile: "poi:q,r", "lm:q,r", "quest:q,r" */
  spots: Record<string, Foreseen>;
  /** spares that fit any tile of the same kind and terrain: unused wild scenes and abandoned spots */
  pool: Foreseen[];
}

export interface EventContext {
  hex: Hex;
  biome: Biome;
  poi: PoiKind | 'wild' | 'quest';
  tier: number;
  regionName: string;
  returningNpc?: NPC;
  /** sub-style terrain name, e.g. "Autumn Wood" */
  terrain?: string;
  /** landmark kind the scene is built around */
  landmark?: string;
}

export interface Track {
  landmarks: string[];
  biomes: string[];
  styles: string[];
  omens: string[];
  buys: number;
  talks: number;
  deathSaves: number;
  recruits: number;
  sword: boolean;
  /** companions who have learned at least one talent you picked */
  mentored?: number;
}

export interface PendingFight {
  spec: EnemySpec;
  tier: number;
  boss: boolean;
  intro: string;
  /** quest climax context, so winning still completes the quest */
  quest?: EventContext;
  /** point of interest to mark done on victory */
  tileKey?: string;
}
