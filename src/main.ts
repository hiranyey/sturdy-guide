import './style.css';
import './ui/install'; // registers beforeinstallprompt early
import { applyPrefs } from './ui/prefs';
import { MapView } from './ui/map';
import { Game } from './ui/game';
import { showTitle, showCreate, hideScreen, showLoading } from './ui/screens';
import { toast } from './ui/dom';
import { initUpdates } from './ui/updates';
import { setMood } from './ui/music';
import { setAmbience, TITLE_AMBIENCE } from './ui/ambience';
import { createGame, load, save, reveal } from './core/state';
import { finishOAuth } from './ai/openrouter';
import { genPremise } from './ai/director';
import type { GameState } from './core/types';

let current: GameState | null = null;
let demo: GameState | null = null;
let game: Game | null = null;

const map = new MapView(document.getElementById('map') as HTMLCanvasElement, () => current ?? demo);

function makeDemo() {
  const d = createGame('', 'warrior', 'heroic', { name: '', hook: '' });
  for (let q = -40; q <= 60; q++) for (let r = -30; r <= 40; r++) d.revealed[`${q},${r}`] = 1;
  reveal(d, d.pos);
  return d;
}

function title() {
  game = null;
  current = null;
  demo = makeDemo();
  map.demo = true;
  map.snapTo({ q: 0, r: 0 });
  document.body.classList.add('at-title');
  setMood('title');
  setAmbience(TITLE_AMBIENCE);
  showTitle({
    onContinue: () => {
      const s = load();
      if (s) start(s, false);
    },
    onNew: () => showCreate(async (name, cls, tone) => {
      showLoading('Dreaming up a world…');
      const premise = await genPremise(tone, name, cls);
      const s = createGame(name, cls, tone, premise);
      save(s);
      start(s, true);
    }, title),
  });
}

function start(s: GameState, isNew: boolean) {
  current = s;
  demo = null;
  document.body.classList.remove('at-title');
  hideScreen();
  game = new Game(s, map, () => {
    if (current) save(current);
    title();
  });
  game.begin(isNew);
}

async function boot() {
  applyPrefs();
  try {
    if (await finishOAuth()) toast('Connected to OpenRouter! The AI Dungeon Master awaits.', 'good', 4000);
  } catch (e) {
    toast(`OpenRouter connection failed: ${(e as Error).message}`, 'bad', 5000);
  }
  title();
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && current) save(current);
  });
  initUpdates(() => { if (current) save(current); });
}

if (import.meta.env.DEV) {
  (window as any).__hb = { map, get game() { return game; }, get state() { return current; }, get demo() { return demo; } };
  import('./core/terrain').then((m) => ((window as any).__terrain = m));
}

boot();
