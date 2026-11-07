// Applies accessibility preferences app-wide, and provides read-aloud narration.
import { settings } from '../ai/settings';

export function applyPrefs() {
  document.documentElement.style.fontSize = `${Math.round(16 * settings.textScale)}px`;
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}

export const reducedMotion = () => settings.reduceMotion;

// ---------- Read-aloud (Web Speech API) ----------
let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /en[-_]GB/i.test(v.lang) && /natural|premium|enhanced|daniel|serena/i.test(v.name))
      ?? voices.find((v) => /en[-_]GB/i.test(v.lang))
      ?? voices.find((v) => /^en/i.test(v.lang))
      ?? null;
  } catch { voice = null; }
}
try {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
} catch { /* not supported */ }

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!settings.readAloud || !speechSupported() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[★✨🎲☠♥]/gu, ''));
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.pitch = 0.95;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function stopSpeech() {
  try { if (speechSupported()) speechSynthesis.cancel(); } catch { /* ignore */ }
}

/** Polite live region so screen readers announce dice results and outcomes. */
let live: HTMLElement | null = null;
export function announce(text: string) {
  if (!live) {
    live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    live.className = 'sr-only';
    document.body.appendChild(live);
  }
  live.textContent = '';
  setTimeout(() => { if (live) live.textContent = text; }, 50);
}
