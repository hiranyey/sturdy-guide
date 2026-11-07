import { describe, it, expect } from 'vitest';
import { weatherAt, weatherFor, frontAt, WEATHER_INFO, type Weather } from './weather';
import { ambienceFor } from '../ui/ambience';
import { edgeColor } from '../ui/edges';

describe('weather', () => {
  it('is calm on the first morning and the same on every reload', () => {
    for (let q = -5; q <= 5; q++) expect(frontAt(42, 1, { q, r: 0 })).toBe('calm');
    expect(weatherAt(42, 5, { q: 3, r: -2 })).toBe(weatherAt(42, 5, { q: 3, r: -2 }));
  });

  it('turns a front into what the terrain would show', () => {
    expect(weatherFor('wet', 'grass')).toBe('rain');
    expect(weatherFor('wet', 'snow')).toBe('snow');
    expect(weatherFor('wet', 'desert')).toBe('clear');
    expect(weatherFor('storm', 'forest')).toBe('storm');
    expect(weatherFor('storm', 'desert')).toBe('wind');
    expect(weatherFor('mist', 'swamp')).toBe('fog');
    expect(weatherFor('hot', 'desert')).toBe('heat');
    expect(weatherFor('hot', 'mountain')).toBe('clear');
  });

  it('changes from day to day, mostly fair', () => {
    const seen: Record<string, number> = {};
    for (let day = 2; day < 400; day++) {
      const f = frontAt(7, day, { q: 0, r: 0 });
      seen[f] = (seen[f] ?? 0) + 1;
    }
    expect(Object.keys(seen).length).toBe(6);
    expect(seen.calm).toBeGreaterThan(seen.storm);
  });

  it('every kind has an icon, a name and words for the storyteller', () => {
    for (const w of Object.keys(WEATHER_INFO) as Weather[]) {
      expect(WEATHER_INFO[w].icon && WEATHER_INFO[w].name && WEATHER_INFO[w].prompt && WEATHER_INFO[w].arrive).toBeTruthy();
    }
  });

  it('is heard and seen: rain hushes birds, storms thunder, edges go grey', () => {
    const day = { biome: 'grass' as const, time: 'day' as const };
    expect(ambienceFor(day)).toContain('birds');
    expect(ambienceFor({ ...day, weather: 'rain' })).toEqual(expect.arrayContaining(['rain']));
    expect(ambienceFor({ ...day, weather: 'rain' })).not.toContain('birds');
    expect(ambienceFor({ ...day, weather: 'storm' })).toEqual(expect.arrayContaining(['rain', 'storm', 'wind']));
    expect(ambienceFor({ biome: 'snow', weather: 'snow' })).toEqual(['gale']);
    expect(ambienceFor({ biome: 'grass', poi: 'cave', weather: 'storm' })).not.toContain('rain');
    const clear = edgeColor(day), storm = edgeColor({ ...day, weather: 'storm' });
    const sat = (c: number[]) => Math.max(...c) - Math.min(...c);
    expect(sat(storm)).toBeLessThan(sat(clear));
  });
});
