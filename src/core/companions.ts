// Companions are heroes too: same classes, same levelling, same talent trees.
// This module turns an NPC friend into a fighting party member and keeps them
// in step with the player.
import { CLASSES, newHero, levelUpHero, checkBonus, takeItem, itemScore, trimBag, XP_LEVELS, type Helper } from './rules';
import { modsOf, mergeMods, autoPick, learn, treeSize, type Mods, type TalentNode } from './talents';
import { hashString } from './rng';
import type { ClassId, GameState, Hero, Item, NPC, Stat } from './types';

const ROLE_CLASS: [RegExp, ClassId][] = [
  [/(bard|minstrel|singer|poet|perform|jester|piper|storyteller|merchant|trader|peddler|noble|diplomat|courtier|herald|dancer|actor|innkeep|fortune|charlatan|lute)/i, 'bard'],
  [/(mage|wizard|witch|hermit|sage|scholar|alchemist|priest|monk|druid|shaman|mystic|seer|oracle|sorcer|warlock|cleric|acolyte|librar|astronom|herbalist|healer|spirit|ghost|wraith|apprentice|scribe)/i, 'mage'],
  [/(thief|rogue|scout|smuggl|spy|assassin|cutpurse|poacher|burglar|tracker|trapper|urchin|pickpocket|outlaw|courier|hunter|archer|ranger|bandit|sneak)/i, 'rogue'],
  [/(guard|knight|soldier|warrior|smith|mercenar|sellsword|captain|brute|gladiator|champion|raider|barbarian|warden|sentinel|militia|paladin|squire|veteran|woodcutter|miner|sailor|pirate|wolf|bear|beast|ogre|troll|golem)/i, 'warrior'],
];

/** Guess a class from a story role ("wandering herbalist" → mage). */
export function classForRole(role: string, name: string): ClassId {
  for (const [re, cls] of ROLE_CLASS) if (re.test(role)) return cls;
  const all: ClassId[] = ['warrior', 'rogue', 'mage', 'bard'];
  return all[hashString(name + role) % all.length];
}

export const companionClass = (npc: NPC): ClassId => npc.hero?.cls ?? npc.cls ?? classForRole(npc.role, npc.name);

/** The branch of their tree this companion leans towards when choosing alone. */
export const favouriteBranch = (npc: NPC) => hashString(npc.name) % 3;

/** Give a companion a combat sheet if they lack one, and catch them up to `level`. */
export function ensureHero(npc: NPC, level = 1): Hero {
  if (!npc.hero) npc.hero = newHero(companionClass(npc));
  const h = npc.hero;
  // Older saves and odd data: keep the sheet well-formed.
  h.talents ??= [];
  h.points ??= 0;
  h.asi ??= 0;
  while (h.level < Math.min(20, level)) levelUpHero(h, true);
  h.xp = Math.max(h.xp, XP_LEVELS[h.level - 1] ?? 0);
  return h;
}

/** Companions travel and grow with the hero: bring everyone in the party up to the hero's level. */
export function syncParty(s: GameState): { npc: NPC; from: number; to: number }[] {
  const out: { npc: NPC; from: number; to: number }[] = [];
  for (const n of partyOf(s)) {
    const from = n.hero?.level ?? 0;
    const h = ensureHero(n, s.player.level);
    if (h.level > from && from > 0) out.push({ npc: n, from, to: h.level });
  }
  return out;
}

/** Let a companion spend their points on their own. Returns what they learned. */
export function autoLearn(npc: NPC): TalentNode[] {
  const h = ensureHero(npc);
  const got: TalentNode[] = [];
  for (;;) {
    const n = autoPick(h, favouriteBranch(npc));
    if (!n || !learn(h, n.id)) break;
    got.push(n);
  }
  return got;
}

export function partyOf(s: GameState): NPC[] {
  return Object.values(s.npcs).filter((n) => n.inParty);
}

/** Companions able to lend a hand on checks. */
export function helpers(s: GameState): Helper[] {
  return partyOf(s).filter((n) => n.hero).map((n) => ({ name: n.name, hero: n.hero! }));
}

/** The hero's bonus on a check, including help from companions' talents. */
export const heroCheck = (s: GameState, stat: Stat) => checkBonus(s.player, stat, helpers(s));

/** Everyone's talents added together: for party-wide effects (torches, gold, luck…). */
export function partyMods(s: GameState): Mods {
  const out = mergeMods({}, modsOf(s.player));
  for (const n of partyOf(s)) if (n.hero) mergeMods(out, modsOf(n.hero));
  return out;
}

/** Anyone in the party (hero included) with points to spend or stats to raise? */
export function unspent(s: GameState) {
  const p = s.player;
  return (p.points ?? 0) + (p.asi ?? 0) + partyOf(s).reduce((a, n) => a + (n.hero?.points ?? 0), 0);
}

/** Old saves had no talents and companions were a bare "power" number. */
export function migrateSave(s: GameState) {
  const p = s.player;
  if (!Array.isArray(p.talents)) {
    p.talents = [];
    // Talent points for every level already earned (the tree caps at its size).
    p.points = Math.min(treeSize(p.cls), Math.max(0, p.level - 1));
  }
  p.points ??= 0;
  p.asi ??= 0;
  for (const n of Object.values(s.npcs)) {
    if (n.hero || !n.inParty) continue;
    ensureHero(n, Math.max(1, n.power ?? s.player.level));
    delete n.power;
  }
  return s;
}

export const className = (h: Hero) => CLASSES[h.cls].name;

const slotOf = (h: Hero, it: Item) => (it.slot === 'weapon' ? h.weapon : it.slot === 'armor' ? h.armor : h.charm);

/**
 * New loot: the hero takes it if it's an upgrade; otherwise the companion it
 * helps most equips it (their old piece goes in the bag); otherwise it's bagged.
 * Returns who equipped it ('you', a companion's name) or null.
 */
export function stowLoot(s: GameState, it: Item): string | null {
  const p = s.player;
  if (takeItem(p, it)) return 'you';
  let best: NPC | null = null, gain = 0;
  for (const n of partyOf(s)) {
    if (!n.hero) continue;
    const g = itemScore(it) - itemScore(slotOf(n.hero, it));
    if (g > gain) { gain = g; best = n; }
  }
  if (!best) return null;
  p.bag = p.bag.filter((x) => x.id !== it.id);
  const h = best.hero!;
  const old = slotOf(h, it);
  if (old) p.bag.push(old);
  if (it.slot === 'weapon') h.weapon = it;
  else if (it.slot === 'armor') h.armor = it;
  else h.charm = it;
  trimBag(p);
  return best.name;
}

/** "Runed Halberd (d10 +3) — equipped!" / "— Bryn equips it" */
export const lootNote = (who: string | null) => (who === 'you' ? ' — equipped!' : who ? ` — ${who} equips it` : '');
