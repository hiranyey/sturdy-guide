import { CLASSES, armorClass, attackBonus, damageBonus, checkBonus, rollD20, rollDice, d, heal, type D20Roll } from './rules';
import { randInt, weighted, chance, pick } from './rng';
import { ENEMY_TAUNTS } from './content';
import type { EnemyKind, EnemySpec, GameState, NPC, Stat } from './types';
import { party } from './state';

export type Intent = 'attack' | 'heavy' | 'guard';

export interface Enemy {
  name: string; kind: EnemyKind; emoji: string;
  hp: number; maxHp: number; ac: number; atk: number;
  dmgN: number; dmgD: number; dmgB: number;
  talkDC: number; talkStat: Stat; talkable: boolean;
  xp: number; gold: number; boss: boolean; tier: number;
  intent: Intent; mocked: boolean;
}

export interface DmgRoll { dice: number[]; sides: number; bonus: number; total: number }

export interface Beat {
  actor: 'you' | 'ally' | 'foe' | 'system';
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'crit';
  d20?: D20Roll;
  dmg?: DmgRoll;
  floatOn?: 'enemy' | 'player';
  floatText?: string;
}

export interface CombatState {
  enemy: Enemy;
  round: number;
  abilityUsed: boolean;
  defending: boolean;
  deathSaveUsed: boolean;
  allyHealed: Record<string, boolean>;
  end: null | 'win' | 'flee' | 'friend' | 'down';
}

export type Action = 'attack' | 'ability' | 'defend' | 'potion' | 'talk' | 'flee';

const KIND_STATS: Record<EnemyKind, { hp: number; ac: number; talk: Stat; talkBase: number; talkable: boolean }> = {
  beast: { hp: 1.0, ac: 0, talk: 'wis', talkBase: 11, talkable: true },
  humanoid: { hp: 0.95, ac: 1, talk: 'cha', talkBase: 10, talkable: true },
  undead: { hp: 1.1, ac: 0, talk: 'cha', talkBase: 17, talkable: false },
  monster: { hp: 1.25, ac: 1, talk: 'cha', talkBase: 15, talkable: true },
  spirit: { hp: 0.85, ac: 2, talk: 'cha', talkBase: 12, talkable: true },
};

export function makeEnemy(spec: EnemySpec, tier: number, boss = false): Enemy {
  const k = KIND_STATS[spec.kind] ?? KIND_STATS.monster;
  const hp = Math.round((9 + tier * 8 + randInt(0, tier * 3)) * k.hp * (boss ? 1.7 : 1));
  return {
    name: spec.name, kind: spec.kind, emoji: spec.emoji || '👹',
    hp, maxHp: hp, ac: 10 + tier + k.ac + (boss ? 1 : 0), atk: 2 + tier + (boss ? 1 : 0),
    dmgN: tier >= 4 ? 2 : 1, dmgD: [4, 6, 8, 6, 8][tier - 1] ?? 8, dmgB: tier - 1 + (boss ? 2 : 0),
    talkDC: Math.min(22, k.talkBase + tier + (boss ? 3 : 0)), talkStat: k.talk, talkable: k.talkable,
    xp: 30 * tier * (boss ? 3 : 1), gold: tier * randInt(3, 8) * (boss ? 3 : 1), boss, tier,
    intent: 'attack', mocked: false,
  };
}

export function startCombat(enemy: Enemy): CombatState {
  enemy.intent = 'attack';
  return { enemy, round: 1, abilityUsed: false, defending: false, deathSaveUsed: false, allyHealed: {}, end: null };
}

export function intentText(e: Enemy): { icon: string; text: string } {
  if (e.intent === 'heavy') return { icon: '⚠️', text: `${e.name} winds up a crushing blow!` };
  if (e.intent === 'guard') return { icon: '🛡️', text: `${e.name} raises its guard (+3 AC)` };
  return { icon: '⚔️', text: `${e.name} ${pick(ENEMY_TAUNTS)} and readies an attack` };
}

function dmg(n: number, sides: number, bonus: number, crit = false): DmgRoll {
  const dice = rollDice(crit ? n * 2 : n, sides);
  return { dice, sides, bonus, total: Math.max(1, dice.reduce((a, b) => a + b, 0) + bonus) };
}

const enemyAc = (cs: CombatState) => cs.enemy.ac + (cs.enemy.intent === 'guard' ? 3 : 0);

function hitEnemy(cs: CombatState, amount: number) {
  cs.enemy.hp = Math.max(0, cs.enemy.hp - amount);
  if (cs.enemy.hp <= 0) cs.end = 'win';
}

export function canUse(s: GameState, cs: CombatState, a: Action): boolean {
  if (a === 'ability') return !cs.abilityUsed;
  if (a === 'potion') return s.player.potions > 0 && s.player.hp < s.player.maxHp;
  return true;
}

/** Resolve one full round. `adv` lets the player spend Inspiration. */
export function playRound(s: GameState, cs: CombatState, action: Action, useInspiration = false): Beat[] {
  const beats: Beat[] = [];
  const p = s.player, e = cs.enemy;
  const cls = CLASSES[p.cls];
  cs.defending = false;
  const adv: -1 | 0 | 1 = useInspiration ? 1 : 0;
  if (useInspiration) p.inspiration = false;

  const weaponAttack = (opts: { adv: -1 | 0 | 1; extraDice?: number; sneak?: boolean; label: string }) => {
    const ab = attackBonus(p);
    const r = rollD20(ab, enemyAc(cs), opts.adv, [{ label: 'ATK', value: ab }]);
    if (r.success) {
      const die = p.weapon.die ?? 6;
      const dr = dmg(1 + (opts.extraDice ?? 0), die, damageBonus(p), r.crit);
      if (opts.sneak) {
        const extra = rollDice(r.crit ? 4 : 2, 6);
        dr.dice.push(...extra);
        dr.total += extra.reduce((a, b) => a + b, 0);
      }
      hitEnemy(cs, dr.total);
      if (r.crit) s.stats.crits++;
      beats.push({ actor: 'you', text: `${r.crit ? 'CRITICAL! ' : ''}${opts.label} hits for ${dr.total}!`, tone: r.crit ? 'crit' : 'good', d20: r, dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
      return true;
    }
    if (r.fumble) s.stats.fumbles++;
    beats.push({ actor: 'you', text: r.fumble ? `${opts.label} — you stumble badly!` : `${opts.label} misses.`, tone: 'bad', d20: r, floatOn: 'enemy', floatText: 'miss' });
    return false;
  };

  // ---- Player action ----
  switch (action) {
    case 'attack':
      weaponAttack({ adv, label: p.cls === 'mage' ? 'Firebolt' : `Your ${p.weapon.name}` });
      break;
    case 'ability': {
      cs.abilityUsed = true;
      if (p.cls === 'warrior') weaponAttack({ adv: 1, extraDice: 1, label: 'Mighty Blow' });
      else if (p.cls === 'rogue') weaponAttack({ adv: 1, sneak: true, label: 'Sneak Attack' });
      else if (p.cls === 'mage') {
        const dr = dmg(3, 8, 0);
        hitEnemy(cs, dr.total);
        beats.push({ actor: 'you', text: `Thunderwave slams ${e.name} for ${dr.total}!`, tone: 'good', dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
      } else {
        const dr = dmg(2, 6, 0);
        hitEnemy(cs, dr.total);
        e.mocked = true;
        beats.push({ actor: 'you', text: `Your mockery cuts deep: ${dr.total} psychic damage. ${e.name} is rattled!`, tone: 'good', dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` });
      }
      break;
    }
    case 'defend': {
      cs.defending = true;
      const h = heal(p, d(4) + 1);
      beats.push({ actor: 'you', text: `You brace behind your guard${h ? ` and catch your breath (+${h} HP)` : ''}.`, tone: 'neutral', floatOn: 'player', floatText: h ? `+${h}` : '🛡' });
      break;
    }
    case 'potion': {
      p.potions--;
      const dr = dmg(2, 4, 4);
      const h = heal(p, dr.total);
      beats.push({ actor: 'you', text: `You gulp a potion: +${h} HP.`, tone: 'good', dmg: dr, floatOn: 'player', floatText: `+${h}` });
      break;
    }
    case 'talk': {
      const cb = checkBonus(p, e.talkStat);
      const dc = e.talkable ? e.talkDC : e.talkDC + 5;
      const r = rollD20(cb.total, dc, p.cls === 'bard' ? 1 : adv, cb.parts);
      if (r.success) {
        const befriend = (e.kind === 'humanoid' || e.kind === 'spirit') && (r.crit || chance(0.55)) && !e.boss;
        cs.end = befriend ? 'friend' : 'flee';
        beats.push({ actor: 'you', text: befriend ? `Your words land. ${e.name} lowers their weapon — and offers a hand.` : `${e.name} hesitates… then slinks away.`, tone: r.crit ? 'crit' : 'good', d20: r });
        return beats;
      }
      beats.push({ actor: 'you', text: e.talkable ? `${e.name} isn't convinced.` : `${e.name} cannot be reasoned with!`, tone: 'bad', d20: r });
      break;
    }
    case 'flee': {
      const cb = checkBonus(p, 'dex');
      const r = rollD20(cb.total, 9 + e.tier + (e.boss ? 4 : 0), adv, cb.parts);
      if (r.success) {
        cs.end = 'flee';
        beats.push({ actor: 'you', text: 'You break away and escape!', tone: 'good', d20: r });
        return beats;
      }
      beats.push({ actor: 'you', text: 'You try to run, but it cuts you off!', tone: 'bad', d20: r });
      if (e.intent === 'guard') e.intent = 'attack';
      break;
    }
  }
  if (cs.end) return beats;

  // ---- Companions ----
  for (const ally of party(s)) {
    if (cs.end) break;
    beats.push(allyTurn(s, cs, ally));
  }
  if (cs.end) return beats;

  // ---- Enemy turn ----
  if (e.intent === 'guard') {
    const h = Math.min(e.maxHp - e.hp, d(4) + e.tier);
    e.hp += h;
    beats.push({ actor: 'foe', text: `${e.name} holds its guard${h ? ` and recovers ${h} HP` : ''}.`, tone: 'neutral', floatOn: 'enemy', floatText: h ? `+${h}` : '🛡' });
  } else {
    const ac = armorClass(p) + (cs.defending ? 4 : 0);
    const r = rollD20(e.atk, ac, e.mocked ? -1 : 0, [{ label: 'ATK', value: e.atk }]);
    e.mocked = false;
    if (r.success) {
      const heavy = e.intent === 'heavy';
      const dr = dmg(e.dmgN, e.dmgD, e.dmgB + (heavy ? 2 : 0), r.crit);
      let total = heavy ? Math.round(dr.total * 1.5) : dr.total;
      if (heavy && cs.defending) total = Math.ceil(total / 2);
      dr.total = total;
      p.hp = Math.max(0, p.hp - total);
      beats.push({ actor: 'foe', text: `${r.crit ? 'Critical hit! ' : ''}${e.name} ${heavy ? 'lands a crushing blow' : 'strikes you'}: -${total} HP${heavy && cs.defending ? ' (braced!)' : ''}.`, tone: 'bad', d20: r, dmg: dr, floatOn: 'player', floatText: `-${total}` });
    } else {
      beats.push({ actor: 'foe', text: `${e.name} attacks — ${cs.defending ? 'your guard holds!' : 'and misses!'}`, tone: 'good', d20: r, floatOn: 'player', floatText: 'miss' });
    }
  }

  // ---- Death save ----
  if (p.hp <= 0) {
    if (!cs.deathSaveUsed) {
      cs.deathSaveUsed = true;
      const r = rollD20(0, 10, 0, []);
      if (r.success) {
        p.hp = r.crit ? Math.ceil(p.maxHp / 3) : 1;
        if (r.crit) p.inspiration = true;
        beats.push({ actor: 'system', text: r.crit ? 'DEATH SAVE — NAT 20! You surge back to your feet, blazing with resolve!' : 'DEATH SAVE succeeded. You cling on with 1 HP!', tone: 'crit', d20: r, floatOn: 'player', floatText: `+${p.hp}` });
      } else {
        cs.end = 'down';
        beats.push({ actor: 'system', text: 'DEATH SAVE failed. Darkness takes you…', tone: 'bad', d20: r });
        return beats;
      }
    } else {
      cs.end = 'down';
      beats.push({ actor: 'system', text: 'You collapse…', tone: 'bad' });
      return beats;
    }
  }

  // ---- Next intent ----
  cs.round++;
  e.intent = weighted<Intent>([['attack', 6], ['heavy', e.boss ? 4 : 2.5], ['guard', e.hp < e.maxHp / 2 ? 2 : 1]]);
  void cls;
  return beats;
}

function allyTurn(s: GameState, cs: CombatState, ally: NPC): Beat {
  const p = s.player;
  if (p.hp < p.maxHp * 0.35 && !cs.allyHealed[ally.id]) {
    cs.allyHealed[ally.id] = true;
    const dr = dmg(1, 8, 1 + Math.floor(ally.power / 2));
    const h = heal(p, dr.total);
    return { actor: 'ally', text: `${ally.name} patches you up: +${h} HP.`, tone: 'good', dmg: dr, floatOn: 'player', floatText: `+${h}` };
  }
  const bonus = 3 + Math.floor(ally.power / 2);
  const r = rollD20(bonus, enemyAc(cs), 0, [{ label: 'ALLY', value: bonus }]);
  if (r.success) {
    const dr = dmg(1, 6, Math.floor(ally.power / 2), r.crit);
    hitEnemy(cs, dr.total);
    return { actor: 'ally', text: `${ally.name} strikes for ${dr.total}!`, tone: 'good', d20: r, dmg: dr, floatOn: 'enemy', floatText: `-${dr.total}` };
  }
  return { actor: 'ally', text: `${ally.name}'s attack goes wide.`, tone: 'neutral', d20: r, floatOn: 'enemy', floatText: 'miss' };
}
