import { describe, it, expect } from 'vitest';
import { HERO_NAMES, heroName, MAX_NAME } from './names';
import { mulberry32 } from './rng';

describe('hero names', () => {
  it('has a long, varied list that fits the name field', () => {
    expect(HERO_NAMES.length).toBeGreaterThanOrEqual(200);
    expect(new Set(HERO_NAMES).size).toBe(HERO_NAMES.length);
    for (const n of HERO_NAMES) {
      expect(n.length).toBeLessThanOrEqual(MAX_NAME);
      expect(n).toMatch(/^[A-Z][A-Za-z' -]+$/);
    }
    expect(HERO_NAMES.filter((n) => n.includes(' ')).length).toBeGreaterThanOrEqual(50); // the grand ones
  });

  it('always changes the name when you roll', () => {
    const r = mulberry32(7);
    let name = heroName('', r);
    for (let i = 0; i < 200; i++) {
      const next = heroName(name, r);
      expect(next).not.toBe(name);
      name = next;
    }
  });
});
