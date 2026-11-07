import { h, Sheet, toast } from './dom';
import { settings, saveSettings, MODEL_SUGGESTIONS, aiEnabled } from '../ai/settings';
import { startOAuth, testConnection } from '../ai/openrouter';
import { wipe } from '../core/state';
import { sfx } from './audio';

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
      toggle('Sound effects', settings.sound, (v) => (settings.sound = v)),
      toggle('Fast text', settings.textSpeed >= 50, (v) => (settings.textSpeed = v ? 60 : 2)),
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

function toggle(label: string, value: boolean, set: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox', checked: value, onchange: (e: Event) => {
    set((e.target as HTMLInputElement).checked);
    saveSettings();
    sfx.tap();
  } });
  return h('label', { class: 'toggle' }, h('span', null, label), input, h('span', { class: 'switch' }));
}
