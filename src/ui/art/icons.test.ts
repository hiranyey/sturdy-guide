import { describe, it, expect } from 'vitest';
import { ICON_IDS, icon, iconFor, hasIcon } from './icons';
import { SIGNS } from '../../core/encounters';
import { BLOCK_INFO } from '../../core/blocks';
import { WEATHER_INFO } from '../../core/weather';
import { OMENS } from '../../core/content';
import { ABILITIES, TREES } from '../../core/talents';
import { ACHIEVEMENTS } from '../../core/achievements';

describe('interface icons', () => {
  it('draws every icon as a self-contained 32-unit SVG', () => {
    expect(ICON_IDS.length).toBeGreaterThan(90);
    for (const id of ICON_IDS) {
      const svg = icon(id, 24);
      expect(svg, id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32"/);
      expect(svg, id).toContain(' width="24" height="24"');
      expect(svg.endsWith('</svg>'), id).toBe(true);
      // no ids, fonts or external references: safe to inline many times and to draw on a canvas
      expect(svg, id).not.toMatch(/\sid=|url\(|<text|href=/);
      expect(svg, id).not.toMatch(/NaN|undefined/);
    }
  });

  it('follows the text size when no size is given', () => {
    expect(icon('coin')).not.toMatch(/\swidth="/);
    expect(icon('coin')).toContain('class="ic ic-coin"');
  });

  it('names icons that carry meaning and hides the rest from screen readers', () => {
    expect(icon('flame')).toContain('aria-label="torch"');
    expect(icon('plus')).toContain('aria-hidden="true"');
  });

  it('maps emoji to icons, with or without a variation selector', () => {
    expect(iconFor('🔥')).toBe('flame');
    expect(iconFor('⚔️')).toBe('swords');
    expect(iconFor('⚔')).toBe('swords');
    expect(iconFor('🦄')).toBeUndefined();
    expect(hasIcon('-1 🔥 (time lost)')).toBe(true);
    expect(hasIcon('Nothing to see here.')).toBe(false);
  });

  it('has an icon for everything the map and HUD show', () => {
    const shown = [
      ...Object.values(SIGNS).map((s) => s.icon),
      ...Object.values(BLOCK_INFO).map((b) => b.icon),
      ...Object.values(WEATHER_INFO).map((w) => w.icon),
      ...OMENS.map((o) => o.icon),
    ];
    for (const e of shown) expect(iconFor(e), e).toBeDefined();
  });

  it('has an icon for every ability, talent and achievement', () => {
    const glyphs = [
      ...Object.values(ABILITIES).map((a) => a.icon),
      ...Object.values(TREES).flatMap((t) => [...t.nodes.map((n) => n.icon), ...t.branches.map((b) => b.icon)]),
      ...ACHIEVEMENTS.map((a) => a.icon),
    ];
    // '✦' is a plain text glyph (talent points), drawn by the font
    const missing = [...new Set(glyphs)].filter((e) => e !== '✦' && !iconFor(e));
    expect(missing).toEqual([]);
  });
});
