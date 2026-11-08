import { describe, it, expect, afterEach } from 'vitest';
import { plain, styleGuide, PLAIN_STYLE, fallbackChapterEnd } from './director';
import { settings } from './settings';
import { createGame, log } from '../core/state';

afterEach(() => { settings.plainStory = true; });

describe('plain story text', () => {
  it('asks the storyteller for short sentences and everyday words by default', () => {
    expect(styleGuide()).toBe(PLAIN_STYLE);
    expect(PLAIN_STYLE).toMatch(/never over 18/);
    settings.plainStory = false;
    expect(styleGuide()).not.toBe(PLAIN_STYLE);
  });

  it('splits semicolon chains into separate sentences', () => {
    expect(plain('The door creaks; something moves inside; you hold your breath.'))
      .toBe('The door creaks. Something moves inside. You hold your breath.');
    expect(plain('"Wait;  Mira is here."')).toBe('"Wait. Mira is here."');
    settings.plainStory = false;
    expect(plain('A; b')).toBe('A; b');
  });

  it('writes the offline recap as one short sentence per event', () => {
    const s = createGame('Ash Vale', 'mage', 'heroic', { name: 'W', hook: 'h' });
    log(s, 'took up the quest "The Lost Bell"', 'quest');
    log(s, 'tried to climb the tower at Old Spire (success)', 'event');
    log(s, 'rested at Moonwell Shrine', 'event');
    const { recap } = fallbackChapterEnd(s);
    expect(recap).not.toContain(';');
    expect(recap.split('. ').length).toBeGreaterThanOrEqual(3);
    expect(recap).toMatch(/^On day \d+, Ash took up the quest/);
    expect(recap).toMatch(/Finally, Ash rested at Moonwell Shrine\.$/);
  });
});
