// What waits on the tiles around you, shown on the map before you step there.
// Each open tile may hold a sign for the day: a foe, a scene, a quick choice on
// the road, a cache or healing herbs. Signs are deterministic from the seed,
// the day and the tile, so the map can show them in advance and moving becomes
// a choice of route. A sign is used up when you step on it, and fresh ones
// appear each morning (fewer on ground you've already walked).
import { key, eq, type Hex } from './hex';
import { hash2, type Rand, rand } from './rng';
import { biomeAt, poiAt, isPassable, BIOME_INFO } from './world';
import { landmarkAt } from './terrain';
import { blockAt } from './blocks';
import { reveal, hasOmen } from './state';
import { gainXp, heal } from './rules';
import { ENEMIES } from './content';
import type { Cost, EnemySpec, GameState } from './types';

export type SignKind = 'foe' | 'scene' | 'moment' | 'cache' | 'herbs';

export const SIGNS: Record<SignKind, { icon: string; name: string; desc: string; ring: string }> = {
  foe: { icon: '⚔️', name: 'Foe', desc: 'A fight waits here.', ring: '#e94057' },
  scene: { icon: '❔', name: 'Encounter', desc: 'Something is happening here: a scene with choices.', ring: '#a77fd0' },
  moment: { icon: '👣', name: 'Crossroads', desc: 'A quick choice on the road.', ring: '#d9b26a' },
  cache: { icon: '💰', name: 'Cache', desc: 'Something worth picking up.', ring: '#ffd76a' },
  herbs: { icon: '🌿', name: 'Herbs', desc: 'Healing plants grow here (+HP).', ring: '#59c27a' },
};

/** Chance of each sign on ground you haven't walked yet (foes scale with the terrain's danger). */
export const SIGN_RATE: [SignKind, number][] = [['foe', 0.13], ['scene', 0.15], ['moment', 0.12], ['cache', 0.06], ['herbs', 0.05]];
/** Ground you've walked before gets fewer signs. */
export const REVISIT = 0.3;

export interface Sign { kind: SignKind; enemy?: EnemySpec; moment?: number }

const roll = (s: GameState, h: Hex, salt: number) => hash2(h.q, h.r, (s.seed ^ Math.imul(s.day + salt, 0x2c1b3c6d)) >>> 0) / 4294967296;

/** The sign on a tile today, if any. Places, landmarks, the quest goal and blocked tiles never hold one. */
export function signAt(s: GameState, h: Hex): Sign | null {
  if (!isPassable(h, s.seed) || poiAt(h, s.seed) || landmarkAt(h, s.seed) || (s.quest && eq(h, s.quest.target)) || blockAt(s, h)) return null;
  const mem = s.tiles[key(h)];
  if (mem?.e === s.day) return null;
  const biome = biomeAt(h, s.seed);
  const scale = mem?.v ? REVISIT : 1;
  const omen = hasOmen(s, 'blood-moon') ? 1.6 : hasOmen(s, 'still-air') ? 0.45 : 1;
  let u = roll(s, h, 1);
  for (const [kind, base] of SIGN_RATE) {
    const p = base * scale * (kind === 'foe' ? BIOME_INFO[biome].danger * omen : 1);
    if (u < p) {
      const pickN = (n: number) => Math.floor(roll(s, h, 7) * n);
      if (kind === 'foe') {
        const pool = ENEMIES[biome].length ? ENEMIES[biome] : ENEMIES.grass;
        return { kind, enemy: pool[pickN(pool.length)] };
      }
      if (kind === 'moment') return { kind, moment: pickN(MOMENTS.length) };
      return { kind };
    }
    u -= p;
  }
  return null;
}

/** Use up a tile's sign for today. */
export function spendSign(s: GameState, h: Hex) {
  (s.tiles[key(h)] ||= {}).e = s.day;
}

// ---- Quick moments: one tap, a small trade-off, no dice ----

/** What an option gives (negative numbers take away). */
export interface Gain { torch?: number; hp?: number; gold?: number; potion?: number; insp?: boolean; reveal?: number; xp?: number }
export interface MomentOption {
  label: string;
  cost?: Cost;
  gain: Gain;
  /** chance the good result happens (default: always) */
  odds?: number;
  /** what happens otherwise */
  bad?: Gain;
  ok: string;
  fail?: string;
}
export interface Moment { title: string; text: string; options: [MomentOption, MomentOption] }

export const MOMENTS: ((t: number) => Moment)[] = [
  (t) => ({ title: 'Fork in the Trail', text: 'The path splits. The short way is full of thorns. The long way is easy, but slow.', options: [
    { label: 'Push through the thorns', gain: { torch: 1, hp: -(1 + t) }, ok: 'Scratched and bleeding, you save time.' },
    { label: 'Take the long way round', cost: { torch: 1 }, gain: { reveal: 3, xp: 5 * t }, ok: 'The long way shows you a lot of the land.' },
  ] }),
  (t) => ({ title: 'Old Campfire', text: 'Someone camped here last night. The embers are still warm.', options: [
    { label: 'Rest by the embers', cost: { torch: 1 }, gain: { hp: 4 + 2 * t }, ok: 'You warm your hands and rest your legs.' },
    { label: 'Search the ashes', gain: { gold: 3 * t + 2 }, odds: 0.7, bad: { hp: -1 }, ok: 'A few coins were dropped in the ashes.', fail: 'You burn your fingers. Nothing there.' },
  ] }),
  (t) => ({ title: 'Berry Bushes', text: 'Bushes hang heavy with dark berries. Some of them look a bit odd.', options: [
    { label: 'Eat your fill', gain: { hp: 3 + 2 * t }, odds: 0.75, bad: { hp: -2 }, ok: 'Sweet and filling. You feel better.', fail: 'Bad berries. Your stomach turns.' },
    { label: 'Pick some to sell', gain: { gold: 2 * t + 2 }, ok: 'A full bag of berries. Someone will buy them.' },
  ] }),
  (t) => ({ title: 'A Lost Purse', text: 'A coin purse lies in the mud. A name is stitched on it.', options: [
    { label: 'Keep the coins', gain: { gold: 5 * t + 3 }, ok: 'Finders keepers.' },
    { label: 'Leave it on the road marker', gain: { insp: true }, ok: 'It feels right. You walk on lighter.' },
  ] }),
  (t) => ({ title: 'Fox in a Snare', text: 'A fox is caught in a hunter\'s snare. It watches you, panting.', options: [
    { label: 'Free the fox', gain: { insp: true }, odds: 0.7, bad: { hp: -2 }, ok: 'The fox runs off. Somehow you feel lucky.', fail: 'It bites you and runs off.' },
    { label: 'Take the hunter\'s bait pouch', gain: { gold: 2 * t + 1 }, ok: 'The pouch holds a few coins.' },
  ] }),
  (t) => ({ title: 'High Rock', text: 'A tall rock stands over the land. The climb looks hard.', options: [
    { label: 'Climb to the top', cost: { torch: 1 }, gain: { reveal: 4, xp: 10 * t }, ok: 'From the top you can see for miles.' },
    { label: 'Look around from the bottom', gain: { reveal: 2 }, ok: 'You get a fair view.' },
  ] }),
  (t) => ({ title: 'Cold Spring', text: 'Clear water bubbles out of the rocks. It is ice cold.', options: [
    { label: 'Drink and wash your wounds', gain: { hp: 2 + t }, ok: 'The cold water wakes you up.' },
    { label: 'Brew a potion here', cost: { torch: 2 }, gain: { potion: 1 }, ok: 'It takes a while, but you fill a potion bottle.' },
  ] }),
  (t) => ({ title: 'Wandering Pedlar', text: 'A pedlar with a huge pack waves at you. "Potions! News! Cheap!"', options: [
    { label: 'Buy a potion', cost: { gold: 8 + 2 * t }, gain: { potion: 1 }, ok: 'One potion, wrapped in cloth.' },
    { label: 'Swap news', gain: { reveal: 3 }, ok: 'The pedlar tells you about the roads ahead.' },
  ] }),
  (t) => ({ title: 'Roadside Shrine', text: 'A tiny stone shrine sits by the road. Coins glint in its bowl.', options: [
    { label: 'Leave a coin', cost: { gold: 3 }, gain: { insp: true }, ok: 'A warm breeze passes. You feel blessed.' },
    { label: 'Take the coins', gain: { gold: 4 * t + 2 }, odds: 0.65, bad: { hp: -(2 + t) }, ok: 'Nobody saw. Probably.', fail: 'A cold wind knocks you flat. The gods saw that.' },
  ] }),
  (t) => ({ title: 'Empty Hunter\'s Camp', text: 'A hunter\'s camp, empty. Meat hangs over a cold fire.', options: [
    { label: 'Eat and rest a little', cost: { torch: 1 }, gain: { hp: 3 + 2 * t }, ok: 'A good meal. You feel stronger.' },
    { label: 'Borrow some supplies', gain: { potion: 1 }, odds: 0.5, bad: { gold: -(2 * t + 3) }, ok: 'You find a potion in a sack.', fail: 'The hunter comes back. You pay for what you took.' },
  ] }),
];

/** "+6 HP · −1 🔥" for a gain. */
export function gainText(g: Gain): string {
  const sign = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
  return [
    g.hp ? `${sign(g.hp)} HP` : '', g.torch ? `${sign(g.torch)} 🔥` : '', g.gold ? `${sign(g.gold)} 🪙` : '',
    g.potion ? `${sign(g.potion)} 🧪` : '', g.insp ? '✨' : '', g.reveal ? '🗺 map' : '', g.xp ? `+${g.xp} XP` : '',
  ].filter(Boolean).join(' · ');
}

export interface MomentResult { good: boolean; text: string; lines: string[]; levels: number }

/** Take a moment's option: pay, see if it works out, apply what it gives. */
export function takeMoment(s: GameState, opt: MomentOption, r: Rand = rand): MomentResult {
  const p = s.player;
  const lines: string[] = [];
  if (opt.cost?.gold) { p.gold -= opt.cost.gold; lines.push(`-${opt.cost.gold} gold`); }
  if (opt.cost?.torch) { s.stamina -= opt.cost.torch; lines.push(`-${opt.cost.torch} 🔥`); }
  if (opt.cost?.hp) { p.hp = Math.max(1, p.hp - opt.cost.hp); lines.push(`-${opt.cost.hp} HP`); }
  const good = opt.odds === undefined || r() < opt.odds;
  const g = good ? opt.gain : opt.bad ?? {};
  let levels = 0;
  if (g.hp && g.hp > 0) { const got = heal(p, g.hp); if (got) lines.push(`+${got} HP`); }
  if (g.hp && g.hp < 0) { const lost = Math.min(-g.hp, p.hp - 1); if (lost > 0) { p.hp -= lost; lines.push(`-${lost} HP`); } }
  if (g.torch) { s.stamina = Math.max(0, s.stamina + g.torch); lines.push(`${g.torch > 0 ? '+' : ''}${g.torch} 🔥`); }
  if (g.gold) { const n = Math.max(-p.gold, g.gold); p.gold += n; if (n) lines.push(`${n > 0 ? '+' : ''}${n} gold`); }
  if (g.potion) { p.potions = Math.min(8, p.potions + g.potion); lines.push('+1 potion'); }
  if (g.reveal) { reveal(s, s.pos, g.reveal); lines.push('Map revealed'); }
  let xp = g.xp ?? 0;
  if (g.insp) {
    if (p.inspiration) xp += 10 * Math.max(1, Math.ceil(p.level / 3));
    else { p.inspiration = true; lines.push('✨ Inspiration'); }
  }
  if (xp) { levels = gainXp(p, xp); lines.push(`+${xp} XP`); }
  return { good, text: good ? opt.ok : opt.fail ?? opt.ok, lines, levels };
}

/** A moment for a tile and tier (the sign picks which). */
export function momentFor(sign: Sign, tier: number): Moment {
  return MOMENTS[(sign.moment ?? 0) % MOMENTS.length](Math.max(1, tier));
}
