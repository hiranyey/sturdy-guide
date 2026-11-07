// Visual & gameplay variety layered on top of biomes:
//  - sub-styles (autumn forests, mesas, volcanic peaks…) that form coherent patches
//  - rivers that connect from hex to hex
//  - midhex landmarks (standing stones, swords in stones, shipwrecks…) with lore, perks and mini-events
import { fbm, hash2, mulberry32, weighted } from './rng';
import { type Hex, key, neighbors, distance, toPixel, DIRS } from './hex';
import { biomeAt, poiAt, climate, isPassable } from './world';
import type { Biome, EventContext, GameEvent } from './types';

// ---------------- Sub-styles ----------------
export const STYLE_NAMES: Record<string, string> = {
  'grass:meadow': 'Meadow', 'grass:bloom': 'Flower Meadow', 'grass:steppe': 'Dry Steppe', 'grass:farm': 'Farmland',
  'forest:pine': 'Pine Forest', 'forest:broadleaf': 'Woodland', 'forest:autumn': 'Autumn Wood', 'forest:birch': 'Birch Grove', 'forest:jungle': 'Jungle',
  'hills:green': 'Hills', 'hills:heather': 'Heather Hills', 'hills:rocky': 'Rocky Hills',
  'mountain:grey': 'Peaks', 'mountain:red': 'Red Crags', 'mountain:volcanic': 'Volcanic Peaks',
  'snow:drift': 'Snowfield', 'snow:ice': 'Glacier', 'snow:tundra': 'Tundra',
  'desert:dunes': 'Dunes', 'desert:mesa': 'Red Mesa', 'desert:saltflat': 'Salt Flat',
  'swamp:reed': 'Marsh', 'swamp:mangrove': 'Mangrove', 'swamp:dead': 'Dead Marsh',
  'sand:beach': 'Beach', 'sand:pebble': 'Pebble Shore',
  'water:shallow': 'Shallows', 'water:lily': 'Lily Shallows',
  'deep:deep': 'Deep Sea', 'deep:kelp': 'Kelp Sea',
};

const styleCache = new Map<string, string>();
const riverCache = new Map<string, boolean>();
const lmCache = new Map<string, LandmarkKind | null>();
let cacheSeed = -1;
function checkSeed(seed: number) {
  if (seed !== cacheSeed) {
    styleCache.clear();
    riverCache.clear();
    lmCache.clear();
    elevCache.clear();
    downCache.clear();
    maskCache.clear();
    cacheSeed = seed;
  }
  if (styleCache.size > 40000) styleCache.clear();
  if (riverCache.size > 40000) riverCache.clear();
  if (lmCache.size > 40000) lmCache.clear();
  if (elevCache.size > 40000) { elevCache.clear(); downCache.clear(); maskCache.clear(); }
}

function patch(h: Hex, seed: number) {
  const p = toPixel(h, 1);
  return fbm(p.x * 0.11 + 77, p.y * 0.11 + 13, seed ^ 0xbeef, 2);
}

export function styleAt(h: Hex, seed: number): string {
  checkSeed(seed);
  const k = key(h);
  const c = styleCache.get(k);
  if (c) return c;
  const b = biomeAt(h, seed);
  const { elev, moist, temp } = climate(h, seed);
  const n = patch(h, seed);
  let st: string;
  switch (b) {
    case 'grass':
      if (neighbors(h).some((x) => poiAt(x, seed) === 'village') || poiAt(h, seed) === 'village') st = 'farm';
      else if (moist < 0.42) st = 'steppe';
      else if (n > 0.6) st = 'bloom';
      else st = 'meadow';
      break;
    case 'forest':
      if (temp < 0.38) st = 'pine';
      else if (temp > 0.6 && moist > 0.56) st = 'jungle';
      else if (n < 0.38) st = 'autumn';
      else if (n > 0.64) st = 'birch';
      else st = 'broadleaf';
      break;
    case 'hills': st = moist < 0.4 ? 'rocky' : n > 0.58 ? 'heather' : 'green'; break;
    case 'mountain': st = temp > 0.6 && n > 0.5 ? 'volcanic' : temp > 0.52 ? 'red' : 'grey'; break;
    case 'snow': st = elev > 0.8 ? 'ice' : n < 0.42 ? 'tundra' : 'drift'; break;
    case 'desert': st = elev > 0.54 ? 'mesa' : n > 0.63 ? 'saltflat' : 'dunes'; break;
    case 'swamp': st = temp > 0.57 ? 'mangrove' : n < 0.38 ? 'dead' : 'reed'; break;
    case 'sand': st = n > 0.58 ? 'pebble' : 'beach'; break;
    case 'water': st = n > 0.6 && temp > 0.42 ? 'lily' : 'shallow'; break;
    case 'deep': st = n > 0.66 ? 'kelp' : 'deep'; break;
    default: st = 'default';
  }
  styleCache.set(k, st);
  return st;
}

export function terrainName(h: Hex, seed: number) {
  const b = biomeAt(h, seed);
  return STYLE_NAMES[`${b}:${styleAt(h, seed)}`] ?? b;
}

// ---------------- Rivers ----------------
const RIVER_BIOMES: Biome[] = ['grass', 'forest', 'hills', 'swamp', 'desert', 'sand'];

export function riverAt(h: Hex, seed: number): boolean {
  checkSeed(seed);
  const k = key(h);
  const c = riverCache.get(k);
  if (c !== undefined) return c;
  let r = false;
  if (RIVER_BIOMES.includes(biomeAt(h, seed)) && !poiAt(h, seed)) {
    const p = toPixel(h, 1);
    const v = fbm(p.x * 0.042 + 900, p.y * 0.042 - 400, seed ^ 0x51ed, 3);
    r = Math.abs(v - 0.5) < 0.022;
  }
  riverCache.set(k, r);
  return r;
}

const elevCache = new Map<string, number>();
const downCache = new Map<string, number>();
const maskCache = new Map<string, number>();

function elevAt(h: Hex, seed: number) {
  const k = key(h);
  let e = elevCache.get(k);
  if (e === undefined) {
    const b = biomeAt(h, seed);
    // Open water is always the lowest point so rivers find the sea.
    e = b === 'water' || b === 'deep' ? -1 : climate(h, seed).elev;
    elevCache.set(k, e);
  }
  return e;
}

/** Index of the single neighbour this river tile drains into (-1 = spring/pond). */
function downhill(h: Hex, seed: number): number {
  const k = key(h);
  const c = downCache.get(k);
  if (c !== undefined) return c;
  let best = -1, bestE = elevAt(h, seed);
  DIRS.forEach((d, i) => {
    const n = { q: h.q + d.q, r: h.r + d.r };
    const b = biomeAt(n, seed);
    if (!(riverAt(n, seed) || b === 'water' || b === 'deep')) return;
    const e = elevAt(n, seed);
    if (e < bestE) { bestE = e; best = i; }
  });
  downCache.set(k, best);
  return best;
}

/** Bit i set = river connects toward DIRS[i]: its one outflow plus any tributaries flowing in. */
export function riverMask(h: Hex, seed: number): number {
  if (!riverAt(h, seed)) return 0;
  const k = key(h);
  const c = maskCache.get(k);
  if (c !== undefined) return c;
  let m = 0;
  const flow = downhill(h, seed);
  if (flow >= 0) m |= 1 << flow;
  DIRS.forEach((d, i) => {
    const n = { q: h.q + d.q, r: h.r + d.r };
    if (riverAt(n, seed) && downhill(n, seed) === (i + 3) % 6) m |= 1 << i;
  });
  maskCache.set(k, m);
  return m;
}

// ---------------- Landmarks ----------------
export type LandmarkKind =
  | 'standing_stones' | 'statue' | 'well' | 'signpost' | 'windmill' | 'scarecrow' | 'great_tree' | 'cart'
  | 'sword_stone' | 'banner' | 'ashes' | 'mushrooms' | 'stump' | 'totem' | 'lantern' | 'cairn' | 'obelisk'
  | 'crystals' | 'lava_vent' | 'geyser' | 'ice_spire' | 'ribcage' | 'bones' | 'oasis' | 'shipwreck' | 'tidepool';

export type LandmarkEffect = 'heal' | 'reveal' | 'insp' | 'gold' | 'potion' | 'xp' | 'torch';

export interface LandmarkDef {
  name: string;
  icon: string;
  lore: string[];
  effect?: LandmarkEffect;
  chance?: number;
  /** Interactive landmarks open a small event (AI-written when connected). */
  event?: (ctx: EventContext) => GameEvent;
}

const dc = (base: number, ctx: EventContext) => Math.min(20, base + ctx.tier);

export const LANDMARKS: Record<LandmarkKind, LandmarkDef> = {
  standing_stones: { name: 'Standing Stones', icon: '🗿', effect: 'reveal', chance: 0.6, lore: ['A ring of leaning stones hums faintly. From their centre, the land seems to unfold before you.', 'Moss-eaten stones stand in a circle older than any kingdom.'] },
  statue: { name: 'Forgotten Statue', icon: '🗽', effect: 'xp', chance: 1, lore: ['A weathered statue of a forgotten hero. Its plaque reads only: "They did not turn back."', 'A stone queen stares at the horizon, one hand outstretched toward something long gone.'] },
  well: { name: 'Old Well', icon: '🪣', effect: 'heal', chance: 1, lore: ['An old stone well. The water is cold, sweet, and somehow restoring.', 'Coins glint at the bottom of a wishing well. You drink and feel better.'] },
  signpost: { name: 'Crooked Signpost', icon: '🪧', effect: 'reveal', chance: 1, lore: ['A crooked signpost. Most arms are blank — one points the way you need to go.', 'Someone has carved "TURN BACK" into a signpost, then crossed it out and written "KEEP GOING".'] },
  windmill: { name: 'Windmill', icon: '🌾', effect: 'heal', chance: 0.7, lore: ['A windmill creaks lazily. The miller waves and tosses you a warm loaf.', 'Sails turn over golden fields. Flour dust drifts on the breeze.'] },
  scarecrow: { name: 'Scarecrow', icon: '🎃', lore: ['A scarecrow with a carved turnip head. You could swear it was facing the other way a moment ago.', 'The scarecrow wears a better coat than you do.'] },
  great_tree: { name: 'Great Elder Tree', icon: '🌳', effect: 'insp', chance: 0.4, lore: ['A colossal tree, its roots like sleeping giants. Resting beneath it, you feel strangely hopeful.', 'Ribbons and charms hang from the elder tree\'s lowest branches — wishes from a hundred travellers.'] },
  cart: { name: 'Abandoned Cart', icon: '🛒', effect: 'gold', chance: 0.65, lore: ['An abandoned merchant cart, one wheel snapped. A few coins still rattle in the lockbox.', 'A cart tipped in the ditch. Whoever owned it left in a hurry.'] },
  sword_stone: {
    name: 'Sword in the Stone', icon: '🗡️', lore: ['A blade sunk to the hilt in an ancient boulder.'],
    event: (ctx) => ({ title: 'The Sword in the Stone', text: 'A sword is buried to the hilt in a moss-covered boulder. Runes along the crossguard glow faintly as you approach. Many have tried. The scratches on the stone prove it.', npc: null, choices: [
      { label: 'Pull with all your might', kind: 'check', stat: 'str', dc: dc(14, ctx), reward: 'item' },
      { label: 'Read the runes first', kind: 'check', stat: 'int', dc: dc(13, ctx), reward: 'lore' },
      { label: 'Leave it for the worthy', kind: 'leave' },
    ] }),
  },
  banner: { name: 'Tattered Banner', icon: '🚩', lore: ['A tattered war banner flaps on a broken spear. The battle it marked is long forgotten.', 'A banner of a fallen house, still proudly snapping in the wind.'] },
  ashes: { name: 'Cold Campfire', icon: '🔥', lore: ['The ashes of a campfire — still faintly warm. Someone was here not long ago.', 'An old fire ring. Bootprints lead away in three directions.'] },
  mushrooms: {
    name: 'Glowing Mushrooms', icon: '🍄', lore: ['Mushrooms glow softly in the gloom.'],
    event: (ctx) => ({ title: 'Glowcap Ring', text: 'A ring of mushrooms pulses with soft blue light. They smell of honey and thunder. A small sign reads, in tiny letters: "Eat me?"', npc: null, choices: [
      { label: 'Eat one', kind: 'check', stat: 'con', dc: dc(11, ctx), reward: 'heal' },
      { label: 'Identify them carefully', kind: 'check', stat: 'wis', dc: dc(11, ctx), reward: 'xp' },
      { label: 'Absolutely not', kind: 'leave' },
    ] }),
  },
  stump: { name: 'Hollow Stump', icon: '🪵', effect: 'potion', chance: 0.35, lore: ['A huge hollow stump. Inside, someone left a small stash wrapped in oilcloth.', 'An ancient stump, rings too many to count.'] },
  totem: {
    name: 'Carved Totem', icon: '🪶', lore: ['A totem carved with staring faces.'],
    event: (ctx) => ({ title: 'The Watching Totem', text: 'A tall totem of stacked, carved faces. As you pass, the eyes of the topmost face seem to follow you. Offerings of feathers and bones lie at its base.', npc: null, choices: [
      { label: 'Leave an offering', kind: 'check', stat: 'wis', dc: dc(11, ctx), reward: 'lore' },
      { label: 'Decipher the carvings', kind: 'check', stat: 'int', dc: dc(12, ctx), reward: 'xp' },
      { label: 'Walk on quickly', kind: 'leave' },
    ] }),
  },
  lantern: { name: 'Marsh Lantern', icon: '🏮', lore: ['A lantern on a pole, burning without oil. It has burned like this for a hundred years, the locals say.', 'A lamp post in the middle of nowhere, flickering patiently.'] },
  cairn: { name: 'Traveller\'s Cairn', icon: '🪨', effect: 'insp', chance: 0.3, lore: ['A cairn of stacked stones. Tradition says you add one for luck. You do.', 'A cairn marks a lost traveller\'s grave. You pause in respect.'] },
  obelisk: {
    name: 'Black Obelisk', icon: '🗼', lore: ['A black obelisk etched with stars.'],
    event: (ctx) => ({ title: 'The Star Obelisk', text: 'A black obelisk, smooth as glass, etched with constellations that do not match tonight\'s sky. One star is carved deeper than the rest — and it is warm to the touch.', npc: null, choices: [
      { label: 'Trace the star map', kind: 'check', stat: 'int', dc: dc(12, ctx), reward: 'lore' },
      { label: 'Press the warm star', kind: 'check', stat: 'cha', dc: dc(13, ctx), reward: 'item' },
      { label: 'Leave it alone', kind: 'leave' },
    ] }),
  },
  crystals: {
    name: 'Crystal Outcrop', icon: '💎', lore: ['Crystals jut from the rock.'],
    event: (ctx) => ({ title: 'Singing Crystals', text: 'A cluster of violet crystals juts from the rock, ringing faintly in the wind. A loose shard near the base looks valuable — and very sharp.', npc: null, choices: [
      { label: 'Pry a shard loose', kind: 'check', stat: 'dex', dc: dc(12, ctx), reward: 'gold' },
      { label: 'Attune to their song', kind: 'check', stat: 'wis', dc: dc(13, ctx), reward: 'heal' },
      { label: 'Admire and move on', kind: 'leave' },
    ] }),
  },
  lava_vent: { name: 'Lava Vent', icon: '🌋', lore: ['A crack in the earth glows orange. The air shimmers and smells of sulphur.', 'Molten rock bubbles lazily in a vent. You keep your distance.'] },
  geyser: { name: 'Hot Spring', icon: '♨️', effect: 'heal', chance: 1, lore: ['A steaming hot spring. You soak your aching feet for a blissful moment.', 'A geyser erupts in a white plume, then settles into a warm pool.'] },
  ice_spire: { name: 'Ice Spire', icon: '🧊', lore: ['A spire of blue ice, frozen around the silhouette of something enormous.', 'Wind howls through a needle of ancient ice, singing one low note.'] },
  ribcage: { name: 'Giant\'s Ribcage', icon: '🦴', effect: 'xp', chance: 1, lore: ['The bleached ribcage of something colossal arches over your head like a cathedral.', 'Enormous bones half-buried in the earth. Whatever this was, it was not small.'] },
  bones: { name: 'Scattered Bones', icon: '💀', effect: 'gold', chance: 0.4, lore: ['Bones of an unlucky traveller. A purse still hangs from the belt.', 'Picked-clean bones and a rusted helmet. A grim reminder.'] },
  oasis: { name: 'Oasis', icon: '🌴', effect: 'torch', chance: 1, lore: ['Palms and a clear blue pool. You drink, rest in the shade, and feel your strength return. (+1 torch)', 'A hidden oasis. Dates, shade, and water — a small miracle. (+1 torch)'] },
  shipwreck: {
    name: 'Shipwreck', icon: '⚓', lore: ['The broken hull of a ship.'],
    event: (ctx) => ({ title: 'The Wreck of the Gull', text: 'A ship lies broken on the rocks, its hull split like an egg. The captain\'s cabin is still above the waterline. Something moves in the dark of the hold.', npc: null, choices: [
      { label: 'Search the captain\'s cabin', kind: 'check', stat: 'int', dc: dc(11, ctx), reward: 'item' },
      { label: 'Climb down into the hold', kind: 'fight', enemy: { name: 'Drowned Sailor', kind: 'undead', emoji: '🧟' } },
      { label: 'Leave the dead in peace', kind: 'leave' },
    ] }),
  },
  tidepool: { name: 'Tide Pool', icon: '🐚', effect: 'potion', chance: 0.25, lore: ['A tide pool teeming with tiny bright creatures. Among them, a corked bottle.', 'Crabs scuttle among starfish in a glittering tide pool.'] },
};

const LM_TABLE: Partial<Record<string, [LandmarkKind, number][]>> = {
  grass: [['standing_stones', 3], ['statue', 2], ['well', 3], ['signpost', 3], ['great_tree', 2], ['cart', 2], ['sword_stone', 1], ['banner', 1], ['ashes', 2]],
  'grass:farm': [['windmill', 6], ['scarecrow', 5], ['well', 3], ['cart', 2]],
  forest: [['mushrooms', 4], ['great_tree', 3], ['stump', 3], ['totem', 2], ['signpost', 1], ['ashes', 2], ['statue', 1]],
  swamp: [['mushrooms', 3], ['totem', 3], ['stump', 2], ['bones', 2], ['statue', 1], ['lantern', 3]],
  hills: [['standing_stones', 4], ['cairn', 3], ['statue', 2], ['sword_stone', 2], ['signpost', 2], ['obelisk', 2], ['crystals', 1]],
  mountain: [['crystals', 4], ['cairn', 3], ['geyser', 2], ['ribcage', 1]],
  'mountain:volcanic': [['lava_vent', 6], ['crystals', 2], ['geyser', 2]],
  snow: [['ice_spire', 4], ['cairn', 3], ['ribcage', 2], ['geyser', 2], ['crystals', 2]],
  desert: [['ribcage', 3], ['obelisk', 3], ['statue', 2], ['bones', 3], ['cart', 2], ['totem', 1], ['oasis', 2]],
  sand: [['shipwreck', 4], ['tidepool', 3], ['ribcage', 1], ['signpost', 1]],
};

export function landmarkAt(h: Hex, seed: number): LandmarkKind | null {
  checkSeed(seed);
  const k = key(h);
  if (lmCache.has(k)) return lmCache.get(k)!;
  let found: LandmarkKind | null = null;
  if (distance(h, { q: 0, r: 0 }) > 1 && isPassable(h, seed) && !poiAt(h, seed) && !riverAt(h, seed)) {
    const v = hash2(h.q, h.r, seed ^ 0x1a2b3c);
    if (v / 4294967296 < 0.12) {
      const b = biomeAt(h, seed);
      const table = LM_TABLE[`${b}:${styleAt(h, seed)}`] ?? LM_TABLE[b];
      if (table) found = weighted(table, mulberry32(v));
    }
  }
  lmCache.set(k, found);
  return found;
}
