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

export interface Player {
  name: string;
  cls: ClassId;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  stats: Record<Stat, number>;
  gold: number;
  potions: number;
  weapon: Item;
  armor: Item;
  charm: Item | null;
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
  /** companion level-ish power */
  power: number;
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

export interface NpcSpec { name: string; role: string; look: string; personality: string }

export interface GameEvent {
  title: string;
  text: string;
  npc: NpcSpec | null;
  choices: Choice[];
}

export interface EventContext {
  hex: Hex;
  biome: Biome;
  poi: PoiKind | 'wild' | 'quest';
  tier: number;
  regionName: string;
  returningNpc?: NPC;
}
