import { fbm, hash2, hashf, weighted, mulberry32 } from './rng';
import { type Hex, key, neighbors, spiral, distance, toPixel } from './hex';
import type { Biome, PoiKind } from './types';

export const BIOME_INFO: Record<Biome, { name: string; cost: number; passable: boolean; danger: number }> = {
  deep: { name: 'Deep Sea', cost: 99, passable: false, danger: 0 },
  water: { name: 'Shallows', cost: 99, passable: false, danger: 0 },
  sand: { name: 'Shore', cost: 1, passable: true, danger: 0.6 },
  grass: { name: 'Meadow', cost: 1, passable: true, danger: 0.8 },
  forest: { name: 'Forest', cost: 1, passable: true, danger: 1.2 },
  swamp: { name: 'Marsh', cost: 2, passable: true, danger: 1.4 },
  hills: { name: 'Hills', cost: 1, passable: true, danger: 1.1 },
  mountain: { name: 'Peaks', cost: 2, passable: true, danger: 1.3 },
  snow: { name: 'Snowfield', cost: 2, passable: true, danger: 1.2 },
  desert: { name: 'Dunes', cost: 1, passable: true, danger: 1.0 },
};

const biomeCache = new Map<string, Biome>();
let cacheSeed = -1;

export function biomeAt(h: Hex, seed: number): Biome {
  if (cacheSeed !== seed) {
    biomeCache.clear();
    poiCache.clear();
    cacheSeed = seed;
  }
  const k = key(h);
  const cached = biomeCache.get(k);
  if (cached) return cached;
  const b = computeBiome(h, seed);
  if (biomeCache.size > 50000) biomeCache.clear();
  biomeCache.set(k, b);
  return b;
}

/** Raw climate values (0..1) used for biomes and their sub-styles. */
export function climate(h: Hex, seed: number) {
  const p = toPixel(h, 1);
  return {
    elev: fbm(p.x * 0.085, p.y * 0.085, seed, 5),
    moist: fbm(p.x * 0.06 + 311, p.y * 0.06 - 97, seed ^ 0x5bd1e995, 4),
    temp: fbm(p.x * 0.03 - 51, p.y * 0.03 + 77, seed ^ 0x1b873593, 3),
  };
}

function computeBiome(h: Hex, seed: number): Biome {
  const c = climate(h, seed);
  let elev = c.elev;
  const moist = c.moist, temp = c.temp;
  // Guarantee a friendly landmass around the start.
  const d = distance(h, { q: 0, r: 0 });
  elev += 0.22 * Math.exp(-(d * d) / 40);
  if (d <= 1) return 'grass';

  if (elev < 0.33) return 'deep';
  if (elev < 0.4) return 'water';
  if (elev < 0.43) return 'sand';
  if (elev > 0.72) return temp < 0.45 ? 'snow' : 'mountain';
  if (elev > 0.62) return temp < 0.36 ? 'snow' : 'hills';
  if (moist < 0.4 && temp > 0.5) return 'desert';
  if (moist > 0.6 && elev < 0.5) return 'swamp';
  if (moist > 0.49) return 'forest';
  return 'grass';
}

export function isPassable(h: Hex, seed: number) {
  return BIOME_INFO[biomeAt(h, seed)].passable;
}

export function moveCost(h: Hex, seed: number) {
  return BIOME_INFO[biomeAt(h, seed)].cost;
}

const POI_TABLE: Partial<Record<Biome, [PoiKind, number][]>> = {
  grass: [['village', 5], ['ruin', 2], ['camp', 2], ['shrine', 1], ['stranger', 3]],
  forest: [['grove', 3], ['camp', 2], ['ruin', 2], ['stranger', 2], ['village', 2]],
  hills: [['cave', 3], ['tower', 3], ['ruin', 2], ['village', 1]],
  mountain: [['cave', 4], ['shrine', 2], ['tower', 1]],
  swamp: [['ruin', 3], ['shrine', 2], ['stranger', 2], ['village', 1]],
  desert: [['ruin', 3], ['tower', 2], ['camp', 2], ['stranger', 1]],
  snow: [['shrine', 2], ['cave', 2], ['ruin', 1], ['village', 1]],
  sand: [['ruin', 2], ['stranger', 2], ['village', 2]],
};

const poiCache = new Map<string, PoiKind | null>();

/** Points of interest are sparse local-minima of a hash, so they never clump. */
export function poiAt(h: Hex, seed: number): PoiKind | null {
  biomeAt(h, seed); // ensures cache seed
  const k = key(h);
  if (poiCache.has(k)) return poiCache.get(k)!;
  let result: PoiKind | null = null;
  if (h.q === 0 && h.r === 0) result = 'start';
  else {
    const biome = biomeAt(h, seed);
    const table = POI_TABLE[biome];
    if (table && distance(h, { q: 0, r: 0 }) > 1) {
      const v = hash2(h.q, h.r, seed ^ 0xabcdef);
      if (v / 4294967296 < 0.35) {
        let isMin = true;
        for (const n of spiral(h, 2)) {
          if (n.q === h.q && n.r === h.r) continue;
          if (hash2(n.q, n.r, seed ^ 0xabcdef) < v) { isMin = false; break; }
        }
        if (isMin) result = weighted(table, mulberry32(v));
      }
    }
  }
  poiCache.set(k, result);
  return result;
}

/** Danger tier grows with distance from where you started. */
export function tierAt(h: Hex): number {
  return Math.min(5, 1 + Math.floor(distance(h, { q: 0, r: 0 }) / 9));
}

export function regionKey(h: Hex): string {
  return `${Math.round(h.q / 7)},${Math.round(h.r / 7)}`;
}

export function visionRadius(h: Hex, seed: number): number {
  const b = biomeAt(h, seed);
  if (b === 'mountain' || b === 'snow') return 3;
  if (b === 'hills') return 3;
  if (b === 'forest' || b === 'swamp') return 1;
  return 2;
}

/** Breadth-first search over passable tiles; returns path excluding start. */
export function findPath(from: Hex, to: Hex, seed: number, allowed: (h: Hex) => boolean, maxNodes = 4000): Hex[] | null {
  const startK = key(from), goalK = key(to);
  if (startK === goalK) return [];
  const prev = new Map<string, string>();
  const nodes = new Map<string, Hex>([[startK, from]]);
  const queue: Hex[] = [from];
  prev.set(startK, '');
  while (queue.length && prev.size < maxNodes) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const nk = key(n);
      if (prev.has(nk)) continue;
      if (!isPassable(n, seed) || (!allowed(n) && nk !== goalK)) continue;
      prev.set(nk, key(cur));
      nodes.set(nk, n);
      if (nk === goalK) {
        const path: Hex[] = [];
        let c = nk;
        while (c && c !== startK) {
          path.unshift(nodes.get(c)!);
          c = prev.get(c)!;
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/** Pick a reachable tile roughly `min..max` steps away for a quest. */
export function pickQuestTarget(from: Hex, seed: number, min: number, max: number, salt: number): Hex {
  const dist = new Map<string, number>([[key(from), 0]]);
  const queue: Hex[] = [from];
  const candidates: Hex[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(key(cur))!;
    if (d >= max) continue;
    for (const n of neighbors(cur)) {
      const nk = key(n);
      if (dist.has(nk) || !isPassable(n, seed)) continue;
      dist.set(nk, d + 1);
      queue.push(n);
      if (d + 1 >= min && !poiAt(n, seed)) candidates.push(n);
    }
  }
  if (!candidates.length) return from;
  // Prefer tiles further from the origin so the world keeps opening up.
  candidates.sort((a, b) => distance(b, { q: 0, r: 0 }) - distance(a, { q: 0, r: 0 }));
  const top = candidates.slice(0, Math.max(6, Math.floor(candidates.length / 3)));
  return top[Math.floor(hashf(salt, top.length, seed) * top.length)];
}
