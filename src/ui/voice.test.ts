import { describe, it, expect, beforeEach } from 'vitest';
import { castLines, guessVoice, narrator, setStoryTone, speakable, voiceFor, TONE_NARRATOR } from './voice';
import { parseVoice } from '../ai/director';
import { settings } from '../ai/settings';

beforeEach(() => { settings.narrator = 'auto'; setStoryTone('heroic'); });

const FEM = ['cordelia', 'delia', 'iris', 'luna', 'amalthea', 'andromeda', 'asteria', 'aurora', 'callista', 'cora', 'harmonia', 'helena', 'janus', 'juno', 'minerva', 'ophelia', 'phoebe', 'selene', 'thalia', 'theia', 'vesta', 'athena', 'hera', 'pandora'];

describe('voice casting', () => {
  it('picks the narrator from the story tone unless the player chose one', () => {
    expect(narrator()).toBe(TONE_NARRATOR.heroic);
    setStoryTone('grim');
    expect(narrator()).toBe(TONE_NARRATOR.grim);
    settings.narrator = 'athena';
    expect(narrator()).toBe('athena');
  });

  it('gives each character a lasting voice that fits how they sound, never the narrator', () => {
    const v = voiceFor('Old Nan', { gender: 'feminine', age: 'mature' });
    expect(voiceFor('Old Nan', { gender: 'feminine', age: 'mature' })).toBe(v);
    expect(['athena', 'hera', 'helena', 'vesta', 'pandora']).toContain(v);
    expect(['jupiter', 'mars', 'pluto', 'zeus']).toContain(voiceFor('Grok', { gender: 'masculine', deep: true }));
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      expect(voiceFor(n, { gender: 'masculine', age: 'mature' })).not.toBe(narrator());
      expect(FEM).toContain(voiceFor(n, { gender: 'feminine' }));
    }
  });

  it('reads quotes in the speaker\'s voice and narration in the narrator\'s', () => {
    const mira = { name: 'Mira Ashcloak', voice: { gender: 'feminine' as const } };
    const bram = { name: 'Bram', voice: { gender: 'masculine' as const, deep: true } };
    const lines = castLines('Mira wipes her hands. "Three goats gone." Bram growls, "Then we hunt." You ask, "Where?"', [mira, bram], mira);
    expect(lines).toEqual([
      { text: 'Mira wipes her hands.' },
      { text: 'Three goats gone.', voice: voiceFor(mira.name, mira.voice) },
      { text: 'Bram growls,' },
      { text: 'Then we hunt.', voice: voiceFor(bram.name, bram.voice) },
      { text: 'You ask, Where?' },
    ]);
  });

  it('gives a bare campfire line to the companion', () => {
    const bram = { name: 'Bram', voice: { gender: 'masculine' as const } };
    expect(castLines('Bram: We did well today.', [bram], bram, true)).toEqual([{ text: 'We did well today.', voice: voiceFor('Bram', bram.voice) }]);
    expect(castLines('The fire crackles.', [], null)).toEqual([{ text: 'The fire crackles.' }]);
  });

  it('reads how a character sounds from the model or the scene', () => {
    expect(parseVoice('feminine mature')).toEqual({ gender: 'feminine', age: 'mature' });
    expect(parseVoice('masculine adult deep')).toEqual({ gender: 'masculine', age: 'adult', deep: true });
    expect(parseVoice({ gender: 'masculine', deep: true })).toEqual({ gender: 'masculine', deep: true });
    expect(parseVoice('???')).toBeUndefined();
    expect(guessVoice('The old woman wrings her hat.')).toEqual({ gender: 'feminine', age: 'mature' });
    expect(guessVoice('Someone waves.')).toBeUndefined();
  });

  it('strips emoji and symbols before speaking', () => {
    expect(speakable('★ The Lost Bell 🔔 —  ring it!')).toBe('The Lost Bell — ring it!');
  });
});
