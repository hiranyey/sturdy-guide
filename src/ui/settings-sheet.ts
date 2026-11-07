import { h, Sheet, toast } from './dom';
import { settings, saveSettings, MODEL_SUGGESTIONS, aiEnabled } from '../ai/settings';
import { startOAuth, testConnection } from '../ai/openrouter';
import { wipe } from '../core/state';
import { sfx, applyVolumes } from './audio';
import { refreshMusic } from './music';
import { applyPrefs, speechSupported, speak, stopSpeech } from './prefs';
import { installAvailable, offerInstall, isStandalone } from './install';

export function openSettings(opts: { inGame: boolean; onQuit?: () => void; onChange?: () => void }) {
  const sheet = new Sheet('panel', { dismissable: true });
  const render = () => {
    const status = h('div', { class: `ai-status ${aiEnabled() ? 'on' : 'off'}` },
      aiEnabled() ? '● AI Dungeon Master connected' : '○ Offline storyteller (hand-written events)');
    const keyInput = h('input', { type: 'password', placeholder: 'sk-or-v1-…', value: settings.apiKey, autocomplete: 'off', spellcheck: false }) as HTMLInputElement;
    const modelInput = h('input', { type: 'text', value: settings.model, list: 'models', spellcheck: false }) as HTMLInputElement;
    const testOut = h('div', { class: 'muted small' });
    sheet.set(
      h('h2', null, '⚙️ Settings'),
      h('h3', null, 'AI Dungeon Master'),
      status,
      h('p', { class: 'muted small' }, 'Hexbound uses OpenRouter so you can choose any model. Events, NPCs, regions, quests and chapter recaps are generated live. Without a key, a hand-written storyteller takes over.'),
      h('button', { class: 'btn btn-primary wide', onclick: () => startOAuth().catch((e) => toast(String(e.message || e), 'bad')) }, '🔗 Connect with OpenRouter'),
      h('label', { class: 'field' }, h('span', null, 'or paste an API key'), keyInput),
      h('label', { class: 'field' }, h('span', null, 'Model'), modelInput,
        h('datalist', { id: 'models' }, ...MODEL_SUGGESTIONS.map((m) => h('option', { value: m })))),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => {
          settings.apiKey = keyInput.value.trim();
          settings.model = modelInput.value.trim() || settings.model;
          saveSettings();
          toast('Saved', 'good');
          opts.onChange?.();
          render();
        } }, 'Save'),
        h('button', { class: 'btn', onclick: async () => {
          settings.apiKey = keyInput.value.trim();
          settings.model = modelInput.value.trim() || settings.model;
          saveSettings();
          testOut.textContent = 'Summoning…';
          try {
            testOut.textContent = `✓ "${await testConnection()}"`;
          } catch (e) {
            testOut.textContent = `✗ ${(e as Error).message}`;
          }
        } }, 'Test'),
        aiEnabled() ? h('button', { class: 'btn', onclick: () => { settings.apiKey = ''; saveSettings(); opts.onChange?.(); render(); } }, 'Disconnect') : null,
      ),
      testOut,
      h('h3', null, 'Play'),
      toggle('Tap the die to roll (off = auto-roll)', settings.tapToRoll, (v) => (settings.tapToRoll = v)),
      toggle('Fast text', settings.textSpeed >= 50, (v) => (settings.textSpeed = v ? 60 : 2)),
      h('h3', null, 'Sound'),
      toggle('Sound effects', settings.sound, (v) => { settings.sound = v; applyVolumes(); }),
      slider('Effects volume', settings.sfxVol, (v) => { settings.sfxVol = v; applyVolumes(); }, () => sfx.coin()),
      toggle('Ambient music', settings.music, (v) => { settings.music = v; applyVolumes(); refreshMusic(); }),
      slider('Music volume', settings.musicVol, (v) => { settings.musicVol = v; applyVolumes(); }),
      speechSupported() ? toggle('Read story aloud', settings.readAloud, (v) => { settings.readAloud = v; if (v) speak('The story will be read aloud.'); else stopSpeech(); }) : null,
      h('h3', null, 'Accessibility'),
      segmented('Text size', [[0.9, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']], settings.textScale, (v) => { settings.textScale = v; applyPrefs(); render(); }),
      toggle('Reduce motion', settings.reduceMotion, (v) => { settings.reduceMotion = v; applyPrefs(); }),
      !isStandalone() ? h('h3', null, 'App') : null,
      !isStandalone() ? h('button', { class: 'btn wide', onclick: () => offerInstall(true) }, installAvailable() ? '📲 Install Hexbound on this device' : '📲 Add to Home Screen') : null,
      opts.inGame ? h('h3', null, 'Journey') : null,
      opts.inGame ? h('button', { class: 'btn wide', onclick: () => { sheet.close(); opts.onQuit?.(); } }, '🏠 Save & return to title') : null,
      opts.inGame ? h('button', { class: 'btn btn-danger wide', onclick: () => {
        if (!confirm('Abandon this journey forever? Your save will be deleted.')) return;
        wipe();
        sheet.close();
        location.reload();
      } }, 'Abandon journey') : null,
      h('button', { class: 'btn wide', onclick: () => sheet.close() }, 'Close'),
    );
  };
  render();
}

function slider(label: string, value: number, set: (v: number) => void, preview?: () => void) {
  const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(value), 'aria-label': label,
    oninput: (e: Event) => set(Number((e.target as HTMLInputElement).value)),
    onchange: () => { saveSettings(); preview?.(); },
  });
  return h('label', { class: 'range' }, h('span', null, label), input);
}

function segmented(label: string, options: [number, string][], value: number, set: (v: number) => void) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, h('span', null, label),
    ...options.map(([v, l]) => h('button', { class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value), onclick: () => { set(v); saveSettings(); sfx.tap(); } }, l)));
}

function toggle(label: string, value: boolean, set: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox', checked: value, onchange: (e: Event) => {
    set((e.target as HTMLInputElement).checked);
    saveSettings();
    sfx.tap();
  } });
  return h('label', { class: 'toggle' }, h('span', null, label), input, h('span', { class: 'switch' }));
}
