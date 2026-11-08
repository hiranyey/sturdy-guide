import { describe, it, expect, beforeEach } from 'vitest';
import { shapeChoices, canPay, pay, clampCost, BOLD_DC } from './choices';
import { applyCheck, defeatLoss } from './resolve';
import { createGame } from './state';
import type { D20Roll } from './rules';
import type { EventContext, GameEvent, GameState } from './types';

let s: GameState;
const ctx = (poi: EventContext['poi'] = 'wild'): EventContext => ({ hex: { q: 3, r: 0 }, biome: 'grass', poi, tier: 1, regionName: 'R' });
const scene = (): GameEvent => ({ title: 'T', text: 'x', npc: null, choices: [
  { label: 'Climb', kind: 'check', stat: 'str', dc: 12, reward: 'gold' },
  { label: 'Think', kind: 'check', stat: 'int', dc: 10, reward: 'lore' },
  { label: 'Go', kind: 'leave' },
] });
const win = (dc = 10): D20Roll => ({ dice: [15], kept: 15, adv: 0, bonus: 0, parts: [], total: 15, dc, success: true, crit: false, fumble: false });

beforeEach(() => { s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' }); });

describe('trade-off choices', () => {
  it('makes the hardest check bold and adds a paid sure thing before Leave', () => {
    const ev = shapeChoices(s, scene(), ctx(), () => 0);
    const climb = ev.choices[0];
    expect(climb.bold).toBe(1);
    expect(climb.dc).toBe(12 + BOLD_DC);
    const sure = ev.choices.find((c) => c.sure)!;
    expect(sure.reward).toBe('lore'); // mirrors the safest check
    expect(sure.cost?.gold).toBeGreaterThan(0);
    expect(ev.choices[ev.choices.length - 1].kind).toBe('leave');
    // only once
    const n = ev.choices.length;
    shapeChoices(s, ev, ctx());
    expect(ev.choices.length).toBe(n);
  });

  it('offers a hurt hero a way to heal', () => {
    s.player.hp = 3;
    const sure = shapeChoices(s, scene(), ctx()).choices.find((c) => c.sure)!;
    expect(sure.reward).toBe('heal');
    expect(sure.cost).toEqual({ torch: 1 });
  });

  it('keeps the quest climax a real roll, and prices rests', () => {
    const q = shapeChoices(s, scene(), ctx('quest'));
    expect(q.choices.some((c) => c.sure)).toBe(false);
    const rest = (poi: EventContext['poi']) => shapeChoices(s, { title: 'T', text: 'x', npc: null, choices: [{ label: 'Rest', kind: 'rest' }] }, ctx(poi)).choices[0].cost;
    expect(rest('shrine')).toEqual({ torch: 2 });
    expect(rest('village')?.gold).toBeGreaterThan(0);
  });

  it('pays only what the hero has', () => {
    s.player.gold = 5;
    expect(canPay(s, { gold: 6 })).toBe(false);
    expect(canPay(s, { hp: s.player.hp })).toBe(false); // can't pay with your last HP
    expect(canPay(s, { torch: s.stamina })).toBe(true);
    expect(pay(s, { gold: 5, torch: 1 })).toEqual(['-5 gold', '-1 🔥']);
    expect(s.player.gold).toBe(0);
    expect(clampCost({ gold: 999, torch: 9, hp: -3 }, 1)).toEqual({ gold: 20, torch: 2 });
    expect(clampCost('free', 1)).toBeUndefined();
  });

  it('a bold success pays double; a sure thing teaches less', () => {
    const base = applyCheck(s, scene(), { label: 'x', kind: 'check', stat: 'int', dc: 10, reward: 'xp' }, win(), 1, 'R', false);
    const bold = applyCheck(s, scene(), { label: 'x', kind: 'check', stat: 'int', dc: 10, reward: 'xp', bold: 1 }, win(), 1, 'R', false);
    const sure = applyCheck(s, scene(), { label: 'x', kind: 'check', stat: 'int', reward: 'xp', sure: 1 }, win(), 1, 'R', false);
    const xp = (l: string[]) => Number(l[0].match(/\d+/)![0]);
    expect(xp(bold.lines)).toBe(2 * xp(base.lines));
    expect(xp(sure.lines)).toBeLessThan(xp(base.lines));
  });
});

describe('defeat', () => {
  it('costs the day\'s takings (at least a quarter) and an item from the bag', () => {
    s.stats.chapterStartGold = 20;
    s.player.gold = 60;
    s.player.bag = [{ id: 'x', name: 'Old Ring', slot: 'charm', tier: 1, plus: 1 }];
    const loss = defeatLoss(s, () => 0);
    expect(loss.gold).toBe(40);
    expect(loss.item?.name).toBe('Old Ring');
    expect(s.player.gold).toBe(20);
    expect(s.player.bag).toHaveLength(0);
    s.stats.chapterStartGold = 100;
    expect(defeatLoss(s).gold).toBe(5); // a poor day still costs a quarter
  });
});
