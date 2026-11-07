import { describe, it, expect } from 'vitest';
import { heroPortraitSvg, classEmblemSvg, faceOf } from './heroes';
import { portraitSvg } from '../portrait';
import type { ClassId } from '../../core/types';

const CLASSES: ClassId[] = ['warrior', 'rogue', 'mage', 'bard'];
const NAMES = ['Aldric', 'Brienne', 'Corwin', 'Dagny', 'Elowen', 'Fenwick', 'Gareth', 'Hilde', 'Isolde', 'Jory', 'Kael', 'Lyra'];
const ids = (svg: string) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const stripIds = (svg: string) => svg.replace(/\b(hp|ce)\d+/g, 'X');

describe('hero portraits', () => {
  it('are deterministic apart from per-call ids', () => {
    for (const c of CLASSES) expect(stripIds(heroPortraitSvg('Mira', c))).toBe(stripIds(heroPortraitSvg('Mira', c)));
  });

  it('use unique ids per call, and every url(#…) points at a local id', () => {
    const a = heroPortraitSvg('Mira', 'mage'), b = heroPortraitSvg('Mira', 'mage');
    expect(ids(a).filter((x) => ids(b).includes(x))).toEqual([]);
    for (const svg of [a, b]) for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids(svg)).toContain(ref);
  });

  it('keep the same face as portraitSvg (skin & hair colours)', () => {
    for (const name of NAMES) {
      const f = faceOf(name), old = portraitSvg(name);
      expect(old).toContain(`fill="${f.skin}"`);
      expect(old).toContain(`stroke="${f.hair}"`); // eyebrows
      for (const c of CLASSES) expect(heroPortraitSvg(name, c)).toContain(`fill="${f.skin}"`);
    }
  });

  it('are compact, self-contained SVG with the portrait class', () => {
    for (const name of NAMES) for (const c of CLASSES) {
      const svg = heroPortraitSvg(name, c, 40, 'me');
      expect(svg.length).toBeLessThan(8000);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 100 100" width="40" height="40" class="portrait me">/);
      expect(svg).not.toMatch(/<image|<text|filter|NaN|undefined/);
    }
  });

  it('vary headgear within a class by name', () => {
    const helm = NAMES.map((nm) => heroPortraitSvg(nm, 'warrior').includes('M47.4 34 L52.6 34'));
    const hat = NAMES.map((nm) => heroPortraitSvg(nm, 'mage').includes('<ellipse cx="50" cy="31"'));
    expect(new Set(helm).size).toBe(2);
    expect(new Set(hat).size).toBe(2);
  });
});

describe('class emblems', () => {
  it('render each class distinctly', () => {
    const all = CLASSES.map((c) => classEmblemSvg(c, 48));
    expect(new Set(all.map(stripIds)).size).toBe(4);
    for (const svg of all) {
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg.length).toBeLessThan(8000);
      expect(svg).not.toMatch(/NaN|undefined|<text/);
    }
  });
});
