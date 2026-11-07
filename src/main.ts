import './style.css';
import './ui/install'; // registers beforeinstallprompt early
import { applyPrefs } from './ui/prefs';
import { MapView } from './ui/map';
import { Game } from './ui/game';
import { showTitle, showCreate, hideScreen, showLoading } from './ui/screens';
import { toast } from './ui/dom';
import { initUpdates } from './ui/updates';
import { fitViewport } from './ui/viewport';
import { setMood } from './ui/music';
import { setAmbience, TITLE_AMBIENCE } from './ui/ambience';
import { edgeMood } from './ui/edges';
import { setWeather } from './ui/weather-fx';
import { createGame, load, save, reveal } from './core/state';
import { finishOAuth } from './ai/openrouter';
import { genPremise } from './ai/director';
import type { GameState } from './core/types';

let current: GameState | null = null;
let demo: GameState | null = null;
let game: Game | null = null;

const map = new MapView(document.getElementById('map') as HTMLCanvasElement, () => current ?? demo);

// The map runs under the HUD and dock: tell the camera and the overlay UI how tall they are.
fitViewport();

function watchBars() {
  const hud = document.getElementById('hud')!, dock = document.getElementById('dock')!;
  const update = () => {
    const top = document.body.classList.contains('at-title') ? 0 : hud.offsetHeight;
    const bottom = document.body.classList.contains('at-title') ? 0 : dock.offsetHeight;
    document.documentElement.style.setProperty('--hud-h', `${top}px`);
    document.documentElement.style.setProperty('--dock-h', `${bottom}px`);
    map.setInsets(top, bottom);
  };
  const ro = new ResizeObserver(update);
  ro.observe(hud);
  ro.observe(dock);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  update();
}
watchBars();

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
  setWeather('clear');
  edgeMood('title');
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
