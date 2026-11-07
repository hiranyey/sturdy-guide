import { describe, it, expect, vi } from 'vitest';
import { sceneArt, combatBackdrop, SCENE_LANDMARKS, type ScenePoi, type SceneTime } from './scenes';
import type { Biome } from '../../core/types';
import { LANDMARKS } from '../../core/terrain';
import { OMENS } from '../../core/content';

const BIOMES: Biome[] = ['deep', 'water', 'sand', 'grass', 'forest', 'swamp', 'hills', 'mountain', 'snow', 'desert'];
const POIS: (ScenePoi | undefined)[] = ['village', 'ruin', 'cave', 'shrine', 'camp', 'tower', 'grove', 'stranger', 'start', 'quest', 'wild', undefined];
const TIMES: SceneTime[] = ['day', 'dusk', 'night'];

/** Strip the per-call id prefix so two renders can be compared. */
const norm = (s: string) => s.replace(/hs[0-9a-z]+_/g, 'ID_');

function wellFormed(svg: string) {
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).toContain('viewBox="0 0 360 140"');
  expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  expect(svg).not.toMatch(/NaN|undefined|Infinity|<image|<text|filter/);
  expect((svg.match(/<g[ >]/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
}

describe('sceneArt', () => {
  it('renders every biome × poi × time without Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    for (const biome of BIOMES) for (const poi of POIS) for (const time of TIMES) {
      const svg = sceneArt({ biome, poi, seed: 7, time });
      wellFormed(svg);
      expect(svg.length).toBeLessThan(16000);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is deterministic for a seed and varies between seeds', () => {
    for (const biome of BIOMES) {
      const a = sceneArt({ biome, poi: 'village', seed: 1234 });
      const b = sceneArt({ biome, poi: 'village', seed: 1234 });
      expect(norm(a)).toBe(norm(b));
      expect(norm(sceneArt({ biome, poi: 'village', seed: 99 }))).not.toBe(norm(a));
    }
  });

  it('uses ids that are unique across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const svg = i % 2 ? sceneArt({ biome: BIOMES[i % BIOMES.length], poi: 'quest', seed: i, time: 'night' }) : combatBackdrop({ biome: 'forest', seed: 3 });
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      for (const id of ids) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(m[1]);
    }
  });

  it('draws every landmark key, alone and beside a poi', () => {
    for (const k of Object.keys(LANDMARKS)) expect(SCENE_LANDMARKS).toContain(k);
    for (const landmark of SCENE_LANDMARKS) {
      const alone = sceneArt({ biome: 'grass', landmark, seed: 5 });
      wellFormed(alone);
      expect(alone.length).toBeGreaterThan(sceneArt({ biome: 'grass', seed: 5 }).length);
      wellFormed(sceneArt({ biome: 'water', poi: 'camp', landmark, seed: 5, time: 'dusk' }));
    }
    // unknown keys fall back to no landmark
    expect(norm(sceneArt({ biome: 'hills', landmark: 'nope', seed: 2 }))).toBe(norm(sceneArt({ biome: 'hills', seed: 2 })));
  });

  it('accepts every omen', () => {
    for (const { id } of OMENS) for (const time of TIMES) wellFormed(sceneArt({ biome: 'grass', poi: 'village', seed: 3, time, omen: id }));
    expect(sceneArt({ biome: 'grass', seed: 3, time: 'night', omen: 'blood-moon' })).toContain('#e0503c');
  });
});

describe('combatBackdrop', () => {
  it('renders every biome and time, with no subject', () => {
    for (const biome of BIOMES) for (const time of TIMES) {
      const svg = combatBackdrop({ biome, seed: 11, time });
      wellFormed(svg);
      expect(norm(svg)).toBe(norm(combatBackdrop({ biome, seed: 11, time })));
    }
  });
});
