import { rand, randInt, pick, type Rand } from './rng';
import type { ClassId, Hero, Item, Player, Stat } from './types';
import { modsOf, treeSize, ASI_LEVELS, MAX_LEVEL, type Mods } from './talents';

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((level - 1) / 4);

export interface ClassDef {
  id: ClassId;
  name: string;
  glyph: string;
  color: string;
  blurb: string;
  stats: Record<Stat, number>;
  prof: Stat[];
  hitDie: number;
  attackStat: Stat;
  ability: { name: string; desc: string };
  weapon: Item;
  armor: Item;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior', name: 'Warrior', glyph: '⚔', color: '#e0583a',
    blurb: 'Steel, grit and a stubborn refusal to fall.',
    stats: { str: 16, dex: 12, con: 15, int: 8, wis: 11, cha: 10 },
    prof: ['str', 'con'], hitDie: 10, attackStat: 'str',
    ability: { name: 'Mighty Blow', desc: 'Strike with advantage and an extra damage die. Once per fight.' },
    weapon: { id: 'w0', name: 'Longsword', slot: 'weapon', tier: 1, die: 8, plus: 0 },
    armor: { id: 'a0', name: 'Chain Shirt', slot: 'armor', tier: 1, plus: 4 },
  },
  rogue: {
    id: 'rogue', name: 'Rogue', glyph: '🗡', color: '#47c08a',
    blurb: 'Quick fingers, quicker exits, quietest footsteps.',
    stats: { str: 10, dex: 16, con: 13, int: 12, wis: 11, cha: 14 },
    prof: ['dex', 'int'], hitDie: 8, attackStat: 'dex',
    ability: { name: 'Sneak Attack', desc: 'Your next hit deals +2d6 damage. Once per fight.' },
    weapon: { id: 'w0', name: 'Twin Daggers', slot: 'weapon', tier: 1, die: 6, plus: 0 },
    armor: { id: 'a0', name: 'Leather Coat', slot: 'armor', tier: 1, plus: 1 },
  },
  mage: {
    id: 'mage', name: 'Mage', glyph: '✦', color: '#7b7cf5',
    blurb: 'Arcane sparks and a head full of forbidden footnotes.',
    stats: { str: 8, dex: 13, con: 12, int: 16, wis: 14, cha: 11 },
    prof: ['int', 'wis'], hitDie: 8, attackStat: 'int',
    ability: { name: 'Thunderwave', desc: 'Unleash 3d8 force damage — no attack roll needed. Once per fight.' },
    weapon: { id: 'w0', name: 'Firebolt Focus', slot: 'weapon', tier: 1, die: 10, plus: 0 },
    armor: { id: 'a0', name: 'Mage Armor', slot: 'armor', tier: 1, plus: 3 },
  },
  bard: {
    id: 'bard', name: 'Bard', glyph: '♪', color: '#e8b33a',
    blurb: 'Every foe is an audience. Every audience can be won.',
    stats: { str: 9, dex: 14, con: 12, int: 11, wis: 10, cha: 16 },
    prof: ['cha', 'dex'], hitDie: 8, attackStat: 'dex',
    ability: { name: 'Vicious Mockery', desc: 'Insult so cutting it deals 2d6 psychic damage and makes the foe miss its next swing. Once per fight.' },
    weapon: { id: 'w0', name: 'Rapier', slot: 'weapon', tier: 1, die: 8, plus: 0 },
    armor: { id: 'a0', name: 'Leather Doublet', slot: 'armor', tier: 1, plus: 1 },
  },
};

/** A fresh level-1 hero of a class: the player and companions start the same way. */
export function newHero(cls: ClassId): Hero {
  const def = CLASSES[cls];
  const maxHp = def.hitDie + 4 + mod(def.stats.con) * 2;
  return {
    cls, level: 1, xp: 0, hp: maxHp, maxHp,
    stats: { ...def.stats },
    weapon: { ...def.weapon }, armor: { ...def.armor }, charm: null,
    talents: [], points: 0, asi: 0,
  };
}

export function newPlayer(name: string, cls: ClassId): Player {
  return { ...newHero(cls), name, gold: 15, potions: 2, bag: [], inspiration: true };
}

export function armorClass(h: Hero, m: Mods = modsOf(h)): number {
  return 10 + Math.min(mod(h.stats.dex), h.cls === 'warrior' ? 2 : 5) + h.armor.plus + (m.ac ?? 0);
}

export interface Helper { name: string; hero: Hero }
export type Part = { label: string; value: number };

/**
 * Bonus on an ability check. Companions with a matching talent lend a hand
 * (their talent bonus shows up as a separate, named part of the roll).
 */
export function checkBonus(h: Hero, stat: Stat, helpers: Helper[] = []): { total: number; parts: Part[] } {
  const parts: Part[] = [{ label: stat.toUpperCase(), value: mod(h.stats[stat]) }];
  if (CLASSES[h.cls].prof.includes(stat)) parts.push({ label: 'PROF', value: profBonus(h.level) });
  if (h.charm && h.charm.stat === stat) parts.push({ label: h.charm.name.split(' ').slice(-1)[0].toUpperCase(), value: h.charm.plus });
  const own = modsOf(h).checks?.[stat];
  if (own) parts.push({ label: 'TALENT', value: own });
  for (const x of helpers) {
    const v = modsOf(x.hero).checks?.[stat];
    if (v) parts.push({ label: x.name.split(' ')[0].toUpperCase(), value: v });
  }
  return { total: parts.reduce((s, x) => s + x.value, 0), parts };
}

export function attackBonus(h: Hero, m: Mods = modsOf(h)) {
  const stat = CLASSES[h.cls].attackStat;
  return mod(h.stats[stat]) + profBonus(h.level) + h.weapon.plus + (m.atk ?? 0);
}

export function damageBonus(h: Hero, m: Mods = modsOf(h)) {
  return mod(h.stats[CLASSES[h.cls].attackStat]) + h.weapon.plus + (m.dmg ?? 0);
}

export const critOn = (h: Hero, m: Mods = modsOf(h)) => 20 - (m.crit ?? 0);

export interface D20Roll {
  dice: number[]; // 1 or 2 dice
  kept: number;
  adv: -1 | 0 | 1;
  bonus: number;
  parts: { label: string; value: number }[];
  total: number;
  dc: number;
  success: boolean;
  crit: boolean;
  fumble: boolean;
  /** a natural 1 was rerolled thanks to the Lucky talent */
  lucky?: boolean;
}

export interface RollOpts {
  r?: Rand;
  /** reroll natural 1s */
  lucky?: boolean;
  /** lowest natural roll that counts as a critical (attacks only) */
  critOn?: number;
}

export function d(sides: number, r: Rand = rand) {
  return randInt(1, sides, r);
}

export function rollD20(bonus: number, dc: number, adv: -1 | 0 | 1 = 0, parts: Part[] = [], o: RollOpts = {}): D20Roll {
  const r = o.r ?? rand;
  const dice = adv === 0 ? [d(20, r)] : [d(20, r), d(20, r)];
  let lucky = false;
  if (o.lucky) {
    for (let i = 0; i < dice.length; i++) {
      if (dice[i] === 1) { dice[i] = d(20, r); lucky = true; }
    }
  }
  const kept = adv === 1 ? Math.max(...dice) : adv === -1 ? Math.min(...dice) : dice[0];
  const total = kept + bonus;
  const crit = kept >= (o.critOn ?? 20), fumble = kept === 1;
  const roll: D20Roll = { dice, kept, adv, bonus, parts, total, dc, crit, fumble, success: crit || (!fumble && total >= dc) };
  if (lucky) roll.lucky = true;
  return roll;
}

export function rollDice(n: number, sides: number, r: Rand = rand): number[] {
  return Array.from({ length: n }, () => d(sides, r));
}

/** Probability (0..1) to beat a DC with a bonus on a d20. */
export function successChance(bonus: number, dc: number, adv: -1 | 0 | 1 = 0) {
  const p = Math.min(0.95, Math.max(0.05, (21 - (dc - bonus)) / 20));
  if (adv === 1) return 1 - (1 - p) ** 2;
  if (adv === -1) return p * p;
  return p;
}

/**
 * A smooth levelling curve: going from level L to L + 1 costs 100 + 80·(L − 1) XP
 * (100, 180, 260, 340 …), so every level asks exactly 80 XP more than the last.
 * Rewards grow with the danger tier (and, past tier 5, with how far you've outgrown
 * a region), so the number of encounters per level rises gently: about 4 at first,
 * 8 by level 10, and 9–10 near the cap.
 */
export const XP_STEP_BASE = 100;
export const XP_STEP_GROWTH = 80;
export const xpStep = (level: number) => XP_STEP_BASE + XP_STEP_GROWTH * (level - 1);
/** XP_LEVELS[n] is the total XP needed to reach level n + 1 (closed form: 100n + 40n(n − 1)). */
export const XP_LEVELS: number[] = Array.from({ length: MAX_LEVEL }, (_, n) => XP_STEP_BASE * n + (XP_STEP_GROWTH / 2) * n * (n - 1));
/** Total XP to reach the next level (Infinity at the level cap). */
export function xpForNext(level: number) {
  return level >= MAX_LEVEL ? Infinity : XP_LEVELS[level];
}

export const hpPerLevel = (h: Hero) => Math.max(2, Math.ceil(CLASSES[h.cls].hitDie / 2) + 1 + mod(h.stats.con));

/** +2 to a stat (max 20). CON also raises max HP, as it would have from level 1. */
export function raiseStat(h: Hero, st: Stat) {
  if (h.stats[st] >= 20) return false;
  h.stats[st] = Math.min(20, h.stats[st] + 2);
  if (st === 'con') { h.maxHp += 2; h.hp += 2; }
  return true;
}

/** What a companion raises on their own: their fighting stat, then their other strengths. */
export function autoRaise(h: Hero) {
  const def = CLASSES[h.cls];
  const order: Stat[] = [def.attackStat, ...def.prof, 'con', 'dex', 'wis', 'cha', 'int', 'str'];
  for (const st of order) if (raiseStat(h, st)) return st;
  return null;
}

/**
 * One level: more HP, a talent point (or, once the tree is complete, another
 * ability score increase), and ability score increases at 4, 8, 12, 16 and 19.
 * The player chooses their stat increases; companions (`autoAsi`) choose their own.
 */
export function levelUpHero(h: Hero, autoAsi: boolean) {
  h.level++;
  const hpGain = hpPerLevel(h);
  h.maxHp += hpGain;
  h.hp += hpGain;
  let asi = ASI_LEVELS.includes(h.level) ? 1 : 0;
  if (h.talents.length + h.points >= treeSize(h.cls)) asi++;
  else h.points++;
  for (let i = 0; i < asi; i++) {
    if (autoAsi) autoRaise(h);
    else h.asi++;
  }
  return hpGain;
}

/** Returns the number of levels gained. */
export function gainXp(h: Hero, amount: number, autoAsi = false): number {
  h.xp += amount;
  let gained = 0;
  while (h.level < MAX_LEVEL && h.xp >= xpForNext(h.level)) {
    levelUpHero(h, autoAsi);
    gained++;
  }
  return gained;
}

export function heal(p: { hp: number; maxHp: number }, amount: number) {
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  return p.hp - before;
}

// --- Loot ---
const WEAPON_NAMES: Record<ClassId, string[]> = {
  warrior: ['Greatsword', 'Battleaxe', 'Warhammer', 'Halberd', 'Bastard Sword'],
  rogue: ['Stiletto', 'Shortsword', 'Kris Blade', 'Hand Crossbow', 'Shadow Dirk'],
  mage: ['Ember Wand', 'Rune Staff', 'Storm Orb', 'Grimoire', 'Crystal Rod'],
  bard: ['Silver Rapier', 'Lute-Blade', 'Duelling Sabre', 'Whip of Verses', 'Songsteel Foil'],
};
const WEAPON_PREFIX = ['Rusty', 'Fine', 'Runed', 'Moonlit', 'Dragonbone', 'Starforged'];
const ARMOR_NAMES = ['Brigandine', 'Scale Mail', 'Warded Cloak', 'Studded Jerkin', 'Ironweave Vest', 'Dragonscale Coat'];
const CHARM_NAMES: Record<Stat, string[]> = {
  str: ['Bear Tooth', 'Ox-Hide Band'], dex: ['Cat-Eye Ring', 'Feather Anklet'],
  con: ['Ironroot Amulet', 'Troll Knuckle'], int: ['Owl Lens', 'Inkstone Pendant'],
  wis: ['Moon Pebble', 'Hermit Bell'], cha: ['Silver Tongue Pin', 'Rose Locket'],
};

let itemCounter = Date.now() % 100000;
const uid = () => `i${(itemCounter++).toString(36)}`;

export function randomItem(p: Hero, tier: number, r: Rand = rand): Item {
  const roll = r();
  const plus = Math.max(1, Math.min(5, Math.round(tier * 0.8 + r() * 1.2)));
  const prefix = WEAPON_PREFIX[Math.min(WEAPON_PREFIX.length - 1, plus)];
  if (roll < 0.4) {
    const die = CLASSES[p.cls].weapon.die! + (r() < 0.3 && tier > 1 ? 2 : 0);
    return { id: uid(), name: `${prefix} ${pick(WEAPON_NAMES[p.cls], r)}`, slot: 'weapon', tier, die: Math.min(12, die), plus };
  }
  if (roll < 0.7) {
    const base = CLASSES[p.cls].armor.plus;
    return { id: uid(), name: `${prefix} ${pick(ARMOR_NAMES, r)}`, slot: 'armor', tier, plus: base + Math.ceil(plus / 2) };
  }
  const stat = pick(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Stat[], r);
  return { id: uid(), name: pick(CHARM_NAMES[stat], r), slot: 'charm', tier, plus: Math.min(3, Math.ceil(plus / 2)), stat };
}

export function itemScore(it: Item | null): number {
  if (!it) return 0;
  if (it.slot === 'weapon') return (it.die ?? 6) / 2 + it.plus * 1.5;
  return it.plus;
}

export function itemDesc(it: Item): string {
  if (it.slot === 'weapon') return `d${it.die} ${it.plus ? fmtMod(it.plus) + ' hit/dmg' : ''}`.trim();
  if (it.slot === 'armor') return `${fmtMod(it.plus)} AC`;
  return `${fmtMod(it.plus)} ${it.stat?.toUpperCase()} checks`;
}

/** Equip if strictly better; otherwise put in bag. Returns true if equipped. */
export function takeItem(p: Player, it: Item): boolean {
  const cur = it.slot === 'weapon' ? p.weapon : it.slot === 'armor' ? p.armor : p.charm;
  if (itemScore(it) > itemScore(cur)) {
    if (cur) p.bag.push(cur);
    if (it.slot === 'weapon') p.weapon = it;
    else if (it.slot === 'armor') p.armor = it;
    else p.charm = it;
    trimBag(p);
    return true;
  }
  p.bag.push(it);
  trimBag(p);
  return false;
}

export function equip(p: Player, id: string) {
  const idx = p.bag.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const it = p.bag.splice(idx, 1)[0];
  const cur = it.slot === 'weapon' ? p.weapon : it.slot === 'armor' ? p.armor : p.charm;
  if (cur) p.bag.push(cur);
  if (it.slot === 'weapon') p.weapon = it;
  else if (it.slot === 'armor') p.armor = it;
  else p.charm = it;
}

export function trimBag(p: Player) {
  while (p.bag.length > 8) {
    p.bag.sort((a, b) => itemScore(a) - itemScore(b));
    p.bag.shift();
  }
}

export function sellValue(it: Item) {
  return 5 + it.tier * 6 + it.plus * 4;
}
