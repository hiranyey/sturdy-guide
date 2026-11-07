import { SQRT3, fromPixel, toPixel, key, neighbors, distance, type Hex } from '../core/hex';
import { biomeAt, poiAt, isPassable, moveCost, visionRadius } from '../core/world';
import { mulberry32, hash2 } from '../core/rng';
import { CLASSES } from '../core/rules';
import { party } from '../core/state';
import { blockAt, canEnter, BLOCK_INFO } from '../core/blocks';
import type { Biome, GameState, PoiKind } from '../core/types';
import { styleAt, riverMask, riverAt, landmarkAt } from '../core/terrain';
import { reducedMotion } from './prefs';
import { hexPath, palette, decorate, drawRiver, riverSegments, drawLandmark, waterGlint, type Ctx } from './terrain-art';


// ---------- POI icons ----------
/** A closed hex: darkened, hatched, a pulsing red rim and what's in the way. */
function drawBlock(ctx: Ctx, icon: string, x: number, y: number, s: number, t: number) {
  ctx.save();
  hexPath(ctx, x, y, s - 2);
  ctx.fillStyle = 'rgba(30,8,8,0.32)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    const o = i * s * 0.32;
    ctx.moveTo(x + o - s, y + s);
    ctx.lineTo(x + o + s, y - s);
  }
  ctx.stroke();
  ctx.restore();
  hexPath(ctx, x, y, s - 2.5);
  ctx.strokeStyle = `rgba(255,96,72,${0.55 + 0.25 * Math.sin(t / 420)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = `${Math.round(s * 0.62)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#fff4dc'; // only shows where no colour-emoji font exists
  ctx.fillText(icon, x, y - s * 0.04);
  ctx.restore();
}

function drawPoi(ctx: Ctx, kind: PoiKind | 'quest', x: number, y: number, s: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow disc
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.28, s * 0.38, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const S = s;
  switch (kind) {
    case 'village': {
      const house = (hx: number, hy: number, k: number, roof: string) => {
        ctx.fillStyle = '#efe0b9';
        ctx.fillRect(hx - S * 0.16 * k, hy - S * 0.2 * k, S * 0.32 * k, S * 0.24 * k);
        ctx.fillStyle = '#c9b48a';
        ctx.fillRect(hx + S * 0.04 * k, hy - S * 0.2 * k, S * 0.12 * k, S * 0.24 * k);
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(hx - S * 0.22 * k, hy - S * 0.18 * k);
        ctx.lineTo(hx, hy - S * 0.42 * k);
        ctx.lineTo(hx + S * 0.22 * k, hy - S * 0.18 * k);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd86b';
        ctx.fillRect(hx - S * 0.1 * k, hy - S * 0.12 * k, S * 0.07 * k, S * 0.07 * k);
        ctx.fillStyle = '#5a3b22';
        ctx.fillRect(hx - S * 0.0 * k, hy - S * 0.1 * k, S * 0.06 * k, S * 0.14 * k);
      };
      house(-S * 0.17, S * 0.12, 0.85, '#b5462e');
      house(S * 0.17, S * 0.2, 1, '#8c3a2a');
      // smoke
      ctx.fillStyle = 'rgba(240,240,240,0.5)';
      for (let i = 0; i < 3; i++) {
        const ph = ((t / 1400 + i / 3) % 1);
        ctx.beginPath();
        ctx.arc(S * 0.22 + ph * S * 0.1, -S * 0.3 - ph * S * 0.35, S * (0.04 + ph * 0.05), 0, Math.PI * 2);
        ctx.globalAlpha = 1 - ph;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'ruin': {
      ctx.fillStyle = '#c9c4b5';
      ctx.fillRect(-S * 0.3, -S * 0.25, S * 0.12, S * 0.5);
      ctx.fillRect(-S * 0.06, -S * 0.05, S * 0.12, S * 0.3);
      ctx.fillRect(S * 0.18, -S * 0.38, S * 0.12, S * 0.63);
      ctx.fillStyle = '#e8e3d4';
      ctx.fillRect(-S * 0.34, -S * 0.3, S * 0.2, S * 0.06);
      ctx.fillRect(S * 0.14, -S * 0.42, S * 0.2, S * 0.06);
      ctx.fillStyle = '#9a9483';
      ctx.fillRect(-S * 0.38, S * 0.2, S * 0.76, S * 0.06);
      ctx.fillStyle = '#4f8a3a';
      ctx.beginPath();
      ctx.arc(S * 0.22, -S * 0.1, S * 0.06, 0, Math.PI * 2);
      ctx.arc(-S * 0.26, S * 0.05, S * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cave': {
      ctx.fillStyle = '#6e6a66';
      ctx.beginPath();
      ctx.moveTo(-S * 0.42, S * 0.25);
      ctx.quadraticCurveTo(-S * 0.38, -S * 0.42, 0, -S * 0.42);
      ctx.quadraticCurveTo(S * 0.38, -S * 0.42, S * 0.42, S * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8f8a84';
      ctx.beginPath();
      ctx.moveTo(-S * 0.38, S * 0.2);
      ctx.quadraticCurveTo(-S * 0.34, -S * 0.36, 0, -S * 0.38);
      ctx.lineTo(-S * 0.1, S * 0.2);
      ctx.fill();
      ctx.fillStyle = '#16121a';
      ctx.beginPath();
      ctx.moveTo(-S * 0.17, S * 0.25);
      ctx.quadraticCurveTo(-S * 0.17, -S * 0.12, 0, -S * 0.12);
      ctx.quadraticCurveTo(S * 0.17, -S * 0.12, S * 0.17, S * 0.25);
      ctx.fill();
      ctx.fillStyle = '#ffcf5a';
      ctx.beginPath();
      ctx.arc(-S * 0.05, S * 0.07, S * 0.025, 0, Math.PI * 2);
      ctx.arc(S * 0.05, S * 0.07, S * 0.025, 0, Math.PI * 2);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 500);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'shrine': {
      const g = ctx.createRadialGradient(0, -S * 0.15, 0, 0, -S * 0.15, S * 0.5);
      g.addColorStop(0, `rgba(120,220,255,${0.45 + 0.2 * Math.sin(t / 600)})`);
      g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -S * 0.15, S * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a7a3b8';
      ctx.beginPath();
      ctx.moveTo(-S * 0.12, S * 0.22);
      ctx.lineTo(-S * 0.08, -S * 0.4);
      ctx.lineTo(0, -S * 0.5);
      ctx.lineTo(S * 0.08, -S * 0.4);
      ctx.lineTo(S * 0.12, S * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d5d1e6';
      ctx.beginPath();
      ctx.moveTo(-S * 0.12, S * 0.22);
      ctx.lineTo(-S * 0.08, -S * 0.4);
      ctx.lineTo(0, -S * 0.5);
      ctx.lineTo(0, S * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7fe3ff';
      ctx.fillRect(-S * 0.03, -S * 0.25, S * 0.06, S * 0.18);
      ctx.fillStyle = '#8a8698';
      ctx.fillRect(-S * 0.22, S * 0.2, S * 0.44, S * 0.07);
      break;
    }
    case 'camp':
    case 'start': {
      if (kind === 'camp') {
        ctx.fillStyle = '#a0522d';
        ctx.beginPath();
        ctx.moveTo(-S * 0.38, S * 0.18);
        ctx.lineTo(-S * 0.12, -S * 0.32);
        ctx.lineTo(S * 0.14, S * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c9773f';
        ctx.beginPath();
        ctx.moveTo(-S * 0.12, -S * 0.32);
        ctx.lineTo(S * 0.14, S * 0.18);
        ctx.lineTo(-S * 0.04, S * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.moveTo(-S * 0.18, S * 0.18);
        ctx.lineTo(-S * 0.12, -S * 0.05);
        ctx.lineTo(-S * 0.06, S * 0.18);
        ctx.fill();
      }
      const fx = kind === 'camp' ? S * 0.26 : 0, fy = S * 0.15;
      ctx.strokeStyle = '#5a3b22';
      ctx.lineWidth = S * 0.06;
      ctx.beginPath();
      ctx.moveTo(fx - S * 0.12, fy + S * 0.05);
      ctx.lineTo(fx + S * 0.12, fy - S * 0.02);
      ctx.moveTo(fx - S * 0.12, fy - S * 0.02);
      ctx.lineTo(fx + S * 0.12, fy + S * 0.05);
      ctx.stroke();
      const flick = 1 + 0.15 * Math.sin(t / 90) + 0.1 * Math.sin(t / 37);
      ctx.fillStyle = '#ff8a2a';
      ctx.beginPath();
      ctx.moveTo(fx - S * 0.09, fy);
      ctx.quadraticCurveTo(fx, fy - S * 0.38 * flick, fx + S * 0.09, fy);
      ctx.fill();
      ctx.fillStyle = '#ffe36a';
      ctx.beginPath();
      ctx.moveTo(fx - S * 0.045, fy);
      ctx.quadraticCurveTo(fx, fy - S * 0.2 * flick, fx + S * 0.045, fy);
      ctx.fill();
      break;
    }
    case 'tower': {
      ctx.fillStyle = '#8d8478';
      ctx.fillRect(-S * 0.13, -S * 0.42, S * 0.26, S * 0.68);
      ctx.fillStyle = '#b0a798';
      ctx.fillRect(-S * 0.13, -S * 0.42, S * 0.12, S * 0.68);
      ctx.fillStyle = '#6a3a9a';
      ctx.beginPath();
      ctx.moveTo(-S * 0.2, -S * 0.4);
      ctx.lineTo(0, -S * 0.78);
      ctx.lineTo(S * 0.2, -S * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,220,120,${0.6 + 0.4 * Math.sin(t / 400)})`;
      ctx.fillRect(-S * 0.04, -S * 0.3, S * 0.08, S * 0.1);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-S * 0.05, S * 0.1, S * 0.1, S * 0.16);
      break;
    }
    case 'grove': {
      ctx.fillStyle = '#5a3b22';
      ctx.fillRect(-S * 0.05, -S * 0.1, S * 0.1, S * 0.36);
      const g = ctx.createRadialGradient(0, -S * 0.3, S * 0.05, 0, -S * 0.3, S * 0.4);
      g.addColorStop(0, '#d9ff8a');
      g.addColorStop(1, '#2f8a4a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -S * 0.3, S * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6b0';
      for (let i = 0; i < 5; i++) {
        const a = t / 1500 + i * 1.3;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 300 + i);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * S * 0.4, -S * 0.3 + Math.sin(a * 1.3) * S * 0.3, S * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'stranger': {
      ctx.fillStyle = '#3d3552';
      ctx.beginPath();
      ctx.moveTo(-S * 0.16, S * 0.25);
      ctx.quadraticCurveTo(-S * 0.18, -S * 0.25, 0, -S * 0.32);
      ctx.quadraticCurveTo(S * 0.18, -S * 0.25, S * 0.16, S * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1626';
      ctx.beginPath();
      ctx.arc(0, -S * 0.17, S * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = S * 0.04;
      ctx.beginPath();
      ctx.moveTo(S * 0.24, S * 0.25);
      ctx.lineTo(S * 0.24, -S * 0.32);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,210,90,${0.7 + 0.3 * Math.sin(t / 250)})`;
      ctx.beginPath();
      ctx.arc(S * 0.24, -S * 0.36, S * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // speech bubble
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-S * 0.24, -S * 0.5, S * 0.14, S * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = `bold ${S * 0.16}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('…', -S * 0.24, -S * 0.52);
      break;
    }
    case 'quest': {
      ctx.strokeStyle = '#5a3b22';
      ctx.lineWidth = S * 0.05;
      ctx.beginPath();
      ctx.moveTo(-S * 0.1, S * 0.25);
      ctx.lineTo(-S * 0.1, -S * 0.55);
      ctx.stroke();
      const wave = Math.sin(t / 300) * S * 0.04;
      ctx.fillStyle = '#e8b33a';
      ctx.beginPath();
      ctx.moveTo(-S * 0.1, -S * 0.55);
      ctx.quadraticCurveTo(S * 0.12, -S * 0.5 + wave, S * 0.32, -S * 0.45);
      ctx.lineTo(-S * 0.1, -S * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.font = `${S * 0.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', S * 0.05, -S * 0.42);
      break;
    }
  }
  ctx.restore();
}

// ---------- The map view ----------
export class MapView {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  size = 34;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  w = 0;
  h = 0;
  cam = { x: 0, y: 0 };
  private camTarget = { x: 0, y: 0 };
  private follow = true;
  private cache = new Map<string, HTMLCanvasElement>();
  private player = { x: 0, y: 0, hop: 0 };
  private moveAnim: { from: { x: number; y: number }; to: { x: number; y: number }; t0: number; dur: number; resolve: () => void } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  private pinch: { d: number; size: number } | null = null;
  private flash: { h: Hex; t: number; ok: boolean } | null = null;
  onTap: (h: Hex) => void = () => {};
  /** title-screen mode: slow drifting camera, no player token */
  demo = false;
  onFollowChange: (following: boolean) => void = () => {};
  onLongPress: (h: Hex, x: number, y: number) => void = () => {};
  /** Render at full rate until this time; otherwise idle at a low ambient rate (battery saver). */
  private wakeUntil = 0;
  private lastDraw = 0;
  private longTimer: ReturnType<typeof setTimeout> | null = null;
  private longFired = false;

  /** Ask for smooth redraws for a moment (input, state changes). */
  invalidate(ms = 700) {
    this.wakeUntil = Math.max(this.wakeUntil, performance.now() + ms);
  }

  constructor(canvas: HTMLCanvasElement, private getState: () => GameState | null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    this.bindInput();
    const loop = (t: number) => {
      const settling = Math.abs(this.camTarget.x - this.cam.x) + Math.abs(this.camTarget.y - this.cam.y) > 0.4;
      const busy = this.moveAnim || settling || this.flash || t < this.wakeUntil || this.pointers.size > 0 || (this.demo && !reducedMotion());
      // Battery saver: full frame rate only while something moves; ambient effects at ~12fps; none with reduced motion.
      const ambientDue = !reducedMotion() && t - this.lastDraw > 83;
      if (busy || ambientDue || this.lastDraw === 0) {
        this.lastDraw = t;
        this.draw(t);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    const auto = Math.max(26, Math.min(44, this.w / 11));
    if (!this.userZoomed) this.setSize(auto);
    this.invalidate();
  }

  /** Height of the bars drawn over the map (HUD on top, dock below). */
  private insetTop = 0;
  private insetBottom = 0;
  /** The map runs under the translucent bars: keep the hero centred in what's actually visible. */
  setInsets(top: number, bottom: number) {
    if (top === this.insetTop && bottom === this.insetBottom) return;
    const was = this.viewShift;
    this.insetTop = top;
    this.insetBottom = bottom;
    const d = this.viewShift - was;
    this.cam.y -= d;
    this.camTarget.y -= d;
    this.invalidate();
  }
  /** How far below the canvas centre the visible area's centre sits. */
  private get viewShift() { return (this.insetTop - this.insetBottom) / 2; }

  private userZoomed = false;
  private setSize(s: number) {
    const old = this.size;
    this.size = Math.max(20, Math.min(64, s));
    this.invalidate();
    if (old !== this.size) {
      this.cache.clear();
      const k = this.size / old;
      this.cam.x *= k; this.cam.y *= k; this.camTarget.x *= k; this.camTarget.y *= k;
      this.player.x *= k; this.player.y *= k;
    }
  }

  snapTo(h: Hex) {
    const p = toPixel(h, this.size);
    this.player.x = p.x;
    this.player.y = p.y;
    this.cam = { x: p.x, y: p.y - this.viewShift };
    this.camTarget = { ...this.cam };
    this.follow = true;
    this.onFollowChange(true);
    this.invalidate();
  }

  recenter() {
    this.invalidate();
    this.follow = true;
    this.onFollowChange(true);
  }

  animateMove(from: Hex, to: Hex, dur = 260): Promise<void> {
    return new Promise((resolve) => {
      this.moveAnim = { from: toPixel(from, this.size), to: toPixel(to, this.size), t0: performance.now(), dur, resolve };
      this.follow = true;
    });
  }

  flashTile(h: Hex, ok: boolean) {
    this.flash = { h, t: performance.now(), ok };
  }

  screenOf(h: Hex) {
    const p = toPixel(h, this.size);
    return { x: p.x - this.cam.x + this.w / 2, y: p.y - this.cam.y + this.h / 2 };
  }

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.invalidate();
      if (this.pointers.size === 1) {
        this.dragStart = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false };
        this.longFired = false;
        if (this.longTimer) clearTimeout(this.longTimer);
        const { clientX, clientY } = e;
        this.longTimer = setTimeout(() => {
          if (!this.dragStart || this.dragStart.moved || this.pointers.size !== 1) return;
          this.longFired = true;
          this.onLongPress(this.hexAt(clientX, clientY), clientX, clientY);
        }, 450);
      } else if (this.longTimer) clearTimeout(this.longTimer);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), size: this.size };
        if (this.dragStart) this.dragStart.moved = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.userZoomed = true;
        this.setSize((this.pinch.size * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.d);
        return;
      }
      const ds = this.dragStart;
      if (!ds) return;
      const dx = e.clientX - ds.x, dy = e.clientY - ds.y;
      if (!ds.moved && Math.hypot(dx, dy) > 10) {
        ds.moved = true;
        this.follow = false;
        this.onFollowChange(false);
      }
      if (ds.moved) {
        this.cam.x = ds.cx - dx;
        this.cam.y = ds.cy - dy;
        this.camTarget = { ...this.cam };
      }
    });
    const up = (e: PointerEvent) => {
      const ds = this.dragStart;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        if (this.longTimer) clearTimeout(this.longTimer);
        if (ds && !ds.moved && e.type === 'pointerup' && !this.longFired) this.onTap(this.hexAt(e.clientX, e.clientY));
        this.longFired = false;
        this.dragStart = null;
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.userZoomed = true;
      this.setSize(this.size * (e.deltaY < 0 ? 1.1 : 0.9));
    }, { passive: false });
  }

  hexAt(clientX: number, clientY: number): Hex {
    const rect = this.canvas.getBoundingClientRect();
    const wx = clientX - rect.left - this.w / 2 + this.cam.x;
    const wy = clientY - rect.top - this.h / 2 + this.cam.y;
    return fromPixel(wx, wy, this.size);
  }

  zoom(f: number) {
    this.userZoomed = true;
    this.setSize(this.size * f);
  }

  // ----- sprite cache -----
  private sprite(id: string, draw: (ctx: Ctx, cx: number, cy: number, s: number) => void) {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const s = this.size * this.dpr;
    const pad = s * 0.9;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(SQRT3 * s + 4);
    cv.height = Math.ceil(2 * s + pad + s * 0.3 + 4);
    const ctx = cv.getContext('2d')!;
    draw(ctx, cv.width / 2, pad + s + 2, s);
    this.cache.set(id, cv);
    return cv;
  }

  private tileSprite(biome: Biome, style: string, variant: number, rmask: number, lm: boolean) {
    return this.sprite(`t:${biome}:${style}:${variant}:${rmask}:${lm ? 1 : 0}`, (ctx, cx, cy, s) => {
      const [light, dark, ext] = palette(biome, style);
      const depth = biome === 'deep' || biome === 'water' ? s * 0.08 : s * 0.2;
      hexPath(ctx, cx, cy + depth, s - 0.5);
      ctx.fillStyle = ext;
      ctx.fill();
      hexPath(ctx, cx, cy, s - 0.5);
      const g = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
      g.addColorStop(0, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      hexPath(ctx, cx, cy, s - 0.5);
      ctx.clip();
      const r = mulberry32(hash2(variant, biome.length + style.length * 7, 77));
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 14; i++) ctx.fillRect(cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s * 1.6, s * 0.05, s * 0.05);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let i = 0; i < 14; i++) ctx.fillRect(cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s * 1.6, s * 0.05, s * 0.05);
      ctx.restore();
      hexPath(ctx, cx, cy, s - 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.stroke();
      hexPath(ctx, cx, cy, s - 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const dr = mulberry32(hash2(variant, biome.charCodeAt(0) + style.charCodeAt(0) * 31, 1234 + rmask));
      const isRiver = (rmask & 64) !== 0;
      const segs = isRiver ? riverSegments(rmask & 63, cx, cy, s) : [];
      if (isRiver) drawRiver(ctx, rmask & 63, cx, cy, s, dr);
      const avoid = (x: number, y: number) => {
        if (lm && Math.hypot(x - cx, y - cy) < s * 0.36) return true;
        for (const [x0, y0, x1, y1] of segs) {
          const dx = x1 - x0, dy = y1 - y0;
          const k = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
          if (Math.hypot(x - (x0 + dx * k), y - (y0 + dy * k)) < s * 0.2) return true;
        }
        return false;
      };
      decorate(ctx, biome, style, cx, cy, s, dr, avoid);
    });
  }

  private fogSprite(variant: number) {
    return this.sprite(`fog:${variant}`, (ctx, cx, cy, s) => {
      hexPath(ctx, cx, cy, s - 0.5);
      const g = ctx.createRadialGradient(cx, cy - s * 0.3, s * 0.1, cx, cy, s * 1.1);
      g.addColorStop(0, '#2c3150');
      g.addColorStop(1, '#1a1d33');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,166,74,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const r = mulberry32(variant * 99 + 7);
      ctx.save();
      hexPath(ctx, cx, cy, s - 0.5);
      ctx.clip();
      ctx.fillStyle = 'rgba(200,210,255,0.05)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx + (r() - 0.5) * s, cy + (r() - 0.5) * s, s * (0.25 + r() * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // ----- render -----
  draw(now: number) {
    // With reduced motion, ambient animation (fires, glows, bobbing) freezes.
    const t = reducedMotion() ? 0 : now;
    const s = this.getState();
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // background
    const bg = ctx.createRadialGradient(this.w / 2, this.h / 2, 10, this.w / 2, this.h / 2, Math.max(this.w, this.h));
    bg.addColorStop(0, '#171a2e');
    bg.addColorStop(1, '#0a0b16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!s) return;
    const size = this.size;

    // player animation
    if (this.moveAnim) {
      const m = this.moveAnim;
      const k = Math.min(1, (now - m.t0) / m.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.player.x = m.from.x + (m.to.x - m.from.x) * e;
      this.player.y = m.from.y + (m.to.y - m.from.y) * e;
      this.player.hop = Math.sin(k * Math.PI) * size * 0.35;
      if (k >= 1) {
        this.moveAnim = null;
        this.player.hop = 0;
        m.resolve();
      }
    } else {
      const p = toPixel(s.pos, size);
      this.player.x = p.x;
      this.player.y = p.y;
    }
    if (this.demo) {
      this.camTarget.x += size * 0.012;
      this.camTarget.y += size * 0.004;
    } else if (this.follow) this.camTarget = { x: this.player.x, y: this.player.y + size * 0.4 - this.viewShift };
    this.cam.x += (this.camTarget.x - this.cam.x) * 0.15;
    this.cam.y += (this.camTarget.y - this.cam.y) * 0.15;
    const ox = this.w / 2 - this.cam.x, oy = this.h / 2 - this.cam.y;

    const rowH = size * 1.5;
    const rMin = Math.floor((this.cam.y - this.h / 2) / rowH) - 2;
    const rMax = Math.ceil((this.cam.y + this.h / 2) / rowH) + 2;
    const sw = SQRT3 * size;
    const vision = visionRadius(s.pos, s.seed);
    const pad = size * this.dpr * 0.9;
    const reach = new Set(
      neighbors(s.pos).filter((n) => isPassable(n, s.seed) && moveCost(n, s.seed) <= s.stamina && (this.demo || canEnter(s, n))).map(key),
    );

    const pois: { kind: PoiKind | 'quest'; x: number; y: number; done: boolean }[] = [];
    const blocked: { icon: string; x: number; y: number }[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const qMin = Math.floor((this.cam.x - this.w / 2) / sw - r / 2) - 2;
      const qMax = Math.ceil((this.cam.x + this.w / 2) / sw - r / 2) + 2;
      for (let q = qMin; q <= qMax; q++) {
        const hx = { q, r };
        const k = key(hx);
        const p = toPixel(hx, size);
        const x = p.x + ox, y = p.y + oy;
        const hv = hash2(q, r, s.seed);
        const variant = hv % 6;
        let img: HTMLCanvasElement;
        const revealed = s.revealed[k] === 1;
        let biome: Biome = 'grass';
        let lm: ReturnType<typeof landmarkAt> = null;
        if (revealed) {
          biome = biomeAt(hx, s.seed);
          lm = landmarkAt(hx, s.seed);
          const rm = riverAt(hx, s.seed) ? riverMask(hx, s.seed) | 64 : 0;
          img = this.tileSprite(biome, styleAt(hx, s.seed), variant, rm, !!lm);
        }
        else {
          let near = false;
          for (const n of neighbors(hx)) if (s.revealed[key(n)]) { near = true; break; }
          if (!near) continue;
          img = this.fogSprite(variant);
        }
        ctx.drawImage(img, x - img.width / this.dpr / 2, y - (pad + size * this.dpr + 2) / this.dpr, img.width / this.dpr, img.height / this.dpr);
        if (!revealed) continue;
        if (biome === 'water' || biome === 'deep') waterGlint(ctx, x, y, size, t, (hv % 1000) / 160);
        if (lm) drawLandmark(ctx, lm, x, y, size, t, hv % 7);
        if (!this.demo && distance(hx, s.pos) > vision) {
          hexPath(ctx, x, y, size - 0.5);
          ctx.fillStyle = 'rgba(10,12,30,0.32)';
          ctx.fill();
        }
        const bl = this.demo ? null : blockAt(s, hx);
        if (bl) blocked.push({ icon: BLOCK_INFO[bl.kind].icon, x, y });
        const poi = poiAt(hx, s.seed);
        const isQuest = s.quest && s.quest.target.q === q && s.quest.target.r === r;
        if (isQuest) pois.push({ kind: 'quest', x, y, done: false });
        else if (poi) pois.push({ kind: poi, x, y, done: !!s.tiles[k]?.done });
        if (reach.has(k) && !this.demo) {
          hexPath(ctx, x, y, size - 3);
          ctx.strokeStyle = `rgba(255,230,160,${0.35 + 0.25 * Math.sin(t / 350)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    for (const p of pois) {
      ctx.globalAlpha = p.done ? 0.5 : 1;
      drawPoi(ctx, p.kind, p.x, p.y, size, t);
      ctx.globalAlpha = 1;
      if (p.done) {
        ctx.fillStyle = 'rgba(30,30,40,0.7)';
        ctx.beginPath();
        ctx.arc(p.x + size * 0.38, p.y - size * 0.35, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9fe39f';
        ctx.font = `bold ${size * 0.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', p.x + size * 0.38, p.y - size * 0.34);
      }
    }

    for (const b of blocked) drawBlock(ctx, b.icon, b.x, b.y, size, t);

    // tap flash
    if (this.flash) {
      const k = (now - this.flash.t) / 400;
      if (k > 1) this.flash = null;
      else {
        const p = toPixel(this.flash.h, size);
        hexPath(ctx, p.x + ox, p.y + oy, size - 2);
        ctx.fillStyle = this.flash.ok ? `rgba(255,240,180,${0.4 * (1 - k)})` : `rgba(255,80,80,${0.45 * (1 - k)})`;
        ctx.fill();
      }
    }

    // quest beacon (visible through fog)
    if (s.quest && !this.demo) {
      const qp = toPixel(s.quest.target, size);
      const x = qp.x + ox, y = qp.y + oy;
      const g = ctx.createLinearGradient(x, y - size * 4, x, y);
      const a = 0.25 + 0.12 * Math.sin(t / 500);
      g.addColorStop(0, 'rgba(255,215,106,0)');
      g.addColorStop(1, `rgba(255,215,106,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - size * 0.22, y - size * 4, size * 0.44, size * 4);
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,215,106,${a})`;
      ctx.fill();
      this.drawEdgeArrow(x, y, t, distance(s.pos, s.quest.target));
    }

    if (this.demo) return;
    // companions
    const allies = party(s);
    allies.forEach((a, i) => {
      const ang = t / 1200 + i * Math.PI;
      const ax = this.player.x + ox + Math.cos(ang) * size * 0.55;
      const ay = this.player.y + oy + size * 0.15 + Math.sin(ang) * size * 0.18;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ax, ay + size * 0.16, size * 0.14, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsl(${(a.name.charCodeAt(0) * 37) % 360} 55% 55%)`;
      ctx.beginPath();
      ctx.arc(ax, ay, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${size * 0.17}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.name[0], ax, ay + 1);
    });

    // player token
    const cls = CLASSES[s.player.cls];
    const px = this.player.x + ox;
    const bob = Math.sin(t / 400) * size * 0.04;
    const py = this.player.y + oy - this.player.hop - size * 0.18 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(this.player.x + ox, this.player.y + oy + size * 0.18, size * 0.3 - this.player.hop * 0.15, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(px, py, size * 0.1, px, py, size * 0.7);
    glow.addColorStop(0, cls.color + '88');
    glow.addColorStop(1, cls.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // pawn body
    ctx.fillStyle = cls.color;
    ctx.beginPath();
    ctx.moveTo(px - size * 0.24, py + size * 0.22);
    ctx.quadraticCurveTo(px - size * 0.2, py - size * 0.05, px, py - size * 0.08);
    ctx.quadraticCurveTo(px + size * 0.2, py - size * 0.05, px + size * 0.24, py + size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py - size * 0.22, size * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff8e0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff8e0';
    ctx.font = `bold ${size * 0.2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cls.glyph, px, py - size * 0.21);
  }

  private drawEdgeArrow(x: number, y: number, t: number, dist: number) {
    const m = 34;
    const top = this.insetTop + m, bottom = this.h - this.insetBottom - m;
    if (x > m && x < this.w - m && y > top && y < bottom) return;
    const cx = this.w / 2, cy = (top + bottom) / 2;
    const dx = x - cx, dy = y - cy;
    const k = Math.min((this.w / 2 - m) / Math.abs(dx || 1e-6), Math.max(10, (bottom - top) / 2) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k, ay = cy + dy * k;
    const ang = Math.atan2(dy, dx);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(ax, ay);
    const pulse = 1 + 0.08 * Math.sin(t / 250);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(20,18,30,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8b33a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(16, -7);
    ctx.lineTo(16, 7);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-ang);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 12px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`★${dist}`, 0, 1);
    ctx.restore();
  }
}
