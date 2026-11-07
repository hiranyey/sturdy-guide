import { describe, it, expect } from 'vitest';
import { itemArt, itemArtShape, potionArt, goldArt, torchArt, inspirationArt, xpArt, type ItemArtInput } from './items';
import { CLASSES } from '../../core/rules';
import type { Stat } from '../../core/types';

// Mirrors the (unexported) loot tables in core/rules.ts.
const WEAPON_NAMES = [
  'Greatsword', 'Battleaxe', 'Warhammer', 'Halberd', 'Bastard Sword',
  'Stiletto', 'Shortsword', 'Kris Blade', 'Hand Crossbow', 'Shadow Dirk',
  'Ember Wand', 'Rune Staff', 'Storm Orb', 'Grimoire', 'Crystal Rod',
  'Silver Rapier', 'Lute-Blade', 'Duelling Sabre', 'Whip of Verses', 'Songsteel Foil',
];
const PREFIX = ['Rusty', 'Fine', 'Runed', 'Moonlit', 'Dragonbone', 'Starforged'];
const ARMOR_NAMES = ['Brigandine', 'Scale Mail', 'Warded Cloak', 'Studded Jerkin', 'Ironweave Vest', 'Dragonscale Coat'];
const CHARM_NAMES: Record<Stat, string[]> = {
  str: ['Bear Tooth', 'Ox-Hide Band'], dex: ['Cat-Eye Ring', 'Feather Anklet'],
  con: ['Ironroot Amulet', 'Troll Knuckle'], int: ['Owl Lens', 'Inkstone Pendant'],
  wis: ['Moon Pebble', 'Hermit Bell'], cha: ['Silver Tongue Pin', 'Rose Locket'],
};

const all: ItemArtInput[] = [
  ...Object.values(CLASSES).flatMap((c) => [c.weapon, c.armor]),
  ...PREFIX.flatMap((p, i) => WEAPON_NAMES.map((w) => ({ name: `${p} ${w}`, slot: 'weapon' as const, tier: i + 1, plus: i, die: 8 }))),
  ...PREFIX.flatMap((p, i) => ARMOR_NAMES.map((a) => ({ name: `${p} ${a}`, slot: 'armor' as const, tier: i + 1, plus: 4 + i }))),
  ...Object.entries(CHARM_NAMES).flatMap(([stat, ns]) => ns.map((name) => ({ name, slot: 'charm' as const, tier: 2, plus: 2, stat: stat as Stat }))),
];
const ids = (svg: string) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);

describe('item art', () => {
  it('gives every generated name a specific (non-fallback) shape', () => {
    for (const it of all) expect(itemArtShape(it), it.name).not.toMatch(/^fallback/);
    // weapon names, armour names and charms each map to distinct drawings
    expect(new Set(WEAPON_NAMES.map((name) => itemArtShape({ name, slot: 'weapon' }))).size).toBe(WEAPON_NAMES.length - 1); // the foil is drawn as a rapier
    expect(new Set(Object.values(CHARM_NAMES).flat().map((name) => itemArtShape({ name, slot: 'charm' }))).size).toBe(12);
    expect(new Set(ARMOR_NAMES.map((name) => itemArtShape({ name, slot: 'armor' }))).size).toBe(6);
  });

  it('ignores the material prefix when picking a shape', () => {
    expect(itemArtShape({ name: 'Dragonbone Scale Mail', slot: 'armor' })).toBe('scale');
    expect(itemArtShape({ name: 'Moonlit Rune Staff', slot: 'weapon' })).toBe('staff');
  });

  it('falls back by slot and stat for unknown names', () => {
    expect(itemArtShape({ name: 'Thingamajig', slot: 'weapon' })).toBe('fallback-weapon');
    expect(itemArtShape({ name: 'Odd Garb', slot: 'armor' })).toBe('fallback-armor');
    expect(itemArtShape({ name: 'Trinket', slot: 'charm', stat: 'dex' })).toBe('fallback-ring');
    expect(itemArtShape({ name: 'Trinket', slot: 'charm', stat: 'wis' })).toBe('fallback-amulet');
    expect(itemArt({ name: 'Trinket', slot: 'charm', tier: 1, plus: 1 })).toMatch(/^<svg/);
  });

  it('produces compact, self-contained SVG with unique ids across calls', () => {
    const svgs = [...all, ...all].map((it) => itemArt(it, 48));
    svgs.push(potionArt(), potionArt('heal'), goldArt(), torchArt(), torchArt(false), inspirationArt(), xpArt());
    const seen = new Set<string>();
    for (const svg of svgs) {
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 64 64"/);
      expect(svg.length).toBeLessThan(5000);
      expect(svg).not.toMatch(/NaN|undefined|<image|<text|filter/);
      const own = ids(svg);
      for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(own).toContain(ref);
      for (const id of own) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it('is deterministic apart from ids', () => {
    const strip = (s: string) => s.replace(/it[0-9a-z]+_[0-9a-z]+/g, 'X');
    for (const it of all.slice(0, 20)) expect(strip(itemArt(it))).toBe(strip(itemArt(it)));
  });
});
