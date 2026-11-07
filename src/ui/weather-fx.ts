// Weather drawn over the map: rain streaks, a storm with lightning, drifting
// snow, rolling fog banks, gust lines, and a heat-haze tint. A light canvas
// layer above the map (30 fps, paused when hidden; only the tint with
// Reduce motion on).
import { reducedMotion } from './prefs';
import { settings } from '../ai/settings';
import type { Weather } from '../core/weather';

interface Drop { x: number; y: number; v: number; len: number; r: number; ph: number }

let layer: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let flashEl: HTMLDivElement | null = null;
let current: Weather = 'clear';
let parts: Drop[] = [];
let raf = 0;
let last = 0;
let W = 0, H = 0, dpr = 1;
let ownThunder: ReturnType<typeof setTimeout> | null = null;

const COUNT: Partial<Record<Weather, number>> = { rain: 90, storm: 150, snow: 70, fog: 7, wind: 22 };

function ensure() {
  if (layer) return;
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;
  layer = document.createElement('div');
  layer.className = 'weather';
  layer.setAttribute('aria-hidden', 'true');
  cv = document.createElement('canvas');
  flashEl = document.createElement('div');
  flashEl.className = 'weather-flash';
  layer.append(cv, flashEl);
  wrap.insertBefore(layer, document.getElementById('map-ui'));
  new ResizeObserver(size).observe(wrap);
  size();
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('hexbound:thunder', (e) => {
    const d = (e as CustomEvent<{ inMs: number; near: boolean }>).detail;
    if (current === 'storm') setTimeout(() => flash(d.near), Math.max(0, d.inMs));
  });
}

function size() {
  if (!layer || !cv) return;
  const r = layer.getBoundingClientRect();
  dpr = Math.min(2, devicePixelRatio || 1);
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  seed();
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function seed() {
  const n = COUNT[current] ?? 0;
  parts = Array.from({ length: n }, () => spawn(true));
}

function spawn(anywhere: boolean): Drop {
  const y = anywhere ? rnd(0, H) : rnd(-60, -10);
  switch (current) {
    case 'snow': return { x: rnd(0, W), y, v: rnd(18, 42), len: 0, r: rnd(1, 2.6), ph: rnd(0, 6.3) };
    case 'fog': return { x: rnd(-W * 0.3, W), y: rnd(0, H), v: rnd(4, 10), len: 0, r: rnd(90, 170), ph: rnd(0, 6.3) };
    case 'wind': return { x: anywhere ? rnd(0, W) : rnd(-W, -40), y: rnd(0, H), v: rnd(260, 420), len: rnd(40, 110), r: 0, ph: rnd(0, 6.3) };
    default: return { x: rnd(-40, W + 40), y, v: rnd(520, 760) * (current === 'storm' ? 1.25 : 1), len: rnd(14, 26), r: 0, ph: 0 };
  }
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (now - last < 32) return; // ~30 fps is plenty for weather
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const g = cv?.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const slant = current === 'storm' ? 0.32 : 0.16;
  if (current === 'rain' || current === 'storm') {
    g.strokeStyle = current === 'storm' ? 'rgba(210,222,255,0.6)' : 'rgba(200,218,255,0.5)';
    g.lineWidth = 1.3;
    g.beginPath();
    for (const p of parts) {
      p.y += p.v * dt; p.x += p.v * slant * dt;
      if (p.y > H + 20) Object.assign(p, spawn(false));
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.len * slant, p.y - p.len);
    }
    g.stroke();
  } else if (current === 'snow') {
    g.fillStyle = 'rgba(245,248,255,0.85)';
    g.beginPath();
    for (const p of parts) {
      p.ph += dt * 1.3;
      p.y += p.v * dt; p.x += Math.sin(p.ph) * 14 * dt + 6 * dt;
      if (p.y > H + 6) Object.assign(p, spawn(false));
      g.moveTo(p.x + p.r, p.y);
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    g.fill();
  } else if (current === 'fog') {
    for (const p of parts) {
      p.x += p.v * dt;
      if (p.x - p.r > W) { p.x = -p.r; p.y = rnd(0, H); }
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grd.addColorStop(0, 'rgba(225,230,240,0.22)');
      grd.addColorStop(1, 'rgba(225,230,240,0)');
      g.fillStyle = grd;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
  } else if (current === 'wind') {
    g.strokeStyle = 'rgba(235,240,255,0.22)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (const p of parts) {
      p.x += p.v * dt; p.ph += dt * 3;
      if (p.x > W + p.len) Object.assign(p, spawn(false));
      const wob = Math.sin(p.ph) * 4;
      g.moveTo(p.x, p.y + wob);
      g.quadraticCurveTo(p.x - p.len / 2, p.y + wob - 5, p.x - p.len, p.y + wob);
    }
    g.stroke();
  }
}

function start() {
  if (raf || !cv || document.hidden || reducedMotion() || !(COUNT[current] ?? 0)) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
}

function flash(near: boolean) {
  if (!flashEl || reducedMotion()) return;
  flashEl.classList.remove('on', 'near');
  void flashEl.offsetWidth;
  flashEl.classList.add('on');
  if (near) flashEl.classList.add('near');
}

/** Lightning on its own when the ambience (which times the thunder) is off. */
function silentStorm() {
  if (ownThunder) clearTimeout(ownThunder);
  ownThunder = null;
  if (current !== 'storm' || settings.ambience) return;
  ownThunder = setTimeout(() => { flash(Math.random() < 0.4); silentStorm(); }, rnd(9000, 22000));
}

/** Show this weather over the map. */
export function setWeather(w: Weather) {
  ensure();
  if (!layer) return;
  const changed = w !== current;
  current = w;
  layer.dataset.w = w;
  if (changed) {
    stop();
    seed();
  }
  start();
  silentStorm();
}
