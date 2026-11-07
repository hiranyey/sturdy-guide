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
}

export interface NpcSpec { name: string; role: string; look: string; personality: string; cls?: ClassId }

export interface GameEvent {
  title: string;
  text: string;
  npc: NpcSpec | null;
  choices: Choice[];
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
