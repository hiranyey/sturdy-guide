import { describe, it, expect } from 'vitest';
import { biomeAt, poiAt, findPath, pickQuestTarget, isPassable } from './world';
import { spiral, distance } from './hex';

describe('world', () => {
  it('biome distribution is varied and start is grass', () => {
    const counts: Record<string, number> = {};
    let pois = 0;
    for (const seed of [1, 42, 999]) {
      expect(biomeAt({ q: 0, r: 0 }, seed)).toBe('grass');
      for (const h of spiral({ q: 0, r: 0 }, 30)) {
        const b = biomeAt(h, seed);
        counts[b] = (counts[b] || 0) + 1;
        if (poiAt(h, seed)) pois++;
      }
    }
    console.log(counts, 'pois', pois);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(8);
  });
  it('quest target reachable', () => {
    for (const seed of [1, 7, 42, 1234, 77777]) {
      const t = pickQuestTarget({ q: 0, r: 0 }, seed, 6, 9, 1);
      expect(isPassable(t, seed)).toBe(true);
      expect(distance(t, { q: 0, r: 0 })).toBeGreaterThan(2);
      const p = findPath({ q: 0, r: 0 }, t, seed, () => true);
      expect(p).not.toBeNull();
    }
  });
});
