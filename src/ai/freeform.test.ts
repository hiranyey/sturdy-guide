import { describe, it, expect, beforeEach } from 'vitest';
import { cleanAction, isOpenMoment, keywordIntent, sanitizeIntent, interpretAction, MAX_ACTION } from './freeform';
import { sanitizeEvent } from './director';
import { settings } from './settings';
import { createGame } from '../core/state';
import type { EventContext, GameEvent, GameState } from '../core/types';

const ctx = (over: Partial<EventContext> = {}): EventContext => ({ hex: { q: 1, r: 1 }, biome: 'forest', poi: 'ruin', tier: 2, regionName: 'Elder Wood', ...over });
const ev = (over: Partial<GameEvent> = {}): GameEvent => ({
  title: 'The Troll Bridge', text: 'A troll blocks the bridge.', npc: { name: 'Grubb', role: 'troll', look: '', personality: 'hungry' },
  choices: [{ label: 'Fight it', kind: 'fight', enemy: { name: 'Bridge Troll', kind: 'monster', emoji: '🧌' } }, { label: 'Move on', kind: 'leave' }], ...over,
});

let s: GameState;
beforeEach(() => {
  s = createGame('T', 'bard', 'heroic', { name: 'W', hook: 'h' });
  s.player.gold = 10;
  s.player.potions = 1;
  settings.apiKey = '';
});

describe('write your own action', () => {
  it('is offered only at special moments', () => {
    expect(isOpenMoment(ev(), ctx())).toBe(false);
    expect(isOpenMoment(ev(), ctx({ poi: 'quest' }))).toBe(true);
    expect(isOpenMoment(ev(), ctx({ poi: 'wild', landmark: 'obelisk' }))).toBe(true);
    expect(isOpenMoment(ev({ open: true }), ctx())).toBe(true);
    // the AI's turning-point flag survives validation
    const raw = { ...ev(), open: true, choices: [{ label: 'Talk', kind: 'check', stat: 'cha', dc: 12, reward: 'ally' }] };
    expect(sanitizeEvent(raw, ctx()).open).toBe(true);
    expect(sanitizeEvent({ ...raw, open: 'yes' }, ctx()).open).toBeUndefined();
  });

  it('cleans what was typed', () => {
    expect(cleanAction('  climb\n\tthe   statue ')).toBe('climb the statue');
    expect(cleanAction('x'.repeat(500))).toHaveLength(MAX_ACTION);
  });

  it('keeps the referee honest: clamps difficulty, checks the purse, no free friends', () => {
    const t = 'Offer the troll my potion';
    const a = sanitizeIntent({ kind: 'check', stat: 'CHA', dc: 3, reward: 'ally', clever: true, spend: { potions: 1 } }, s, ev(), ctx(), t);
    expect(a.choice).toMatchObject({ kind: 'check', stat: 'cha', dc: 8, reward: 'ally', adv: 1, custom: t });
    expect(a.spend).toEqual({ gold: 0, potions: 1 });
    expect(sanitizeIntent({ kind: 'check', dc: 99 }, s, ev(), ctx(), t).choice?.dc).toBe(20);
    expect(sanitizeIntent({ kind: 'check', spend: { gold: 50 } }, s, ev(), ctx(), t).refuse).toMatch(/10 gold/);
    s.player.potions = 0;
    expect(sanitizeIntent({ kind: 'check', spend: { potions: 1 } }, s, ev(), ctx(), t).refuse).toMatch(/no potions/);
    expect(sanitizeIntent({ kind: 'check', reward: 'ally' }, s, ev({ npc: null }), ctx(), t).choice?.reward).toBe('xp');
    expect(sanitizeIntent({ refuse: 'You have no rope.' }, s, ev(), ctx(), t)).toMatchObject({ refuse: 'You have no rope.' });
    expect(sanitizeIntent({ kind: 'teleport' }, s, ev(), ctx(), t).choice?.kind).toBe('check');
  });

  it('a fight uses the scene\'s foe when none is named', () => {
    const f = sanitizeIntent({ kind: 'fight' }, s, ev(), ctx(), 'I charge the troll');
    expect(f.choice?.enemy?.name).toBe('Bridge Troll');
  });

  it('works without AI by reading the words', async () => {
    expect(keywordIntent(s, ev(), ctx(), 'Try to bribe the troll').choice).toMatchObject({ stat: 'cha', kind: 'check' });
    expect(keywordIntent(s, ev(), ctx(), 'Try to bribe the troll').spend.gold).toBeGreaterThan(0);
    expect(keywordIntent(s, ev(), ctx(), 'climb the bridge railings').choice?.stat).toBe('str');
    expect(keywordIntent(s, ev(), ctx(), 'sneak past while it sleeps').choice?.stat).toBe('dex');
    expect(keywordIntent(s, ev(), ctx(), 'study the runes on the stones').choice).toMatchObject({ stat: 'int', reward: 'lore' });
    expect(keywordIntent(s, ev(), ctx(), 'attack it with my lute').choice?.kind).toBe('fight');
    expect(keywordIntent(s, ev(), ctx(), 'just walk away').choice?.kind).toBe('leave');
    const viaApi = await interpretAction(s, ev(), ctx(), 'share my potion with the troll');
    expect(viaApi.choice?.stat).toBe('cha');
    expect(viaApi.spend.potions).toBe(1);
    expect((await interpretAction(s, ev(), ctx(), '   ')).refuse).toBeTruthy();
  });
});
