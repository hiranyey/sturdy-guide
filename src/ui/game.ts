import { h, $, Sheet, modal, toast, typewrite, wait, bar, vibrate } from './dom';
import { MapView } from './map';
import { rollCheck, DiceTray, d20Svg } from './dice';
import { sfx } from './audio';
import { portraitEl } from './portrait';
import { openSettings } from './settings-sheet';
import { key, eq, distance, toPixel, compass, type Hex } from '../core/hex';
import { biomeAt, poiAt, isPassable, moveCost, tierAt, regionKey, findPath, pickQuestTarget, BIOME_INFO } from '../core/world';
import { save, reveal, log, party, remember, addNpc, chapterLog, startDay, hasOmen } from '../core/state';
import {
  CLASSES, checkBonus, armorClass, attackBonus, fmtMod, mod, xpForNext, XP_LEVELS, heal, randomItem, takeItem, itemDesc,
  equip, sellValue, profBonus, rollDice, gainXp,
} from '../core/rules';
import { applyCheck, questRewards, type Effects } from '../core/resolve';
import { makeEnemy, startCombat, playRound, intentText, canUse, type Action, type Beat } from '../core/combat';
import { FLAVOR, ENEMIES, ENEMY_INTRO, AWAY_GIFTS, OMENS, STYLE_FLAVOR, RIVER_FLAVOR } from '../core/content';
import { landmarkAt, LANDMARKS, terrainName, riverAt, styleAt, type LandmarkKind } from '../core/terrain';
import { pick, chance, mulberry32, hashString, randInt } from '../core/rng';
import { genEvent, genOutcome, genRegion, genQuest, genChapterEnd, type Outcome } from '../ai/director';
import { aiEnabled } from '../ai/settings';
import { STATS, STAT_NAMES } from '../core/types';
import type { Choice, EnemySpec, EventContext, GameEvent, GameState, Item, PoiKind, Stat, NPC } from '../core/types';

const POI_LABEL: Record<string, string> = {
  village: 'Village', ruin: 'Ruins', cave: 'Cave', shrine: 'Shrine', camp: 'Camp', tower: 'Tower',
  grove: 'Grove', stranger: 'Encounter', start: 'Campsite', wild: 'Wilderness', quest: 'Quest',
};

export class Game {
  private busy = false;
  private calm = 1;
  private hud = $('#hud');
  private dock = $('#dock');
  private mapUi = $('#map-ui');
  private ticker!: HTMLElement;

  constructor(public s: GameState, private map: MapView, private onQuit: () => void) {
    map.demo = false;
    map.onTap = (hex) => this.onTap(hex);
    map.onFollowChange = (f) => this.mapUi.classList.toggle('free-cam', !f);
    map.snapTo(s.pos);
    this.buildChrome();
    this.renderHud();
  }

  // ================= Chrome =================
  private buildChrome() {
    this.mapUi.innerHTML = '';
    this.mapUi.append(
      h('div', { class: 'region-banner', id: 'region-banner' }),
      h('div', { class: 'map-ctrls' },
        h('button', { class: 'mc', 'aria-label': 'Zoom in', onclick: () => this.map.zoom(1.2) }, '+'),
        h('button', { class: 'mc', 'aria-label': 'Zoom out', onclick: () => this.map.zoom(1 / 1.2) }, '−'),
        h('button', { class: 'mc recenter', 'aria-label': 'Recenter', onclick: () => this.map.recenter() }, '◎'),
      ),
    );
    this.ticker = h('button', { class: 'ticker', onclick: () => this.openJournal() }, 'Tap a glowing tile to move.');
    const btn = (icon: string, label: string, fn: () => void, cls = '') =>
      h('button', { class: `dock-btn ${cls}`, onclick: () => { sfx.tap(); fn(); } }, h('span', { class: 'di' }, icon), h('span', { class: 'dl' }, label));
    this.dock.innerHTML = '';
    this.dock.append(
      this.ticker,
      h('nav', { class: 'dock-nav' },
        btn('🎒', 'Bag', () => this.openBag()),
        btn('👥', 'Party', () => this.openParty()),
        btn('📜', 'Journal', () => this.openJournal()),
        btn('🏕️', 'Camp', () => this.confirmCamp(), 'camp-btn'),
        btn('⚙️', 'Menu', () => openSettings({ inGame: true, onQuit: () => this.onQuit() })),
      ),
    );
  }

  renderHud() {
    const s = this.s, p = s.player, cls = CLASSES[p.cls];
    const prev = XP_LEVELS[p.level - 1] ?? 0;
    const torches = Array.from({ length: Math.max(s.maxStamina, s.stamina) }, (_, i) => h('span', { class: `torch ${i < s.stamina ? 'lit' : ''}` }));
    let questChip: HTMLElement | null = null;
    if (s.quest) {
      const a = toPixel(s.pos, 1), b = toPixel(s.quest.target, 1);
      const d = distance(s.pos, s.quest.target);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      questChip = h('button', { class: 'quest-chip', onclick: () => this.openJournal() },
        h('span', { class: 'qc-arrow', style: `transform:rotate(${ang}rad)` }, '➤'),
        h('span', { class: 'qc-title' }, s.quest.title),
        h('span', { class: 'qc-dist' }, d === 0 ? 'here' : `${d} hex ${compass(b.x - a.x, b.y - a.y)}`),
      );
    }
    this.hud.innerHTML = '';
    this.hud.append(
      h('div', { class: 'hud-row' },
        h('button', { class: 'hero-chip', onclick: () => this.openBag() },
          h('span', { class: 'hero-glyph', style: `background:${cls.color}` }, cls.glyph),
          h('span', { class: 'hero-txt' }, h('b', null, p.name), h('small', null, `Lv ${p.level} ${cls.name}`)),
        ),
        h('div', { class: 'hud-bars' },
          bar(p.hp, p.maxHp, `hp ${p.hp / p.maxHp < 0.35 ? 'low' : ''}`, `♥ ${p.hp}/${p.maxHp}`),
          bar(p.xp - prev, xpForNext(p.level) - prev, 'xp', `XP ${p.xp}/${xpForNext(p.level)}`),
        ),
        h('div', { class: 'hud-res' },
          h('span', { title: 'Gold' }, '🪙', h('b', null, String(p.gold))),
          h('span', { title: 'Potions' }, '🧪', h('b', null, String(p.potions))),
          p.inspiration ? h('span', { class: 'insp', title: 'Inspiration: spend for advantage' }, '✨') : null,
        ),
      ),
      h('div', { class: 'hud-row row2' },
        h('div', { class: 'torches', title: 'Torches: each step burns one. Camp to end the day.' }, ...torches),
        h('button', { class: 'day', onclick: () => { const o = this.omen(); if (o) toast(`${o.icon} ${o.name}: ${o.desc}`, 'gold', 3500); } },
          this.omen() ? h('span', { class: 'omen' }, this.omen()!.icon) : null, `Day ${s.day}`),
      ),
      ...(questChip ? [questChip] : []),
    );
  }

  omen() {
    return OMENS.find((o) => o.id === this.s.omen);
  }

  setTicker(text: string) {
    this.ticker.textContent = text;
    this.ticker.classList.remove('pulse');
    void this.ticker.offsetWidth;
    this.ticker.classList.add('pulse');
  }

  private persist() {
    save(this.s);
    this.renderHud();
  }

  // ================= Session flow =================
  async begin(isNew: boolean) {
    if (isNew) {
      await this.intro();
      await this.ensureQuest(true);
      const o = this.omen();
      if (o) toast(`${o.icon} Today's omen: ${o.name} — ${o.desc}`, 'info', 4200);
    } else {
      await this.recap();
      if (!this.s.quest) await this.ensureQuest(true);
    }
    this.regionCheck(this.s.pos);
    this.persist();
    if (this.s.stamina <= 0) this.confirmCamp(true);
  }

  private async intro() {
    const m = modal('intro');
    const text = h('p', { class: 'intro-text' });
    m.card.append(
      h('div', { class: 'eyebrow' }, 'A new tale begins'),
      h('h1', { class: 'intro-title' }, this.s.world.name),
      text,
    );
    await typewrite(text, this.s.world.hook, 1);
    await new Promise<void>((res) => m.card.append(
      h('div', { class: 'tip' }, '🔥 Each day you carry 12 torches. Every step burns one. When they run out, make camp — your story is saved and summarised. Perfect for short sessions.'),
      h('button', { class: 'btn btn-primary', onclick: () => { m.close(); res(); } }, 'Step into the world'),
    ));
  }

  private async recap() {
    const s = this.s;
    const away = Date.now() - s.lastPlayed;
    let gift: string | null = null;
    if (away > 30 * 60 * 1000) {
      const g = pick(AWAY_GIFTS);
      gift = g.text;
      if (g.potions) s.player.potions += g.potions;
      if (g.gold) s.player.gold += g.gold;
      if (g.inspiration) s.player.inspiration = true;
      if (g.heal) heal(s.player, g.heal);
      const comp = party(s)[0];
      if (comp && chance(0.5)) gift = `While you were away, ${comp.name} kept watch and foraged supplies. (+1 potion)`, s.player.potions++;
    }
    if (!s.recap && !gift) return;
    const m = modal('recap');
    m.card.append(...([
      h('div', { class: 'eyebrow' }, `Previously, in ${s.world.name}…`),
      s.recap ? h('p', { class: 'recap-text' }, s.recap) : null,
      s.hook ? h('p', { class: 'hook' }, s.hook) : null,
      gift ? h('div', { class: 'gift' }, '🎁 ', gift) : null,
      s.quest ? h('div', { class: 'today' }, h('small', null, 'Your quest'), h('b', null, s.quest.title), h('span', null, s.quest.description)) : null,
      this.omen() ? h('div', { class: 'omen-card' }, h('b', null, `${this.omen()!.icon} Today's omen: ${this.omen()!.name}`), h('span', null, this.omen()!.desc)) : null,
      h('div', { class: 'today small' }, `Day ${s.day} · ${s.stamina} torches remain`),
    ] as (HTMLElement | null)[]).filter((x): x is HTMLElement => !!x));
    await new Promise<void>((res) => m.card.append(h('button', { class: 'btn btn-primary', onclick: () => { m.close(); res(); } }, 'Continue the tale')));
  }

  private async ensureQuest(announce: boolean) {
    const s = this.s;
    if (s.quest) return;
    const target = pickQuestTarget(s.pos, s.seed, 6, 9, s.questsDone * 31 + s.day);
    const a = toPixel(s.pos, 1), b = toPixel(target, 1);
    const dir = compass(b.x - a.x, b.y - a.y);
    const loading = announce ? this.loadingModal('The threads of fate are spinning…') : null;
    const q = await genQuest(s, biomeAt(target, s.seed), dir, distance(s.pos, target));
    loading?.close();
    s.quest = { ...q, target, stage: s.questsDone };
    log(s, `took up the quest "${q.title}"`, 'quest');
    this.persist();
    if (announce) {
      sfx.level();
      const m = modal('quest');
      m.card.append(
        h('div', { class: 'eyebrow' }, `Quest ${s.questsDone + 1}`),
        h('h2', null, '★ ', q.title),
        h('p', null, q.description),
        h('p', { class: 'muted' }, `Seek ${q.place}, ${distance(s.pos, target)} hexes to the ${dir}. Follow the golden beacon.`),
      );
      await new Promise<void>((res) => m.card.append(h('button', { class: 'btn btn-primary', onclick: () => { m.close(); res(); } }, 'Onward')));
    }
  }

  private loadingModal(text: string) {
    const m = modal('loading');
    m.card.append(h('div', { class: 'spin-die', html: d20Svg('?') }), h('p', null, text));
    return m;
  }

  // ================= Movement =================
  private async onTap(target: Hex) {
    if (this.busy) return;
    const s = this.s;
    if (eq(target, s.pos)) {
      if (s.quest && eq(s.pos, s.quest.target)) {
        this.busy = true;
        try {
          await this.runEvent({ hex: s.pos, biome: biomeAt(s.pos, s.seed), poi: 'quest', tier: Math.max(tierAt(s.pos), 1 + Math.floor(s.questsDone / 2)), regionName: this.regionName(s.pos) });
        } finally {
          this.busy = false;
        }
        return;
      }
      const poi = poiAt(s.pos, s.seed);
      if (poi === 'village') this.villageServices();
      else this.setTicker(this.describeTile(s.pos));
      return;
    }
    if (!s.revealed[key(target)]) {
      this.map.flashTile(target, false);
      this.setTicker('The fog hides that place. Explore closer.');
      return;
    }
    if (!isPassable(target, s.seed)) {
      this.map.flashTile(target, false);
      this.setTicker('Deep water blocks the way.');
      return;
    }
    const path = findPath(s.pos, target, s.seed, (hx) => !!s.revealed[key(hx)]);
    if (!path || !path.length) {
      this.map.flashTile(target, false);
      this.setTicker('No known path leads there.');
      return;
    }
    this.map.flashTile(target, true);
    if (s.stamina <= 0) return this.confirmCamp(true);
    this.busy = true;
    try {
      await this.travel(path);
    } finally {
      this.busy = false;
    }
    if (this.s.stamina <= 0 && !this.campOpen) this.confirmCamp(true);
  }

  private async travel(path: Hex[]) {
    const s = this.s;
    for (const step of path) {
      const cost = moveCost(step, s.seed);
      if (s.stamina < cost) {
        toast(`Not enough torches to cross ${BIOME_INFO[biomeAt(step, s.seed)].name} (${cost} 🔥).`, 'bad');
        break;
      }
      const from = { ...s.pos };
      s.stamina -= cost;
      sfx.step();
      await this.map.animateMove(from, step, path.length > 1 ? 200 : 260);
      s.pos = { ...step };
      reveal(s, step);
      this.renderHud();
      const stop = await this.enterTile(step);
      this.persist();
      if (stop || s.player.hp <= 0) break;
    }
  }

  private describeTile(hx: Hex) {
    const s = this.s;
    const region = s.regions[regionKey(hx)]?.name;
    const lm = landmarkAt(hx, s.seed);
    const extras = [lm ? `${LANDMARKS[lm].icon} ${LANDMARKS[lm].name}` : '', riverAt(hx, s.seed) ? '🌊 stream' : ''].filter(Boolean).join(' · ');
    return `${terrainName(hx, s.seed)}${extras ? ' · ' + extras : ''}${region && region !== 'the wilds' ? ' — ' + region : ''} · ${'☠'.repeat(tierAt(hx))}`;
  }

  private flavor(hx: Hex) {
    const s = this.s;
    if (riverAt(hx, s.seed) && chance(0.6)) return pick(RIVER_FLAVOR);
    const b = biomeAt(hx, s.seed);
    const st = STYLE_FLAVOR[`${b}:${styleAt(hx, s.seed)}`];
    return st && chance(0.7) ? pick(st) : pick(FLAVOR[b]);
  }

  /** First visit to a midhex landmark: lore, plus a small perk. */
  private async discoverLandmark(kind: LandmarkKind, tier: number) {
    const s = this.s, p = s.player;
    const def = LANDMARKS[kind];
    const lore = def.lore[(s.pos.q * 7 + s.pos.r * 13 + 1000) % def.lore.length];
    let perk = '';
    let levels = 0;
    if (def.effect && Math.random() < (def.chance ?? 1)) {
      switch (def.effect) {
        case 'heal': { const h2 = heal(p, rollDice(1, 6)[0] + 2 + tier); perk = h2 ? `+${h2} HP` : ''; if (h2) sfx.heal(); break; }
        case 'reveal': {
          reveal(s, s.pos, 2);
          perk = 'Map revealed';
          if (kind === 'signpost' && s.quest) {
            const a = toPixel(s.pos, 1), b = toPixel(s.quest.target, 1);
            perk = `Points ${compass(b.x - a.x, b.y - a.y)} toward ${s.quest.place}`;
          }
          break;
        }
        case 'insp': if (!p.inspiration) { p.inspiration = true; perk = '✨ Inspiration'; } break;
        case 'gold': { const g = rollDice(1, 6)[0] * tier + 3; p.gold += g; perk = `+${g} gold`; sfx.coin(); break; }
        case 'potion': if (p.potions < 8) { p.potions++; perk = '+1 potion'; sfx.heal(); } break;
        case 'xp': { const xp = 15 * tier; levels = gainXp(p, xp); perk = `+${xp} XP`; break; }
        case 'torch': s.stamina++; perk = '+1 🔥'; break;
      }
    }
    log(s, `discovered ${def.name.startsWith('Old') || def.name.startsWith('The') ? 'the' : 'a'} ${def.name.replace(/^The /, '')}${perk ? ` (${perk})` : ''}`, 'event');
    this.setTicker(lore);
    toast(`${def.icon} ${def.name}${perk ? ' — ' + perk : ''}`, perk ? 'gold' : 'info', 3200);
    this.persist();
    if (levels) await this.levelUp(levels);
  }

  private async enterTile(hx: Hex): Promise<boolean> {
    const s = this.s;
    const k = key(hx);
    const mem = (s.tiles[k] ||= {});
    const first = !mem.v;
    if (first) {
      mem.v = 1;
      s.stats.explored++;
      s.stats.chapterExplored++;
    }
    this.regionCheck(hx);
    const biome = biomeAt(hx, s.seed);
    const tier = tierAt(hx);

    if (s.quest && eq(hx, s.quest.target)) {
      await this.runEvent({ hex: hx, biome, poi: 'quest', tier: Math.max(tier, 1 + Math.floor(s.questsDone / 2)), regionName: this.regionName(hx) });
      return true;
    }
    const poi = poiAt(hx, s.seed);
    if (poi && poi !== 'start' && !mem.done) {
      await this.runEvent({ hex: hx, biome, poi, tier, regionName: this.regionName(hx), returningNpc: this.maybeReturningNpc(poi) });
      return true;
    }
    if (poi === 'village') {
      this.setTicker('Back in the village. Tap your tile to trade or rest.');
      return true;
    }
    const lmk = landmarkAt(hx, s.seed);
    if (lmk && !mem.lm) {
      mem.lm = 1;
      this.calm = 1;
      if (LANDMARKS[lmk].event) {
        await this.runEvent({ hex: hx, biome, poi: 'wild', tier, regionName: this.regionName(hx), landmark: lmk });
        return true;
      }
      await this.discoverLandmark(lmk, tier);
      return false;
    }
    if (this.calm > 0) {
      this.calm--;
      this.setTicker(this.flavor(hx));
      return false;
    }
    const danger = BIOME_INFO[biome].danger;
    const roll = Math.random();
    const enc = 0.1 * danger * (first ? 1 : 0.4) * (hasOmen(s, 'blood-moon') ? 1.6 : hasOmen(s, 'still-air') ? 0.45 : 1);
    const wild = enc + 0.11 * (first ? 1 : 0.3);
    const find = wild + 0.07;
    if (roll < enc) {
      const spec = pick(ENEMIES[biome].length ? ENEMIES[biome] : ENEMIES.grass);
      const result = await this.combat(spec, tier, false, pick(ENEMY_INTRO).replace('{e}', `A ${spec.name}`));
      this.afterCombatLog(spec, result);
      this.calm = 2;
      return true;
    }
    if (roll < wild) {
      await this.runEvent({ hex: hx, biome, poi: 'wild', tier, regionName: this.regionName(hx) });
      this.calm = 2;
      return true;
    }
    if (roll < find) {
      const r = Math.random();
      if (r < 0.45) {
        const g = randInt(2, 6) * tier;
        s.player.gold += g;
        sfx.coin();
        toast(`You find ${g} gold glinting in the dirt.`, 'gold');
      } else if (r < 0.75 && s.player.potions < 6) {
        s.player.potions++;
        sfx.heal();
        toast('You find a stoppered potion in an old satchel. 🧪', 'good');
      } else {
        const h2 = heal(s.player, rollDice(1, 6)[0] + tier);
        sfx.heal();
        toast(`Wild herbs soothe your wounds (+${h2} HP).`, 'good');
      }
      this.calm = 1;
      return false;
    }
    this.setTicker(this.flavor(hx));
    return false;
  }

  private regionName(hx: Hex) {
    return this.s.regions[regionKey(hx)]?.name ?? 'the wilds';
  }

  private regionCheck(hx: Hex) {
    const s = this.s;
    const rk = regionKey(hx);
    if (s.regions[rk]) return;
    const biome = biomeAt(hx, s.seed);
    s.regions[rk] = { name: 'the wilds', blurb: '' };
    genRegion(s, biome).then((info) => {
      s.regions[rk] = info;
      save(s);
      this.showRegionBanner(info.name, info.blurb);
    });
  }

  private showRegionBanner(name: string, blurb: string) {
    const el = $('#region-banner');
    if (!el) return;
    el.innerHTML = '';
    el.append(h('div', { class: 'rb-name' }, name), h('div', { class: 'rb-blurb' }, blurb));
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  private maybeReturningNpc(poi: PoiKind): NPC | undefined {
    if (!['village', 'stranger', 'camp', 'grove'].includes(poi)) return;
    const known = Object.values(this.s.npcs).filter((n) => !n.inParty && n.affinity > -40 && n.metDay < this.s.day + 1);
    if (!known.length || !chance(0.3)) return;
    return pick(known);
  }

  // ================= Events =================
  private async runEvent(ctx: EventContext) {
    const s = this.s;
    ctx.terrain ??= terrainName(ctx.hex, s.seed);
    const sheet = new Sheet('event');
    const lmDef = ctx.landmark ? LANDMARKS[ctx.landmark as LandmarkKind] : null;
    const kindLabel = `${lmDef ? `${lmDef.icon} ${lmDef.name}` : POI_LABEL[ctx.poi] ?? 'Encounter'} · ${ctx.regionName}`;
    sheet.set(h('div', { class: 'parchment loading-card' },
      h('div', { class: 'ev-kind' }, kindLabel),
      h('div', { class: 'spin-die', html: d20Svg('?') }),
      h('p', { class: 'muted center' }, aiEnabled() ? 'The Dungeon Master weaves fate…' : 'The mists part…'),
    ));
    const ev = await genEvent(s, ctx);
    await this.showEvent(sheet, ev, ctx, kindLabel);
    await sheet.done;
    this.persist();
  }

  private async showEvent(sheet: Sheet, ev: GameEvent, ctx: EventContext, kindLabel: string) {
    const s = this.s;
    const text = h('p', { class: 'ev-text' });
    const choicesEl = h('div', { class: 'choices' });
    const npcEl = ev.npc
      ? h('div', { class: 'npc-row' }, portraitEl(ev.npc.name, 56),
          h('div', null, h('b', null, ev.npc.name), h('small', null, [ev.npc.role, ev.npc.personality].filter(Boolean).join(' · ')),
            (() => {
              const known = Object.values(s.npcs).find((n) => n.name === ev.npc!.name);
              return known ? h('span', { class: 'aff' }, affinityLabel(known.affinity)) : null;
            })()))
      : null;
    const card = h('div', { class: 'parchment' },
      h('div', { class: 'ev-kind' }, kindLabel, h('span', { class: 'tier' }, '☠'.repeat(ctx.tier))),
      h('h2', { class: 'ev-title' }, ev.title),
      npcEl,
      text,
      choicesEl,
    );
    sheet.set(card);
    await typewrite(text, ev.text, 2);
    for (const c of ev.choices) {
      choicesEl.appendChild(this.choiceButton(c, () => this.resolveChoice(sheet, card, choicesEl, ev, c, ctx)));
    }
  }

  private choiceButton(c: Choice, onClick: () => void) {
    const p = this.s.player;
    let badge: HTMLElement;
    if (c.kind === 'check' && c.stat && c.dc) {
      const b = checkBonus(p, c.stat).total;
      const pct = Math.min(95, Math.max(5, ((21 - (c.dc - b)) / 20) * 100));
      badge = h('span', { class: `cbadge ${pct >= 65 ? 'easy' : pct >= 40 ? 'fair' : 'hard'}` }, `${c.stat.toUpperCase()} ${c.dc}`);
    } else {
      const map: Record<string, [string, string]> = { fight: ['⚔ FIGHT', 'fight'], trade: ['🪙 TRADE', 'trade'], rest: ['🛏 REST', 'rest'], leave: ['LEAVE', 'leave'] };
      const [label, cls] = map[c.kind] ?? ['', ''];
      badge = h('span', { class: `cbadge ${cls}` }, label);
    }
    const rewardIcon: Record<string, string> = { gold: '🪙', item: '🎁', ally: '♥', heal: '✚', lore: '🗺', xp: '★' };
    return h('button', { class: `choice choice-${c.kind}`, onclick: () => { sfx.tap(); onClick(); } },
      h('span', { class: 'clabel' }, c.label, c.reward ? h('span', { class: 'rhint' }, rewardIcon[c.reward]) : null),
      badge,
    );
  }

  private async resolveChoice(sheet: Sheet, card: HTMLElement, choicesEl: HTMLElement, ev: GameEvent, c: Choice, ctx: EventContext) {
    const s = this.s, p = s.player;
    const k = key(ctx.hex);
    const isQuest = ctx.poi === 'quest';
    const markDone = () => {
      if (ctx.poi !== 'wild' && !isQuest) (s.tiles[k] ||= {}).done = 1;
    };
    choicesEl.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));

    if (c.kind === 'leave') {
      markDone();
      log(s, `passed by ${ev.title}`, 'info');
      sheet.close();
      return;
    }
    if (c.kind === 'trade') {
      markDone();
      if (ev.npc) addNpc(s, ev.npc, ctx.regionName);
      sheet.close();
      await this.shop(ctx.tier, k);
      return;
    }
    if (c.kind === 'rest') {
      markDone();
      const inn = ctx.poi === 'village';
      const cost = inn ? 8 + ctx.tier * 2 : 0;
      if (inn && p.gold < cost) {
        toast(`A bed costs ${cost} gold. You have ${p.gold}.`, 'bad');
        choicesEl.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = false));
        return;
      }
      p.gold -= cost;
      const healed = heal(p, inn ? p.maxHp : Math.ceil(p.maxHp / 2));
      const torches = inn ? Math.max(0, Math.min(3, s.maxStamina - s.stamina)) : 0;
      s.stamina += torches;
      sfx.heal();
      log(s, `rested at ${ev.title}`, 'event');
      this.outcomeBlock(card, choicesEl, inn ? `A hot meal, a soft bed. You wake refreshed.` : 'You rest in the stillness. Peace settles over you.',
        [`+${healed} HP`, torches ? `+${torches} 🔥` : '', cost ? `-${cost} gold` : ''].filter(Boolean), true, sheet);
      this.persist();
      return;
    }
    if (c.kind === 'fight') {
      sheet.close();
      const spec: EnemySpec = c.enemy ?? pick(ENEMIES[ctx.biome].length ? ENEMIES[ctx.biome] : ENEMIES.grass);
      const result = await this.combat(spec, ctx.tier, isQuest, ev.text.length < 160 ? ev.text : `${spec.name} attacks!`);
      this.afterCombatLog(spec, result, ev.title);
      if (result === 'win' || result === 'friend') {
        markDone();
        if (isQuest) await this.completeQuest(ctx);
      } else if (isQuest && result === 'flee') {
        this.setTicker('You retreat for now. Tap your own tile to face the guardian again.');
      }
      return;
    }
    // ---- skill check ----
    const stat = c.stat as Stat;
    const cb = checkBonus(p, stat);
    let fx: Effects | null = null;
    let outcomeP: Promise<Outcome> | null = null;
    const { roll } = await rollCheck({
      title: `${STAT_NAMES[stat]} check`,
      subtitle: c.label,
      dc: c.dc ?? 12,
      bonus: cb.total,
      parts: cb.parts,
      canInspire: p.inspiration,
      onRoll: (r, usedInsp) => {
        if (usedInsp) p.inspiration = false;
        fx = applyCheck(s, ev, c, r, ctx.tier, ctx.regionName, isQuest);
        outcomeP = genOutcome(s, ev, c, { success: r.success, crit: r.crit, fumble: r.fumble, effects: fx.lines });
      },
    });
    const effects = fx as Effects | null;
    if (!effects || !outcomeP) return;
    if (roll.success || !isQuest) markDone();
    log(s, `tried to ${c.label.toLowerCase().replace(/[.!]$/, '')} at ${ev.title} (${roll.crit ? 'triumph' : roll.success ? 'success' : 'failure'})`, 'event');
    const thinking = h('p', { class: 'muted center small' }, '…');
    choicesEl.replaceWith(thinking);
    const outcome = await (outcomeP as Promise<Outcome>);
    thinking.replaceWith(choicesEl);
    if (effects.npc && ev.npc) remember(effects.npc, outcome.memory ?? `${roll.success ? 'Helped' : 'Let down'} by ${p.name} at ${ev.title}`);
    if (outcome.flag) {
      s.flags.push(outcome.flag);
      if (s.flags.length > 20) s.flags.shift();
    }
    this.persist();
    const rollLine = `🎲 ${roll.kept}${fmtMod(roll.bonus)} = ${roll.total} vs DC ${roll.dc}`;
    await this.outcomeBlock(card, choicesEl, outcome.text, effects.lines, roll.success, sheet, rollLine, roll.crit, roll.fumble, effects);
    if (effects.levels) await this.levelUp(effects.levels);
    if (isQuest && roll.success) {
      await sheet.done;
      await this.completeQuest(ctx, true);
    } else if (isQuest) {
      this.setTicker('The goal is still within reach. Regroup, then tap your own tile to try again.');
    }
  }

  private async outcomeBlock(_card: HTMLElement, choicesEl: HTMLElement, text: string, effects: string[], ok: boolean, sheet: Sheet, rollLine?: string, crit = false, fumble = false, fx?: Effects) {
    const t = h('p', { class: 'ev-text outcome' });
    const chips = h('div', { class: 'chips' }, ...effects.map((e) => h('span', { class: `chip ${/^-|♥ -/.test(e) ? 'bad' : 'good'}` }, e)));
    const actions = h('div', { class: 'choices' });
    const block = h('div', { class: `outcome-block ${crit ? 'crit' : fumble ? 'fumble' : ok ? 'ok' : 'bad'}` },
      rollLine ? h('div', { class: 'roll-line' }, rollLine, h('b', null, crit ? ' CRITICAL!' : fumble ? ' FUMBLE!' : ok ? ' ✓' : ' ✗')) : null,
      t, chips, actions);
    choicesEl.replaceWith(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (effects.some((e) => e.includes('gold') && !e.startsWith('-'))) sfx.coin();
    await typewrite(t, text, 2);
    const s = this.s;
    if (fx?.recruit) {
      const npc = fx.recruit;
      actions.append(
        h('div', { class: 'recruit' }, portraitEl(npc.name, 44), h('span', null, h('b', null, npc.name), ' wants to travel with you!')),
        h('button', { class: 'choice choice-ally', onclick: () => {
          npc.inParty = true;
          npc.power = Math.max(npc.power, s.player.level);
          s.stats.friends++;
          remember(npc, `Joined ${s.player.name}'s party on day ${s.day}`);
          log(s, `welcomed ${npc.name} into the party`, 'friend');
          sfx.level();
          toast(`${npc.name} joined your party!`, 'good');
          this.persist();
          sheet.close();
        } }, h('span', { class: 'clabel' }, 'Welcome them aboard'), h('span', { class: 'cbadge rest' }, '♥ JOIN')),
        h('button', { class: 'choice choice-leave', onclick: () => sheet.close() }, h('span', { class: 'clabel' }, 'Not now'), h('span', { class: 'cbadge leave' }, 'LATER')),
      );
    } else {
      actions.append(h('button', { class: 'btn btn-primary wide', onclick: () => sheet.close() }, 'Continue'));
    }
  }

  // ================= Combat =================
  private afterCombatLog(spec: EnemySpec, result: string, where?: string) {
    const s = this.s;
    const at = where ? ` at ${where}` : '';
    if (result === 'win') log(s, `defeated a ${spec.name}${at}`, 'fight');
    else if (result === 'friend') log(s, `talked down a ${spec.name}${at} and made a friend`, 'friend');
    else if (result === 'flee') log(s, `escaped a ${spec.name}${at}`, 'fight');
    else log(s, `was beaten by a ${spec.name}${at}`, 'fight');
  }

  private combat(spec: EnemySpec, tier: number, boss: boolean, intro: string): Promise<'win' | 'flee' | 'friend' | 'down'> {
    return new Promise((resolve) => {
      const s = this.s, p = s.player;
      const enemy = makeEnemy(spec, tier, boss);
      const cs = startCombat(enemy);
      const sheet = new Sheet('combat');
      const tray = new DiceTray();
      const logEl = h('div', { class: 'clog' }, h('div', { class: 'cl system' }, intro));
      const foeHp = h('div');
      const meHp = h('div');
      const intentEl = h('div', { class: 'intent' });
      const sprite = h('div', { class: `foe-sprite ${boss ? 'boss' : ''}` }, enemy.emoji);
      const foeCard = h('div', { class: 'foe-card' }, sprite,
        h('div', { class: 'foe-info' },
          h('div', { class: 'foe-name' }, enemy.name, boss ? h('span', { class: 'boss-tag' }, 'BOSS') : null),
          h('div', { class: 'foe-meta' }, `${enemy.kind} · `, h('span', { class: 'ac' }, `🛡 AC ${enemy.ac}`), ` · ${'☠'.repeat(tier)}`),
          foeHp));
      const actionsEl = h('div', { class: 'actions' });
      let inspire = false;
      const inspBtn = h('button', { class: 'insp-toggle', onclick: () => {
        if (!p.inspiration) return;
        inspire = !inspire;
        inspBtn.classList.toggle('on', inspire);
        sfx.tap();
      } }, '✨ Inspiration: advantage on next roll');
      const allies = party(s);
      const meRow = h('div', { class: 'me-row' },
        h('span', { class: 'hero-glyph sm', style: `background:${CLASSES[p.cls].color}` }, CLASSES[p.cls].glyph),
        meHp,
        ...allies.map((a) => portraitEl(a.name, 30)));
      sheet.set(h('div', { class: 'combat-wrap' }, foeCard, intentEl, tray.el, logEl, meRow, inspBtn, actionsEl));

      const refresh = () => {
        foeHp.replaceChildren(bar(enemy.hp, enemy.maxHp, 'foe', `${enemy.hp}/${enemy.maxHp}`));
        meHp.replaceChildren(bar(p.hp, p.maxHp, `hp ${p.hp / p.maxHp < 0.35 ? 'low' : ''}`, `♥ ${p.hp}/${p.maxHp} · AC ${armorClass(p)}`));
        const it = intentText(enemy);
        intentEl.className = `intent ${enemy.intent}`;
        intentEl.textContent = `${it.icon} ${it.text}`;
        inspBtn.style.display = p.inspiration ? '' : 'none';
        if (!p.inspiration) { inspire = false; inspBtn.classList.remove('on'); }
        this.renderHud();
      };
      const cls = CLASSES[p.cls];
      const actionDefs: [Action, string, string][] = [
        ['attack', p.cls === 'mage' ? '🔥 Firebolt' : '⚔️ Attack', `${fmtMod(attackBonus(p))} vs AC · d${p.weapon.die}`],
        ['ability', `💥 ${cls.ability.name}`, 'once per fight'],
        ['defend', '🛡️ Defend', '+4 AC, recover'],
        ['potion', '🧪 Potion', `${p.potions} left · 2d4+4`],
        ['talk', enemy.kind === 'beast' ? '🤚 Calm' : '💬 Talk', `${enemy.talkStat.toUpperCase()} DC ${enemy.talkable ? enemy.talkDC : enemy.talkDC + 5}`],
        ['flee', '🏃 Flee', `DEX DC ${9 + tier + (boss ? 4 : 0)}`],
      ];
      const buttons = new Map<Action, HTMLButtonElement>();
      for (const [a, label, sub] of actionDefs) {
        const b = h('button', { class: `act act-${a}`, onclick: () => act(a) }, h('b', null, label), h('small', null, sub));
        buttons.set(a, b);
        actionsEl.appendChild(b);
      }
      const setEnabled = (on: boolean) => {
        for (const [a, b] of buttons) b.disabled = !on || !canUse(s, cs, a);
        const pot = buttons.get('potion')!;
        pot.querySelector('small')!.textContent = `${p.potions} left · 2d4+4`;
      };
      const floatText = (target: 'enemy' | 'player', text: string, cls2: string) => {
        const host = target === 'enemy' ? sprite : meRow;
        const f = h('span', { class: `float ${cls2}` }, text);
        host.appendChild(f);
        setTimeout(() => f.remove(), 1000);
      };
      const addLine = (b: Beat) => {
        const line = h('div', { class: `cl ${b.actor} ${b.tone}` }, b.text);
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
      };
      const playBeat = async (b: Beat) => {
        const label = b.actor === 'you' ? 'You' : b.actor === 'foe' ? enemy.name : b.actor === 'ally' ? 'Ally' : 'Fate';
        if (b.d20) await tray.showD20(b.d20, label, b.actor !== 'you' && b.actor !== 'system');
        else tray.clear();
        if (b.dmg) await tray.showDamage(b.dmg, b.floatText?.startsWith('+') ? 'healed' : 'damage');
        addLine(b);
        if (b.floatOn && b.floatText) {
          const neg = b.floatText.startsWith('-');
          floatText(b.floatOn, b.floatText, neg ? (b.floatOn === 'enemy' ? 'dmg' : 'hurt') : b.floatText.startsWith('+') ? 'heal' : 'miss');
          if (neg && b.floatOn === 'enemy') { sprite.classList.remove('hit'); void sprite.offsetWidth; sprite.classList.add('hit'); sfx.hit(); vibrate(25); }
          if (neg && b.floatOn === 'player') { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); sfx.hit(); vibrate([50, 30, 50]); }
        }
        refresh();
        await wait(b.actor === 'you' ? 450 : 350);
      };
      const act = async (a: Action) => {
        setEnabled(false);
        sfx.tap();
        const useInsp = inspire && p.inspiration;
        const beats = playRound(s, cs, a, useInsp);
        for (const b of beats) await playBeat(b);
        if (cs.end) return finish();
        setEnabled(true);
      };
      const finish = async () => {
        const end = cs.end!;
        actionsEl.innerHTML = '';
        inspBtn.remove();
        const summary: string[] = [];
        let levels = 0;
        if (end === 'win') {
          s.stats.kills++;
          s.stats.chapterKills++;
          sprite.classList.add('defeated');
          const xp = Math.round(enemy.xp * (hasOmen(s, 'blood-moon') ? 1.5 : 1));
          const gold = Math.round(enemy.gold * (hasOmen(s, 'golden-hour') ? 1.5 : 1));
          p.gold += gold;
          summary.push(`+${xp} XP`, `+${gold} gold`);
          levels = gainXp(s.player, xp);
          if (chance(boss ? 1 : 0.3)) {
            const it = randomItem(p, tier);
            const eqd = takeItem(p, it);
            summary.push(`${it.name} (${itemDesc(it)})${eqd ? ' — equipped!' : ''}`);
          }
          if (chance(0.25) && p.potions < 6) { p.potions++; summary.push('+1 potion'); }
          sfx.crit();
        } else if (end === 'friend') {
          const npc = addNpc(s, { name: `${enemy.name.replace(/^(Road |Desert |Wrecker )/, '')} ${pick(['Ash', 'Kell', 'Brin', 'Moss', 'Vey', 'Tarn'])}`, role: enemy.name.toLowerCase(), look: `${enemy.emoji} a former foe`, personality: 'wary but grateful' }, this.regionName(s.pos));
          npc.affinity = Math.max(npc.affinity, 35);
          remember(npc, `${p.name} spared them instead of fighting`);
          summary.push(`+${Math.round(enemy.xp * 0.75)} XP`, `${npc.name} ♥ +35`);
          levels = gainXp(s.player, Math.round(enemy.xp * 0.75));
          sfx.level();
          if (party(s).length < 2) {
            actionsEl.append(h('button', { class: 'act act-talk', onclick: () => {
              npc.inParty = true;
              s.stats.friends++;
              log(s, `${npc.name}, once a foe, joined the party`, 'friend');
              toast(`${npc.name} joined your party!`, 'good');
              this.persist();
              close();
            } }, h('b', null, `♥ Invite ${npc.name}`), h('small', null, 'to join your party')));
          }
        } else if (end === 'flee') {
          summary.push('Escaped');
        }
        if (end !== 'down') {
          logEl.appendChild(h('div', { class: `cl result ${end}` }, end === 'win' ? `🏆 Victory! ${enemy.name} is defeated.` : end === 'friend' ? '🤝 The fight is over — peacefully.' : '💨 You got away.'));
          logEl.appendChild(h('div', { class: 'chips' }, ...summary.map((x) => h('span', { class: 'chip good' }, x))));
          logEl.scrollTop = logEl.scrollHeight;
        }
        const close = async () => {
          sheet.close();
          this.persist();
          if (levels) await this.levelUp(levels);
          if (end === 'down') await this.downed();
          resolve(end);
        };
        if (end === 'down') {
          logEl.appendChild(h('div', { class: 'cl result down' }, '💀 You fall…'));
          await wait(900);
          return close();
        }
        actionsEl.append(h('button', { class: 'btn btn-primary wide', onclick: close }, 'Continue'));
      };
      refresh();
      setEnabled(true);
    });
  }

  private async downed() {
    const s = this.s;
    const lost = Math.floor(s.player.gold * 0.25);
    s.player.gold -= lost;
    s.player.hp = Math.max(1, Math.ceil(s.player.maxHp / 2));
    s.stamina = 0;
    const comp = party(s)[0];
    log(s, `fell in battle and was ${comp ? `dragged to safety by ${comp.name}` : 'found by a passing stranger'}`, 'fight');
    const m = modal('downed');
    m.card.append(
      h('div', { class: 'eyebrow' }, 'Defeated'),
      h('h2', null, 'You wake by a dying fire'),
      h('p', null, comp ? `${comp.name} dragged you to safety and kept watch through the night.` : 'A passing stranger bandaged your wounds and vanished before dawn.'),
      h('p', { class: 'muted' }, `Lost ${lost} gold. The day is over — but your tale is not.`),
    );
    await new Promise<void>((r) => m.card.append(h('button', { class: 'btn btn-primary', onclick: () => { m.close(); r(); } }, 'Make camp')));
    this.persist();
    await this.camp();
  }

  private async completeQuest(ctx: EventContext, viaCheck = false) {
    const s = this.s;
    const q = s.quest!;
    const fx = questRewards(s, ctx.tier);
    s.questsDone++;
    log(s, `completed the quest "${q.title}" at ${q.place}`, 'quest');
    s.flags.push(`${s.player.name} completed "${q.title}"`);
    s.tiles[key(q.target)] = { ...(s.tiles[key(q.target)] || {}), done: 1, note: q.title };
    s.quest = null;
    this.persist();
    sfx.level();
    vibrate([60, 40, 60, 40, 200]);
    const m = modal('quest-done');
    m.card.append(
      h('div', { class: 'eyebrow' }, viaCheck ? 'Quest complete' : 'Victory — quest complete'),
      h('h2', null, '🏆 ', q.title),
      h('p', null, `${q.place} gives up its secret. Word of your deed will travel.`),
      h('div', { class: 'chips' }, ...fx.lines.map((l) => h('span', { class: 'chip good' }, l))),
    );
    await new Promise<void>((r) => m.card.append(h('button', { class: 'btn btn-primary', onclick: () => { m.close(); r(); } }, 'Claim rewards')));
    if (fx.levels) await this.levelUp(fx.levels);
    await this.ensureQuest(true);
  }

  // ================= Level up =================
  private async levelUp(levels: number) {
    const p = this.s.player;
    for (let i = 0; i < levels; i++) {
      sfx.level();
      vibrate([30, 30, 30, 30, 120]);
      const m = modal('levelup');
      const grid = h('div', { class: 'stat-pick' });
      m.card.append(
        h('div', { class: 'eyebrow' }, 'Level up!'),
        h('h2', { class: 'lvl' }, `Level ${p.level - levels + i + 1}`),
        h('p', null, `Max HP is now ${p.maxHp}. Proficiency ${fmtMod(profBonus(p.level))}. Choose a stat to raise by +2:`),
        grid,
      );
      await new Promise<void>((res) => {
        for (const st of STATS) {
          grid.appendChild(h('button', { class: 'stat-btn', disabled: p.stats[st] >= 20, onclick: () => {
            p.stats[st] = Math.min(20, p.stats[st] + 2);
            if (st === 'con') { p.maxHp += 2; p.hp += 2; }
            m.close();
            res();
          } }, h('b', null, st.toUpperCase()), h('span', null, `${p.stats[st]} → ${Math.min(20, p.stats[st] + 2)}`), h('small', null, `${fmtMod(mod(p.stats[st]))} → ${fmtMod(mod(Math.min(20, p.stats[st] + 2)))}`)));
        }
      });
      // Companions grow with you.
      for (const a of party(this.s)) a.power++;
    }
    this.persist();
  }

  // ================= Shop & village =================
  private villageServices() {
    const s = this.s;
    const tier = tierAt(s.pos);
    const sheet = new Sheet('event', { dismissable: true });
    const cost = 8 + tier * 2;
    sheet.set(h('div', { class: 'parchment' },
      h('div', { class: 'ev-kind' }, `Village · ${this.regionName(s.pos)}`),
      h('h2', { class: 'ev-title' }, 'Familiar Rooftops'),
      h('p', { class: 'ev-text' }, 'Dogs bark a greeting. The smell of fresh bread drifts from the inn.'),
      h('div', { class: 'choices' },
        h('button', { class: 'choice', onclick: () => { sheet.close(); this.shop(tier, key(s.pos)); } }, h('span', { class: 'clabel' }, 'Visit the market'), h('span', { class: 'cbadge trade' }, '🪙 TRADE')),
        h('button', { class: 'choice', onclick: () => {
          if (s.player.gold < cost) return toast(`A bed costs ${cost} gold.`, 'bad');
          s.player.gold -= cost;
          heal(s.player, s.player.maxHp);
          const t = Math.max(0, Math.min(3, s.maxStamina - s.stamina));
          s.stamina += t;
          sfx.heal();
          toast(`Rested at the inn. Full HP${t ? `, +${t} 🔥` : ''}.`, 'good');
          this.persist();
          sheet.close();
        } }, h('span', { class: 'clabel' }, `Rent a bed (${cost}g)`), h('span', { class: 'cbadge rest' }, '🛏 REST')),
        h('button', { class: 'choice', onclick: () => sheet.close() }, h('span', { class: 'clabel' }, 'Leave'), h('span', { class: 'cbadge leave' }, 'LEAVE')),
      )));
  }

  private async shop(tier: number, seedKey: string) {
    const s = this.s, p = s.player;
    const r = mulberry32(hashString(seedKey + s.day));
    const stock: (Item & { price: number; sold?: boolean })[] = Array.from({ length: 3 }, () => {
      const it = randomItem(p, tier, r);
      return { ...it, price: 18 + tier * 14 + it.plus * 8 };
    });
    const disc = hasOmen(s, 'market-day') ? 0.7 : 1;
    stock.forEach((it) => (it.price = Math.round(it.price * disc)));
    const potionPrice = Math.round((10 + tier * 3) * disc);
    const sheet = new Sheet('event', { dismissable: true });
    const render = () => {
      sheet.set(h('div', { class: 'parchment' },
        h('div', { class: 'ev-kind' }, 'Market', h('span', { class: 'gold-badge' }, `🪙 ${p.gold}`)),
        h('h2', { class: 'ev-title' }, 'Wares & Wonders'),
        h('div', { class: 'shop-list' },
          h('div', { class: 'shop-item' }, h('span', { class: 'si-icon' }, '🧪'), h('div', null, h('b', null, 'Healing Potion'), h('small', null, `Heals 2d4+4 · you have ${p.potions}`)),
            h('button', { class: 'buy', disabled: p.gold < potionPrice || p.potions >= 8, onclick: () => { p.gold -= potionPrice; p.potions++; sfx.coin(); this.persist(); render(); } }, `${potionPrice}g`)),
          ...stock.map((it) => h('div', { class: `shop-item ${it.sold ? 'sold' : ''}` },
            h('span', { class: 'si-icon' }, it.slot === 'weapon' ? '🗡️' : it.slot === 'armor' ? '🛡️' : '💍'),
            h('div', null, h('b', null, it.name), h('small', null, `${itemDesc(it)} · ${compareTo(p, it)}`)),
            h('button', { class: 'buy', disabled: it.sold || p.gold < it.price, onclick: () => {
              p.gold -= it.price; it.sold = true;
              const { price: _price, sold: _sold, ...item } = it;
              const eqd = takeItem(p, item);
              sfx.coin();
              toast(`Bought ${it.name}${eqd ? ' — equipped!' : ' (in bag)'}`, 'gold');
              this.persist(); render();
            } }, it.sold ? 'SOLD' : `${it.price}g`))),
        ),
        p.bag.length ? h('div', { class: 'ev-kind' }, 'Sell from your bag') : null,
        h('div', { class: 'shop-list' }, ...p.bag.map((it) => h('div', { class: 'shop-item' },
          h('span', { class: 'si-icon' }, it.slot === 'weapon' ? '🗡️' : it.slot === 'armor' ? '🛡️' : '💍'),
          h('div', null, h('b', null, it.name), h('small', null, itemDesc(it))),
          h('button', { class: 'buy sell', onclick: () => { p.bag = p.bag.filter((x) => x.id !== it.id); p.gold += sellValue(it); sfx.coin(); this.persist(); render(); } }, `+${sellValue(it)}g`)))),
        h('button', { class: 'btn btn-primary wide', onclick: () => sheet.close() }, 'Done'),
      ));
    };
    render();
    await sheet.done;
  }

  // ================= Camp / chapter end =================
  private campOpen = false;
  private confirmCamp(outOfTorches = false) {
    if (this.busy || this.campOpen) return;
    const s = this.s;
    const sheet = new Sheet('event', { dismissable: !outOfTorches });
    sheet.set(h('div', { class: 'parchment' },
      h('div', { class: 'campfire' }, h('span', { class: 'flame f1' }), h('span', { class: 'flame f2' }), h('span', { class: 'flame f3' }), h('span', { class: 'logs' })),
      h('h2', { class: 'ev-title center' }, outOfTorches ? 'Your last torch gutters out' : 'Make camp?'),
      h('p', { class: 'ev-text center' }, outOfTorches
        ? 'Night falls. Time to rest, recount the day, and let the story settle.'
        : `You have ${s.stamina} torches left. Camping ends the day: full rest, and your chapter is written into the journal.`),
      h('div', { class: 'choices' },
        h('button', { class: 'btn btn-primary wide', onclick: () => { sheet.close(); this.camp(); } }, '🏕️ Make camp & end the day'),
        outOfTorches ? null : h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Keep exploring'),
      )));
  }

  private async camp() {
    if (this.campOpen) return;
    this.campOpen = true;
    this.busy = true;
    const s = this.s;
    const sheet = new Sheet('event');
    sheet.set(h('div', { class: 'parchment' },
      h('div', { class: 'campfire' }, h('span', { class: 'flame f1' }), h('span', { class: 'flame f2' }), h('span', { class: 'flame f3' }), h('span', { class: 'logs' })),
      h('p', { class: 'muted center' }, aiEnabled() ? 'The bard by the fire writes today\'s chapter…' : 'The fire crackles as you recount the day…')));
    const out = await genChapterEnd(s);
    const goldDelta = s.player.gold - s.stats.chapterStartGold;
    const explored = s.stats.chapterExplored, kills = s.stats.chapterKills;
    const events = chapterLog(s).filter((l) => l.kind !== 'info').length;
    s.summary = out.summary;
    s.recap = out.recap;
    s.hook = out.hook;
    for (const f of out.flags) s.flags.push(f);
    if (s.flags.length > 20) s.flags.splice(0, s.flags.length - 20);
    s.chapters.push({ day: s.day, recap: out.recap });
    const comp = party(s)[0];
    sheet.set(h('div', { class: 'parchment chapter' },
      h('div', { class: 'campfire small' }, h('span', { class: 'flame f1' }), h('span', { class: 'flame f2' }), h('span', { class: 'flame f3' }), h('span', { class: 'logs' })),
      h('div', { class: 'ev-kind center' }, `Day ${s.day} · Chapter complete`),
      h('p', { class: 'ev-text recap-text' }, out.recap),
      h('div', { class: 'chapter-stats' },
        h('div', null, h('b', null, String(explored)), h('small', null, 'tiles explored')),
        h('div', null, h('b', null, String(events)), h('small', null, 'deeds')),
        h('div', null, h('b', null, String(kills)), h('small', null, 'foes bested')),
        h('div', null, h('b', null, `${goldDelta >= 0 ? '+' : ''}${goldDelta}`), h('small', null, 'gold')),
      ),
      h('div', { class: 'banter' }, comp ? portraitEl(comp.name, 40) : h('span', { class: 'fire-ico' }, '🔥'), h('p', null, out.banter)),
      h('p', { class: 'hook' }, out.hook),
      h('p', { class: 'muted center small' }, '✓ Your tale is saved. A fine place to pause.'),
      h('button', { class: 'btn btn-primary wide', onclick: () => sheet.close() }, '🌅 Sleep until dawn'),
    ));
    save(s);
    await sheet.done;
    s.day++;
    s.player.hp = s.player.maxHp;
    const omen = startDay(s);
    s.stats.chapterStartGold = s.player.gold;
    s.stats.chapterKills = 0;
    s.stats.chapterExplored = 0;
    this.calm = 1;
    this.campOpen = false;
    this.busy = false;
    this.persist();
    sfx.level();
    toast(`☀️ Day ${s.day} dawns — ${s.stamina} fresh torches.`, 'gold', 3000);
    setTimeout(() => toast(`${omen.icon} Omen: ${omen.name} — ${omen.desc}`, 'info', 4200), 600);
  }

  // ================= Sheets: bag / party / journal =================
  openBag() {
    const s = this.s, p = s.player, cls = CLASSES[p.cls];
    const sheet = new Sheet('panel', { dismissable: true });
    const render = () => {
      const slot = (label: string, it: Item | null, icon: string) => h('div', { class: 'gear' }, h('span', { class: 'si-icon' }, icon),
        h('div', null, h('small', null, label), h('b', null, it ? it.name : '—'), it ? h('small', null, itemDesc(it)) : null));
      sheet.set(
        h('div', { class: 'panel-head' }, h('span', { class: 'hero-glyph', style: `background:${cls.color}` }, cls.glyph),
          h('div', null, h('h2', null, p.name), h('small', null, `Level ${p.level} ${cls.name} · AC ${armorClass(p)} · ATK ${fmtMod(attackBonus(p))} · PROF ${fmtMod(profBonus(p.level))}`))),
        h('div', { class: 'stat-grid' }, ...STATS.map((st) => h('div', { class: `stat ${cls.prof.includes(st) ? 'prof' : ''}` },
          h('small', null, st.toUpperCase()), h('b', null, fmtMod(mod(p.stats[st]))), h('span', null, String(p.stats[st]))))),
        h('p', { class: 'muted small' }, `Gold-ringed stats are proficient (+${profBonus(p.level)} on checks). ${cls.ability.name}: ${cls.ability.desc}`),
        h('div', { class: 'gear-list' }, slot('Weapon', p.weapon, '🗡️'), slot('Armor', p.armor, '🛡️'), slot('Charm', p.charm, '💍')),
        h('div', { class: 'shop-item' }, h('span', { class: 'si-icon' }, '🧪'), h('div', null, h('b', null, `Potions × ${p.potions}`), h('small', null, 'Heal 2d4+4')),
          h('button', { class: 'buy', disabled: !p.potions || p.hp >= p.maxHp, onclick: () => {
            p.potions--;
            const amt = heal(p, rollDice(2, 4).reduce((a, b) => a + b, 0) + 4);
            sfx.heal();
            toast(`+${amt} HP`, 'good');
            this.persist(); render();
          } }, 'Drink')),
        p.inspiration ? h('div', { class: 'gift' }, '✨ You have Inspiration — spend it on any roll for advantage.') : null,
        h('h3', null, `Bag (${p.bag.length}/8)`),
        p.bag.length ? null : h('p', { class: 'muted small' }, 'Empty. Better loot is equipped automatically.'),
        ...p.bag.map((it) => h('div', { class: 'shop-item' }, h('span', { class: 'si-icon' }, it.slot === 'weapon' ? '🗡️' : it.slot === 'armor' ? '🛡️' : '💍'),
          h('div', null, h('b', null, it.name), h('small', null, `${itemDesc(it)} · ${compareTo(p, it)}`)),
          h('button', { class: 'buy', onclick: () => { equip(p, it.id); sfx.tap(); this.persist(); render(); } }, 'Equip'))),
        h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
      );
    };
    render();
  }

  openParty() {
    const s = this.s;
    const sheet = new Sheet('panel', { dismissable: true });
    const render = () => {
      const allies = party(s);
      const others = Object.values(s.npcs).filter((n) => !n.inParty);
      sheet.set(
        h('h2', null, 'Your Party'),
        allies.length ? null : h('p', { class: 'muted' }, 'You travel alone. Win people over in events — charm, help, or spare them — and they may join you (max 2). Companions fight beside you and remember what you\'ve done.'),
        ...allies.map((n) => h('div', { class: 'npc-card' }, portraitEl(n.name, 64),
          h('div', { class: 'npc-body' },
            h('b', null, n.name), h('small', null, `${n.role} · ${n.personality}`),
            h('div', { class: 'aff-bar' }, bar(n.affinity + 100, 200, 'aff', affinityLabel(n.affinity))),
            n.memories.length ? h('ul', { class: 'mem' }, ...n.memories.slice(-3).map((m) => h('li', null, m))) : null,
            h('button', { class: 'link', onclick: () => {
              if (!confirm(`Part ways with ${n.name}?`)) return;
              n.inParty = false;
              remember(n, `Parted ways with ${s.player.name} on day ${s.day}`);
              this.persist(); render();
            } }, 'Part ways')))),
        others.length ? h('h3', null, 'People you\'ve met') : null,
        ...others.slice(-12).reverse().map((n) => h('div', { class: 'npc-mini' }, portraitEl(n.name, 36),
          h('div', null, h('b', null, n.name), h('small', null, `${n.role} · met day ${n.metDay} · ${affinityLabel(n.affinity)}`)),
          n.affinity >= 30 && allies.length < 2 ? h('button', { class: 'buy', onclick: () => {
            n.inParty = true;
            s.stats.friends++;
            log(s, `${n.name} rejoined the party`, 'friend');
            this.persist(); render();
          } }, 'Invite') : null)),
        h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
      );
    };
    render();
  }

  openJournal() {
    const s = this.s;
    const sheet = new Sheet('panel', { dismissable: true });
    const today = chapterLog(s).filter((l) => l.kind !== 'info');
    sheet.set(
      h('h2', null, '📜 ', s.world.name),
      s.quest ? h('div', { class: 'today' }, h('small', null, `Quest ${s.questsDone + 1}`), h('b', null, `★ ${s.quest.title}`), h('span', null, s.quest.description),
        h('small', null, `Destination: ${s.quest.place} · ${distance(s.pos, s.quest.target)} hexes away`)) : null,
      h('h3', null, 'The story so far'),
      h('p', { class: 'story' }, s.summary),
      today.length ? h('h3', null, `Today (Day ${s.day})`) : null,
      today.length ? h('ul', { class: 'mem' }, ...today.slice(-8).map((l) => h('li', null, `${s.player.name} ${l.text}`))) : null,
      s.chapters.length ? h('h3', null, 'Chapters') : null,
      ...s.chapters.slice().reverse().map((c) => h('div', { class: 'chap' }, h('b', null, `Day ${c.day}`), h('p', null, c.recap))),
      s.flags.length ? h('h3', null, 'Known truths') : null,
      s.flags.length ? h('ul', { class: 'mem' }, ...s.flags.slice(-10).map((f) => h('li', null, f))) : null,
      h('div', { class: 'chapter-stats' },
        h('div', null, h('b', null, String(s.stats.explored)), h('small', null, 'explored')),
        h('div', null, h('b', null, String(s.stats.kills)), h('small', null, 'foes')),
        h('div', null, h('b', null, String(s.stats.friends)), h('small', null, 'friends')),
        h('div', null, h('b', null, String(s.stats.crits)), h('small', null, 'nat 20s')),
      ),
      h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
    );
  }
}

function affinityLabel(a: number) {
  if (a >= 70) return '♥♥♥ Devoted';
  if (a >= 40) return '♥♥ Friend';
  if (a >= 15) return '♥ Friendly';
  if (a > -15) return 'Neutral';
  if (a > -50) return 'Wary';
  return 'Hostile';
}

function compareTo(p: GameState['player'], it: Item) {
  const cur = it.slot === 'weapon' ? p.weapon : it.slot === 'armor' ? p.armor : p.charm;
  if (!cur) return 'new slot!';
  const score = (x: Item) => (x.slot === 'weapon' ? (x.die ?? 6) / 2 + x.plus * 1.5 : x.plus);
  const d = score(it) - score(cur);
  return d > 0 ? '▲ upgrade' : d < 0 ? '▼ weaker' : '= similar';
}

