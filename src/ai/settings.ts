export interface Settings {
  apiKey: string;
  model: string;
  tapToRoll: boolean;
  sound: boolean;
  textSpeed: number; // chars per frame
  sfxVol: number; // 0..1
  music: boolean;
  musicVol: number; // 0..1
  ambience: boolean;
  ambVol: number; // 0..1
  textScale: number; // 0.9..1.3
  reduceMotion: boolean;
  readAloud: boolean;
  installDismissedAt: number;
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

const prefersReducedMotion = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

const defaults: Settings = {
  apiKey: '', model: DEFAULT_MODEL, tapToRoll: true, sound: true, textSpeed: 2,
  sfxVol: 0.8, music: true, musicVol: 0.45, ambience: true, ambVol: 0.6, textScale: 1, reduceMotion: prefersReducedMotion, readAloud: false,
  installDismissedAt: 0,
};

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
