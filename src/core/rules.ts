import { rand, randInt, pick, type Rand } from './rng';
import type { ClassId, Item, Player, Stat } from './types';

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
    prof: ['int', 'wis'], hitDie: 6, attackStat: 'int',
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
    weapon: { id: 'w0', name: 'Rapier', slot: 'weapon', tier: 1, die: 6, plus: 0 },
    armor: { id: 'a0', name: 'Leather Doublet', slot: 'armor', tier: 1, plus: 1 },
  },
};

export function newPlayer(name: string, cls: ClassId): Player {
  const def = CLASSES[cls];
  const maxHp = def.hitDie + 4 + mod(def.stats.con) * 2;
  return {
    name, cls, level: 1, xp: 0, hp: maxHp, maxHp,
    stats: { ...def.stats }, gold: 15, potions: 2,
    weapon: { ...def.weapon }, armor: { ...def.armor }, charm: null, bag: [],
    inspiration: true,
  };
}

export function armorClass(p: Player): number {
  return 10 + Math.min(mod(p.stats.dex), p.cls === 'warrior' ? 2 : 5) + p.armor.plus;
}

export function checkBonus(p: Player, stat: Stat): { total: number; parts: { label: string; value: number }[] } {
  const parts = [{ label: stat.toUpperCase(), value: mod(p.stats[stat]) }];
  if (CLASSES[p.cls].prof.includes(stat)) parts.push({ label: 'PROF', value: profBonus(p.level) });
  if (p.charm && p.charm.stat === stat) parts.push({ label: p.charm.name.split(' ').slice(-1)[0].toUpperCase(), value: p.charm.plus });
  return { total: parts.reduce((s, x) => s + x.value, 0), parts };
}

export function attackBonus(p: Player) {
  const stat = CLASSES[p.cls].attackStat;
  return mod(p.stats[stat]) + profBonus(p.level) + p.weapon.plus;
}

export function damageBonus(p: Player) {
  return mod(p.stats[CLASSES[p.cls].attackStat]) + p.weapon.plus;
}

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
}

export function d(sides: number, r: Rand = rand) {
  return randInt(1, sides, r);
}

export function rollD20(bonus: number, dc: number, adv: -1 | 0 | 1 = 0, parts: { label: string; value: number }[] = [], r: Rand = rand): D20Roll {
  const dice = adv === 0 ? [d(20, r)] : [d(20, r), d(20, r)];
  const kept = adv === 1 ? Math.max(...dice) : adv === -1 ? Math.min(...dice) : dice[0];
  const total = kept + bonus;
  const crit = kept === 20, fumble = kept === 1;
  return { dice, kept, adv, bonus, parts, total, dc, crit, fumble, success: crit || (!fumble && total >= dc) };
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

export const XP_LEVELS = [0, 100, 260, 480, 760, 1100, 1500, 2000, 2600, 3300, 4100];
export function xpForNext(level: number) {
  return XP_LEVELS[Math.min(level, XP_LEVELS.length - 1)] ?? level * 500;
}

/** Returns number of levels gained (stats chosen in UI). */
export function gainXp(p: Player, amount: number): number {
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpForNext(p.level) && p.level < 20) {
    p.level++;
    gained++;
    const hpGain = Math.max(2, Math.ceil(CLASSES[p.cls].hitDie / 2) + 1 + mod(p.stats.con));
    p.maxHp += hpGain;
    p.hp += hpGain;
  }
  return gained;
}

export function heal(p: Player, amount: number) {
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

export function randomItem(p: Player, tier: number, r: Rand = rand): Item {
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

function trimBag(p: Player) {
  while (p.bag.length > 8) {
    p.bag.sort((a, b) => itemScore(a) - itemScore(b));
    p.bag.shift();
  }
}

export function sellValue(it: Item) {
  return 5 + it.tier * 6 + it.plus * 4;
}
