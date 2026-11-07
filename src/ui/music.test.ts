import { describe, it, expect } from 'vitest';
import { moodFor, MOODS } from './music';
import { ambienceFor } from './ambience';

describe('scene music', () => {
  it('special places pick their own music', () => {
    expect(moodFor({ biome: 'grass', poi: 'village' })).toBe('village');
    expect(moodFor({ biome: 'grass', poi: 'market' })).toBe('market');
    expect(moodFor({ biome: 'hills', poi: 'cave', time: 'night' })).toBe('depths');
    expect(moodFor({ biome: 'forest', poi: 'shrine' })).toBe('sacred');
    expect(moodFor({ biome: 'snow', poi: 'tower' })).toBe('arcane');
  });
  it('the land sets the mood by day; night has its own', () => {
    expect(moodFor({ biome: 'forest', time: 'day' })).toBe('forest');
    expect(moodFor({ biome: 'mountain' })).toBe('highlands');
    expect(moodFor({ biome: 'deep' })).toBe('coast');
    expect(moodFor({ biome: 'desert', time: 'night' })).toBe('night');
    expect(moodFor({ biome: 'grass', poi: 'stranger' })).toBe('plains');
  });
  it('every mood is well-formed', () => {
    for (const [name, d] of Object.entries(MOODS)) {
      expect(d.prog.length, name).toBeGreaterThan(0);
      for (const pat of [d.bass?.pat, d.arp?.pat, d.drums?.kick, d.drums?.snare, d.drums?.hat, d.drums?.frame]) {
        if (pat) expect(pat, name).toMatch(/^[xoh.]{16}$/);
      }
    }
  });
});

describe('ambience', () => {
  it('fits the place and the hour', () => {
    expect(ambienceFor({ biome: 'grass', time: 'day' })).toContain('birds');
    expect(ambienceFor({ biome: 'grass', time: 'night' })).toContain('crickets');
    expect(ambienceFor({ biome: 'grass', time: 'night' })).not.toContain('birds');
    expect(ambienceFor({ biome: 'water' })).toContain('waves');
    expect(ambienceFor({ biome: 'snow' })).toEqual(['gale']);
    expect(ambienceFor({ biome: 'hills', poi: 'cave' })).toContain('drips');
    expect(ambienceFor({ biome: 'grass', poi: 'market' })).toContain('crowd');
  });
  it('adds a babbling river where one runs', () => {
    expect(ambienceFor({ biome: 'forest', river: true })).toContain('river');
  });
});
