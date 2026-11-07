export interface Settings {
  apiKey: string;
  model: string;
  tapToRoll: boolean;
  sound: boolean;
  textSpeed: number; // chars per frame
}

const KEY = 'hexbound.settings';
export const DEFAULT_MODEL = 'google/gemini-2.5-flash';
export const MODEL_SUGGESTIONS = [
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
  'anthropic/claude-haiku-4.5',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-small-3.2-24b-instruct',
  'deepseek/deepseek-chat-v3.1',
];

const defaults: Settings = { apiKey: '', model: DEFAULT_MODEL, tapToRoll: true, sound: true, textSpeed: 2 };

export const settings: Settings = (() => {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
})();

export function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export const aiEnabled = () => settings.apiKey.trim().length > 0;
