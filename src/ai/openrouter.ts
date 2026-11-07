import { settings, saveSettings } from './settings';

const API = 'https://openrouter.ai/api/v1';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export class AiError extends Error {}

/** Extract the first balanced JSON object from model output. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }
  const start = cleaned.indexOf('{');
  if (start < 0) throw new AiError('no json');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
  }
  throw new AiError('unbalanced json');
}

let jsonModeUnsupported = false;

export async function chatJson<T>(messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}): Promise<T> {
  if (!settings.apiKey) throw new AiError('no key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.9,
    };
    if (!jsonModeUnsupported) body.response_format = { type: 'json_object' };
    let res = await post(body, ctrl.signal);
    if (res.status === 400 && body.response_format) {
      jsonModeUnsupported = true;
      delete body.response_format;
      res = await post(body, ctrl.signal);
    }
    if (!res.ok) throw new AiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new AiError('empty response');
    return extractJson(content) as T;
  } finally {
    clearTimeout(timer);
  }
}

function post(body: unknown, signal: AbortSignal) {
  return fetch(`${API}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Hexbound',
    },
    body: JSON.stringify(body),
  });
}

export async function testConnection(): Promise<string> {
  const out = await chatJson<{ ok: boolean; line: string }>([
    { role: 'system', content: 'Reply only with JSON.' },
    { role: 'user', content: 'Return {"ok": true, "line": "<a 6-word fantasy greeting>"}' },
  ], { maxTokens: 60, timeoutMs: 15000 });
  return out.line || 'Connected!';
}

// --- OAuth PKCE: "Connect with OpenRouter" (no copy-pasting keys on a phone) ---
const VERIFIER_KEY = 'hexbound.pkce';

function b64url(bytes: Uint8Array) {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startOAuth() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = b64url(digest);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const callback = location.origin + location.pathname;
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${challenge}&code_challenge_method=S256`;
}

/** Call on boot. Returns true if a key was obtained from an OAuth redirect. */
export async function finishOAuth(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return false;
  const verifier = sessionStorage.getItem(VERIFIER_KEY) || localStorage.getItem(VERIFIER_KEY);
  history.replaceState(null, '', location.pathname);
  if (!verifier) return false;
  const res = await fetch(`${API}/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  localStorage.removeItem(VERIFIER_KEY);
  if (!res.ok) throw new AiError(`OAuth failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.key) throw new AiError('OAuth: no key returned');
  settings.apiKey = data.key;
  saveSettings();
  return true;
}
