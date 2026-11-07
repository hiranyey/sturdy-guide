import { h, toast } from './dom';
import { sfx } from './audio';
import { openSettings } from './settings-sheet';
import { d20Svg } from './dice';
import { CLASSES, fmtMod, mod } from '../core/rules';
import { load } from '../core/state';
import { npcName } from '../core/content';
import { aiEnabled } from '../ai/settings';
import { STATS } from '../core/types';
import type { ClassId, Tone } from '../core/types';

const screen = () => document.getElementById('screen')!;

export function showTitle(handlers: { onContinue: () => void; onNew: () => void }) {
  const save = load();
  const root = screen();
  root.className = 'screen title-screen show';
  root.innerHTML = '';
  const aiLine = h('div', { class: `ai-pill ${aiEnabled() ? 'on' : 'off'}` });
  const refreshAi = () => {
    aiLine.className = `ai-pill ${aiEnabled() ? 'on' : 'off'}`;
    aiLine.textContent = aiEnabled() ? '● AI Dungeon Master ready' : '○ Offline storyteller · connect AI in Settings';
  };
  refreshAi();
  root.append(
    h('div', { class: 'title-inner' },
      h('div', { class: 'logo-die', html: d20Svg(20) }),
      h('h1', { class: 'logo' }, 'HEXBOUND'),
      h('p', { class: 'tagline' }, 'A pocket-sized saga. Five minutes at a time.'),
      h('div', { class: 'title-btns' },
        save ? h('button', { class: 'btn btn-primary big', onclick: () => { sfx.tap(); handlers.onContinue(); } },
          'Continue', h('small', null, `${save.player.name} · Day ${save.day} · Lv ${save.player.level}`)) : null,
        h('button', { class: `btn big ${save ? '' : 'btn-primary'}`, onclick: () => {
          sfx.tap();
          if (save && !confirm('Start a new journey? Your current save will be replaced.')) return;
          handlers.onNew();
        } }, 'New Journey'),
        h('button', { class: 'btn', onclick: () => openSettings({ inGame: false, onChange: refreshAi }) }, '⚙️ Settings & AI'),
      ),
      aiLine,
    ),
  );
}

export function hideScreen() {
  const root = screen();
  root.classList.remove('show');
  setTimeout(() => { if (!root.classList.contains('show')) root.innerHTML = ''; }, 400);
}

export function showCreate(onBegin: (name: string, cls: ClassId, tone: Tone) => void, onBack: () => void) {
  const root = screen();
  root.className = 'screen create-screen show';
  root.innerHTML = '';
  let cls: ClassId = 'warrior';
  let tone: Tone = 'heroic';
  const nameInput = h('input', { class: 'name-input', value: npcName().split(' ')[0], maxlength: 18, placeholder: 'Your name', autocomplete: 'off' }) as HTMLInputElement;
  const classGrid = h('div', { class: 'class-grid' });
  const detail = h('div', { class: 'class-detail' });
  const renderClasses = () => {
    classGrid.innerHTML = '';
    for (const c of Object.values(CLASSES)) {
      classGrid.appendChild(h('button', { class: `class-card ${c.id === cls ? 'sel' : ''}`, style: `--cc:${c.color}`, onclick: () => { cls = c.id; sfx.tap(); renderClasses(); } },
        h('span', { class: 'cc-glyph' }, c.glyph), h('b', null, c.name)));
    }
    const c = CLASSES[cls];
    detail.innerHTML = '';
    detail.append(
      h('p', { class: 'cd-blurb' }, c.blurb),
      h('div', { class: 'mini-stats' }, ...STATS.map((st) => h('span', { class: c.prof.includes(st) ? 'prof' : '' }, h('small', null, st.toUpperCase()), h('b', null, fmtMod(mod(c.stats[st])))))),
      h('p', { class: 'cd-ability' }, h('b', null, `💥 ${c.ability.name}: `), c.ability.desc),
      h('p', { class: 'cd-ability' }, `🗡️ ${c.weapon.name} (d${c.weapon.die}) · 🛡️ ${c.armor.name}`),
    );
  };
  renderClasses();
  const toneRow = h('div', { class: 'tone-row' });
  const tones: [Tone, string, string][] = [['heroic', '☀️', 'Heroic'], ['grim', '🌑', 'Grim'], ['whimsical', '🍄', 'Whimsical']];
  const renderTones = () => {
    toneRow.innerHTML = '';
    for (const [t, icon, label] of tones) toneRow.appendChild(h('button', { class: `tone ${t === tone ? 'sel' : ''}`, onclick: () => { tone = t; sfx.tap(); renderTones(); } }, icon, ' ', label));
  };
  renderTones();
  root.append(h('div', { class: 'create-inner' },
    h('button', { class: 'back', onclick: onBack }, '‹ Back'),
    h('h2', null, 'Who walks into the wilds?'),
    h('label', { class: 'field' }, h('span', null, 'Name'), nameInput),
    h('label', { class: 'field' }, h('span', null, 'Class')),
    classGrid,
    detail,
    h('label', { class: 'field' }, h('span', null, 'Tone of the tale')),
    toneRow,
    h('button', { class: 'btn btn-primary big wide', onclick: () => {
      const name = nameInput.value.trim();
      if (!name) return toast('Every hero needs a name.', 'bad');
      sfx.level();
      onBegin(name, cls, tone);
    } }, 'Begin the journey'),
    h('p', { class: 'muted small center' }, aiEnabled() ? 'Your world will be dreamt up by the AI Dungeon Master.' : 'Tip: connect OpenRouter in Settings for a unique AI-written world.'),
  ));
}

export function showLoading(text: string) {
  const root = screen();
  root.className = 'screen loading-screen show';
  root.innerHTML = '';
  root.append(h('div', { class: 'title-inner' }, h('div', { class: 'spin-die big', html: d20Svg('?') }), h('p', { class: 'tagline' }, text)));
}
