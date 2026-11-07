import { describe, it, expect, beforeEach } from 'vitest';
import { blockAt, canEnter, placeBlocks, clearBlock, expireBlocks, blocksNear, BLOCK_INFO, BLOCK_KINDS } from './blocks';
import { createGame } from './state';
import { findPath, isPassable, poiAt } from './world';
import { neighbors, spiral, key, eq, type Hex } from './hex';
import { riverAt } from './terrain';
import { weatherAt } from './weather';
import type { GameState } from './types';

let s: GameState;
beforeEach(() => {
  s = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
  s.quest = null;
});

const openNeighbour = (st: GameState, h: Hex) => neighbors(h).find((n) => isPassable(n, st.seed) && !poiAt(n, st.seed))!;

describe('blocked ways', () => {
  it('every kind can be described and (except weather) cleared', () => {
    for (const k of BLOCK_KINDS) expect(BLOCK_INFO[k].icon && BLOCK_INFO[k].name && BLOCK_INFO[k].verb).toBeTruthy();
  });

  it('closes a hex near the event, never the hero\'s own tile', () => {
    const placed = placeBlocks(s, s.pos, 'rockfall', 'Boulders.', { count: 2 });
    expect(placed.length).toBe(2);
    for (const h of placed) {
      expect(eq(h, s.pos)).toBe(false);
      expect(blockAt(s, h)?.kind).toBe('rockfall');
      expect(canEnter(s, h)).toBe(false);
    }
    expect(placeBlocks(s, s.pos, 'fire', 'Fire.', { here: true })).toEqual([]); // the hero stands there
  });

  it('pathfinding goes around a block', () => {
    const a = s.pos;
    const b = openNeighbour(s, a);
    const far = neighbors(b).find((n) => !eq(n, a) && isPassable(n, s.seed) && !neighbors(a).some((m) => eq(m, n)))!;
    expect(findPath(a, far, s.seed, () => true)).toHaveLength(2);
    (s.blocks ??= {})[key(b)] = { kind: 'thorns', reason: 'Thorns.', day: s.day };
    const around = findPath(a, far, s.seed, (h) => canEnter(s, h));
    expect((around ?? []).some((h) => eq(h, b))).toBe(false);
  });

  it('never cuts the hero off from their quest or boxes them in', () => {
    s.quest = { title: 'Q', description: 'd', place: 'p', target: spiral(s.pos, 3).find((h) => isPassable(h, s.seed) && !poiAt(h, s.seed) && !eq(h, s.pos))!, giver: 'x' } as unknown as GameState['quest'];
    for (let i = 0; i < 40; i++) placeBlocks(s, s.pos, 'barricade', 'Barricade.', { count: 6 });
    expect(blockAt(s, s.quest!.target)).toBeNull();
    expect(findPath(s.pos, s.quest!.target, s.seed, (h) => canEnter(s, h))).not.toBeNull();
    expect(neighbors(s.pos).some((n) => isPassable(n, s.seed) && canEnter(s, n))).toBe(true);
  });

  it('fires and floods burn out; others stay until cleared', () => {
    const [f] = placeBlocks(s, s.pos, 'fire', 'Fire.');
    const [r] = placeBlocks(s, s.pos, 'rockfall', 'Rocks.');
    s.day += 2;
    expireBlocks(s);
    expect(blockAt(s, f)).toBeNull();
    expect(blockAt(s, r)).not.toBeNull();
    clearBlock(s, r);
    expect(blockAt(s, r)).toBeNull();
  });

  it('storms flood river crossings for the day', () => {
    let found = false;
    for (let t = 0; t < 60 && !found; t++) {
      const g = createGame('T', 'warrior', 'heroic', { name: 'W', hook: 'h' });
      g.quest = null;
      for (let day = 2; day < 30 && !found; day++) for (const h of spiral({ q: 0, r: 0 }, 8)) {
        if (!riverAt(h, g.seed) || weatherAt(g.seed, day, h) !== 'storm' || poiAt(h, g.seed)) continue;
        g.day = day;
        expect(blockAt(g, h)).toMatchObject({ kind: 'flood', weather: true });
        g.day = day + 1;
        if (weatherAt(g.seed, day + 1, h) !== 'storm') expect(blockAt(g, h)).toBeNull();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('tells the storyteller what is blocked nearby', () => {
    placeBlocks(s, s.pos, 'guards', 'The garrison bars the road.');
    expect(blocksNear(s)[0]).toMatch(/Guarded: The garrison bars the road/);
  });
});
