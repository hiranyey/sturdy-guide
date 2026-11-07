import { describe, it, expect } from 'vitest';
import { createGame, addNpc } from './state';
import { newHero, newPlayer, gainXp, checkBonus, rollD20, xpForNext, xpStep, XP_LEVELS, mod } from './rules';
import { TREES, ABILITIES, ROW_LEVEL, learn, learnState, abilitiesOf, modsOf, autoPick, treeSize, type AbilityId } from './talents';
import { ensureHero, syncParty, autoLearn, classForRole, migrateSave, heroCheck, partyMods } from './companions';
import { makeEnemy, startCombat, playRound, useBonus, canUse, partyUnits, afterFight } from './combat';
import { startDay } from './state';
import type { ClassId, EnemyKind, GameState } from './types';

const CLS: ClassId[] = ['warrior', 'rogue', 'mage', 'bard'];

describe('levelling', () => {
  it('climbs one level at a time all the way to 20 (no skipping past 10)', () => {
    const p = newPlayer('T', 'warrior');
    expect(gainXp(p, XP_LEVELS[9])).toBe(9);
    expect(p.level).toBe(10);
    expect(gainXp(p, XP_LEVELS[10] - p.xp)).toBe(1);
    expect(p.level).toBe(11);
    gainXp(p, 1_000_000);
    expect(p.level).toBe(20);
    expect(xpForNext(20)).toBe(Infinity);
    expect(XP_LEVELS).toHaveLength(20);
  });
  it('the XP curve is smooth: each level costs exactly 80 more than the last', () => {
    expect(XP_LEVELS.slice(0, 5)).toEqual([0, 100, 280, 540, 880]);
    expect(XP_LEVELS[19]).toBe(15580);
    const steps = XP_LEVELS.slice(1).map((x, i) => x - XP_LEVELS[i]);
    steps.forEach((st, i) => {
      expect(st).toBe(xpStep(i + 1));
      if (i) expect(st - steps[i - 1]).toBe(80);
    });
  });
  it('encounters per level rise gently and never jump', () => {
    // Rough average XP per encounter at the tier a hero of each level explores
    // (events ~14·tier, fights 30·tier, quests amortised), with out-levelled fights
    // worth more past tier 5.
    const perEncounter = (level: number) => {
      const tier = Math.min(5, 1 + (level - 1) / 3);
      const over = Math.max(0, level - 13);
      return 25 * tier + 0.4 * 30 * tier * 0.1 * over;
    };
    const pace = Array.from({ length: 19 }, (_, i) => xpStep(i + 1) / perEncounter(i + 1));
    for (let i = 1; i < pace.length; i++) {
      expect(pace[i]).toBeGreaterThan(pace[i - 1]);
      expect(pace[i] - pace[i - 1]).toBeLessThan(1.5);
    }
    expect(pace[0]).toBeGreaterThan(3);
    expect(pace[18]).toBeLessThan(11);
  });
  it('foes in regions you have outgrown are worth more XP', () => {
    const base = makeEnemy({ name: 'F', kind: 'beast' }, 5, false, 0, 13).xp;
    expect(makeEnemy({ name: 'F', kind: 'beast' }, 5, false, 0, 19).xp).toBe(Math.round(base * 1.6));
  });
  it('gives a talent point per level and stat increases at 4, 8, 12, 16, 19', () => {
    const p = newPlayer('T', 'rogue');
    gainXp(p, XP_LEVELS[3]); // level 4
    expect(p.level).toBe(4);
    expect(p.points).toBe(3);
    expect(p.asi).toBe(1);
    gainXp(p, XP_LEVELS[18] - p.xp); // level 19
    // 5 regular increases, plus levels 14-19: twelve unspent points already fill the tree.
    expect(p.points).toBe(12);
    expect(p.asi).toBe(5 + 6);
  });
  it('turns talent points into stat increases once the tree is complete', () => {
    const h = newHero('mage');
    gainXp(h, XP_LEVELS[19], true);
    expect(h.level).toBe(20);
    expect(h.points + h.talents.length).toBe(treeSize('mage'));
    expect(h.asi).toBe(0); // companions spend their own
    expect(h.stats.int).toBe(20);
  });
});

describe('talent trees', () => {
  it('every class has 3 branches x 4 tiers with unique ids', () => {
    const ids = new Set<string>();
    for (const cls of CLS) {
      const t = TREES[cls];
      expect(t.nodes).toHaveLength(12);
      for (let b = 0; b < 3; b++) for (let r = 1; r <= 4; r++) expect(t.nodes.filter((n) => n.branch === b && n.row === r)).toHaveLength(1);
      for (const n of t.nodes) {
        expect(ids.has(n.id)).toBe(false);
        ids.add(n.id);
        if (n.grants) expect(ABILITIES[n.grants]).toBeTruthy();
        expect(n.mods || n.grants).toBeTruthy();
      }
    }
  });
  it('respects points, levels and the path above', () => {
    const h = newHero('warrior');
    const [c1, c2] = TREES.warrior.nodes.filter((n) => n.branch === 0);
    expect(learnState(h, c1)).toBe('locked-level');
    gainXp(h, XP_LEVELS[1]); // level 2, 1 point
    expect(learnState(h, c1)).toBe('available');
    expect(learnState(h, c2)).toBe('locked-path');
    expect(learn(h, c2.id)).toBe(false);
    expect(learn(h, c1.id)).toBe(true);
    expect(h.points).toBe(0);
    expect(learn(h, c1.id)).toBe(false);
    gainXp(h, XP_LEVELS[ROW_LEVEL[2] - 1] - h.xp);
    expect(learnState(h, c2)).toBe('available');
  });
  it('applies max HP talents once, and passives sum up', () => {
    const h = newHero('warrior');
    gainXp(h, XP_LEVELS[1]);
    const hp = h.maxHp;
    learn(h, 'w_g1');
    expect(h.maxHp).toBe(hp + 6);
    expect(modsOf(h).ac).toBe(1);
  });
  it('talents unlock abilities', () => {
    const h = newHero('bard');
    expect(abilitiesOf(h)).toEqual(['vicious_mockery', 'first_aid']);
    gainXp(h, XP_LEVELS[1]);
    learn(h, 'b_h1');
    expect(abilitiesOf(h)).toContain('healing_word');
  });
});

describe('companions', () => {
  it('guesses classes from roles', () => {
    expect(classForRole('wandering herbalist', 'x')).toBe('mage');
    expect(classForRole('city guard', 'x')).toBe('warrior');
    expect(classForRole('smuggler', 'x')).toBe('rogue');
    expect(classForRole('travelling minstrel', 'x')).toBe('bard');
    expect(CLS).toContain(classForRole('???', 'Zed'));
  });
  it('join at the hero level, grow with them, and choose talents on their own', () => {
    const s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
    gainXp(s.player, XP_LEVELS[4]);
    const npc = addNpc(s, { name: 'Bryn', role: 'scout', look: '', personality: '', cls: 'rogue' }, 'here');
    npc.inParty = true;
    const h = ensureHero(npc, s.player.level);
    expect(h.cls).toBe('rogue');
    expect(h.level).toBe(5);
    expect(h.points).toBe(4);
    gainXp(s.player, XP_LEVELS[6] - s.player.xp);
    const grown = syncParty(s);
    expect(grown[0].to).toBe(7);
    const got = autoLearn(npc);
    expect(got.length).toBe(6);
    expect(h.points).toBe(0);
  });
  it('lend talent bonuses to the hero\'s checks and party-wide perks', () => {
    const s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
    const npc = addNpc(s, { name: 'Sage Ilo', role: 'scholar', look: '', personality: '', cls: 'mage' }, 'here');
    npc.inParty = true;
    const h = ensureHero(npc, 2);
    learn(h, 'm_d1'); // Scholar +2 INT/WIS
    const cb = heroCheck(s, 'int');
    expect(cb.parts.some((p) => p.label === 'SAGE' && p.value === 2)).toBe(true);
    expect(cb.total).toBe(checkBonus(s.player, 'int').total + 2);
    h.talents.push('w_l3'); // pretend: Forced March
    expect(partyMods(s).torches).toBe(1);
    startDay(s);
    expect(s.stamina).toBeGreaterThanOrEqual(13);
  });
  it('migrates pre-talent saves', () => {
    const s = createGame('T', 'mage', 'heroic', { name: 'W', hook: 'h' }) as GameState;
    gainXp(s.player, XP_LEVELS[5]);
    const old = JSON.parse(JSON.stringify(s));
    delete old.player.talents; delete old.player.points; delete old.player.asi;
    old.npcs.n1 = { id: 'n1', name: 'Old Friend', role: 'knight', look: '', personality: '', affinity: 50, memories: [], metDay: 1, where: 'x', inParty: true, power: 4 };
    const back = migrateSave(old);
    expect(back.player.talents).toEqual([]);
    expect(back.player.points).toBe(5);
    expect(back.npcs.n1.hero?.cls).toBe('warrior');
    expect(back.npcs.n1.hero?.level).toBe(4);
    expect(back.npcs.n1.power).toBeUndefined();
    expect(migrateSave(back)).toBe(back);
  });
});

describe('lucky', () => {
  it('rerolls natural 1s', () => {
    let seq = [1, 15];
    const r = () => (seq.shift()! - 1) / 20 + 0.001;
    const roll = rollD20(0, 10, 0, [], { r, lucky: true });
    expect(roll.kept).toBe(15);
    expect(roll.lucky).toBe(true);
    seq = [1];
    expect(rollD20(0, 10, 0, [], { r }).fumble).toBe(true);
  });
  it('wider crit range', () => {
    const r = () => 18.5 / 20;
    expect(rollD20(0, 30, 0, [], { r, critOn: 19 }).crit).toBe(true);
    expect(rollD20(0, 30, 0, [], { r }).crit).toBe(false);
  });
});

/** A party of random builds at `level`, with gear roughly matching the tier. */
function party(cls: ClassId, level: number, allies: number) {
  const s = createGame('T', cls, 'heroic', { name: 'W', hook: 'h' });
  gainXp(s.player, XP_LEVELS[level - 1], true);
  let n;
  while ((n = autoPick(s.player, Math.floor(Math.random() * 3)))) learn(s.player, n.id);
  s.player.hp = s.player.maxHp;
  const plus = Math.round(Math.max(1, Math.min(5, Math.ceil(level / 3))) * 0.8 + 0.6);
  if (level > 2) { s.player.weapon.plus = plus; s.player.armor.plus += Math.ceil(plus / 2); }
  for (let i = 0; i < allies; i++) {
    const npc = addNpc(s, { name: `Ally ${i} ${Math.random()}`, role: 'x', look: '', personality: '', cls: CLS[Math.floor(Math.random() * 4)] }, 'here');
    npc.inParty = true;
    ensureHero(npc, level);
    autoLearn(npc);
  }
  return s;
}

function fight(s: GameState, tier: number, boss: boolean, level: number) {
  const kinds: EnemyKind[] = ['beast', 'humanoid', 'undead', 'monster', 'spirit'];
  const allies = partyUnits(s).length - 1;
  const cs = startCombat(makeEnemy({ name: 'F', kind: kinds[Math.floor(Math.random() * 5)] }, tier, boss, allies, level));
  const p = s.player;
  let r = 0;
  while (!cs.end && r++ < 80) {
    for (const id of abilitiesOf(p)) if (ABILITIES[id].bonus && canUse(s, cs, id)) useBonus(s, cs, id);
    const main = abilitiesOf(p).filter((id) => !ABILITIES[id].bonus && id !== 'first_aid' && canUse(s, cs, id));
    playRound(s, cs, p.hp < p.maxHp * 0.35 && p.potions ? 'potion' : main[0] ?? 'attack');
    for (const u of partyUnits(s)) {
      expect(u.hero.hp).toBeGreaterThanOrEqual(0);
      expect(u.hero.hp).toBeLessThanOrEqual(u.hero.maxHp);
    }
  }
  expect(cs.end).not.toBeNull();
  afterFight(s, cs.end === 'win');
  for (const u of partyUnits(s)) if (!u.isPlayer) expect(u.hero.hp).toBeGreaterThan(0);
  return cs.end;
}

describe('party combat', () => {
  it('every ability resolves for every class', () => {
    for (const cls of CLS) {
      const s = party(cls, 20, 2);
      for (const id of Object.keys(ABILITIES) as AbilityId[]) {
        if (!abilitiesOf(s.player).includes(id)) continue;
        const cs = startCombat(makeEnemy({ name: 'Dummy', kind: 'monster' }, 5, true, 2));
        s.player.hp = Math.ceil(s.player.maxHp / 2);
        const beats = ABILITIES[id].bonus ? useBonus(s, cs, id) : playRound(s, cs, id);
        expect(beats.length).toBeGreaterThan(0);
        s.player.hp = s.player.maxHp;
      }
    }
  });
  it('random parties at every depth always finish, with sane HP', () => {
    for (let n = 0; n < 160; n++) {
      const cls = CLS[n % 4];
      const tier = 1 + (n % 5);
      const level = Math.min(20, 1 + (tier - 1) * 3 + (n % 3));
      fight(party(cls, level, n % 3), tier, n % 7 === 0, level);
    }
  });
  it('fights at the expected level are winnable for every class, alone or in a party', () => {
    for (const cls of CLS) {
      for (const [tier, level, allies] of [[2, 4, 0], [3, 7, 0], [3, 7, 2], [5, 13, 2]]) {
        let wins = 0;
        for (let i = 0; i < 80; i++) if (fight(party(cls, level, allies), tier, false, level) === 'win') wins++;
        expect(wins / 80, `${cls} T${tier} L${level} +${allies}`).toBeGreaterThan(0.85);
      }
    }
  });
});
void mod; void newPlayer;

import { stowLoot } from './companions';
describe('loot sharing', () => {
  it('gives the hero upgrades, else the companion it helps most', () => {
    const s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
    const npc = addNpc(s, { name: 'Kit', role: 'thief', look: '', personality: '', cls: 'rogue' }, 'here');
    npc.inParty = true;
    ensureHero(npc, 1);
    s.player.armor = { id: 'big', name: 'Plate', slot: 'armor', tier: 3, plus: 8 };
    const coat = { id: 'c1', name: 'Coat', slot: 'armor' as const, tier: 1, plus: 3 };
    expect(stowLoot(s, coat)).toBe('Kit');
    expect(npc.hero!.armor.id).toBe('c1');
    expect(s.player.bag.some((i) => i.name === 'Leather Coat')).toBe(true);
    expect(stowLoot(s, { id: 'c2', name: 'Rag', slot: 'armor', tier: 1, plus: 0 })).toBeNull();
    expect(stowLoot(s, { id: 'c3', name: 'Mithril', slot: 'armor', tier: 5, plus: 9 })).toBe('you');
  });
});

describe('curve change on old saves', () => {
  it('settles levels already earned on load', () => {
    const s = createGame('T', 'rogue', 'heroic', { name: 'W', hook: 'h' });
    s.player.level = 18; s.player.xp = 14100; // old curve: level 19 needed 14100; new needs 14040
    s.player.points = 0;
    migrateSave(s);
    expect(s.player.level).toBe(19);
    expect(s.player.asi).toBeGreaterThanOrEqual(1);
  });
});
