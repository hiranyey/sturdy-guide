import { h, $, Sheet, modal, toast, typewrite, wait, bar, vibrate, longPress, popover } from './dom';
import { setMood, moodForBiome } from './music';
import { speak, stopSpeech, announce } from './prefs';
import { offerInstall } from './install';
import { shareCard } from './share';
import { checkAchievements, trackSeen, track, ACHIEVEMENTS, achievementCount, type AchievementDef } from '../core/achievements';

import { MapView } from './map';
import { rollCheck, DiceTray, d20Svg } from './dice';
import { sfx } from './audio';
import { portraitEl } from './portrait';
import { openSettings } from './settings-sheet';
import { key, eq, distance, toPixel, compass, type Hex } from '../core/hex';
import { biomeAt, poiAt, isPassable, moveCost, tierAt, regionKey, findPath, pickQuestTarget, BIOME_INFO } from '../core/world';
import { save, reveal, log, party, remember, addNpc, chapterLog, startDay, hasOmen } from '../core/state';
import {
  CLASSES, armorClass, attackBonus, fmtMod, mod, xpForNext, XP_LEVELS, heal, randomItem, itemDesc,
  equip, sellValue, profBonus, rollDice, gainXp, successChance, raiseStat,
} from '../core/rules';
import { heroCheck, partyMods, ensureHero, syncParty, unspent, classForRole, stowLoot, lootNote } from '../core/companions';
import { ABILITIES, abilitiesOf, TREES, ROW_LEVEL, type AbilityId } from '../core/talents';
import { openTalents, companionCard, avatar, members, abilityChips } from './talents-ui';
import { applyCheck, questRewards, goldMult, type Effects } from '../core/resolve';
import { makeEnemy, startCombat, playRound, useBonus, intentText, canUse, partyUnits, usesLeft, unitAc, unitAtk, potionHeal, afterFight, isDown, type Action, type Beat } from '../core/combat';
import { FLAVOR, ENEMIES, ENEMY_INTRO, AWAY_GIFTS, OMENS, STYLE_FLAVOR, RIVER_FLAVOR } from '../core/content';
import { landmarkAt, LANDMARKS, terrainName, riverAt, styleAt, type LandmarkKind } from '../core/terrain';
import { pick, chance, mulberry32, hashString, randInt } from '../core/rng';
import { genEvent, genOutcome, genRegion, genQuest, genChapterEnd, type Outcome } from '../ai/director';
import { aiEnabled } from '../ai/settings';
import { STATS, STAT_NAMES } from '../core/types';
import type { Choice, EnemySpec, EventContext, GameEvent, GameState, Hero, Item, PoiKind, Stat, NPC } from '../core/types';

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
    map.onLongPress = (hex, x, y) => this.tileInfo(hex, x, y);
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
      h('button', { class: `dock-btn ${cls}`, onclick: () => { sfx.tap(); fn(); } }, h('span', { class: 'di' }, icon), h('span', { class: 'dl' }, label), h('i', { class: 'badge-dot', 'aria-hidden': 'true' }));
    this.dock.innerHTML = '';
    this.dock.append(
      this.ticker,
      h('nav', { class: 'dock-nav' },
        btn('🎒', 'Hero', () => this.openBag(), 'bag-btn'),
        btn('👥', 'Party', () => this.openParty(), 'party-btn'),
        btn('📜', 'Journal', () => this.openJournal()),
        btn('🏕️', 'Camp', () => this.confirmCamp(), 'camp-btn'),
        btn('⚙️', 'Menu', () => openSettings({ inGame: true, onQuit: () => this.onQuit() })),
      ),
    );
  }

  renderHud() {
    const s = this.s, p = s.player, cls = CLASSES[p.cls];
    const prev = XP_LEVELS[p.level - 1] ?? 0;
    const maxed = !Number.isFinite(xpForNext(p.level));
    const growth = unspent(s);
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
          growth ? h('span', { class: 'grow-badge', 'aria-label': 'Talent points to spend' }, '✦') : null,
        ),
        h('div', { class: 'hud-bars' },
          bar(p.hp, p.maxHp, `hp ${p.hp / p.maxHp < 0.35 ? 'low' : ''}`, `♥ ${p.hp}/${p.maxHp}`),
          maxed ? bar(1, 1, 'xp', `XP ${p.xp} · MAX`) : bar(p.xp - prev, xpForNext(p.level) - prev, 'xp', `XP ${p.xp}/${xpForNext(p.level)}`),
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
    this.checkAch();
    save(this.s);
    this.renderHud();
    this.dock.querySelector('.bag-btn')?.classList.toggle('badged', (this.s.player.points ?? 0) + (this.s.player.asi ?? 0) > 0);
    this.dock.querySelector('.party-btn')?.classList.toggle('badged', members(this.s).slice(1).some((m) => m.hero.points > 0));
    this.map.invalidate(300);
  }

  // ================= Achievements =================
  private achQueue: AchievementDef[] = [];
  private achShowing = false;
  private checkAch() {
    const fresh = checkAchievements(this.s);
    if (!fresh.length) return;
    this.achQueue.push(...fresh);
    for (const a of fresh) log(this.s, `earned the achievement "${a.name}"`, 'info');
    if (!this.achShowing) this.nextAch();
  }

  private nextAch() {
    const a = this.achQueue.shift();
    if (!a) { this.achShowing = false; return; }
    this.achShowing = true;
    sfx.achievement();
    vibrate([20, 40, 20, 40, 80]);
    announce(`Achievement unlocked: ${a.name}. ${a.desc}`);
    const el = h('button', { class: 'ach-banner', 'aria-label': `Achievement unlocked: ${a.name}. Tap to share.`, onclick: () => { el.remove(); shareCard(this.s, { kind: 'achievement', ach: a }); } },
      h('span', { class: 'ach-icon' }, a.icon),
      h('span', { class: 'ach-txt' }, h('small', null, 'Achievement unlocked'), h('b', null, a.name), h('span', null, a.desc)),
      h('span', { class: 'ach-share' }, '📤'));
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.remove(); this.nextAch(); }, 400);
    }, 4200);
  }

  openAchievements() {
    const s = this.s;
    const t = track(s);
    const sheet = new Sheet('panel', { dismissable: true, label: 'Achievements' });
    sheet.set(
      h('h2', null, `🏆 Achievements · ${achievementCount(s)}/${ACHIEVEMENTS.length}`),
      h('div', { class: 'ach-grid' }, ...ACHIEVEMENTS.map((a) => {
        const got = !!s.ach?.[a.id];
        const pr = !got && a.progress ? a.progress(s, t) : null;
        return h('button', { class: `ach-card ${got ? 'got' : ''}`, 'aria-label': `${a.name}: ${a.desc}${got ? ' Unlocked.' : ''}`, onclick: () => got && shareCard(s, { kind: 'achievement', ach: a }) },
          h('span', { class: 'ach-icon' }, got ? a.icon : '🔒'),
          h('b', null, a.name),
          h('small', null, a.desc),
          pr ? bar(pr[0], pr[1], 'xp ach-prog') : null,
          pr ? h('small', { class: 'ach-num' }, `${pr[0]}/${pr[1]}`) : null,
          got ? h('small', { class: 'ach-num' }, '📤 tap to share') : null);
      })),
      h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
    );
  }

  // ================= Long-press tile info =================
  private tileInfo(hx: Hex, x: number, y: number) {
    const s = this.s;
    const k = key(hx);
    if (!s.revealed[k]) {
      popover(x, y, h('b', null, 'Unexplored'), h('div', { class: 'pv-lore' }, 'The fog hides this place. Walk closer to reveal it.'));
      return;
    }
    const b = biomeAt(hx, s.seed);
    const info = BIOME_INFO[b];
    const lm = landmarkAt(hx, s.seed);
    const poi = poiAt(hx, s.seed);
    const mem = s.tiles[k] || {};
    const rows: [string, string][] = [];
    if (s.quest && eq(hx, s.quest.target)) rows.push(['Quest', `★ ${s.quest.place}`]);
    if (poi && poi !== 'start') rows.push(['Place', `${POI_LABEL[poi] ?? poi}${mem.done ? ' ✓ visited' : ''}`]);
    if (lm) rows.push(['Landmark', `${LANDMARKS[lm].icon} ${LANDMARKS[lm].name}${mem.lm ? ' ✓' : ''}`]);
    if (riverAt(hx, s.seed)) rows.push(['Water', '🌊 Stream (fordable)']);
    rows.push(['Danger', '☠'.repeat(tierAt(hx))]);
    rows.push(['Move cost', info.passable ? `${info.cost} 🔥` : 'Impassable']);
    rows.push(['Distance', `${distance(s.pos, hx)} hex`]);
    const region = s.regions[regionKey(hx)]?.name;
    popover(x, y,
      h('b', null, terrainName(hx, s.seed)),
      region && region !== 'the wilds' ? h('div', { class: 'pv-lore' }, region) : null,
      ...rows.map(([a, v]) => h('div', { class: 'pv-row' }, h('span', null, a), h('span', null, v))),
      lm && mem.lm ? h('div', { class: 'pv-lore' }, LANDMARKS[lm].lore[0]) : null);
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
      await this.resumeInterrupted();
      await this.pendingGrowth();
    }
    this.regionCheck(this.s.pos);
    if (this.s.omen) trackSeen(this.s, 'omens', this.s.omen);
    setMood(moodForBiome(biomeAt(this.s.pos, this.s.seed)));
    this.persist();
    if (this.s.stamina <= 0) this.confirmCamp(true);
  }

  /** Reopen whatever was on screen when the app was closed: a fight, or an event. */
  private async resumeInterrupted() {
    const s = this.s;
    this.busy = true;
    try {
      if (s.pendingFight) {
        const f = s.pendingFight;
        toast('⚔️ You left mid-fight — it resumes!', 'bad', 3000);
        const r = await this.combat(f.spec, f.tier, f.boss, f.intro, { quest: f.quest, tileKey: f.tileKey });
        this.afterCombatLog(f.spec, r);
        if (r === 'win' || r === 'friend') {
          if (f.tileKey) (s.tiles[f.tileKey] ||= {}).done = 1;
          if (f.quest) await this.completeQuest(f.quest);
        }
      } else if (s.pending) {
        toast('📜 Picking up where you left off…', 'info', 2600);
        await this.runEvent(s.pending.ctx, s.pending.ev);
      }
      // Closed the app right after falling in battle: finish the defeat properly.
      if (s.player.hp <= 0) await this.downed();
    } finally {
      this.busy = false;
    }
  }

  private async intro() {
    const m = modal('intro');
    const text = h('p', { class: 'intro-text' });
    m.card.append(
      h('div', { class: 'eyebrow' }, 'A new tale begins'),
      h('h1', { class: 'intro-title' }, this.s.world.name),
      text,
    );
    speak(this.s.world.hook);
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
    trackSeen(s, 'biomes', biome);
    trackSeen(s, 'styles', `${biome}:${styleAt(hx, s.seed)}`);
    setMood(moodForBiome(biome));

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
      trackSeen(s, 'landmarks', lmk);
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
  private async runEvent(ctx: EventContext, preset?: GameEvent) {
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
    const ev = preset ?? await genEvent(s, ctx);
    // Remember the open event so closing the app mid-choice brings it back.
    s.pending = { ctx, ev };
    save(s);
    await this.showEvent(sheet, ev, ctx, kindLabel);
    await sheet.done;
    if (s.pending?.ev === ev) s.pending = null;
    save(s);
    stopSpeech();
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
    speak(`${ev.title}. ${ev.text}`);
    await typewrite(text, ev.text, 2);
    for (const c of ev.choices) {
      choicesEl.appendChild(this.choiceButton(c, () => this.resolveChoice(sheet, card, choicesEl, ev, c, ctx)));
    }
  }

  private choiceButton(c: Choice, onClick: () => void) {
    const p = this.s.player;
    let badge: HTMLElement;
    if (c.kind === 'check' && c.stat && c.dc) {
      const b = heroCheck(this.s, c.stat).total;
      const pct = Math.min(95, Math.max(5, ((21 - (c.dc - b)) / 20) * 100));
      badge = h('span', { class: `cbadge ${pct >= 65 ? 'easy' : pct >= 40 ? 'fair' : 'hard'}` }, `${c.stat.toUpperCase()} ${c.dc}`);
    } else {
      const map: Record<string, [string, string]> = { fight: ['⚔ FIGHT', 'fight'], trade: ['🪙 TRADE', 'trade'], rest: ['🛏 REST', 'rest'], leave: ['LEAVE', 'leave'] };
      const [label, cls] = map[c.kind] ?? ['', ''];
      badge = h('span', { class: `cbadge ${cls}` }, label);
    }
    const rewardIcon: Record<string, string> = { gold: '🪙', item: '🎁', ally: '♥', heal: '✚', lore: '🗺', xp: '★' };
    const rewardText: Record<string, string> = { gold: 'Gold', item: 'An item', ally: 'Win a friend', heal: 'Healing', lore: 'Knowledge & map reveal', xp: 'Experience' };
    let aria = c.label;
    if (c.kind === 'check' && c.stat && c.dc) {
      const cb = heroCheck(this.s, c.stat);
      aria += `. ${STAT_NAMES[c.stat]} check, DC ${c.dc}, ${Math.round(successChance(cb.total, c.dc) * 100)} percent chance.`;
    } else aria += `. ${c.kind}.`;
    const btn = h('button', { class: `choice choice-${c.kind}`, 'aria-label': aria, onclick: () => { sfx.tap(); onClick(); } },
      h('span', { class: 'clabel' }, c.label, c.reward ? h('span', { class: 'rhint', 'aria-hidden': 'true' }, rewardIcon[c.reward]) : null),
      badge,
    );
    // Press and hold a choice to see exactly what you are getting into.
    longPress(btn, (x, y) => {
      if (c.kind === 'check' && c.stat && c.dc) {
        const cb = heroCheck(this.s, c.stat);
        const pct = Math.round(successChance(cb.total, c.dc) * 100);
        popover(x, y, h('b', null, `${STAT_NAMES[c.stat]} check · DC ${c.dc}`),
          h('div', { class: 'pv-row' }, h('span', null, 'Your roll'), h('span', null, `d20 ${cb.parts.map((q) => `${fmtMod(q.value)} ${q.label}`).join(' ')}`)),
          h('div', { class: 'pv-row' }, h('span', null, 'Need'), h('span', null, `${Math.max(2, c.dc - cb.total)}+ on the die`)),
          h('div', { class: 'pv-row' }, h('span', null, 'Chance'), h('span', null, `${pct}%${p.inspiration ? ` (${Math.round(successChance(cb.total, c.dc, 1) * 100)}% with ✨)` : ''}`)),
          c.reward ? h('div', { class: 'pv-row' }, h('span', null, 'On success'), h('span', null, `${rewardIcon[c.reward]} ${rewardText[c.reward]}`)) : null,
          h('div', { class: 'pv-lore' }, ['str', 'dex', 'con'].includes(c.stat) ? 'Failing hurts: you may lose HP.' : 'Failing costs time: you may lose a torch.'));
      } else {
        const what: Record<string, string> = { fight: `Starts a fight${c.enemy ? ` with ${c.enemy.name}` : ''}.`, trade: 'Opens the market: buy potions and gear, sell loot.', rest: 'Rest to recover HP.', leave: 'Walk away. Nothing gained, nothing lost.' };
        popover(x, y, h('b', null, c.label), h('div', { class: 'pv-lore' }, what[c.kind] ?? ''));
      }
    });
    return btn;
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
      for (const n of party(s)) if (n.hero) heal(n.hero, inn ? n.hero.maxHp : Math.ceil(n.hero.maxHp / 2));
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
      const result = await this.combat(spec, ctx.tier, isQuest, ev.text.length < 160 ? ev.text : `${spec.name} attacks!`,
        { quest: isQuest ? ctx : undefined, tileKey: ctx.poi !== 'wild' && !isQuest ? k : undefined });
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
    const cb = heroCheck(s, stat);
    let fx: Effects | null = null;
    let outcomeP: Promise<Outcome> | null = null;
    const { roll } = await rollCheck({
      title: `${STAT_NAMES[stat]} check`,
      subtitle: c.label,
      dc: c.dc ?? 12,
      bonus: cb.total,
      parts: cb.parts,
      canInspire: p.inspiration,
      lucky: partyMods(s).lucky,
      extra: (r) => r.crit
        ? h('button', { class: 'share-btn', onclick: () => shareCard(s, { kind: 'crit', title: `${STAT_NAMES[stat]} check`, subtitle: c.label, total: r.total, dc: r.dc }) }, '📤 Share this moment')
        : null,
      onRoll: (r, usedInsp) => {
        // The die is cast: closing the app now must not allow a re-roll.
        s.pending = null;
        queueMicrotask(() => save(s));
        if (ctx.landmark === 'sword_stone' && stat === 'str' && r.success) track(s).sword = true;
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
    speak(text);
    announce(`${text} ${effects.join(', ')}`);
    await typewrite(t, text, 2);
    const s = this.s;
    if (fx?.recruit) {
      const npc = fx.recruit;
      actions.append(
        h('div', { class: 'recruit' }, portraitEl(npc.name, 44), h('span', null, h('b', null, npc.name), ' wants to travel with you!')),
        h('button', { class: 'choice choice-ally', onclick: () => {
          remember(npc, `Joined ${s.player.name}'s party on day ${s.day}`);
          this.joinParty(npc, `welcomed ${npc.name} into the party`);
          sfx.level();
          sheet.close();
        } }, h('span', { class: 'clabel' }, 'Welcome them aboard'), h('span', { class: 'cbadge rest' }, '♥ JOIN')),
        h('button', { class: 'choice choice-leave', onclick: () => sheet.close() }, h('span', { class: 'clabel' }, 'Not now'), h('span', { class: 'cbadge leave' }, 'LATER')),
      );
    } else {
      actions.append(h('button', { class: 'btn btn-primary wide', onclick: () => sheet.close() }, 'Continue'));
    }
  }

  /** Someone joins: they become a full party member at the hero's level. */
  private joinParty(npc: NPC, logText: string) {
    const s = this.s;
    npc.inParty = true;
    track(s).recruits++;
    s.stats.friends++;
    const h0 = ensureHero(npc, s.player.level);
    h0.hp = Math.max(h0.hp, Math.ceil(h0.maxHp / 2));
    log(s, logText, 'friend');
    const c = CLASSES[h0.cls];
    toast(`${npc.name} joined your party — a level ${h0.level} ${c.name}!${h0.points ? ` ✦ ${h0.points} talent point${h0.points > 1 ? 's' : ''} to spend.` : ''}`, 'good', 3600);
    this.persist();
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

  private combat(spec: EnemySpec, tier: number, boss: boolean, intro: string, resume: { quest?: EventContext; tileKey?: string } = {}): Promise<'win' | 'flee' | 'friend' | 'down'> {
    return new Promise((resolve) => {
      const s = this.s, p = s.player;
      s.pending = null;
      s.pendingFight = { spec, tier, boss, intro, ...resume };
      save(s);
      const allies = party(s).filter((n) => n.hero);
      const enemy = makeEnemy(spec, tier, boss, allies.length, p.level);
      const cs = startCombat(enemy);
      setMood('combat');
      const sheet = new Sheet('combat');
      const tray = new DiceTray();
      const logEl = h('div', { class: 'clog' }, h('div', { class: 'cl system' }, intro));
      const foeHp = h('div');
      const intentEl = h('div', { class: 'intent' });
      const sprite = h('div', { class: `foe-sprite ${boss ? 'boss' : ''}` }, enemy.emoji);
      const foeCard = h('div', { class: 'foe-card' }, sprite,
        h('div', { class: 'foe-info' },
          h('div', { class: 'foe-name' }, enemy.name, boss ? h('span', { class: 'boss-tag' }, 'BOSS') : null),
          h('div', { class: 'foe-meta' }, `${enemy.kind} · `, h('span', { class: 'ac' }, `🛡 AC ${enemy.ac}`), ` · ${'☠'.repeat(tier)}`),
          foeHp));
      const actionsEl = h('div', { class: 'actions' });
      const abilRow = h('div', { class: 'abil-row', role: 'group', 'aria-label': 'Abilities' });
      let inspire = false;
      const inspBtn = h('button', { class: 'insp-toggle', onclick: () => {
        if (!p.inspiration) return;
        inspire = !inspire;
        inspBtn.classList.toggle('on', inspire);
        sfx.tap();
      } }, h('span', { class: 'ab-icon' }, '✨'), h('b', null, 'Inspire'), h('small', null, 'advantage on next roll'));

      // Party row: one chip per member with their own HP bar; floating numbers land on them.
      const ms = members(s);
      const chips = new Map<string, { el: HTMLElement; hp: HTMLElement }>();
      const partyRow = h('div', { class: `party-row n${ms.length}` }, ...ms.map((m) => {
        const hp = h('div', { class: 'pc-hp' });
        const el = h('div', { class: `pchip ${m.id === 'you' ? 'me' : ''}` }, avatar(m, m.id === 'you' ? 34 : 28),
          h('div', { class: 'pc-body' }, h('small', { class: 'pc-name' }, m.id === 'you' ? CLASSES[p.cls].name : `${m.name.split(' ')[0]} · ${CLASSES[m.hero.cls].glyph}`), hp));
        chips.set(m.id, { el, hp });
        return el;
      }));
      abilRow.appendChild(inspBtn);
      sheet.set(h('div', { class: 'combat-wrap' }, foeCard, intentEl, tray.el, logEl, partyRow, abilRow, actionsEl));

      const refresh = () => {
        foeHp.replaceChildren(bar(enemy.hp, enemy.maxHp, 'foe', `${enemy.hp}/${enemy.maxHp}`));
        const units = partyUnits(s);
        for (const u of units) {
          const c = chips.get(u.id);
          if (!c) continue;
          const down = u.hero.hp <= 0;
          c.el.classList.toggle('down', down);
          c.hp.replaceChildren(bar(u.hero.hp, u.hero.maxHp, `hp ${down ? 'down' : u.hero.hp / u.hero.maxHp < 0.35 ? 'low' : ''}`,
            down ? '✖ down' : u.isPlayer ? `♥ ${u.hero.hp}/${u.hero.maxHp}${units.length < 3 ? ` · AC ${unitAc(cs, units, u)}` : ''}` : `${u.hero.hp}/${u.hero.maxHp}`));
        }
        const it = intentText(enemy);
        intentEl.className = `intent ${enemy.stun > 0 ? 'stunned' : enemy.intent}`;
        intentEl.textContent = `${it.icon} ${it.text}`;
        inspBtn.style.display = p.inspiration ? '' : 'none';
        if (!p.inspiration) { inspire = false; inspBtn.classList.remove('on'); }
        this.renderHud();
      };
      const me = () => partyUnits(s)[0];
      const baseDefs = (): [Action, string, string][] => {
        const units = partyUnits(s);
        const ph = potionHeal(s);
        const fa = usesLeft(cs, units[0], 'first_aid');
        return [
          ['attack', p.cls === 'mage' ? '🔥 Firebolt' : '⚔️ Attack', `${fmtMod(unitAtk(cs, units, units[0]))} vs AC · d${p.weapon.die}`],
          ['defend', '🛡️ Defend', '+4 AC, recover'],
          ['potion', '🧪 Potion', `${p.potions} left · 2d4+${ph.bonus}`],
          ['talk', enemy.kind === 'beast' ? '🤚 Calm' : '💬 Talk', `${enemy.talkStat.toUpperCase()} DC ${enemy.talkable ? enemy.talkDC : enemy.talkDC + 5}`],
          ['flee', '🏃 Flee', `DEX DC ${9 + tier + (boss ? 4 : 0)}`],
          ['first_aid', '🩹 First Aid', fa > 0 ? 'heal the most hurt' : 'used'],
        ];
      };
      const buttons = new Map<Action, HTMLButtonElement>();
      for (const [a, label, sub] of baseDefs()) {
        const b = h('button', { class: `act act-${a}`, onclick: () => act(a) }, h('b', null, label), h('small', null, sub));
        buttons.set(a, b);
        actionsEl.appendChild(b);
      }
      // Class abilities: signature first, then whatever the talent tree has unlocked.
      const abilIds = abilitiesOf(p).filter((id) => id !== 'first_aid');
      const abilBtns = new Map<AbilityId, HTMLButtonElement>();
      for (const id of abilIds) {
        const def = ABILITIES[id];
        const b = h('button', { class: `abil-btn ${def.bonus ? 'bonus' : ''}`, 'aria-label': `${def.name}. ${def.desc}`, onclick: () => (def.bonus ? bonusAct(id) : act(id)) },
          h('span', { class: 'ab-icon' }, def.icon),
          h('span', { class: 'ab-text' }, h('b', null, def.name), h('small', null, '')));
        longPress(b, (x, y) => popover(x, y, h('b', null, `${def.icon} ${def.name}`), h('div', { class: 'pv-lore' }, def.desc), h('div', { class: 'pv-row' }, h('span', null, def.bonus ? '⚡ Bonus action' : '⚔ Action'), h('span', null, `${usesLeft(cs, me(), id)} left`))));
        abilBtns.set(id, b);
        abilRow.appendChild(b);
      }
      const setEnabled = (on: boolean) => {
        const defs = baseDefs();
        for (const [a, b] of buttons) {
          b.disabled = !on || !canUse(s, cs, a);
          const d0 = defs.find((x) => x[0] === a);
          if (d0) b.querySelector('small')!.textContent = d0[2];
        }
        for (const [id, b] of abilBtns) {
          const left = usesLeft(cs, me(), id);
          b.disabled = !on || !canUse(s, cs, id);
          b.querySelector('small')!.textContent = String(Math.max(0, left));
          b.title = `${ABILITIES[id].bonus ? 'Bonus action · ' : ''}${left} left`;
        }
      };
      const floatText = (host: HTMLElement, text: string, cls2: string) => {
        const f = h('span', { class: `float ${cls2}` }, text);
        host.appendChild(f);
        setTimeout(() => f.remove(), 1000);
      };
      const addLine = (b: Beat) => {
        const line = h('div', { class: `cl ${b.actor} ${b.tone}` }, b.text);
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
      };
      const nameOf = (id?: string) => (!id || id === 'you' ? 'You' : s.npcs[id]?.name.split(' ')[0] ?? 'Ally');
      const playBeat = async (b: Beat) => {
        const label = b.actor === 'you' ? 'You' : b.actor === 'foe' ? enemy.name : b.actor === 'ally' ? nameOf(b.who) : 'Fate';
        if (b.d20) await tray.showD20(b.d20, label, b.actor !== 'you' && b.actor !== 'system');
        else tray.clear();
        if (b.dmg) await tray.showDamage(b.dmg, b.floatText?.startsWith('+') ? 'healed' : 'damage');
        addLine(b);
        if (b.floatOn && b.floatText) {
          const neg = b.floatText.startsWith('-');
          const host = b.floatOn === 'enemy' ? sprite : chips.get(b.target ?? 'you')?.el ?? partyRow;
          floatText(host, b.floatText, neg ? (b.floatOn === 'enemy' ? 'dmg' : 'hurt') : b.floatText.startsWith('+') ? 'heal' : 'miss');
          if (neg && b.floatOn === 'enemy') { sprite.classList.remove('hit'); void sprite.offsetWidth; sprite.classList.add('hit'); sfx.hit(); vibrate(25); }
          if (neg && b.floatOn === 'unit') {
            if ((b.target ?? 'you') === 'you') { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); vibrate([50, 30, 50]); }
            else { host.classList.remove('hit'); void host.offsetWidth; host.classList.add('hit'); vibrate(20); }
            sfx.hit();
          }
          if (b.floatText.startsWith('+')) sfx.heal();
        }
        refresh();
        await wait(b.actor === 'you' ? 450 : 350);
      };
      const bonusAct = async (id: AbilityId) => {
        setEnabled(false);
        sfx.tap();
        const beats = useBonus(s, cs, id);
        for (const b of beats) await playBeat(b);
        setEnabled(true);
      };
      const act = async (a: Action) => {
        setEnabled(false);
        sfx.tap();
        const useInsp = inspire && p.inspiration;
        const beats = playRound(s, cs, a, useInsp);
        if (a === 'talk' && (cs.end === 'friend' || cs.end === 'flee')) track(s).talks++;
        for (const b of beats) {
          if (b.actor === 'system' && b.text.startsWith('DEATH SAVE') && b.d20?.success) track(s).deathSaves++;
          await playBeat(b);
        }
        if (cs.end) return finish();
        setEnabled(true);
      };
      const finish = async () => {
        const end = cs.end!;
        actionsEl.innerHTML = '';
        abilRow.remove();
        inspBtn.remove();
        const summary: string[] = [];
        let levels = 0;
        if (end === 'win') {
          s.stats.kills++;
          s.stats.chapterKills++;
          sprite.classList.add('defeated');
          const xp = Math.round(enemy.xp * (hasOmen(s, 'blood-moon') ? 1.5 : 1));
          const gold = Math.round(enemy.gold * (hasOmen(s, 'golden-hour') ? 1.5 : 1) * goldMult(s));
          p.gold += gold;
          summary.push(`+${xp} XP`, `+${gold} gold`);
          levels = gainXp(s.player, xp);
          if (chance(boss ? 1 : 0.3)) {
            const it = randomItem(p, tier);
            summary.push(`${it.name} (${itemDesc(it)})${lootNote(stowLoot(s, it))}`);
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
              this.joinParty(npc, `${npc.name}, once a foe, joined the party`);
              close();
            } }, h('b', null, `♥ Invite ${npc.name}`), h('small', null, 'to join your party')));
          }
        } else if (end === 'flee') {
          summary.push('Escaped');
        }
        // The fallen get back up; Song of Rest mends the party after a win.
        const fallen = partyUnits(s).filter((u) => !u.isPlayer && isDown(u)).map((u) => u.name);
        summary.push(...afterFight(s, end === 'win'));
        if (fallen.length && end !== 'down') summary.push(`${fallen.join(' & ')} back up (1 HP)`);
        refresh();
        if (end !== 'down') {
          logEl.appendChild(h('div', { class: `cl result ${end}` }, end === 'win' ? `🏆 Victory! ${enemy.name} is defeated.` : end === 'friend' ? '🤝 The fight is over — peacefully.' : '💨 You got away.'));
          logEl.appendChild(h('div', { class: 'chips' }, ...summary.map((x) => h('span', { class: 'chip good' }, x))));
          logEl.scrollTop = logEl.scrollHeight;
        }
        // The fight is decided: rewards are in, so it must not restart on resume.
        s.pendingFight = null;
        save(s);
        const close = async () => {
          sheet.close();
          setMood(moodForBiome(biomeAt(s.pos, s.seed)));
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
    for (const n of party(s)) if (n.hero) n.hero.hp = Math.max(n.hero.hp, Math.ceil(n.hero.maxHp / 2));
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

  /** Full rest for everyone, fallen companions included. */
  private healParty() {
    const s = this.s;
    s.player.hp = s.player.maxHp;
    for (const n of party(s)) if (n.hero) n.hero.hp = n.hero.maxHp;
  }

  // ================= Level up =================
  /**
   * The hero gained `levels`. Show what grew, ask for any ability score
   * increases, bring companions up to the same level, then offer the talent tree.
   */
  private async levelUp(levels: number) {
    const s = this.s, p = s.player;
    sfx.level();
    vibrate([30, 30, 30, 30, 120]);
    const grown = syncParty(s);
    const from = p.level - levels;
    const m = modal('levelup');
    const body = h('div', { class: 'lvl-body' });
    m.card.append(
      h('div', { class: 'eyebrow' }, 'Level up!'),
      h('h2', { class: 'lvl' }, levels > 1 ? `Level ${from} → ${p.level}` : `Level ${p.level}`),
      h('div', { class: 'lvl-gains' },
        h('span', null, '♥ ', h('b', null, String(p.maxHp)), ' max HP'),
        h('span', null, '🎯 ', h('b', null, fmtMod(profBonus(p.level))), ' proficiency'),
        p.points ? h('span', { class: 'gold' }, '✦ ', h('b', null, String(p.points)), p.points === 1 ? ' talent point' : ' talent points') : null,
      ),
      body,
    );
    await this.chooseStats(body);
    body.replaceChildren();
    if (grown.length) {
      body.append(h('div', { class: 'lvl-party' }, ...grown.map((g) => h('div', { class: 'lp' }, portraitEl(g.npc.name, 30),
        h('span', null, h('b', null, g.npc.name), ` reached level ${g.to}${g.npc.hero!.points ? ` · ✦ ${g.npc.hero!.points}` : ''}`)))));
    }
    const anyPoints = members(s).some((x) => x.hero.points > 0);
    const nextTalent = TREES[p.cls].nodes.find((n) => n.row > 1 && p.level === ROW_LEVEL[n.row]);
    if (nextTalent) body.append(h('p', { class: 'muted small center' }, `New tier unlocked: tier ${nextTalent.row} talents are open.`));
    await new Promise<void>((res) => body.append(h('div', { class: 'row lvl-actions' },
      anyPoints ? h('button', { class: 'btn btn-primary', onclick: () => { m.close(); res(); openTalents(s, p.points ? 'you' : members(s).find((x) => x.hero.points > 0)!.id, () => this.persist()); } }, '✦ Choose talents') : null,
      h('button', { class: `btn ${anyPoints ? '' : 'btn-primary'}`, onclick: () => { m.close(); res(); } }, anyPoints ? 'Later' : 'Onward'),
    )));
    this.persist();
  }

  /** Spend any pending ability score increases (+2 to a stat). */
  private async chooseStats(host: HTMLElement) {
    const p = this.s.player;
    while ((p.asi ?? 0) > 0) {
      const grid = h('div', { class: 'stat-pick' });
      host.replaceChildren(h('p', null, h('b', null, 'Ability score increase!'), ' Choose a stat to raise by +2:'), grid);
      await new Promise<void>((res) => {
        for (const st of STATS) {
          grid.appendChild(h('button', { class: 'stat-btn', disabled: p.stats[st] >= 20, onclick: () => {
            raiseStat(p, st);
            p.asi--;
            sfx.tap();
            res();
          } }, h('b', null, st.toUpperCase()), h('span', null, `${p.stats[st]} → ${Math.min(20, p.stats[st] + 2)}`), h('small', null, `${fmtMod(mod(p.stats[st]))} → ${fmtMod(mod(Math.min(20, p.stats[st] + 2)))}`)));
        }
      });
      this.persist();
    }
  }

  /** On resume: finish any stat increase that was interrupted, and nudge about unspent talents. */
  private async pendingGrowth() {
    const s = this.s;
    if ((s.player.asi ?? 0) > 0) {
      const m = modal('levelup');
      const body = h('div');
      m.card.append(h('div', { class: 'eyebrow' }, 'Unfinished business'), body);
      await this.chooseStats(body);
      m.close();
    }
    if (unspent(s) > 0) setTimeout(() => toast('✦ Talent points waiting — open Hero or Party to spend them.', 'gold', 3600), 1200);
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
          this.healParty();
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
    const disc = (hasOmen(s, 'market-day') ? 0.7 : 1) * (1 - (partyMods(s).discount ?? 0) / 100);
    stock.forEach((it) => (it.price = Math.round(it.price * disc)));
    const potionPrice = Math.round((10 + tier * 3) * disc);
    const sheet = new Sheet('event', { dismissable: true });
    const render = () => {
      sheet.set(h('div', { class: 'parchment' },
        h('div', { class: 'ev-kind' }, 'Market', h('span', { class: 'gold-badge' }, `🪙 ${p.gold}`)),
        h('h2', { class: 'ev-title' }, 'Wares & Wonders'),
        h('div', { class: 'shop-list' },
          h('div', { class: 'shop-item' }, h('span', { class: 'si-icon' }, '🧪'), h('div', null, h('b', null, 'Healing Potion'), h('small', null, `Heals 2d4+4 · you have ${p.potions}`)),
            h('button', { class: 'buy', disabled: p.gold < potionPrice || p.potions >= 8, onclick: () => { p.gold -= potionPrice; p.potions++; track(s).buys++; sfx.coin(); this.persist(); render(); } }, `${potionPrice}g`)),
          ...stock.map((it) => h('div', { class: `shop-item ${it.sold ? 'sold' : ''}` },
            h('span', { class: 'si-icon' }, it.slot === 'weapon' ? '🗡️' : it.slot === 'armor' ? '🛡️' : '💍'),
            h('div', null, h('b', null, it.name), h('small', null, `${itemDesc(it)} · ${compareTo(p, it)}`)),
            h('button', { class: 'buy', disabled: it.sold || p.gold < it.price, onclick: () => {
              p.gold -= it.price; it.sold = true;
              track(s).buys++;
              const { price: _price, sold: _sold, ...item } = it;
              const who = stowLoot(s, item);
              sfx.coin();
              toast(`Bought ${it.name}${who ? lootNote(who) : ' (in bag)'}`, 'gold');
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
    setMood('camp');
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
      h('button', { class: 'btn wide', onclick: () => shareCard(s, { kind: 'chapter', day: s.day, recap: out.recap, hook: out.hook, stats: [[String(explored), 'explored'], [String(events), 'deeds'], [String(kills), 'foes'], [`${goldDelta >= 0 ? '+' : ''}${goldDelta}`, 'gold']] }) }, '📤 Share this chapter'),
      h('button', { class: 'btn btn-primary wide', onclick: () => sheet.close() }, '🌅 Sleep until dawn'),
    ));
    speak(`${out.recap} ${out.hook}`);
    this.persist();
    await sheet.done;
    s.day++;
    this.healParty();
    stopSpeech();
    const omen = startDay(s);
    trackSeen(s, 'omens', omen.id);
    setMood(moodForBiome(biomeAt(s.pos, s.seed)));
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
    // The first finished chapter is the moment players are hooked: offer the home-screen install.
    setTimeout(() => offerInstall(false), 5600);
  }

  // ================= Sheets: bag / party / journal =================
  openBag() {
    const s = this.s, p = s.player, cls = CLASSES[p.cls];
    const sheet = new Sheet('panel', { dismissable: true });
    const render = () => {
      const allies = party(s).filter((n) => n.hero);
      const slot = (label: string, it: Item | null, icon: string) => h('div', { class: 'gear' }, h('span', { class: 'si-icon' }, icon),
        h('div', null, h('small', null, label), h('b', null, it ? it.name : '—'), it ? h('small', null, itemDesc(it)) : null));
      const ph = potionHeal(s);
      sheet.set(
        h('div', { class: 'panel-head' }, h('span', { class: 'hero-glyph', style: `background:${cls.color}` }, cls.glyph),
          h('div', null, h('h2', null, p.name), h('small', null, `Level ${p.level} ${cls.name} · AC ${armorClass(p)} · ATK ${fmtMod(attackBonus(p))} · PROF ${fmtMod(profBonus(p.level))}`))),
        h('div', { class: 'stat-grid' }, ...STATS.map((st) => h('div', { class: `stat ${cls.prof.includes(st) ? 'prof' : ''}` },
          h('small', null, st.toUpperCase()), h('b', null, fmtMod(mod(p.stats[st]))), h('span', null, String(p.stats[st]))))),
        h('p', { class: 'muted small' }, `Gold-ringed stats are proficient (+${profBonus(p.level)} on checks).`),
        h('button', { class: `talent-cta ${p.points ? 'has' : ''}`, onclick: () => { sheet.close(); openTalents(s, 'you', () => this.persist()); } },
          h('span', { class: 'tc-icon' }, '✦'),
          h('span', { class: 'tc-text' }, h('b', null, 'Talents & abilities'), h('small', null, p.points ? `${p.points} point${p.points > 1 ? 's' : ''} to spend!` : `${p.talents.length} of ${TREES[p.cls].nodes.length} learned`)),
          h('span', { class: 'tc-go' }, '›')),
        abilityChips(p),
        p.asi ? h('button', { class: 'btn btn-primary wide', onclick: async () => { sheet.close(); await this.pendingGrowth(); } }, '⬆ Raise a stat (+2)') : null,
        h('div', { class: 'gear-list' }, slot('Weapon', p.weapon, '🗡️'), slot('Armor', p.armor, '🛡️'), slot('Charm', p.charm, '💍')),
        h('div', { class: 'shop-item' }, h('span', { class: 'si-icon' }, '🧪'), h('div', null, h('b', null, `Potions × ${p.potions}`), h('small', null, `Heal 2d4+${ph.bonus}`)),
          h('button', { class: 'buy', disabled: !p.potions || p.hp >= p.maxHp, onclick: () => {
            p.potions--;
            const amt = heal(p, rollDice(ph.n, ph.sides).reduce((a, b) => a + b, 0) + ph.bonus);
            sfx.heal();
            toast(`+${amt} HP`, 'good');
            this.persist(); render();
          } }, 'Drink')),
        p.inspiration ? h('div', { class: 'gift' }, '✨ You have Inspiration — spend it on any roll for advantage.') : null,
        h('h3', null, `Bag (${p.bag.length}/8)`),
        p.bag.length ? null : h('p', { class: 'muted small' }, 'Empty. Better loot is equipped automatically.'),
        ...p.bag.map((it) => h('div', { class: 'shop-item bag-item' }, h('span', { class: 'si-icon' }, it.slot === 'weapon' ? '🗡️' : it.slot === 'armor' ? '🛡️' : '💍'),
          h('div', null, h('b', null, it.name), h('small', null, `${itemDesc(it)} · ${compareTo(p, it)}`)),
          h('div', { class: 'bag-btns' },
            h('button', { class: 'buy', onclick: () => { equip(p, it.id); sfx.tap(); this.persist(); render(); } }, 'Equip'),
            ...allies.map((n) => h('button', { class: 'buy give', 'aria-label': `Give to ${n.name}`, title: `${n.name}: ${compareTo(n.hero!, it)}`, onclick: () => {
              giveItem(p, n.hero!, it.id);
              remember(n, `${p.name} gave them ${it.name}`);
              sfx.coin();
              toast(`${n.name} equips ${it.name}.`, 'good');
              this.persist(); render();
            } }, portraitEl(n.name, 18), compareTo(n.hero!, it).startsWith('▲') ? '▲' : ''))))),
        h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
      );
    };
    render();
  }

  openParty() {
    const s = this.s, p = s.player;
    const sheet = new Sheet('panel', { dismissable: true });
    const render = () => {
      const allies = party(s);
      const others = Object.values(s.npcs).filter((n) => !n.inParty);
      const ph = potionHeal(s);
      sheet.set(
        h('h2', null, 'Your Party'),
        allies.length ? h('p', { class: 'muted small' }, 'Companions are heroes too: each has a class, levels up with you, and grows their own talent tree. Tap Talents to choose for them.') : h('p', { class: 'muted' }, 'You travel alone. Win people over in events — charm, help, or spare them — and they may join you (max 2). Companions fight beside you with their own class and talents, and remember what you\'ve done.'),
        ...allies.map((n) => {
          const hero = ensureHero(n, 1);
          const hurt = hero.hp < hero.maxHp;
          return h('div', null,
            companionCard(n, [
              h('button', { class: `buy ${hero.points ? 'glow' : ''}`, onclick: () => { sheet.close(); openTalents(s, n.id, () => this.persist()); } }, hero.points ? `✦ Talents (${hero.points})` : '✦ Talents'),
              h('button', { class: 'buy', disabled: !p.potions || !hurt, onclick: () => {
                p.potions--;
                const was = hero.hp;
                hero.hp = Math.max(0, hero.hp);
                const amt = heal(hero, rollDice(ph.n, ph.sides).reduce((a, b) => a + b, 0) + ph.bonus);
                remember(n, `${p.name} shared a potion with them${was <= 0 ? ' when they had fallen' : ''}`);
                sfx.heal();
                toast(`${n.name} +${amt} HP`, 'good');
                this.persist(); render();
              } }, `🧪 Potion (${p.potions})`),
              h('button', { class: 'link', onclick: () => {
                if (!confirm(`Part ways with ${n.name}?`)) return;
                n.inParty = false;
                remember(n, `Parted ways with ${p.name} on day ${s.day}`);
                this.persist(); render();
              } }, 'Part ways'),
            ]),
            h('div', { class: 'comp-extra' },
              h('div', { class: 'aff-bar' }, bar(n.affinity + 100, 200, 'aff', affinityLabel(n.affinity))),
              n.memories.length ? h('ul', { class: 'mem' }, ...n.memories.slice(-3).map((m) => h('li', null, m))) : null));
        }),
        others.length ? h('h3', null, 'People you\'ve met') : null,
        ...others.slice(-12).reverse().map((n) => h('div', { class: 'npc-mini' }, portraitEl(n.name, 36),
          h('div', null, h('b', null, n.name), h('small', null, `${n.role} · ${CLASSES[n.hero?.cls ?? n.cls ?? classFor(n)].name}${n.hero ? ` Lv ${n.hero.level}` : ''} · met day ${n.metDay} · ${affinityLabel(n.affinity)}`)),
          n.affinity >= 30 && allies.length < 2 ? h('button', { class: 'buy', onclick: () => {
            this.joinParty(n, `${n.name} rejoined the party`);
            render();
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
      h('div', { class: 'row journal-actions' },
        h('button', { class: 'btn', onclick: () => { sheet.close(); this.openAchievements(); } }, `🏆 Achievements ${achievementCount(s)}/${ACHIEVEMENTS.length}`),
        h('button', { class: 'btn', onclick: () => shareCard(s, { kind: 'hero' }) }, '📤 Share my hero'),
      ),
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

/** Hand a bag item to a companion: they equip it and their old piece goes in the bag. */
function giveItem(p: GameState['player'], to: Hero, id: string) {
  const idx = p.bag.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const it = p.bag.splice(idx, 1)[0];
  const cur = it.slot === 'weapon' ? to.weapon : it.slot === 'armor' ? to.armor : to.charm;
  if (cur) p.bag.push(cur);
  if (it.slot === 'weapon') to.weapon = it;
  else if (it.slot === 'armor') to.armor = it;
  else to.charm = it;
}

function compareTo(p: Hero, it: Item) {
  const cur = it.slot === 'weapon' ? p.weapon : it.slot === 'armor' ? p.armor : p.charm;
  if (!cur) return 'new slot!';
  const score = (x: Item) => (x.slot === 'weapon' ? (x.die ?? 6) / 2 + x.plus * 1.5 : x.plus);
  const d = score(it) - score(cur);
  return d > 0 ? '▲ upgrade' : d < 0 ? '▼ weaker' : '= similar';
}


const classFor = (n: NPC) => classForRole(n.role, n.name);
