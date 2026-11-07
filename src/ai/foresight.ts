// Foresight: the Dungeon Master writes encounters before the hero arrives.
//
// While you walk, nearby villages, ruins, landmarks and the quest's climax get
// their scenes written in the background (one AI call at a time), plus a couple
// of spare wilderness scenes for the terrain around you. Stepping onto such a
// tile then opens instantly instead of waiting on the model.
//
// Nothing written is wasted: a scene for a place you walked past, or a tile you
// resolved some other way, goes into a pool of spares and is reused for the next
// place of the same kind and terrain (another ruin in the forest, another
// stranger on the plains).
import { distance } from '../core/hex';
import { party } from '../core/state';
import { weatherAt } from '../core/weather';
import type { EventContext, Foreseen, ForesightStore, GameEvent, GameState } from '../core/types';
import { genEventAi, sanitizeEvent } from './director';
import { aiEnabled, settings } from './settings';

/** Spares kept at most (oldest go first). */
export const MAX_POOL = 14;
/** Spots further than this from the hero are given up (moved to the pool). */
export const SPOT_RADIUS = 5;
/** Story moves on: scenes older than this many days are dropped. */
export const STALE_DAYS = 4;
/** Background calls started per look-around, at most. */
const MAX_QUEUE = 4;

export const store = (s: GameState): ForesightStore => (s.foresight ??= { spots: {}, pool: [] });

/** The tile-specific slot an encounter belongs in, or null for a random wilderness scene. */
export function spotKey(ctx: EventContext): string | null {
  const k = `${ctx.hex.q},${ctx.hex.r}`;
  if (ctx.poi === 'quest') return `quest:${k}`;
  if (ctx.landmark) return `lm:${k}`;
  if (ctx.poi === 'wild') return null;
  return `poi:${k}`;
}

/** What a spare can stand in for: same landmark kind, same kind of place, or any wilderness scene. Quest climaxes never do. */
export function poolKind(ctx: EventContext): string | null {
  if (ctx.poi === 'quest') return null;
  if (ctx.landmark) return `lm:${ctx.landmark}`;
  return ctx.poi === 'wild' ? 'wild' : `poi:${ctx.poi}`;
}

const npcByName = (s: GameState, name: string) => Object.values(s.npcs).find((n) => n.name === name);

/** Is a scene written earlier still true to the story for this context? */
export function fits(f: Foreseen, s: GameState, ctx: EventContext): boolean {
  if (s.day - f.day > STALE_DAYS) return false;
  if (ctx.poi === 'quest' && f.quest !== s.quest?.title) return false;
  // written before the hero changed this region's story
  if ((s.turns ?? []).some((t) => t.where === ctx.regionName && (t.at ?? 0) > (f.written ?? 0))) return false;
  // a rainy scene shouldn't play under a clear sky
  if (f.weather && f.weather !== weatherAt(s.seed, s.day, ctx.hex)) return false;
  const returning = f.ctx.returningNpc;
  if (returning) {
    const now = npcByName(s, returning.name);
    if (!now || now.inParty) return false;
  }
  // A "new" character the hero has met since would be a duplicate.
  if (f.ev.npc && f.ev.npc.name !== returning?.name && npcByName(s, f.ev.npc.name)) return false;
  // Don't narrate companions who have since left the party.
  const here = new Set(party(s).map((n) => n.name));
  const text = `${f.ev.title} ${f.ev.text} ${f.ev.choices.map((c) => c.label).join(' ')}`;
  if (f.party.some((name) => !here.has(name) && text.includes(name))) return false;
  return true;
}

/** Fit a stored scene to where it's actually being played (DCs clamp to this tile's danger, and so on). */
function serve(f: Foreseen, ctx: EventContext): { ctx: EventContext; ev: GameEvent } {
  const c: EventContext = { ...ctx, returningNpc: f.ctx.returningNpc ?? undefined };
  return { ctx: c, ev: sanitizeEvent(f.ev, c) };
}

/** Best spare in the pool for this context (removed from the pool), if any fits. */
export function reuse(s: GameState, ctx: EventContext): { ctx: EventContext; ev: GameEvent } | null {
  const kind = poolKind(ctx);
  if (!kind || ctx.returningNpc) return null; // a returning character needs their own scene
  const st = store(s);
  let best = -1, bestScore = -Infinity;
  st.pool.forEach((f, i) => {
    if (poolKind(f.ctx) !== kind || f.ctx.biome !== ctx.biome || !fits(f, s, ctx)) return;
    const score = (f.ctx.terrain === ctx.terrain ? 2 : 0) + (f.ctx.regionName === ctx.regionName ? 1 : 0)
      - Math.abs(f.ctx.tier - ctx.tier) + f.day * 0.01;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  if (best < 0) return null;
  const [f] = st.pool.splice(best, 1);
  return serve(f, ctx);
}

/** Put an unused scene aside for a later place of the same kind. */
export function toPool(st: ForesightStore, f: Foreseen) {
  if (!poolKind(f.ctx) || f.ctx.returningNpc) return;
  st.pool.push(f);
  if (st.pool.length > MAX_POOL) st.pool.splice(0, st.pool.length - MAX_POOL);
}

/** Something worth writing ahead: a tile's own scene ("poi:…", "lm:…", "quest:…") or a spare for a terrain ("wild:<biome>"). */
export interface Want {
  key: string;
  /** steps from the hero; nearer goes first */
  dist: number;
  /** built only when the job actually runs; null if it's no longer needed */
  make: () => EventContext | null;
}

/** Tidy up: give up spots far away or no longer reachable, drop stale spares. */
export function prune(s: GameState, stillWanted: (key: string, f: Foreseen) => boolean) {
  const st = store(s);
  for (const [k, f] of Object.entries(st.spots)) {
    const far = distance(s.pos, f.ctx.hex) > SPOT_RADIUS;
    if (far || !stillWanted(k, f)) {
      delete st.spots[k];
      toPool(st, f);
    }
  }
  st.pool = st.pool.filter((f) => s.day - f.day <= STALE_DAYS);
}

export class Foresight {
  private inflight = new Map<string, Promise<void>>();
  private queue: Want[] = [];
  private running = false;
  private seq = 0;

  private stopped = false;

  /** `written` is told whenever a scene lands, so it can be saved. */
  constructor(private state: () => GameState, private written: (s: GameState) => void = () => {}) {}

  /** The journey is over (back to the title): finish nothing more. */
  stop() {
    this.stopped = true;
    this.queue = [];
  }

  get enabled() {
    return !this.stopped && aiEnabled() && settings.foresight && (typeof navigator === 'undefined' || navigator.onLine !== false);
  }

  /**
   * Scene for an encounter that's starting: the one written for this tile, the
   * one being written for it right now, or a fitting spare. Null means write it live.
   */
  async take(s: GameState, ctx: EventContext): Promise<{ ctx: EventContext; ev: GameEvent } | null> {
    const st = store(s);
    const k = spotKey(ctx);
    if (k) {
      if (!st.spots[k] && this.inflight.has(k)) await this.inflight.get(k);
      const f = st.spots[k];
      if (f) {
        delete st.spots[k];
        if (fits(f, s, ctx)) return serve(f, ctx);
      }
    } else if (!reuseReady(st, ctx)) {
      // a spare for this terrain may be on its way
      const pending = [...this.inflight.entries()].find(([key]) => key.startsWith(`wild:${ctx.biome}#`));
      if (pending) await pending[1];
    }
    return reuse(s, ctx);
  }

  /** Look around and start writing what's missing. */
  plan(wants: Want[], wildTarget: (dist: number) => number) {
    const s = this.state();
    if (!this.enabled) { this.queue = []; return; }
    const st = store(s);
    const busy = new Set(this.inflight.keys());
    const fresh: Want[] = [];
    for (const w of [...wants].sort((a, b) => a.dist - b.dist)) {
      let need = 1;
      if (w.key.startsWith('wild:')) {
        const biome = w.key.slice(5);
        const have = st.pool.filter((f) => f.ctx.poi === 'wild' && !f.ctx.landmark && f.ctx.biome === biome).length
          + [...busy].filter((b) => b.startsWith(`wild:${biome}#`)).length;
        need = wildTarget(w.dist) - have;
      } else if (st.spots[w.key] || busy.has(w.key)) need = 0;
      for (let i = 0; i < need && fresh.length < MAX_QUEUE; i++) fresh.push(w);
    }
    this.queue = fresh;
    void this.pump();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length && this.enabled) {
        const w = this.queue.shift()!;
        const s = this.state();
        if (!w.key.startsWith('wild:') && store(s).spots[w.key]) continue;
        const slot = w.key.startsWith('wild:') ? `${w.key}#${++this.seq}` : w.key;
        const job = this.write(s, w, slot);
        this.inflight.set(slot, job);
        try { await job; } finally { this.inflight.delete(slot); }
      }
    } finally {
      this.running = false;
    }
  }

  private async write(s: GameState, w: Want, slot: string) {
    const ctx = w.make();
    if (!ctx) return;
    let ev: GameEvent;
    try {
      ev = await genEventAi(s, ctx);
    } catch {
      return; // offline or the model hiccuped: the tile will be written live when reached
    }
    const f: Foreseen = {
      ctx, ev, day: s.day, party: party(s).map((n) => n.name), quest: ctx.poi === 'quest' ? s.quest?.title : undefined,
      weather: weatherAt(s.seed, s.day, ctx.hex), written: Date.now(),
    };
    const st = store(s);
    if (slot.startsWith('wild:')) toPool(st, f);
    else st.spots[w.key] = f;
    if (!this.stopped) this.written(s);
  }
}

function reuseReady(st: ForesightStore, ctx: EventContext) {
  const kind = poolKind(ctx);
  return st.pool.some((f) => poolKind(f.ctx) === kind && f.ctx.biome === ctx.biome);
}
