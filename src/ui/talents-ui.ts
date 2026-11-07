// The talent tree sheet, shared by the hero and every companion: one tab per
// party member, three branches of four talents, tap a talent to read it and learn it.
import { h, Sheet, toast, bar, vibrate } from './dom';
import { heroPortraitEl } from './art/heroes';
import { itemArt } from './art/items';
import { sfx } from './audio';
import { CLASSES, armorClass, attackBonus, fmtMod, mod, profBonus, itemDesc } from '../core/rules';
import {
  TREES, ABILITIES, ROW_LEVEL, learnState, learn, abilitiesOf, usesOf, modsOf, treeSize,
  type TalentNode, type AbilityId, type LearnState,
} from '../core/talents';
import { partyOf, ensureHero, autoLearn, favouriteBranch } from '../core/companions';
import { track } from '../core/achievements';
import { STATS } from '../core/types';
import type { GameState, Hero, NPC } from '../core/types';

export interface Member { id: string; name: string; hero: Hero; npc?: NPC }

export function members(s: GameState): Member[] {
  return [
    { id: 'you', name: s.player.name, hero: s.player },
    ...partyOf(s).map((n) => ({ id: n.id, name: n.name, hero: ensureHero(n, 1), npc: n })),
  ];
}

/** Round class portrait: the hero and companions share one style (face from the name, outfit from the class). */
export function avatar(m: Member, size = 36) {
  return heroPortraitEl(m.name, m.hero.cls, size);
}

export function classTag(hero: Hero) {
  const c = CLASSES[hero.cls];
  return h('span', { class: 'cls-tag', style: `--cls:${c.color}` }, `${c.glyph} Lv ${hero.level} ${c.name}`);
}

/** Row of ability chips with uses per fight (for sheets). */
export function abilityChips(hero: Hero) {
  const m = modsOf(hero);
  return h('div', { class: 'abil-chips' }, ...abilitiesOf(hero).map((id) => {
    const a = ABILITIES[id];
    const n = usesOf(hero, id, m);
    return h('span', { class: `abil-chip ${a.bonus ? 'bonus' : ''} ${id === 'first_aid' ? 'basic' : ''}`, title: a.desc }, `${a.icon} ${a.name}`, h('small', null, ` ×${n}`));
  }));
}

const STATE_TEXT: Record<LearnState, string> = {
  learned: 'Learned',
  available: 'Ready to learn',
  'locked-level': '',
  'locked-path': 'Learn the talent above it first',
  'no-points': 'No talent points — earn one each level',
};

/**
 * Open the talent sheet. `startWith` is a member id ('you' or an NPC id).
 * `onChange` runs after anything is learned so the caller can save.
 */
export function openTalents(s: GameState, startWith = 'you', onChange: () => void = () => {}) {
  const sheet = new Sheet('panel talents', { dismissable: true, label: 'Talents' });
  let current = startWith;
  let selected: string | null = null;

  const render = () => {
    const all = members(s);
    const m = all.find((x) => x.id === current) ?? all[0];
    current = m.id;
    const hero = m.hero;
    const tree = TREES[hero.cls];
    const cls = CLASSES[hero.cls];
    const root = ABILITIES[tree.root];

    const tabs = all.length > 1
      ? h('div', { class: 'tal-tabs', role: 'tablist' }, ...all.map((x) => h('button', {
          class: `tal-tab ${x.id === current ? 'on' : ''}`, role: 'tab', 'aria-selected': String(x.id === current),
          onclick: () => { current = x.id; selected = null; sfx.tap(); render(); },
        }, avatar(x, 26), h('span', null, x.id === 'you' ? 'You' : x.name.split(' ')[0]), x.hero.points > 0 ? h('i', { class: 'dot' }) : null)))
      : null;

    const nodeEl = (n: TalentNode) => {
      const st = learnState(hero, n);
      return h('button', {
        class: `tnode ${st} ${selected === n.id ? 'sel' : ''} row${n.row}`,
        'aria-label': `${n.name}, ${st === 'locked-level' ? `unlocks at level ${ROW_LEVEL[n.row]}` : STATE_TEXT[st]}`,
        onclick: () => { selected = n.id; sfx.tap(); render(); },
      },
        h('span', { class: 'tn-icon' }, n.icon),
        h('span', { class: 'tn-name' }, n.name),
        st === 'locked-level' ? h('span', { class: 'tn-lock' }, `Lv ${ROW_LEVEL[n.row]}`) : null,
        n.grants ? h('span', { class: 'tn-new', title: 'New ability' }, '✦') : null,
      );
    };

    const grid = h('div', { class: 'tal-grid', style: `--cls:${cls.color}` },
      ...tree.branches.map((b, i) => h('div', { class: `tal-branch ${m.npc && favouriteBranch(m.npc) === i ? 'fav' : ''}` },
        h('div', { class: 'tb-head' }, h('b', null, `${b.icon} ${b.name}`), h('small', null, b.blurb)),
        ...tree.nodes.filter((n) => n.branch === i).sort((a, c) => a.row - c.row).map(nodeEl))));

    // Details of the selected talent (or a hint).
    const sel = selected ? tree.nodes.find((n) => n.id === selected) : null;
    let detail: HTMLElement;
    if (sel) {
      const st = learnState(hero, sel);
      const b = tree.branches[sel.branch];
      detail = h('div', { class: `tal-detail ${st}` },
        h('div', { class: 'td-head' }, h('span', { class: 'tn-icon big' }, sel.icon),
          h('div', null, h('b', null, sel.name), h('small', null, `${b.icon} ${b.name} · tier ${sel.row} · level ${ROW_LEVEL[sel.row]}+`))),
        h('p', null, sel.desc),
        sel.grants ? h('p', { class: 'muted small' }, `${ABILITIES[sel.grants].bonus ? '⚡ Bonus action' : '⚔ Takes your turn'} · ${usesOf(hero, sel.grants)}× per fight`) : null,
        st === 'available'
          ? h('button', { class: 'btn btn-primary wide', onclick: () => {
              if (!learn(hero, sel.id)) return;
              if (m.npc) { const t = track(s); t.mentored = (t.mentored ?? 0) + 1; }
              sfx.level();
              vibrate([20, 30, 60]);
              toast(`${m.id === 'you' ? 'You' : m.name} learned ${sel.icon} ${sel.name}!`, 'gold');
              onChange();
              render();
            } }, `✦ Learn ${sel.name}`)
          : h('div', { class: 'td-why' }, st === 'locked-level' ? `Unlocks at level ${ROW_LEVEL[sel.row]} (${m.id === 'you' ? 'you are' : `${m.name} is`} level ${hero.level}).` : STATE_TEXT[st]),
      );
    } else {
      detail = h('div', { class: 'tal-detail hint' }, h('p', null, hero.points > 0
        ? `Tap a glowing talent to learn it. Deeper talents need the one above them and a higher level.`
        : hero.talents.length >= treeSize(hero.cls)
          ? 'Every talent mastered. Further levels raise ability scores instead.'
          : 'Each level earns a talent point. Tap any talent to read about it.'));
    }

    const mods = modsOf(hero);
    sheet.set(
      tabs,
      h('div', { class: 'panel-head' }, avatar(m, 48),
        h('div', null, h('h2', null, m.name), h('small', null, `Level ${hero.level} ${cls.name} · AC ${armorClass(hero)} · ATK ${fmtMod(attackBonus(hero))} · ♥ ${hero.hp}/${hero.maxHp}`)),
        h('div', { class: `pts ${hero.points > 0 ? 'has' : ''}` }, h('b', null, String(hero.points)), h('small', null, hero.points === 1 ? 'point' : 'points'))),
      h('div', { class: 'tal-root' }, h('span', { class: 'tn-icon' }, root.icon),
        h('div', null, h('b', null, `${root.name}`), h('small', null, ` · signature · ${usesOf(hero, tree.root, mods)}× per fight`), h('p', null, root.desc))),
      grid,
      detail,
      m.npc && hero.points > 0
        ? h('button', { class: 'btn wide', onclick: () => {
            const got = autoLearn(m.npc!);
            if (got.length) {
              const t = track(s); t.mentored = (t.mentored ?? 0) + 1;
              sfx.level();
              toast(`${m.name} chose ${got.map((n) => `${n.icon} ${n.name}`).join(', ')}`, 'gold', 3200);
              onChange();
            }
            render();
          } }, `🎲 Let ${m.name.split(' ')[0]} choose`)
        : null,
      m.npc ? companionStats(m.npc) : null,
      h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
    );
  };
  render();
  return sheet;
}

/** Stats and gear of a companion, mirroring the hero's bag sheet. */
export function companionStats(n: NPC) {
  const hero = n.hero!;
  const cls = CLASSES[hero.cls];
  return h('div', { class: 'comp-stats' },
    h('div', { class: 'stat-grid' }, ...STATS.map((st) => h('div', { class: `stat ${cls.prof.includes(st) ? 'prof' : ''}` },
      h('small', null, st.toUpperCase()), h('b', null, fmtMod(mod(hero.stats[st]))), h('span', null, String(hero.stats[st]))))),
    h('div', { class: 'comp-gear' }, ...[hero.weapon, hero.armor, hero.charm].filter((x): x is NonNullable<typeof x> => !!x).map((it) =>
      h('div', { class: 'cg' }, h('span', { class: 'cg-ico', html: itemArt(it) }), h('span', null, h('b', null, it.name), h('small', null, itemDesc(it)))))),
    h('p', { class: 'muted small' }, `Proficiency ${fmtMod(profBonus(hero.level))}`),
  );
}

/** Compact companion card for the Party sheet. */
export function companionCard(n: NPC, actions: HTMLElement[]) {
  const hero = ensureHero(n, 1);
  const m: Member = { id: n.id, name: n.name, hero, npc: n };
  return h('div', { class: 'npc-card comp' }, avatar(m, 60),
    h('div', { class: 'npc-body' },
      h('div', { class: 'comp-head' }, h('b', null, n.name), classTag(hero)),
      h('small', null, `${n.role} · ${n.personality}`),
      bar(hero.hp, hero.maxHp, `hp ${hero.hp <= 0 ? 'down' : hero.hp / hero.maxHp < 0.35 ? 'low' : ''}`, hero.hp <= 0 ? '✖ Fallen — needs tending' : `♥ ${hero.hp}/${hero.maxHp} · AC ${armorClass(hero)} · ATK ${fmtMod(attackBonus(hero))}`),
      abilityChips(hero),
      h('div', { class: 'row comp-actions' }, ...actions),
    ));
}

export const abilityName = (id: AbilityId) => `${ABILITIES[id].icon} ${ABILITIES[id].name}`;
