import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stand-in for the model: every call writes a scene named after the call.
let calls = 0;
vi.mock('./director', async (orig) => {
  const real = await orig<typeof import('./director')>();
  return {
    ...real,
    genEventAi: vi.fn(async (_s: unknown, ctx: { poi: string }) => {
      calls++;
      return { title: `Scene ${calls} (${ctx.poi})`, text: 'Something stirs.', npc: null,
        choices: [{ label: 'Look closer', kind: 'check', stat: 'wis', dc: 12, reward: 'lore' }, { label: 'Move on', kind: 'leave' }] };
    }),
  };
});

import { Foresight, fits, prune, reuse, spotKey, store, toPool, STALE_DAYS, type Want } from './foresight';
import { settings } from './settings';
import { createGame, addNpc } from '../core/state';
import type { EventContext, Foreseen, GameEvent, GameState } from '../core/types';

const ev = (title: string, extra: Partial<GameEvent> = {}): GameEvent => ({
  title, text: 'A scene.', npc: null,
  choices: [{ label: 'Try it', kind: 'check', stat: 'dex', dc: 13, reward: 'gold' }, { label: 'Move on', kind: 'leave' }], ...extra,
});
const ctx = (over: Partial<EventContext> = {}): EventContext => ({
  hex: { q: 2, r: 1 }, biome: 'forest', poi: 'ruin', tier: 2, regionName: 'The Elder Wood', terrain: 'Autumn Wood', ...over,
});
const seen = (s: GameState, c: EventContext, e: GameEvent, extra: Partial<Foreseen> = {}): Foreseen => ({ ctx: c, ev: e, day: s.day, party: [], ...extra });

let s: GameState;
beforeEach(() => {
  s = createGame('T', 'mage', 'heroic', { name: 'W', hook: 'h' });
  calls = 0;
  settings.apiKey = 'test-key';
  settings.foresight = true;
});

describe('foresight', () => {
  it('keys tile scenes by place, landmark and quest; random wilds have no tile', () => {
    expect(spotKey(ctx())).toBe('poi:2,1');
    expect(spotKey(ctx({ poi: 'wild', landmark: 'obelisk' }))).toBe('lm:2,1');
    expect(spotKey(ctx({ poi: 'quest' }))).toBe('quest:2,1');
    expect(spotKey(ctx({ poi: 'wild' }))).toBeNull();
  });

  it('serves the scene written for a tile, instantly, and only once', async () => {
    const f = new Foresight(() => s);
    store(s).spots['poi:2,1'] = seen(s, ctx(), ev('The Sunken Arch'));
    const got = await f.take(s, ctx());
    expect(got?.ev.title).toBe('The Sunken Arch');
    expect(store(s).spots['poi:2,1']).toBeUndefined();
    expect(await f.take(s, ctx())).toBeNull();
  });

  it('reuses an unvisited scene for another place of the same kind and terrain', () => {
    toPool(store(s), seen(s, ctx({ hex: { q: 9, r: 9 } }), ev('Ruin A')));
    expect(reuse(s, ctx({ poi: 'cave' }))).toBeNull(); // different kind of place
    expect(reuse(s, ctx({ biome: 'desert' }))).toBeNull(); // different terrain
    const got = reuse(s, ctx({ hex: { q: 0, r: 5 } }));
    expect(got?.ev.title).toBe('Ruin A');
    expect(got?.ctx.hex).toEqual({ q: 0, r: 5 }); // played where it actually happens
    expect(store(s).pool).toHaveLength(0);
  });

  it('prefers the closest match and clamps difficulty to the new tile', () => {
    const hard = ev('Hard', { choices: [{ label: 'Climb', kind: 'check', stat: 'str', dc: 20, reward: 'item' }, { label: 'Move on', kind: 'leave' }] });
    toPool(store(s), seen(s, ctx({ terrain: 'Pine Wood', tier: 4 }), ev('Far')));
    toPool(store(s), seen(s, ctx({ tier: 5 }), hard));
    const got = reuse(s, ctx({ tier: 1 }))!;
    expect(got.ev.title).toBe('Hard'); // same terrain wins
    expect(got.ev.choices[0].dc).toBeLessThanOrEqual(14); // tier 1 caps DCs at 14
  });

  it('rejects scenes the story has outgrown', () => {
    const base = ctx();
    expect(fits(seen(s, base, ev('Old'), { day: s.day - STALE_DAYS - 1 }), s, base)).toBe(false);
    addNpc(s, { name: 'Mira', role: 'smith', look: '', personality: '' }, 'here');
    expect(fits(seen(s, base, ev('Dup', { npc: { name: 'Mira', role: 'smith', look: '', personality: '' } })), s, base)).toBe(false);
    expect(fits(seen(s, base, ev('Gone', { text: 'Bram grins at the ruin.' }), { party: ['Bram'] }), s, base)).toBe(false);
    expect(fits(seen(s, base, ev('Fine')), s, base)).toBe(true);
    s.quest = { title: 'New quest' } as GameState['quest'];
    const q = ctx({ poi: 'quest' });
    expect(fits(seen(s, q, ev('Climax'), { quest: 'Old quest' }), s, q)).toBe(false);
  });

  it('moves far-off or resolved spots into the pool instead of throwing them away', () => {
    const st = store(s);
    st.spots['poi:20,0'] = seen(s, ctx({ hex: { q: 20, r: 0 } }), ev('Far ruin'));
    st.spots['poi:1,0'] = seen(s, ctx({ hex: { q: 1, r: 0 } }), ev('Done ruin'));
    st.spots['poi:0,1'] = seen(s, ctx({ hex: { q: 0, r: 1 } }), ev('Kept'));
    st.spots['quest:1,1'] = seen(s, ctx({ hex: { q: 1, r: 1 }, poi: 'quest' }), ev('Climax'));
    s.pos = { q: 0, r: 0 };
    prune(s, (k) => k !== 'poi:1,0' && !k.startsWith('quest:'));
    expect(Object.keys(st.spots)).toEqual(['poi:0,1']);
    expect(st.pool.map((f) => f.ev.title).sort()).toEqual(['Done ruin', 'Far ruin']); // quest climaxes aren't reusable
  });

  it('writes nearby scenes in the background, one call at a time, and waits for one in progress', async () => {
    const f = new Foresight(() => s);
    let caveDone = false; // as in the game: a place you've been is marked done and not written again
    const wants: Want[] = [
      { key: 'poi:2,1', dist: 2, make: () => ctx() },
      { key: 'poi:1,0', dist: 1, make: () => (caveDone ? null : ctx({ hex: { q: 1, r: 0 }, poi: 'cave' })) },
      { key: 'wild:forest', dist: 1.5, make: () => ctx({ poi: 'wild' }) },
    ];
    f.plan(wants, () => 2);
    // Stepping onto the nearest place right away: its scene is already being written.
    const first = await f.take(s, ctx({ hex: { q: 1, r: 0 }, poi: 'cave' }));
    expect(first?.ev.title).toMatch(/cave/);
    caveDone = true;
    await vi.waitFor(() => expect(calls).toBe(4)); // the cave, two forest spares, the ruin
    expect(store(s).spots['poi:2,1']).toBeDefined();
    expect(store(s).pool.filter((p) => p.ctx.poi === 'wild')).toHaveLength(2);
    // Enough spares now: planning again asks for nothing new.
    f.plan(wants, () => 2);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toBe(4);
    // A random wilderness encounter takes a spare.
    const wild = await f.take(s, ctx({ poi: 'wild', hex: { q: 5, r: 5 } }));
    expect(wild?.ev.title).toMatch(/wild/);
  });

  it('does nothing without an AI key or with the setting off', async () => {
    const f = new Foresight(() => s);
    settings.foresight = false;
    f.plan([{ key: 'poi:2,1', dist: 1, make: () => ctx() }], () => 2);
    settings.foresight = true;
    settings.apiKey = '';
    f.plan([{ key: 'poi:2,1', dist: 1, make: () => ctx() }], () => 2);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toBe(0);
  });
});
