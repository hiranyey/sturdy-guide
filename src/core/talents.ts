// Talent trees. Every class has a signature ability plus three branches of four
// talents. The hero and every companion use the very same trees: a companion
// is just another Hero with a class, a level and talent points to spend.
import type { ClassId, Hero, Stat } from './types';

/** Passive effects a talent grants. Summed over everything a hero has learned. */
export interface Mods {
  ac?: number;
  atk?: number;
  dmg?: number;
  /** flat max HP, applied once when learned */
  hp?: number;
  /** widen the crit range: 1 means crits on 19–20 */
  crit?: number;
  /** bonus on ability checks (a companion lends it to the hero as help) */
  checks?: Partial<Record<Stat, number>>;
  /** bonus on Talk / Calm in combat */
  talk?: number;
  /** bonus on fleeing (10+ always escapes ordinary foes) */
  flee?: number;
  /** extra healing from every potion (party-wide) */
  potion?: number;
  /** crushing blows against you deal half damage */
  heavyHalf?: boolean;
  /** advantage on attacks in the first round */
  firstAdv?: boolean;
  /** when the foe misses you, strike back with 1dN */
  riposte?: number;
  /** every weapon hit adds 1dN */
  extraDie?: number;
  /** every *other* party member gets +N to attack */
  partyAtk?: number;
  /** every *other* party member gets +N AC */
  partyAc?: number;
  /** heal N at the end of every round while standing */
  regen?: number;
  /** the hero wakes with Inspiration (party-wide) */
  dawnInsp?: boolean;
  /** extra torches per day (party-wide) */
  torches?: number;
  /** +% gold from fights and events (party-wide) */
  gold?: number;
  /** how much more often foes pick you as their target */
  taunt?: number;
  /** once per fight, a blow that would drop you leaves you at 1 HP */
  lastStand?: boolean;
  /** the first hit against you each fight is dodged */
  firstMiss?: boolean;
  /** once per fight, +5 AC against a blow that would hit */
  shield?: boolean;
  /** an arcane ward soaks level + 2 + INT damage each fight */
  ward?: boolean;
  /** extra uses per fight of abilities */
  uses?: Partial<Record<AbilityId, number>>;
  /** extra dice for abilities */
  boost?: Partial<Record<AbilityId, number>>;
  /** natural 1s are rerolled (a companion's luck covers the hero's checks too) */
  lucky?: boolean;
  /** see further when exploring (party-wide) */
  reveal?: number;
  /** after a victory the whole party heals 1dN (party-wide) */
  afterWinHeal?: number;
  /** once per fight, the first party member to fall is restored to a third of their HP */
  saveAlly?: boolean;
  /** a successful Talk always turns a non-boss foe into a friend */
  befriend?: boolean;
  /** % discount at markets (party-wide) */
  discount?: number;
  /** after using an ability, follow up with a free weapon attack */
  battleMagic?: boolean;
}

export type AbilityId =
  | 'first_aid'
  | 'mighty_blow' | 'titan_strike' | 'second_wind' | 'battle_cry' | 'command'
  | 'sneak_attack' | 'execute' | 'vanish' | 'dirty_trick'
  | 'thunderwave' | 'fireball' | 'hold_monster' | 'foresight'
  | 'vicious_mockery' | 'laughter' | 'healing_word' | 'courage';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  icon: string;
  desc: string;
  /** uses per fight before talents */
  uses: number;
  /** a bonus action: resolves instantly and you still get your turn */
  bonus?: boolean;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  first_aid: { id: 'first_aid', name: 'First Aid', icon: '🩹', uses: 1, desc: 'Bind the worst wounds in the party: 1d8 + half your level. Gets a fallen companion back on their feet.' },
  mighty_blow: { id: 'mighty_blow', name: 'Mighty Blow', icon: '💥', uses: 1, desc: 'Strike with advantage and an extra weapon die.' },
  titan_strike: { id: 'titan_strike', name: 'Titan Strike', icon: '🌋', uses: 1, desc: 'A blow with advantage and two extra weapon dice. On a hit the foe is stunned and loses its next turn.' },
  second_wind: { id: 'second_wind', name: 'Second Wind', icon: '💨', uses: 1, bonus: true, desc: 'Bonus action: recover 1d10 + your level HP.' },
  battle_cry: { id: 'battle_cry', name: 'Battle Cry', icon: '📯', uses: 1, bonus: true, desc: 'Bonus action: the whole party gets +2 to attack for the rest of the fight.' },
  command: { id: 'command', name: 'Command', icon: '👑', uses: 1, desc: 'Every companion strikes at once with advantage, then you attack too.' },
  sneak_attack: { id: 'sneak_attack', name: 'Sneak Attack', icon: '🗡', uses: 1, desc: 'Strike with advantage; a hit deals +2d6.' },
  execute: { id: 'execute', name: 'Execute', icon: '☠', uses: 1, desc: 'Strike with advantage. Double damage if the foe is below half HP; an ordinary foe below a quarter dies outright.' },
  vanish: { id: 'vanish', name: 'Vanish', icon: '🫥', uses: 1, bonus: true, desc: 'Bonus action: melt into shadow. The foe can\'t target you next turn and your next attack has advantage.' },
  dirty_trick: { id: 'dirty_trick', name: 'Dirty Trick', icon: '🫳', uses: 1, desc: 'Sand in the eyes, no roll needed: the foe\'s next two attacks have disadvantage.' },
  thunderwave: { id: 'thunderwave', name: 'Thunderwave', icon: '🌩', uses: 1, desc: '3d8 force damage, no attack roll needed.' },
  fireball: { id: 'fireball', name: 'Fireball', icon: '☄', uses: 1, desc: '6d6 fire damage, no attack roll needed.' },
  hold_monster: { id: 'hold_monster', name: 'Hold Monster', icon: '⛓', uses: 1, desc: 'Bind the foe in arcane chains: it loses its next two turns (one for a boss).' },
  foresight: { id: 'foresight', name: 'Foresight', icon: '🔮', uses: 1, bonus: true, desc: 'Bonus action: the whole party attacks with advantage this round, and the foe\'s next attack has disadvantage.' },
  vicious_mockery: { id: 'vicious_mockery', name: 'Vicious Mockery', icon: '🎭', uses: 1, desc: '2d6 psychic damage, and the foe\'s next attack has disadvantage.' },
  laughter: { id: 'laughter', name: 'Hideous Laughter', icon: '🤣', uses: 1, desc: '3d6 psychic damage and the foe collapses laughing, losing its next turn (bosses just get disadvantage).' },
  healing_word: { id: 'healing_word', name: 'Healing Word', icon: '💚', uses: 2, bonus: true, desc: 'Bonus action: heal the most wounded ally 2d4 + CHA. Revives the fallen.' },
  courage: { id: 'courage', name: 'Song of Courage', icon: '🎺', uses: 1, bonus: true, desc: 'Bonus action: the whole party gets +2 AC for the rest of the fight.' },
};

export interface TalentNode {
  id: string;
  cls: ClassId;
  branch: 0 | 1 | 2;
  /** 1..4: deeper rows need the row above in the same branch and a higher level */
  row: 1 | 2 | 3 | 4;
  name: string;
  icon: string;
  desc: string;
  mods?: Mods;
  grants?: AbilityId;
}

export interface Branch { name: string; icon: string; blurb: string }

export interface Tree {
  /** signature ability, known from level 1 */
  root: AbilityId;
  branches: [Branch, Branch, Branch];
  nodes: TalentNode[];
}

/** Level needed for each row. */
export const ROW_LEVEL = [0, 2, 5, 8, 12] as const;
/** Ability score increases, as in the tabletop game. */
export const ASI_LEVELS = [4, 8, 12, 16, 19];
export const MAX_LEVEL = 20;

type N = Omit<TalentNode, 'cls'>;
const tree = (cls: ClassId, root: AbilityId, branches: [Branch, Branch, Branch], nodes: N[]): Tree =>
  ({ root, branches, nodes: nodes.map((n) => ({ ...n, cls })) });

export const TREES: Record<ClassId, Tree> = {
  warrior: tree('warrior', 'mighty_blow', [
    { name: 'Champion', icon: '⚔', blurb: 'Hit harder, crit more often.' },
    { name: 'Guardian', icon: '🛡', blurb: 'Stand between your friends and harm.' },
    { name: 'Warlord', icon: '🚩', blurb: 'Lead from the front; the party fights better.' },
  ], [
    { id: 'w_c1', branch: 0, row: 1, name: 'Weapon Master', icon: '🗡', desc: '+1 to attack and damage.', mods: { atk: 1, dmg: 1 } },
    { id: 'w_c2', branch: 0, row: 2, name: 'Improved Critical', icon: '💢', desc: 'Your attacks crit on 19–20.', mods: { crit: 1 } },
    { id: 'w_c3', branch: 0, row: 3, name: 'Relentless', icon: '🔁', desc: 'Mighty Blow twice per fight, with one more weapon die.', mods: { uses: { mighty_blow: 1 }, boost: { mighty_blow: 1 } } },
    { id: 'w_c4', branch: 0, row: 4, name: 'Titan Strike', icon: '🌋', desc: 'New ability. ' + ABILITIES.titan_strike.desc, grants: 'titan_strike' },
    { id: 'w_g1', branch: 1, row: 1, name: 'Thick Skin', icon: '🪨', desc: '+1 AC and +6 max HP.', mods: { ac: 1, hp: 6 } },
    { id: 'w_g2', branch: 1, row: 2, name: 'Bodyguard', icon: '🛡', desc: 'Foes target you far more often, and crushing blows deal you half damage.', mods: { taunt: 3, heavyHalf: true } },
    { id: 'w_g3', branch: 1, row: 3, name: 'Second Wind', icon: '💨', desc: 'New ability. ' + ABILITIES.second_wind.desc, grants: 'second_wind' },
    { id: 'w_g4', branch: 1, row: 4, name: 'Unbreakable', icon: '🗿', desc: 'Once per fight, a blow that would drop you leaves you at 1 HP. Regain 2 HP every round.', mods: { lastStand: true, regen: 2 } },
    { id: 'w_l1', branch: 2, row: 1, name: 'Battle Cry', icon: '📯', desc: 'New ability. ' + ABILITIES.battle_cry.desc, grants: 'battle_cry' },
    { id: 'w_l2', branch: 2, row: 2, name: 'Leadership', icon: '🎖', desc: 'Everyone else in the party gets +1 to attack.', mods: { partyAtk: 1 } },
    { id: 'w_l3', branch: 2, row: 3, name: 'Forced March', icon: '🥾', desc: '+1 torch every day, and the hero wakes with Inspiration.', mods: { torches: 1, dawnInsp: true } },
    { id: 'w_l4', branch: 2, row: 4, name: 'Command', icon: '👑', desc: 'New ability. ' + ABILITIES.command.desc, grants: 'command' },
  ]),
  rogue: tree('rogue', 'sneak_attack', [
    { name: 'Assassin', icon: '🗡', blurb: 'One perfect strike.' },
    { name: 'Shadow', icon: '🌫', blurb: 'Never where the blow lands.' },
    { name: 'Trickster', icon: '🃏', blurb: 'Skills, luck and dirty tricks.' },
  ], [
    { id: 'r_a1', branch: 0, row: 1, name: 'Envenom', icon: '🧪', desc: 'Poisoned blades: every hit adds 1d4.', mods: { extraDie: 4 } },
    { id: 'r_a2', branch: 0, row: 2, name: 'Ambusher', icon: '🌑', desc: 'Advantage on attacks in the first round; crit on 19–20.', mods: { firstAdv: true, crit: 1 } },
    { id: 'r_a3', branch: 0, row: 3, name: 'Cunning Strikes', icon: '🎯', desc: 'Sneak Attack twice per fight, and it deals +3d6.', mods: { uses: { sneak_attack: 1 }, boost: { sneak_attack: 1 } } },
    { id: 'r_a4', branch: 0, row: 4, name: 'Execute', icon: '☠', desc: 'New ability. ' + ABILITIES.execute.desc, grants: 'execute' },
    { id: 'r_s1', branch: 1, row: 1, name: 'Evasion', icon: '🍃', desc: '+1 AC, and crushing blows deal you half damage.', mods: { ac: 1, heavyHalf: true } },
    { id: 'r_s2', branch: 1, row: 2, name: 'Uncanny Dodge', icon: '🌀', desc: 'The first hit against you each fight is dodged.', mods: { firstMiss: true } },
    { id: 'r_s3', branch: 1, row: 3, name: 'Vanish', icon: '🫥', desc: 'New ability. ' + ABILITIES.vanish.desc, grants: 'vanish' },
    { id: 'r_s4', branch: 1, row: 4, name: 'Shadow Dancer', icon: '🌘', desc: 'When a foe misses you, strike back for 1d6. Fleeing ordinary foes always works.', mods: { riposte: 6, flee: 10 } },
    { id: 'r_t1', branch: 2, row: 1, name: 'Expertise', icon: '📐', desc: '+2 on DEX and INT checks.', mods: { checks: { dex: 2, int: 2 } } },
    { id: 'r_t2', branch: 2, row: 2, name: 'Light Fingers', icon: '🪙', desc: '+30% gold from fights and events.', mods: { gold: 30 } },
    { id: 'r_t3', branch: 2, row: 3, name: 'Dirty Trick', icon: '🫳', desc: 'New ability. ' + ABILITIES.dirty_trick.desc, grants: 'dirty_trick' },
    { id: 'r_t4', branch: 2, row: 4, name: 'Lucky', icon: '🍀', desc: 'Natural 1s are rerolled — in fights, and on the hero\'s checks.', mods: { lucky: true } },
  ]),
  mage: tree('mage', 'thunderwave', [
    { name: 'Evoker', icon: '🔥', blurb: 'Raw destructive power.' },
    { name: 'Abjurer', icon: '🔮', blurb: 'Wards that keep the party standing.' },
    { name: 'Diviner', icon: '👁', blurb: 'See further, know more, act first.' },
  ], [
    { id: 'm_e1', branch: 0, row: 1, name: 'Searing Bolts', icon: '🔥', desc: '+2 damage on your attacks.', mods: { dmg: 2 } },
    { id: 'm_e2', branch: 0, row: 2, name: 'Overchannel', icon: '⚡', desc: 'Thunderwave twice per fight, with one more d8.', mods: { uses: { thunderwave: 1 }, boost: { thunderwave: 1 } } },
    { id: 'm_e3', branch: 0, row: 3, name: 'Fireball', icon: '☄', desc: 'New ability. ' + ABILITIES.fireball.desc, grants: 'fireball' },
    { id: 'm_e4', branch: 0, row: 4, name: 'Archmage', icon: '🌌', desc: 'Fireball twice per fight with 2 more dice; your attacks crit on 19–20.', mods: { uses: { fireball: 1 }, boost: { fireball: 2 }, crit: 1 } },
    { id: 'm_b1', branch: 1, row: 1, name: 'Arcane Ward', icon: '💠', desc: 'A ward soaks the first level + 2 + INT damage you take each fight.', mods: { ward: true } },
    { id: 'm_b2', branch: 1, row: 2, name: 'Shield', icon: '🛡', desc: 'Once per fight, +5 AC against a blow that would hit you.', mods: { shield: true } },
    { id: 'm_b3', branch: 1, row: 3, name: 'Protective Aura', icon: '✨', desc: '+1 AC for you and everyone in the party.', mods: { ac: 1, partyAc: 1 } },
    { id: 'm_b4', branch: 1, row: 4, name: 'Hold Monster', icon: '⛓', desc: 'New ability. ' + ABILITIES.hold_monster.desc, grants: 'hold_monster' },
    { id: 'm_d1', branch: 2, row: 1, name: 'Scholar', icon: '📚', desc: '+2 on INT and WIS checks.', mods: { checks: { int: 2, wis: 2 } } },
    { id: 'm_d2', branch: 2, row: 2, name: 'Far Sight', icon: '🔭', desc: 'See one hex further when exploring.', mods: { reveal: 1 } },
    { id: 'm_d3', branch: 2, row: 3, name: 'Foresight', icon: '🔮', desc: 'New ability. ' + ABILITIES.foresight.desc, grants: 'foresight' },
    { id: 'm_d4', branch: 2, row: 4, name: 'Seer', icon: '🌠', desc: '+1 on every check, and the hero wakes with Inspiration.', mods: { checks: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, dawnInsp: true } },
  ]),
  bard: tree('bard', 'vicious_mockery', [
    { name: 'Valor', icon: '🤺', blurb: 'Blade and song together.' },
    { name: 'Healing', icon: '💚', blurb: 'Keep everyone singing.' },
    { name: 'Silver Tongue', icon: '💬', blurb: 'Words are the sharpest weapon.' },
  ], [
    { id: 'b_v1', branch: 0, row: 1, name: 'Blade Flourish', icon: '🤺', desc: '+1 to attack and damage.', mods: { atk: 1, dmg: 1 } },
    { id: 'b_v2', branch: 0, row: 2, name: 'Cutting Words', icon: '✂', desc: 'Vicious Mockery twice per fight, with one more d6.', mods: { uses: { vicious_mockery: 1 }, boost: { vicious_mockery: 1 } } },
    { id: 'b_v3', branch: 0, row: 3, name: 'Hideous Laughter', icon: '🤣', desc: 'New ability. ' + ABILITIES.laughter.desc, grants: 'laughter' },
    { id: 'b_v4', branch: 0, row: 4, name: 'Battle Magic', icon: '🎼', desc: 'After using any ability, follow up with a free weapon attack.', mods: { battleMagic: true } },
    { id: 'b_h1', branch: 1, row: 1, name: 'Healing Word', icon: '💚', desc: 'New ability. ' + ABILITIES.healing_word.desc, grants: 'healing_word' },
    { id: 'b_h2', branch: 1, row: 2, name: 'Song of Rest', icon: '🎶', desc: 'Potions heal +4. After each victory the whole party heals 1d8.', mods: { potion: 4, afterWinHeal: 8 } },
    { id: 'b_h3', branch: 1, row: 3, name: 'Mass Healing', icon: '💞', desc: 'Healing Word three times per fight, and it heals the whole party.', mods: { uses: { healing_word: 1 }, boost: { healing_word: 1 } } },
    { id: 'b_h4', branch: 1, row: 4, name: 'Guardian Song', icon: '🕊', desc: 'Once per fight, the first of you to fall is restored to a third of their HP.', mods: { saveAlly: true } },
    { id: 'b_t1', branch: 2, row: 1, name: 'Silver Tongue', icon: '💬', desc: '+2 on CHA checks and on Talk in fights.', mods: { checks: { cha: 2 }, talk: 2 } },
    { id: 'b_t2', branch: 2, row: 2, name: 'Captivate', icon: '💫', desc: 'Talking a foe down always wins a friend (beasts too, but not bosses).', mods: { befriend: true } },
    { id: 'b_t3', branch: 2, row: 3, name: 'Song of Courage', icon: '🎺', desc: 'New ability. ' + ABILITIES.courage.desc, grants: 'courage' },
    { id: 'b_t4', branch: 2, row: 4, name: 'Legend', icon: '📖', desc: '+25% gold, and merchants knock 20% off their prices.', mods: { gold: 25, discount: 20 } },
  ]),
};

const NODE_BY_ID: Record<string, TalentNode> = Object.fromEntries(
  Object.values(TREES).flatMap((t) => t.nodes).map((n) => [n.id, n]),
);

export const talent = (id: string): TalentNode | undefined => NODE_BY_ID[id];
export const treeSize = (cls: ClassId) => TREES[cls].nodes.length;

/** Sum of every passive the hero has learned. */
export function modsOf(h: Hero): Mods {
  const out: Mods = {};
  for (const id of h.talents ?? []) {
    const m = NODE_BY_ID[id]?.mods;
    if (m) mergeMods(out, m);
  }
  return out;
}

export function mergeMods(into: Mods, m: Mods): Mods {
  for (const [k, v] of Object.entries(m) as [keyof Mods, unknown][]) {
    if (typeof v === 'number') (into as Record<string, number>)[k] = ((into as Record<string, number>)[k] ?? 0) + v;
    else if (typeof v === 'boolean') (into as Record<string, boolean>)[k] = (into as Record<string, boolean>)[k] || v;
    else if (v && typeof v === 'object') {
      const tgt = ((into as Record<string, Record<string, number>>)[k] ??= {});
      for (const [kk, vv] of Object.entries(v as Record<string, number>)) tgt[kk] = (tgt[kk] ?? 0) + vv;
    }
  }
  return into;
}

/** Abilities this hero can use in a fight, signature first. */
export function abilitiesOf(h: Hero): AbilityId[] {
  const out: AbilityId[] = [TREES[h.cls].root];
  for (const id of h.talents ?? []) {
    const g = NODE_BY_ID[id]?.grants;
    if (g) out.push(g);
  }
  out.push('first_aid');
  return out;
}

export function usesOf(h: Hero, id: AbilityId, mods = modsOf(h)) {
  return ABILITIES[id].uses + (mods.uses?.[id] ?? 0);
}

export type LearnState = 'learned' | 'available' | 'locked-level' | 'locked-path' | 'no-points';

export function learnState(h: Hero, node: TalentNode): LearnState {
  if (h.talents.includes(node.id)) return 'learned';
  if (node.cls !== h.cls) return 'locked-path';
  if (node.row > 1) {
    const prev = TREES[h.cls].nodes.find((n) => n.branch === node.branch && n.row === node.row - 1);
    if (prev && !h.talents.includes(prev.id)) return 'locked-path';
  }
  if (h.level < ROW_LEVEL[node.row]) return 'locked-level';
  if (h.points <= 0) return 'no-points';
  return 'available';
}

/** Learn a talent. Returns false (and changes nothing) if it isn't available. */
export function learn(h: Hero, id: string): boolean {
  const node = NODE_BY_ID[id];
  if (!node || learnState(h, node) !== 'available') return false;
  h.talents.push(id);
  h.points--;
  if (node.mods?.hp) {
    h.maxHp += node.mods.hp;
    h.hp += node.mods.hp;
  }
  return true;
}

export function learnable(h: Hero): TalentNode[] {
  return TREES[h.cls].nodes.filter((n) => learnState(h, n) === 'available');
}

/** Nodes that could ever still be learned (ignoring points and level). */
export function remainingNodes(h: Hero) {
  return TREES[h.cls].nodes.filter((n) => !h.talents.includes(n.id)).length;
}

/**
 * Pick a talent for a companion who's choosing on their own: they favour one
 * branch (from their personality), go deeper when they can, and fall back to
 * whatever is open.
 */
export function autoPick(h: Hero, favourite: number): TalentNode | null {
  const open = learnable(h);
  if (!open.length) return null;
  const order = [favourite, (favourite + 1) % 3, (favourite + 2) % 3];
  open.sort((a, b) => order.indexOf(a.branch) - order.indexOf(b.branch) || b.row - a.row);
  return open[0];
}
