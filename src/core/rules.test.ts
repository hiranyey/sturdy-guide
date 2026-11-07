import { describe, it, expect } from 'vitest';
import { rollD20, successChance, newPlayer, gainXp, checkBonus, mod } from './rules';
import { makeEnemy, startCombat, playRound } from './combat';
import { createGame } from './state';
import { sanitizeEvent } from '../ai/director';
import { extractJson } from '../ai/openrouter';
import type { EventContext } from './types';

describe('dice & checks', () => {
  it('nat 20 always succeeds and nat 1 always fails', () => {
    for (let i = 0; i < 2000; i++) {
      const r = rollD20(0, 25);
      if (r.kept === 20) expect(r.success).toBe(true);
      if (r.kept === 1) expect(r.success).toBe(false);
    }
  });
  it('advantage keeps the higher die', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollD20(2, 10, 1);
      expect(r.dice).toHaveLength(2);
      expect(r.kept).toBe(Math.max(...r.dice));
      expect(r.total).toBe(r.kept + 2);
    }
  });
  it('success chance is sane', () => {
    expect(successChance(0, 11)).toBeCloseTo(0.5);
    expect(successChance(5, 10, 1)).toBeGreaterThan(successChance(5, 10, 0));
    expect(successChance(-10, 30)).toBe(0.05);
  });
  it('proficiency applies to class stats', () => {
    const p = newPlayer('T', 'rogue');
    expect(checkBonus(p, 'dex').total).toBe(mod(16) + 2);
    expect(checkBonus(p, 'str').total).toBe(mod(10));
  });
  it('levels up with XP', () => {
    const p = newPlayer('T', 'warrior');
    const hp = p.maxHp;
    expect(gainXp(p, 270)).toBe(2);
    expect(p.level).toBe(3);
    expect(p.maxHp).toBeGreaterThan(hp);
  });
});

describe('combat', () => {
  it('always terminates and never leaves negative hp', () => {
    for (let n = 0; n < 200; n++) {
      const s = createGame('T', (['warrior', 'rogue', 'mage', 'bard'] as const)[n % 4], 'heroic', { name: 'W', hook: 'h' });
      const cs = startCombat(makeEnemy({ name: 'Wolf', kind: 'beast' }, 1 + (n % 3)));
      let rounds = 0;
      while (!cs.end && rounds < 60) {
        playRound(s, cs, rounds === 0 ? 'ability' : 'attack');
        rounds++;
        expect(s.player.hp).toBeGreaterThanOrEqual(0);
      }
      expect(cs.end).not.toBeNull();
    }
  });
  it('tier 1 fights are winnable most of the time for every class', () => {
    for (const cls of ['warrior', 'rogue', 'mage', 'bard'] as const) {
      let wins = 0;
      for (let n = 0; n < 300; n++) {
        const s = createGame('T', cls, 'heroic', { name: 'W', hook: 'h' });
        const cs = startCombat(makeEnemy({ name: 'Bandit', kind: 'humanoid' }, 1));
        let r = 0;
        while (!cs.end && r++ < 40) playRound(s, cs, r === 1 ? 'ability' : s.player.hp < 6 && s.player.potions ? 'potion' : 'attack');
        if (cs.end === 'win') wins++;
      }
      expect(wins / 300).toBeGreaterThan(0.75);
    }
  });
});

describe('AI output handling', () => {
  const ctx: EventContext = { hex: { q: 3, r: 2 }, biome: 'forest', poi: 'ruin', tier: 2, regionName: 'The Elder Wood' };
  it('extracts json from chatty output', () => {
    expect(extractJson('Sure! ```json\n{"a": {"b": "}"}}\n``` hope that helps')).toEqual({ a: { b: '}' } });
  });
  it('clamps DCs, fixes stats, adds leave, drops invalid', () => {
    const ev = sanitizeEvent({
      title: 'Test', text: 'Some text',
      choices: [
        { label: 'Lift', kind: 'check', stat: 'STR', dc: 99, reward: 'gold' },
        { label: 'Weird', kind: 'dance' },
        { label: 'Befriend', kind: 'check', stat: 'cha', dc: 2, reward: 'ally' },
        { label: 'Fight', kind: 'fight', enemy: { name: 'Golem', kind: 'construct', emoji: 'not-an-emoji' } },
      ],
    }, ctx);
    expect(ev.choices[0].stat).toBe('str');
    expect(ev.choices[0].dc).toBe(16);
    expect(ev.choices[1].dc).toBe(8);
    expect(ev.choices[1].reward).toBe('xp'); // no npc -> no ally
    expect(ev.choices[2].enemy?.kind).toBe('monster');
    expect(ev.choices.some((c) => c.kind === 'leave')).toBe(true);
    expect(ev.choices.length).toBeLessThanOrEqual(4);
  });
  it('falls back when the model returns garbage', () => {
    const ev = sanitizeEvent({ nonsense: true }, ctx);
    expect(ev.choices.length).toBeGreaterThan(1);
    expect(ev.title.length).toBeGreaterThan(0);
  });
});
