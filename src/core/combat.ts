// Turn-based party combat. The hero acts, then each companion (driven by a
// simple tactical AI that uses the same abilities the hero would), then the foe
// picks one of you to strike. Everything is decided here; the UI only animates.
import { CLASSES, armorClass, attackBonus, damageBonus, checkBonus, rollD20, rollDice, d, heal, critOn, mod, type D20Roll } from './rules';
import { ABILITIES, abilitiesOf, modsOf, usesOf, type AbilityId, type Mods } from './talents';
import { partyOf, partyMods, helpers } from './companions';
import { randInt, weighted, chance, pick } from './rng';
import { ENEMY_TAUNTS } from './content';
import type { EnemyKind, EnemySpec, GameState, Hero, Stat } from './types';

export type Intent = 'attack' | 'heavy' | 'guard';

export interface Enemy {
  name: string; kind: EnemyKind; emoji: string;
  hp: number; maxHp: number; ac: number; atk: number;
  dmgN: number; dmgD: number; dmgB: number;
  talkDC: number; talkStat: Stat; talkable: boolean;
  xp: number; gold: number; boss: boolean; tier: number;
  intent: Intent;
  /** attacks per turn: deep-wilds foes facing a party strike more than once */
  attacks: number;
  /** turns it will lose */
  stun: number;
  /** its next N attacks have disadvantage */
  dis: number;
}

export interface DmgRoll { dice: number[]; sides: number; bonus: number; total: number }

export interface Beat {
  actor: 'you' | 'ally' | 'foe' | 'system';
  /** who acted (unit id) for 'you' / 'ally' beats */
  who?: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'crit';
  d20?: D20Roll;
  dmg?: DmgRoll;
  /** where the floating number appears: on the foe, or on a party member */
  floatOn?: 'enemy' | 'unit';
  /** unit id for floatOn 'unit' */
  target?: string;
  floatText?: string;
}

/** A party member in a fight: the player ('you') or a companion (their NPC id). */
export interface Unit { id: string; name: string; hero: Hero; isPlayer: boolean; mods: Mods }

export interface UnitState {
  used: Partial<Record<AbilityId, number>>;
  ward: number;
  defending: boolean;
  vanished: boolean;
  advNext: boolean;
  firstMissUsed: boolean;
  shieldUsed: boolean;
  lastStandUsed: boolean;
}

export interface CombatState {
  enemy: Enemy;
  round: number;
  deathSaveUsed: boolean;
  units: Record<string, UnitState>;
  /** Battle Cry */
  partyAtk: number;
  /** Song of Courage */
  partyAc: number;
  /** Foresight: the party attacks with advantage during this round */
  advRound: number;
  saveAllyUsed: boolean;
  end: null | 'win' | 'flee' | 'friend' | 'down';
}

export type BaseAction = 'attack' | 'defend' | 'potion' | 'talk' | 'flee';
/** 'ability' is shorthand for the class's signature ability. */
export type Action = BaseAction | AbilityId | 'ability';

const KIND_STATS: Record<EnemyKind, { hp: number; ac: number; talk: Stat; talkBase: number; talkable: boolean }> = {
  beast: { hp: 1.0, ac: 0, talk: 'wis', talkBase: 11, talkable: true },
  humanoid: { hp: 0.95, ac: 1, talk: 'cha', talkBase: 10, talkable: true },
  undead: { hp: 1.1, ac: 0, talk: 'cha', talkBase: 17, talkable: false },
  monster: { hp: 1.25, ac: 1, talk: 'cha', talkBase: 15, talkable: true },
  spirit: { hp: 0.85, ac: 2, talk: 'cha', talkBase: 12, talkable: true },
};

/** Foes scale with the size of your party: companions fight, so foes are tougher. */
export const PARTY_HP = 0.7;
/** extra enemy HP per tier beyond the first */
export const TIER_HP = 0.4;
/** extra enemy damage per tier beyond the first */
export const DMG_STEP = 2;
/** from this tier, foes facing a party attack more than once */
export const MULTI_TIER = 3;
/** A heavy blow hits this much harder; bracing (Defend) halves it. Reading the foe's intent matters. */
export const HEAVY_MULT = 3;
/** how often a foe winds up a heavy blow (weight against 6 for a normal attack) */
export const HEAVY_ODDS = 3;
/** Level a hero is expected to be when first reaching a tier. */
export const tierLevel = (tier: number) => 1 + (tier - 1) * 3;

/**
 * `allies` = companions fighting with you; `heroLevel` lets the deep wilds keep
 * pace with a hero who has outgrown them (the world grows with you). Those foes
 * are worth +10% XP per level of the gap, so levelling stays smooth past tier 5.
 */
export function makeEnemy(spec: EnemySpec, tier: number, boss = false, allies = 0, heroLevel = 1): Enemy {
  const k = KIND_STATS[spec.kind] ?? KIND_STATS.monster;
  const over = Math.max(0, heroLevel - tierLevel(tier));
  // Deeper tiers grow faster than linearly: heroes there have talents and signature abilities.
  const depth = 1 + TIER_HP * (tier - 1);
  const hp = Math.round((9 + tier * 8 + randInt(0, tier * 3)) * k.hp * depth * (boss ? 1.5 : 1) * (1 + PARTY_HP * allies) * (1 + 0.06 * over));
  return {
    name: spec.name, kind: spec.kind, emoji: spec.emoji || '👹',
    hp, maxHp: hp, ac: 10 + tier + k.ac + (boss ? 1 : 0) + Math.floor(over / 5),
    atk: 2 + tier + Math.floor((tier - 1) / 2) + (boss ? 1 : 0) + Math.floor(over / 3),
    dmgN: tier >= 4 ? 2 : 1, dmgD: [4, 6, 8, 6, 8][tier - 1] ?? 8, dmgB: Math.round((tier - 1) * DMG_STEP) + (boss ? 2 : 0) + allies + Math.floor(over / 3),
    talkDC: Math.min(22, k.talkBase + tier + (boss ? 3 : 0)), talkStat: k.talk, talkable: k.talkable,
    xp: Math.round(30 * tier * (boss ? 3 : 1) * (1 + 0.1 * over)), gold: tier * randInt(3, 8) * (boss ? 3 : 1), boss, tier,
    intent: 'attack', stun: 0, dis: 0,
    attacks: 1 + (allies >= 1 && tier >= MULTI_TIER ? 1 : 0) + (allies >= 2 && tier >= MULTI_TIER + 2 ? 1 : 0),
  };
}

export function startCombat(enemy: Enemy): CombatState {
  enemy.intent = 'attack';
  return { enemy, round: 1, deathSaveUsed: false, units: {}, partyAtk: 0, partyAc: 0, advRound: 0, saveAllyUsed: false, end: null };
}

export function intentText(e: Enemy): { icon: string; text: string } {
  if (e.stun > 0) return { icon: '💫', text: `${e.name} is stunned and will lose its turn` };
  const dis = e.dis > 0 ? ' (at disadvantage)' : '';
  if (e.intent === 'heavy') return { icon: '⚠️', text: `${e.name} winds up a crushing blow (×${HEAVY_MULT} damage)!${e.attacks > 1 ? ` (+${e.attacks - 1} more)` : ''}${dis} Defend to halve it.` };
  if (e.intent === 'guard') return { icon: '🛡️', text: `${e.name} raises its guard (+3 AC)` };
  const multi = e.attacks > 1 ? (e.attacks === 2 ? ' — two attacks' : ` — ${e.attacks} attacks`) : '';
  return { icon: '⚔️', text: `${e.name} ${pick(ENEMY_TAUNTS)} and readies ${multi ? 'its assault' : 'an attack'}${multi}${dis}` };
}

/** Everyone fighting on your side, hero first. */
export function partyUnits(s: GameState): Unit[] {
  const p = s.player;
  const out: Unit[] = [{ id: 'you', name: p.name, hero: p, isPlayer: true, mods: modsOf(p) }];
  for (const n of partyOf(s)) if (n.hero) out.push({ id: n.id, name: n.name, hero: n.hero, isPlayer: false, mods: modsOf(n.hero) });
  return out;
}

export function unitState(cs: CombatState, u: Unit): UnitState {
  return (cs.units[u.id] ??= {
    used: {}, defending: false, vanished: false, advNext: false,
    firstMissUsed: false, shieldUsed: false, lastStandUsed: false,
    ward: u.mods.ward ? u.hero.level + 2 + Math.max(0, mod(u.hero.stats.int)) : 0,
  });
}

export const isDown = (u: Unit) => u.hero.hp <= 0;

/** Uses left this fight. */
export function usesLeft(cs: CombatState, u: Unit, id: AbilityId) {
  return usesOf(u.hero, id, u.mods) - (unitState(cs, u).used[id] ?? 0);
}

/** AC including the party's auras and buffs. */
export function unitAc(cs: CombatState, units: Unit[], u: Unit) {
  const aura = units.filter((x) => x !== u && !isDown(x)).reduce((a, x) => a + (x.mods.partyAc ?? 0), 0);
  return armorClass(u.hero, u.mods) + aura + cs.partyAc + (unitState(cs, u).defending ? 4 : 0);
}

export function unitAtk(cs: CombatState, units: Unit[], u: Unit) {
  const lead = units.filter((x) => x !== u && !isDown(x)).reduce((a, x) => a + (x.mods.partyAtk ?? 0), 0);
  return attackBonus(u.hero, u.mods) + lead + cs.partyAtk;
}

export const potionHeal = (s: GameState) => ({ n: 2, sides: 4, bonus: 4 + (partyMods(s).potion ?? 0) });

function resolveAction(s: GameState, a: Action): Action {
  return a === 'ability' ? abilitiesOf(s.player)[0] : a;
}

export function canUse(s: GameState, cs: CombatState, action: Action): boolean {
  const a = resolveAction(s, action);
  const p = s.player;
  if (a === 'potion') return p.potions > 0 && p.hp < p.maxHp;
  if (a in ABILITIES) {
    const units = partyUnits(s);
    const me = units[0];
    const id = a as AbilityId;
    if (!abilitiesOf(p).includes(id) || usesLeft(cs, me, id) <= 0) return false;
    if (id === 'first_aid' || id === 'healing_word') return units.some((u) => u.hero.hp < u.hero.maxHp);
    if (id === 'second_wind') return p.hp < p.maxHp;
    if (id === 'command') return units.some((u) => !u.isPlayer && !isDown(u));
    return true;
  }
  return true;
}

function dmg(n: number, sides: number, bonus: number, crit = false): DmgRoll {
  const dice = rollDice(crit ? n * 2 : n, sides);
  return { dice, sides, bonus, total: Math.max(1, dice.reduce((a, b) => a + b, 0) + bonus) };
}

interface Ctx { s: GameState; cs: CombatState; units: Unit[]; beats: Beat[] }

const enemyAc = (cs: CombatState) => cs.enemy.ac + (cs.enemy.intent === 'guard' && cs.enemy.stun <= 0 ? 3 : 0);

function hitEnemy(cs: CombatState, amount: number) {
  cs.enemy.hp = Math.max(0, cs.enemy.hp - amount);
  if (cs.enemy.hp <= 0) cs.end = 'win';
}

const actor = (u: Unit): Beat['actor'] => (u.isPlayer ? 'you' : 'ally');
const subj = (u: Unit) => (u.isPlayer ? 'You' : u.name);

interface AttackOpts {
  adv?: -1 | 0 | 1;
  label: string;
  extraDice?: number;
  sneakDice?: number;
  /** damage multiplier */
  mult?: number;
  /** a hit kills outright */
  lethal?: boolean;
  onHit?: () => string;
}

function weaponAttack(c: Ctx, u: Unit, o: AttackOpts): boolean {
  const { cs, s } = c;
  const st = unitState(cs, u);
  const h = u.hero;
  let adv = o.adv ?? 0;
  if (cs.advRound === cs.round || (u.mods.firstAdv && cs.round === 1)) adv = 1;
  if (st.advNext) { adv = 1; st.advNext = false; }
  const ab = unitAtk(cs, c.units, u);
  const r = rollD20(ab, enemyAc(cs), adv, [{ label: 'ATK', value: ab }], { lucky: u.mods.lucky, critOn: critOn(h, u.mods) });
  if (u.isPlayer && r.kept === 20) s.stats.crits++;
  if (!r.success) {
    if (u.isPlayer && r.fumble) s.stats.fumbles++;
    c.beats.push({ actor: actor(u), who: u.id, text: r.fumble ? `${o.label} — ${u.isPlayer ? 'you stumble' : `${u.name} stumbles`} badly!` : `${o.label} misses.`, tone: 'bad', d20: r, floatOn: 'enemy', floatText: 'miss' });
    return false;
  }
  const dr = dmg(1 + (o.extraDice ?? 0), h.weapon.die ?? 6, damageBonus(h, u.mods), r.crit);
  const add = (n: number, sides: number) => {
    const extra = rollDice(r.crit ? n * 2 : n, sides);
    dr.dice.push(...extra);
    dr.total += extra.reduce((a, b) => a + b, 0);
  };
  if (u.mods.extraDie) add(1, u.mods.extraDie);
  if (o.sneakDice) add(o.sneakDice, 6);
  if (o.mult && o.mult > 1) dr.total = Math.round(dr.total * o.mult);
  if (o.lethal) dr.total = Math.max(dr.total, cs.enemy.hp);
  hitEnemy(cs, dr.total);
  const extraText = !cs.end && o.onHit ? ` ${o.onHit()}` : '';
  c.beats.push({ actor: actor(u), who: u.id, text: `${r.crit ? 'CRITICAL! ' : ''}${o.label} hits for ${dr.total}!${o.lethal ? ' A killing blow!' : ''}${extraText}`, tone: r.crit ? 'crit' : 'good', d20: r, dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
  return true;
}

const basicLabel = (u: Unit) => (u.hero.cls === 'mage' ? `${u.isPlayer ? 'Your' : `${u.name}'s`} firebolt` : u.isPlayer ? `Your ${u.hero.weapon.name}` : `${u.name}'s ${u.hero.weapon.name}`);

/** Heal someone: the fallen first, then whoever is lowest. */
function mostWounded(units: Unit[]): Unit | null {
  const hurt = units.filter((u) => u.hero.hp < u.hero.maxHp);
  if (!hurt.length) return null;
  hurt.sort((a, b) => a.hero.hp / a.hero.maxHp - b.hero.hp / b.hero.maxHp);
  return hurt[0];
}

/** Heal a party member (reviving a fallen companion). `text` builds the log line from the amount. */
function healUnit(c: Ctx, by: Unit, target: Unit, dr: DmgRoll, text: (got: number, name: string) => string) {
  const wasDown = !target.isPlayer && isDown(target);
  if (wasDown) target.hero.hp = 0;
  const got = heal(target.hero, dr.total);
  const name = target === by ? (by.isPlayer ? 'yourself' : 'themself') : target.isPlayer ? 'you' : target.name;
  c.beats.push({ actor: actor(by), who: by.id, text: `${text(got, name)}${wasDown ? ` ${target.name} is back on their feet!` : ''}`, tone: 'good', dmg: dr, floatOn: 'unit', target: target.id, floatText: `+${got}` });
}

function useAbility(c: Ctx, u: Unit, id: AbilityId) {
  const { cs } = c;
  const e = cs.enemy;
  const st = unitState(cs, u);
  st.used[id] = (st.used[id] ?? 0) + 1;
  const boost = u.mods.boost?.[id] ?? 0;
  const def = ABILITIES[id];
  /** "Mighty Blow" for you, "Brakka's Mighty Blow" for a companion */
  const tag = u.isPlayer ? def.name : `${u.name.split(' ')[0]}'s ${def.name}`;
  const say = (text: string, tone: Beat['tone'] = 'good', extra: Partial<Beat> = {}) => c.beats.push({ actor: actor(u), who: u.id, text, tone, ...extra });
  const spell = (n: number, sides: number, verb: string) => {
    const dr = dmg(n, sides, 0);
    hitEnemy(cs, dr.total);
    say(`${tag}! ${verb} ${e.name} for ${dr.total}.`, 'good', { dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
  };
  switch (id) {
    case 'mighty_blow':
      weaponAttack(c, u, { adv: 1, extraDice: 1 + boost, label: tag });
      break;
    case 'titan_strike':
      weaponAttack(c, u, { adv: 1, extraDice: 2, label: tag, onHit: () => { e.stun = Math.max(e.stun, 1); return `${e.name} reels, stunned!`; } });
      break;
    case 'sneak_attack':
      weaponAttack(c, u, { adv: 1, sneakDice: 2 + boost, label: tag });
      break;
    case 'execute': {
      const lethal = !e.boss && e.hp <= e.maxHp / 4;
      weaponAttack(c, u, { adv: 1, label: tag, mult: e.hp < e.maxHp / 2 ? 2 : 1, lethal });
      break;
    }
    case 'command': {
      say(`${subj(u)} ${u.isPlayer ? 'give' : 'gives'} the order — attack as one!`, 'neutral');
      for (const ally of c.units) {
        if (ally === u || isDown(ally) || cs.end) continue;
        weaponAttack(c, ally, { adv: 1, label: `${ally.name} answers` });
      }
      if (!cs.end) weaponAttack(c, u, { label: basicLabel(u) });
      break;
    }
    case 'thunderwave':
      spell(3 + boost, 8, 'A wall of force slams');
      break;
    case 'fireball':
      spell(6 + boost, 6, 'Flames engulf');
      break;
    case 'vicious_mockery': {
      const dr = dmg(2 + boost, 6, 0);
      hitEnemy(cs, dr.total);
      e.dis += 1;
      say(`${subj(u)} mock${u.isPlayer ? '' : 's'} ${e.name} cruelly: ${dr.total} psychic damage. It's rattled!`, 'good', { dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
      break;
    }
    case 'laughter': {
      const dr = dmg(3, 6, 0);
      hitEnemy(cs, dr.total);
      if (e.boss) e.dis += 1; else e.stun = Math.max(e.stun, 1);
      say(`${tag}! ${e.name} ${e.boss ? 'snorts, distracted' : 'collapses in helpless laughter'} (${dr.total} psychic).`, 'good', { dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
      break;
    }
    case 'hold_monster':
      e.stun = Math.max(e.stun, e.boss ? 1 : 2);
      say(`${u.isPlayer ? '' : `${u.name.split(' ')[0]}: `}Arcane chains bind ${e.name}! It loses ${e.boss ? 'its next turn' : 'two turns'}.`, 'crit', { floatOn: 'enemy', floatText: '⛓' });
      break;
    case 'dirty_trick':
      e.dis += 2;
      say(`${u.isPlayer ? '' : `${u.name.split(' ')[0]}: `}Sand in the eyes! ${e.name}'s next two attacks have disadvantage.`, 'good', { floatOn: 'enemy', floatText: '👁' });
      break;
    case 'second_wind': {
      const dr = dmg(1, 10, u.hero.level);
      healUnit(c, u, u, dr, (got) => `${subj(u)} ${u.isPlayer ? 'catch' : 'catches'} a second wind: +${got} HP.`);
      break;
    }
    case 'battle_cry':
      cs.partyAtk += 2;
      say(`${subj(u)} roar${u.isPlayer ? '' : 's'} a battle cry! The party gets +2 to attack.`, 'good', { floatOn: 'unit', target: u.id, floatText: '📯' });
      break;
    case 'courage':
      cs.partyAc += 2;
      say(`${u.isPlayer ? 'Your' : `${u.name.split(' ')[0]}'s`} Song of Courage rings out — the party gets +2 AC.`, 'good', { floatOn: 'unit', target: u.id, floatText: '🎺' });
      break;
    case 'foresight':
      cs.advRound = cs.round;
      e.dis += 1;
      say(`${subj(u)} glimpse${u.isPlayer ? '' : 's'} the next moments: the party strikes with advantage this round.`, 'good', { floatOn: 'unit', target: u.id, floatText: '🔮' });
      break;
    case 'vanish':
      st.vanished = true;
      st.advNext = true;
      say(`${subj(u)} melt${u.isPlayer ? '' : 's'} into the shadows.`, 'good', { floatOn: 'unit', target: u.id, floatText: '🫥' });
      break;
    case 'healing_word': {
      const targets = boost ? c.units.filter((x) => x.hero.hp < x.hero.maxHp) : [mostWounded(c.units)].filter(Boolean) as Unit[];
      for (const t of targets) healUnit(c, u, t, dmg(2, 4, Math.max(0, mod(u.hero.stats.cha))), (got, name) => `${subj(u)} ${u.isPlayer ? 'sing' : 'sings'} a healing word for ${name}: +${got} HP.`);
      break;
    }
    case 'first_aid': {
      const t = mostWounded(c.units);
      if (t) healUnit(c, u, t, dmg(1, 8, Math.ceil(u.hero.level / 2)), (got, name) => `${subj(u)} ${u.isPlayer ? 'patch' : 'patches'} up ${name}: +${got} HP.`);
      break;
    }
  }
  // Battle Magic: every spell or trick flows into a free strike.
  if (u.mods.battleMagic && !def.bonus && id !== 'first_aid' && !cs.end) weaponAttack(c, u, { label: u.isPlayer ? 'Battle Magic' : `${u.name.split(' ')[0]}'s Battle Magic` });
}

// ---------------------------------------------------------------------------

/** A bonus-action ability for the player: resolves now, and the turn goes on. */
export function useBonus(s: GameState, cs: CombatState, id: AbilityId): Beat[] {
  const c: Ctx = { s, cs, units: partyUnits(s), beats: [] };
  if (!ABILITIES[id]?.bonus || !canUse(s, cs, id)) return [];
  useAbility(c, c.units[0], id);
  return c.beats;
}

/** Resolve one full round. `useInspiration` gives the player advantage on this action. */
export function playRound(s: GameState, cs: CombatState, action: Action, useInspiration = false): Beat[] {
  const units = partyUnits(s);
  const c: Ctx = { s, cs, units, beats: [] };
  const p = s.player, me = units[0], e = cs.enemy;
  const myState = unitState(cs, me);
  myState.defending = false;
  const adv: -1 | 0 | 1 = useInspiration ? 1 : 0;
  if (useInspiration) p.inspiration = false;
  const pm = partyMods(s);
  let a = resolveAction(s, action);

  if (a in ABILITIES && ABILITIES[a as AbilityId].bonus) {
    if (canUse(s, cs, a)) useAbility(c, me, a as AbilityId);
    a = 'attack';
  }

  // ---- Player action ----
  switch (a) {
    case 'attack':
      weaponAttack(c, me, { adv, label: basicLabel(me) });
      break;
    case 'defend': {
      myState.defending = true;
      const h = heal(p, d(4) + 1);
      c.beats.push({ actor: 'you', who: 'you', text: `You brace behind your guard${h ? ` and catch your breath (+${h} HP)` : ''}.`, tone: 'neutral', floatOn: 'unit', target: 'you', floatText: h ? `+${h}` : '🛡' });
      break;
    }
    case 'potion': {
      p.potions--;
      const ph = potionHeal(s);
      const dr = dmg(ph.n, ph.sides, ph.bonus);
      const h = heal(p, dr.total);
      c.beats.push({ actor: 'you', who: 'you', text: `You gulp a potion: +${h} HP.`, tone: 'good', dmg: dr, floatOn: 'unit', target: 'you', floatText: `+${h}` });
      break;
    }
    case 'talk': {
      const cb = checkBonus(p, e.talkStat, helpers(s));
      if (me.mods.talk) cb.parts.push({ label: 'TALENT', value: me.mods.talk }), (cb.total += me.mods.talk);
      const dc = e.talkable ? e.talkDC : e.talkDC + 5;
      const r = rollD20(cb.total, dc, p.cls === 'bard' ? 1 : adv, cb.parts, { lucky: pm.lucky });
      if (r.success) {
        const canBefriend = !e.boss && (e.kind === 'humanoid' || e.kind === 'spirit' || !!pm.befriend);
        const befriend = canBefriend && (pm.befriend || r.crit || chance(0.55));
        cs.end = befriend ? 'friend' : 'flee';
        c.beats.push({ actor: 'you', who: 'you', text: befriend ? `Your words land. ${e.name} lowers their weapon — and offers a hand.` : `${e.name} hesitates… then slinks away.`, tone: r.crit ? 'crit' : 'good', d20: r });
        return c.beats;
      }
      c.beats.push({ actor: 'you', who: 'you', text: e.talkable ? `${e.name} isn't convinced.` : `${e.name} cannot be reasoned with!`, tone: 'bad', d20: r });
      break;
    }
    case 'flee': {
      const cb = checkBonus(p, 'dex');
      const r = rollD20(cb.total, 9 + e.tier + (e.boss ? 4 : 0), adv, cb.parts, { lucky: pm.lucky });
      if (r.success || ((me.mods.flee ?? 0) >= 10 && !e.boss)) {
        cs.end = 'flee';
        c.beats.push({ actor: 'you', who: 'you', text: r.success ? 'You break away and escape!' : 'You slip away like a shadow!', tone: 'good', d20: r });
        return c.beats;
      }
      c.beats.push({ actor: 'you', who: 'you', text: 'You try to run, but it cuts you off!', tone: 'bad', d20: r });
      if (e.intent === 'guard') e.intent = 'attack';
      break;
    }
    default:
      if (a in ABILITIES && canUse(s, cs, a)) {
        // Inspiration rides along on the ability's own attack roll.
        if (adv) myState.advNext = true;
        useAbility(c, me, a as AbilityId);
      } else weaponAttack(c, me, { adv, label: basicLabel(me) });
  }
  if (cs.end) return c.beats;

  // ---- Companions ----
  for (const ally of units.slice(1)) {
    if (cs.end) break;
    if (isDown(ally)) continue;
    allyTurn(c, ally);
  }
  if (cs.end) return c.beats;

  // ---- Foe ----
  enemyTurn(c);
  if (cs.end) return c.beats;

  // ---- End of round ----
  for (const u of units) {
    if (isDown(u) || !u.mods.regen || u.hero.hp >= u.hero.maxHp) continue;
    const got = heal(u.hero, u.mods.regen);
    c.beats.push({ actor: actor(u), who: u.id, text: `${subj(u)} ${u.isPlayer ? 'refuse' : 'refuses'} to break (+${got} HP).`, tone: 'neutral', floatOn: 'unit', target: u.id, floatText: `+${got}` });
  }
  cs.round++;
  e.intent = weighted<Intent>([['attack', 6], ['heavy', HEAVY_ODDS + (e.boss ? 1.5 : 0)], ['guard', e.hp < e.maxHp / 2 ? 2 : 1]]);
  return c.beats;
}

/** Companion tactics: heal when it matters, open with buffs, spend abilities, otherwise attack. */
function allyTurn(c: Ctx, u: Unit) {
  const { cs } = c;
  const e = cs.enemy, h = u.hero;
  const st = unitState(cs, u);
  st.defending = false;
  const known = abilitiesOf(h);
  const left = (id: AbilityId) => known.includes(id) && usesLeft(cs, u, id) > 0;
  const hurt = (f: number) => c.units.some((x) => x.hero.hp < x.hero.maxHp * f);
  const foeHealthy = e.hp > e.maxHp * 0.4;

  // Bonus actions first.
  if (left('healing_word') && hurt(0.5)) useAbility(c, u, 'healing_word');
  if (left('second_wind') && h.hp < h.maxHp * 0.5) useAbility(c, u, 'second_wind');
  for (const id of ['battle_cry', 'courage', 'foresight'] as AbilityId[]) if (left(id) && foeHealthy) useAbility(c, u, id);
  if (left('vanish') && h.hp < h.maxHp * 0.4) useAbility(c, u, 'vanish');
  if (cs.end) return;

  // Main action.
  if (left('first_aid') && (c.units.some(isDown) || hurt(0.35))) return useAbility(c, u, 'first_aid');
  const pickMain = (): AbilityId | null => {
    for (const id of known) {
      if (ABILITIES[id].bonus || id === 'first_aid' || !left(id)) continue;
      switch (id) {
        case 'titan_strike': case 'hold_monster': case 'laughter':
          if (e.stun <= 0 && (e.intent === 'heavy' || e.hp > e.maxHp * 0.5)) return id;
          break;
        case 'execute':
          if (e.hp < e.maxHp * 0.5) return id;
          break;
        case 'dirty_trick':
          if (e.intent === 'heavy' || cs.round >= 2) return id;
          break;
        case 'command':
          return id;
        default:
          if (e.hp > e.maxHp * 0.25 || cs.round >= 3) return id;
      }
    }
    return null;
  };
  const main = pickMain();
  if (main) return useAbility(c, u, main);
  if (h.hp < h.maxHp * 0.25 && !left('first_aid')) {
    st.defending = true;
    const got = heal(h, d(4) + 1);
    c.beats.push({ actor: 'ally', who: u.id, text: `${u.name} raises a guard${got ? ` (+${got} HP)` : ''}.`, tone: 'neutral', floatOn: 'unit', target: u.id, floatText: got ? `+${got}` : '🛡' });
    return;
  }
  weaponAttack(c, u, { label: basicLabel(u) });
}

function enemyTurn(c: Ctx) {
  const { cs, units } = c;
  const e = cs.enemy;
  const clearVanish = () => units.forEach((u) => (unitState(cs, u).vanished = false));
  if (e.stun > 0) {
    e.stun--;
    c.beats.push({ actor: 'foe', text: `${e.name} is stunned and can't act!`, tone: 'good', floatOn: 'enemy', floatText: '💫' });
    clearVanish();
    return;
  }
  if (e.intent === 'guard') {
    const h = Math.min(e.maxHp - e.hp, d(4) + e.tier);
    e.hp += h;
    c.beats.push({ actor: 'foe', text: `${e.name} holds its guard${h ? ` and recovers ${h} HP` : ''}.`, tone: 'neutral', floatOn: 'enemy', floatText: h ? `+${h}` : '🛡' });
    clearVanish();
    return;
  }
  for (let i = 0; i < (e.attacks ?? 1) && !cs.end; i++) strike(c, i > 0);
  clearVanish();
}

/** One attack against one party member. Follow-up attacks of a multiattack are a little less accurate. */
function strike(c: Ctx, followUp: boolean) {
  const { cs, units } = c;
  const e = cs.enemy;
  const standing = units.filter((u) => !isDown(u));
  const targets = standing.filter((u) => !unitState(cs, u).vanished);
  if (!targets.length) {
    c.beats.push({ actor: 'foe', text: `${e.name} lashes out at shadows — and finds nothing!`, tone: 'good', floatOn: 'unit', target: 'you', floatText: 'miss' });
    return;
  }
  const t = weighted<Unit>(targets.map((u) => [u, (u.isPlayer ? 2 : 1) * (1 + (u.mods.taunt ?? 0))]));
  const tst = unitState(cs, t);
  const ac = unitAc(cs, units, t);
  const adv: -1 | 0 = e.dis > 0 ? -1 : 0;
  if (e.dis > 0) e.dis--;
  const atk = e.atk - (followUp ? 2 : 0);
  const r = rollD20(atk, ac, adv, [{ label: 'ATK', value: atk }]);
  const heavy = e.intent === 'heavy' && !followUp;
  const whom = t.isPlayer ? 'you' : t.name;
  if (r.success && t.mods.firstMiss && !tst.firstMissUsed) {
    tst.firstMissUsed = true;
    c.beats.push({ actor: 'foe', text: `${e.name} strikes — but ${t.isPlayer ? 'you twist' : `${t.name} twists`} aside at the last instant!`, tone: 'good', d20: r, floatOn: 'unit', target: t.id, floatText: 'dodge' });
    riposte(c, t);
    return;
  }
  if (r.success && !r.crit && t.mods.shield && !tst.shieldUsed && r.total < ac + 5) {
    tst.shieldUsed = true;
    c.beats.push({ actor: 'foe', text: `A shimmering Shield turns ${e.name}'s blow away from ${whom}!`, tone: 'good', d20: r, floatOn: 'unit', target: t.id, floatText: '🛡' });
    return;
  }
  if (!r.success) {
    c.beats.push({ actor: 'foe', text: `${e.name} attacks ${whom} — ${tst.defending ? 'the guard holds!' : 'and misses!'}`, tone: 'good', d20: r, floatOn: 'unit', target: t.id, floatText: 'miss' });
    riposte(c, t);
    return;
  }
  const dr = dmg(e.dmgN, e.dmgD, e.dmgB + (heavy ? 2 : 0), r.crit);
  let total = heavy ? Math.round(dr.total * HEAVY_MULT) : dr.total;
  const braced = heavy && (tst.defending || t.mods.heavyHalf);
  if (braced) total = Math.ceil(total / 2);
  let warded = 0;
  if (tst.ward > 0) {
    warded = Math.min(tst.ward, total);
    tst.ward -= warded;
    total -= warded;
  }
  dr.total = total;
  t.hero.hp = Math.max(0, t.hero.hp - total);
  const note = [braced ? 'braced!' : '', warded ? `ward soaks ${warded}` : ''].filter(Boolean).join(', ');
  c.beats.push({ actor: 'foe', text: `${r.crit ? 'Critical hit! ' : ''}${e.name} ${heavy ? 'lands a crushing blow on' : 'strikes'} ${whom}: -${total} HP${note ? ` (${note})` : ''}.`, tone: 'bad', d20: r, dmg: dr, floatOn: 'unit', target: t.id, floatText: `-${total}` });
  if (t.hero.hp <= 0) fall(c, t);
}

function riposte(c: Ctx, u: Unit) {
  if (!u.mods.riposte || c.cs.end) return;
  const dr = dmg(1, u.mods.riposte, Math.max(0, mod(u.hero.stats[CLASSES[u.hero.cls].attackStat])));
  hitEnemy(c.cs, dr.total);
  c.beats.push({ actor: actor(u), who: u.id, text: `${subj(u)} ${u.isPlayer ? 'strike' : 'strikes'} back from the shadows for ${dr.total}!`, tone: 'good', dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
}

function fall(c: Ctx, u: Unit) {
  const { cs } = c;
  const st = unitState(cs, u);
  if (u.mods.lastStand && !st.lastStandUsed) {
    st.lastStandUsed = true;
    u.hero.hp = 1;
    c.beats.push({ actor: 'system', text: `${subj(u)} ${u.isPlayer ? 'refuse' : 'refuses'} to fall — Unbreakable! (1 HP)`, tone: 'crit', floatOn: 'unit', target: u.id, floatText: '1' });
    return;
  }
  const singer = c.units.find((x) => x.mods.saveAlly && (x === u || !isDown(x)));
  if (singer && !cs.saveAllyUsed) {
    cs.saveAllyUsed = true;
    u.hero.hp = Math.ceil(u.hero.maxHp / 3);
    c.beats.push({ actor: 'system', text: `${singer === u ? 'Your own' : `${singer.name}'s`} Guardian Song catches ${u.isPlayer ? 'you' : u.name} before the fall! (+${u.hero.hp} HP)`, tone: 'crit', floatOn: 'unit', target: u.id, floatText: `+${u.hero.hp}` });
    return;
  }
  if (!u.isPlayer) {
    c.beats.push({ actor: 'system', text: `${u.name} falls! They'll need tending.`, tone: 'bad', floatOn: 'unit', target: u.id, floatText: '✖' });
    return;
  }
  // The hero gets one death save per fight.
  const p = u.hero;
  if (!cs.deathSaveUsed) {
    cs.deathSaveUsed = true;
    const r = rollD20(0, 10, 0, [], { lucky: partyMods(c.s).lucky });
    if (r.success) {
      p.hp = r.crit ? Math.ceil(p.maxHp / 3) : 1;
      if (r.crit) c.s.player.inspiration = true;
      c.beats.push({ actor: 'system', text: r.crit ? 'DEATH SAVE — NAT 20! You surge back to your feet, blazing with resolve!' : 'DEATH SAVE succeeded. You cling on with 1 HP!', tone: 'crit', d20: r, floatOn: 'unit', target: 'you', floatText: `+${p.hp}` });
      return;
    }
    cs.end = 'down';
    c.beats.push({ actor: 'system', text: 'DEATH SAVE failed. Darkness takes you…', tone: 'bad', d20: r });
    return;
  }
  cs.end = 'down';
  c.beats.push({ actor: 'system', text: 'You collapse…', tone: 'bad' });
}

/** After a fight: the fallen get up, and Song of Rest mends the party after a win. */
export function afterFight(s: GameState, won: boolean): string[] {
  const lines: string[] = [];
  const units = partyUnits(s);
  const song = partyMods(s).afterWinHeal;
  if (won && song) {
    let total = 0;
    for (const u of units) total += heal(u.hero, d(song));
    if (total) lines.push(`🎶 +${total} HP to the party`);
  }
  for (const u of units) if (!u.isPlayer && u.hero.hp <= 0) u.hero.hp = 1;
  return lines;
}
