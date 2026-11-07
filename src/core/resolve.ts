// Applies mechanical consequences of choices. The LLM never decides these.
import { d, gainXp, heal, randomItem, rollDice, itemDesc, type D20Roll } from './rules';
import { randInt } from './rng';
import { spiral, key } from './hex';
import { addNpc, party, reveal, hasOmen } from './state';
import { partyMods, stowLoot, lootNote } from './companions';
import type { Choice, GameEvent, GameState, Item, NPC } from './types';

export interface Effects {
  lines: string[];
  levels: number;
  recruit: NPC | null;
  npc: NPC | null;
  item: Item | null;
  questComplete: boolean;
}

const PHYSICAL = ['str', 'dex', 'con'];

export function applyCheck(s: GameState, ev: GameEvent, choice: Choice, roll: D20Roll, tier: number, where: string, isQuest: boolean): Effects {
  const p = s.player;
  const fx: Effects = { lines: [], levels: 0, recruit: null, npc: null, item: null, questComplete: false };
  const npc = ev.npc ? addNpc(s, ev.npc, where) : null;
  fx.npc = npc;
  const mult = roll.crit ? 2 : 1;

  if (roll.crit) {
    s.stats.crits++;
    if (!p.inspiration) {
      p.inspiration = true;
      fx.lines.push('✨ Inspiration');
    }
  }
  if (roll.fumble) s.stats.fumbles++;

  if (roll.success) {
    let xp = 12 * tier * mult;
    switch (choice.reward) {
      case 'gold': {
        const g = Math.round((randInt(5, 10) * tier + Math.max(0, (choice.dc ?? 10) - 10)) * mult * (hasOmen(s, 'golden-hour') ? 1.5 : 1) * goldMult(s));
        p.gold += g;
        fx.lines.push(`+${g} gold`);
        break;
      }
      case 'item': {
        const it = randomItem(p, tier + (roll.crit ? 1 : 0));
        fx.item = it;
        fx.lines.push(`${it.name} (${itemDesc(it)})${lootNote(stowLoot(s, it))}`);
        break;
      }
      case 'ally': {
        if (npc) {
          const gain = roll.crit ? 45 : 30;
          npc.affinity = Math.min(100, npc.affinity + gain);
          fx.lines.push(`${npc.name} ♥ +${gain}`);
          if (npc.affinity >= 30 && !npc.inParty && party(s).length < 2) fx.recruit = npc;
        } else xp += 15 * tier;
        break;
      }
      case 'heal': {
        const amount = roll.crit ? p.maxHp : rollDice(2, 6).reduce((a, b) => a + b, 0) + tier * 2;
        const h = heal(p, amount);
        fx.lines.push(`+${h} HP`);
        // The whole party shares the rest.
        let ph = 0;
        for (const n of party(s)) if (n.hero) ph += heal(n.hero, amount);
        if (ph) fx.lines.push(`Party +${ph} HP`);
        if (p.potions < 5 && roll.crit) { p.potions++; fx.lines.push('+1 potion'); }
        break;
      }
      case 'lore': {
        xp += 10 * tier;
        reveal(s, s.pos, 3);
        fx.lines.push('Map revealed nearby');
        if (s.quest) {
          for (const t of spiral(s.quest.target, 1)) s.revealed[key(t)] = 1;
          fx.lines.push(`Path to ${s.quest.place} revealed`);
        }
        break;
      }
      case 'xp':
      default:
        xp += 20 * tier;
    }
    if (isQuest) {
      fx.questComplete = true;
    }
    fx.levels += gainXp(p, xp);
    fx.lines.unshift(`+${xp} XP`);
  } else {
    const social = !PHYSICAL.includes(choice.stat ?? '');
    if (choice.reward === 'ally' && npc) {
      npc.affinity = Math.max(-100, npc.affinity - 10);
      fx.lines.push(`${npc.name} ♥ -10`);
    }
    if (social && !roll.fumble) {
      if (s.stamina > 0) {
        s.stamina--;
        fx.lines.push('-1 🔥 (time lost)');
      }
    } else {
      const dc = choice.dc ?? 12;
      let dmg = dc < 12 ? d(4) + tier - 1 : dc < 16 ? d(6) + tier : d(6) + d(6) + tier;
      if (roll.fumble) dmg *= 2;
      dmg = Math.min(dmg, p.hp - 1); // events wound, but never kill
      if (dmg > 0) {
        p.hp -= dmg;
        fx.lines.push(`-${dmg} HP`);
      }
    }
    if (choice.reward === 'gold' && p.gold > 0 && roll.fumble) {
      const lost = Math.min(p.gold, tier * 4);
      p.gold -= lost;
      fx.lines.push(`-${lost} gold`);
    }
    fx.levels += gainXp(p, 4 * tier);
    fx.lines.push(`+${4 * tier} XP`);
  }
  return fx;
}

/** Gold multiplier from talents such as Light Fingers and Legend. */
export const goldMult = (s: GameState) => 1 + (partyMods(s).gold ?? 0) / 100;

export function questRewards(s: GameState, tier: number): Effects {
  const p = s.player;
  const g = Math.round((25 * tier + randInt(0, 15)) * goldMult(s));
  p.gold += g;
  const it = randomItem(p, tier + 1);
  const who = stowLoot(s, it);
  const xp = 90 * tier;
  const levels = gainXp(p, xp);
  p.potions = Math.min(6, p.potions + 1);
  p.inspiration = true;
  return {
    lines: [`+${xp} XP`, `+${g} gold`, `${it.name} (${itemDesc(it)})${lootNote(who)}`, '+1 potion', '✨ Inspiration'],
    levels, recruit: null, npc: null, item: it, questComplete: true,
  };
}
