// Choices as trade-offs. Every scene should offer a real decision: a safe
// option, a bold one (harder, double reward) and, where it fits, a sure thing
// you pay for up front (gold, a torch, or HP). Rests have a price too.
// `shapeChoices` adds what a scene is missing, for AI-written and hand-written
// scenes alike, and tilts the paid option towards what the hero needs now.
import { pick, type Rand, rand } from './rng';
import type { Choice, Cost, EventContext, GameEvent, GameState, RewardKind } from './types';

/** How much harder a bold move is. */
export const BOLD_DC = 2;

export function canPay(s: GameState, cost: Cost | undefined): boolean {
  if (!cost) return true;
  return (cost.gold ?? 0) <= s.player.gold && (cost.torch ?? 0) <= s.stamina && (cost.hp ?? 0) < s.player.hp;
}

/** Pay a choice's price; returns the effect lines ("-10 gold"). */
export function pay(s: GameState, cost: Cost | undefined): string[] {
  if (!cost) return [];
  const out: string[] = [];
  if (cost.gold) { s.player.gold -= cost.gold; out.push(`-${cost.gold} gold`); }
  if (cost.torch) { s.stamina -= cost.torch; out.push(`-${cost.torch} 🔥`); }
  if (cost.hp) { s.player.hp -= cost.hp; out.push(`-${cost.hp} HP`); }
  return out;
}

/** "−10 🪙 · −1 🔥" */
export function costText(cost: Cost | undefined): string {
  if (!cost) return '';
  return [cost.gold ? `−${cost.gold} 🪙` : '', cost.torch ? `−${cost.torch} 🔥` : '', cost.hp ? `−${cost.hp} HP` : ''].filter(Boolean).join(' · ');
}

/** Why a price can't be paid, for the toast. */
export function cantPay(s: GameState, cost: Cost): string {
  if ((cost.gold ?? 0) > s.player.gold) return `You need ${cost.gold} gold (you have ${s.player.gold}).`;
  if ((cost.torch ?? 0) > s.stamina) return `You need ${cost.torch} 🔥 (you have ${s.stamina}).`;
  return 'You are too hurt for that.';
}

/** Keep a model's price within reason for the danger tier. */
export function clampCost(raw: unknown, tier: number): Cost | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const c: Cost = {};
  const gold = n(o.gold, 10 + 10 * tier), torch = n(o.torch ?? o.torches, 2), hp = n(o.hp, 2 + 2 * tier);
  if (gold) c.gold = gold;
  if (torch) c.torch = torch;
  if (hp) c.hp = hp;
  return Object.keys(c).length ? c : undefined;
}

const SURE: Record<RewardKind, { labels: string[]; by: 'gold' | 'torch' }> = {
  ally: { labels: ['Offer them a gift', 'Buy them a drink', 'Pay for their trust'], by: 'gold' },
  lore: { labels: ['Pay for directions', 'Buy a local map', 'Pay someone to show you'], by: 'gold' },
  item: { labels: ['Buy it outright', 'Pay for it', 'Trade coin for it'], by: 'gold' },
  gold: { labels: ['Search slowly and carefully', 'Take your time searching'], by: 'torch' },
  xp: { labels: ['Take the slow, safe way', 'Take your time'], by: 'torch' },
  heal: { labels: ['Stop and tend your wounds', 'Rest here a while'], by: 'torch' },
};

/** The price of a sure thing for a reward at a tier. */
export function surePrice(reward: RewardKind, tier: number): Cost {
  if (SURE[reward].by === 'torch') return { torch: 1 };
  return { gold: reward === 'item' ? 10 + 8 * tier : 6 + 5 * tier };
}

/**
 * Give a scene its trade-offs (once): rests get a price, the hardest of two or
 * more checks becomes the bold move, and a paid sure thing is added when there
 * is room. A badly hurt hero is offered a way to heal.
 */
export function shapeChoices(s: GameState, ev: GameEvent, ctx: EventContext, r: Rand = rand): GameEvent {
  if (ev.shaped) return ev;
  ev.shaped = 1;
  const tier = Math.max(1, ctx.tier);
  const village = ctx.poi === 'village';
  for (const c of ev.choices) {
    if (c.kind === 'rest' && !c.cost) c.cost = village ? { gold: 8 + 2 * tier } : { torch: 2 };
  }
  const checks = ev.choices.filter((c) => c.kind === 'check' && !c.sure && c.dc);
  if (checks.length >= 2 && !checks.some((c) => c.bold)) {
    const hardest = checks.reduce((a, b) => ((b.dc ?? 0) > (a.dc ?? 0) ? b : a));
    hardest.bold = 1;
    hardest.dc = Math.min(20, (hardest.dc ?? 12) + BOLD_DC);
  }
  if (ctx.poi === 'quest' || ev.choices.some((c) => c.sure)) return ev;
  const acts = ev.choices.filter((c) => c.kind !== 'leave');
  if (acts.length >= 4 || !checks.length) return ev;
  const hurt = s.player.hp < s.player.maxHp * 0.5;
  const healing = ev.choices.some((c) => c.reward === 'heal' || c.kind === 'rest');
  // the paid sure thing mirrors the scene's safest check, or mends a hurt hero
  const safest = checks.reduce((a, b) => ((b.dc ?? 99) < (a.dc ?? 99) ? b : a));
  const reward: RewardKind = hurt && !healing ? 'heal' : safest.reward ?? 'xp';
  const sure: Choice = { label: pick(SURE[reward].labels, r), kind: 'check', stat: safest.stat, reward, sure: 1, cost: surePrice(reward, tier) };
  const at = ev.choices.findIndex((c) => c.kind === 'leave');
  ev.choices.splice(at < 0 ? ev.choices.length : at, 0, sure);
  return ev;
}
