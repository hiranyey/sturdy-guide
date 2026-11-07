import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../core/content';
import type { EnemyKind } from '../../core/types';
import { foeArchetype, foeArt } from './foes';
import contentSrc from '../../core/content.ts?raw';
import terrainSrc from '../../core/terrain.ts?raw';

const KINDS: EnemyKind[] = ['beast', 'humanoid', 'undead', 'monster', 'spirit'];

// Every enemy spec literal in the content files, including fallback-event and terrain fights.
function allEnemies(): { name: string; kind: EnemyKind }[] {
  const out = Object.values(ENEMIES).flat().map((e) => ({ name: e.name, kind: e.kind }));
  for (const src of [contentSrc, terrainSrc]) {
    for (const m of src.matchAll(/enemy: \{ name: '((?:[^'\\]|\\.)*)', kind: '(\w+)'/g)) {
      out.push({ name: m[1].replace(/\\'/g, "'"), kind: m[2] as EnemyKind });
    }
  }
  return out;
}

describe('foe art', () => {
  const enemies = allEnemies();

  it('finds the content enemies', () => {
    expect(enemies.length).toBeGreaterThan(30);
  });

  it('maps every content enemy by keyword, not by kind fallback', () => {
    for (const e of enemies) {
      const a = foeArchetype(e.name, e.kind);
      // A keyword match is independent of kind; the fallbacks differ per kind.
      for (const k of KINDS) expect(foeArchetype(e.name, k), `${e.name} as ${k}`).toBe(a);
    }
  });

  it('falls back per kind for unknown names', () => {
    const seen = new Set(KINDS.map((k) => foeArchetype('Zorblax', k)));
    expect(seen.size).toBe(KINDS.length);
  });

  it('picks sensible archetypes', () => {
    expect(foeArchetype('Giant Spider', 'monster')).toBe('spider');
    expect(foeArchetype('Hill Giant', 'monster')).toBe('brute');
    expect(foeArchetype('Drowned Sailor', 'undead')).toBe('zombie');
    expect(foeArchetype('Wrecker Pirate', 'humanoid')).toBe('pirate');
    expect(foeArchetype('Goblin Raider', 'humanoid')).toBe('goblin');
    expect(foeArchetype('Ancient Guardian', 'monster')).toBe('golem');
    expect(foeArchetype("Will-o'-Wisp", 'spirit')).toBe('wisp');
    expect(foeArchetype('Pirate Pratt', 'humanoid')).toBe('pirate');
  });

  it('renders valid-looking, compact SVG with unique ids across calls', () => {
    const ids = new Set<string>();
    for (const e of enemies) {
      for (const opts of [{}, { tier: 5 }, { tier: 3, boss: true }]) {
        const svg = foeArt(e, opts);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).toContain('viewBox="0 0 100 100"');
        expect(svg).not.toMatch(/NaN|undefined|<image|<text/);
        expect(svg.length).toBeLessThan(8192);
        const open = (svg.match(/<[a-zA-Z][^>]*(?<!\/)>/g) ?? []).length;
        const close = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
        expect(open).toBe(close);
        const local = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
        for (const id of local) {
          expect(ids.has(id), id).toBe(false);
          ids.add(id);
        }
        for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) expect(local).toContain(ref[1]);
      }
    }
  });

  it('is deterministic apart from ids', () => {
    const strip = (s: string) => s.replace(/fa[0-9a-z]+/g, 'X');
    expect(strip(foeArt({ name: 'Frost Wolf', kind: 'beast' }, { tier: 2 }))).toBe(strip(foeArt({ name: 'Frost Wolf', kind: 'beast' }, { tier: 2 })));
  });
});
