// Blocked ways: hexes that can't be entered for story reasons. The hero's own
// turning points can close them (a burned bridge, an angered garrison, a ward),
// a fumble in the hills can bring down a rockslide, and a storm floods river
// crossings for the day. Most can be cleared with a check; some just pass.
import { key, parseKey, neighbors, spiral, distance, eq, type Hex } from './hex';
import { findPath, isPassable, poiAt } from './world';
import { riverAt } from './terrain';
import { weatherAt } from './weather';
import type { GameState, Stat } from './types';

export type BlockKind = 'rockfall' | 'fire' | 'flood' | 'guards' | 'thorns' | 'ice' | 'curse' | 'barricade' | 'collapse';

export interface Block {
  kind: BlockKind;
  /** what's in the way, in a few words */
  reason: string;
  /** day it appeared */
  day: number;
  /** last day it lasts (it clears overnight after); none = until cleared */
  until?: number;
  /** turning point that caused it */
  turn?: string;
  /** made by the weather today (not stored) */
  weather?: boolean;
}

export const BLOCK_INFO: Record<BlockKind, { icon: string; name: string; stat: Stat | null; dc: number; verb: string; days?: number }> = {
  rockfall: { icon: '🪨', name: 'Rockfall', stat: 'str', dc: 13, verb: 'Heave the boulders aside' },
  fire: { icon: '🔥', name: 'Wildfire', stat: 'con', dc: 14, verb: 'Beat a path through the flames', days: 2 },
  flood: { icon: '🌊', name: 'Flood', stat: 'con', dc: 15, verb: 'Wade the torrent', days: 2 },
  guards: { icon: '🛡️', name: 'Guarded', stat: 'cha', dc: 14, verb: 'Talk your way past' },
  thorns: { icon: '🌿', name: 'Thornwall', stat: 'str', dc: 12, verb: 'Hack through the thorns' },
  ice: { icon: '🧊', name: 'Black ice', stat: 'dex', dc: 13, verb: 'Pick a way across' },
  curse: { icon: '💀', name: 'Warded', stat: 'wis', dc: 15, verb: 'Break the ward' },
  barricade: { icon: '🚧', name: 'Barricade', stat: 'str', dc: 14, verb: 'Tear down the barricade' },
  collapse: { icon: '🕳️', name: 'Collapsed', stat: 'str', dc: 15, verb: 'Dig through the rubble' },
};

export const BLOCK_KINDS = Object.keys(BLOCK_INFO) as BlockKind[];

/** Places that must always stay open: villages, the start, the quest goal. */
function protectedHex(s: GameState, hx: Hex) {
  const poi = poiAt(hx, s.seed);
  return poi === 'village' || poi === 'start' || (!!s.quest && eq(hx, s.quest.target));
}

/** What blocks this hex today, if anything. */
export function blockAt(s: GameState, hx: Hex): Block | null {
  const b = s.blocks?.[key(hx)];
  if (b && (b.until === undefined || s.day <= b.until)) return b;
  if (riverAt(hx, s.seed) && weatherAt(s.seed, s.day, hx) === 'storm' && !protectedHex(s, hx)) {
    return { kind: 'flood', reason: 'The stream has burst its banks in the storm.', day: s.day, until: s.day, weather: true };
  }
  return null;
}

export const canEnter = (s: GameState, hx: Hex) => !blockAt(s, hx);

/** Can the hero still get to the quest goal (ignoring fog)? */
function questReachable(s: GameState) {
  if (!s.quest) return true;
  return !!findPath(s.pos, s.quest.target, s.seed, (h) => canEnter(s, h), 6000);
}

/**
 * Close one or more hexes around `center` ("here" closes the center itself).
 * Never closes the hero's own tile, villages or the quest goal, and never
 * cuts the hero off from their quest or leaves them boxed in.
 */
export function placeBlocks(s: GameState, center: Hex, kind: BlockKind, reason: string, opts: { count?: number; here?: boolean; turn?: string; rnd?: () => number } = {}): Hex[] {
  const rnd = opts.rnd ?? Math.random;
  const info = BLOCK_INFO[kind];
  const ok = (h: Hex) => !eq(h, s.pos) && isPassable(h, s.seed) && !protectedHex(s, h) && !s.blocks?.[key(h)];
  let pool: Hex[] = opts.here ? [center] : spiral(center, 2).filter((h) => !eq(h, center));
  pool = pool.filter(ok).sort((a, b) => distance(a, center) - distance(b, center) || rnd() - 0.5);
  const reachBefore = questReachable(s);
  const placed: Hex[] = [];
  for (const h of pool) {
    if (placed.length >= (opts.count ?? 1)) break;
    const k = key(h);
    (s.blocks ??= {})[k] = { kind, reason, day: s.day, ...(info.days ? { until: s.day + info.days - 1 } : {}), ...(opts.turn ? { turn: opts.turn } : {}) };
    const boxedIn = !neighbors(s.pos).some((n) => isPassable(n, s.seed) && canEnter(s, n));
    if (boxedIn || (reachBefore && !questReachable(s))) delete s.blocks[k];
    else placed.push(h);
  }
  return placed;
}

export function clearBlock(s: GameState, hx: Hex) {
  if (s.blocks) delete s.blocks[key(hx)];
}

/** New morning: blocks that have run their course are gone. */
export function expireBlocks(s: GameState) {
  if (!s.blocks) return;
  for (const [k, b] of Object.entries(s.blocks)) if (b.until !== undefined && s.day > b.until) delete s.blocks[k];
}

/** Blocked ways near the hero, for the storyteller. */
export function blocksNear(s: GameState, radius = 4): string[] {
  return Object.entries(s.blocks ?? {})
    .filter(([k, b]) => (b.until === undefined || s.day <= b.until) && distance(s.pos, parseKey(k)) <= radius)
    .map(([, b]) => `${BLOCK_INFO[b.kind].name}: ${b.reason}`);
}

