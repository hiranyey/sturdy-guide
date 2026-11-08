import { describe, it, expect, beforeEach } from 'vitest';
import { signAt, spendSign, takeMoment, MOMENTS, momentFor, gainText, type SignKind } from './encounters';
import { createGame } from './state';
import { poiAt, isPassable } from './world';
import { landmarkAt } from './terrain';
import { spiral, key } from './hex';
import type { GameState } from './types';

let s: GameState;
beforeEach(() => {
  s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
  s.quest = null;
});

describe('map signs', () => {
  it('about every second fresh tile holds something, and it is the same on every look', () => {
    let tiles = 0, signs = 0;
    const kinds: Partial<Record<SignKind, number>> = {};
    for (let n = 0; n < 20; n++) {
      const g = createGame('T', 'rogue', 'heroic', { name: 'W', hook: 'h' });
      g.quest = null;
      for (const h of spiral({ q: 0, r: 0 }, 8)) {
        if (!isPassable(h, g.seed) || poiAt(h, g.seed) || landmarkAt(h, g.seed)) continue;
        tiles++;
        const a = signAt(g, h);
        expect(signAt(g, h)).toEqual(a);
        if (a) { signs++; kinds[a.kind] = (kinds[a.kind] ?? 0) + 1; }
      }
    }
    expect(signs / tiles).toBeGreaterThan(0.38);
    expect(signs / tiles).toBeLessThan(0.65);
    for (const k of ['foe', 'scene', 'moment', 'cache', 'herbs'] as SignKind[]) expect(kinds[k]).toBeGreaterThan(0);
  });

  it('never sits on places, landmarks or the quest goal', () => {
    for (const h of spiral({ q: 0, r: 0 }, 10)) {
      if (poiAt(h, s.seed) || landmarkAt(h, s.seed) || !isPassable(h, s.seed)) expect(signAt(s, h)).toBeNull();
    }
    const goal = spiral({ q: 0, r: 0 }, 6).find((h) => signAt(s, h))!;
    s.quest = { title: 'Q', description: 'd', place: 'p', target: goal, giver: 'x' } as unknown as GameState['quest'];
    expect(signAt(s, goal)).toBeNull();
  });

  it('is used up when stepped on, and the walked ground is quieter the next day', () => {
    const open = spiral({ q: 0, r: 0 }, 8).filter((h) => isPassable(h, s.seed) && !poiAt(h, s.seed) && !landmarkAt(h, s.seed));
    const h = open.find((x) => signAt(s, x))!;
    spendSign(s, h);
    expect(signAt(s, h)).toBeNull();
    // walk everything: fewer signs come back tomorrow
    const fresh = open.filter((x) => { s.day = 1; return signAt(s, x); }).length;
    for (const x of open) (s.tiles[key(x)] ||= {}).v = 1;
    let later = 0;
    for (let day = 2; day < 6; day++) { s.day = day; later += open.filter((x) => signAt(s, x)).length; }
    expect(later / 4).toBeLessThan(fresh * 0.6);
  });
});

describe('quick moments', () => {
  it('every moment offers two priced options that read clearly', () => {
    for (let i = 0; i < MOMENTS.length; i++) {
      const m = momentFor({ kind: 'moment', moment: i }, 2);
      expect(m.options).toHaveLength(2);
      for (const o of m.options) expect(gainText(o.gain)).not.toBe('');
    }
  });

  it('pays the price and gives what it says; bad luck still never kills', () => {
    const rest = MOMENTS[1](1).options[0]; // rest by the embers: -1 torch, +HP
    s.player.hp = 3;
    const torches = s.stamina;
    const r = takeMoment(s, rest);
    expect(s.stamina).toBe(torches - 1);
    expect(s.player.hp).toBeGreaterThan(3);
    expect(r.lines).toContain('-1 🔥');
    const shrine = MOMENTS[8](3).options[1]; // take the coins (bad luck hurts)
    s.player.hp = 2;
    const bad = takeMoment(s, shrine, () => 0.99);
    expect(bad.good).toBe(false);
    expect(s.player.hp).toBe(1);
  });
});
