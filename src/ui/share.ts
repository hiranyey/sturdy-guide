// Share cards: render a 1080x1350 image (good for stories, feeds and chats) and
// hand it to the native share sheet, with a download fallback.
import { h, modal, toast } from './dom';
import { sfx } from './audio';
import { d20Svg } from './dice';
import { heroPortraitSvg } from './art/heroes';
import { CLASSES } from '../core/rules';
import { party } from '../core/state';
import { ACHIEVEMENTS, achievementCount, type AchievementDef } from '../core/achievements';
import type { GameState } from '../core/types';

const W = 1080, H = 1350;
const GOLD = '#e9bf5e', GOLD_HI = '#ffd76a', INK = '#ece6d6', MUTED = '#a7a2b4';
const HEAD = '"Cinzel", Georgia, serif', BODY = '"Alegreya", Georgia, serif';

export type ShareKind =
  | { kind: 'chapter'; day: number; recap: string; hook: string; stats: [string, string][] }
  | { kind: 'crit'; title: string; subtitle: string; total: number; dc: number }
  | { kind: 'achievement'; ach: AchievementDef }
  | { kind: 'hero' };

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 8, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align;
  const words = text.split(/\s+/);
  let line = '', lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineH;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineH;
      lines++;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

/** How many lines `wrap` would use for this text at the current font. */
function countLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  let line = '', lines = 1;
  for (const w of text.split(/\s+/)) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines++; line = w; } else line = test;
  }
  return lines;
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, '#2a2f5a');
  g.addColorStop(1, '#0b0c18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(212,166,74,0.07)';
  ctx.lineWidth = 2;
  const r = 60, dx = r * Math.sqrt(3);
  for (let row = -1; row < H / (r * 1.5) + 1; row++) {
    for (let col = -1; col < W / dx + 1; col++) {
      hexPath(ctx, col * dx + (row % 2 ? dx / 2 : 0), row * r * 1.5, r);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = 'rgba(233,191,94,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);
}

function header(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD_HI;
  ctx.font = `800 64px ${HEAD}`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 16;
  ctx.fillText('H E X B O U N D', W / 2, 130);
  ctx.shadowBlur = 0;
  ctx.fillStyle = MUTED;
  ctx.font = `italic 34px ${BODY}`;
  ctx.fillText(s.world.name, W / 2, 180);
}

async function footer(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player, cls = CLASSES[p.cls];
  const y = H - 150;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(70, y - 50, W - 140, 120);
  try {
    const img = await loadSvg(heroPortraitSvg(p.name, p.cls, 104));
    ctx.drawImage(img, 90, y - 42, 104, 104);
  } catch { /* portrait optional */ }
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${HEAD}`;
  ctx.fillText(p.name, 215, y + 2, W - 215 - 80); // long names squeeze rather than run off
  ctx.fillStyle = MUTED;
  ctx.font = `30px ${BODY}`;
  ctx.fillText(`Level ${p.level} ${cls.name} · Day ${s.day} · 🏆 ${achievementCount(s)}/${ACHIEVEMENTS.length}`, 215, y + 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = `600 26px ${HEAD}`;
  ctx.fillText(location.host || 'hexbound', W - 90, y + 44);
}

function mapSnapshot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const map = document.getElementById('map') as HTMLCanvasElement | null;
  if (!map || !map.width) return false;
  ctx.save();
  hexPath(ctx, cx, cy, r);
  ctx.clip();
  const side = Math.min(map.width, map.height) * 0.8;
  ctx.drawImage(map, (map.width - side) / 2, (map.height - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  hexPath(ctx, cx, cy, r);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.stroke();
  return true;
}

function statsRow(ctx: CanvasRenderingContext2D, stats: [string, string][], y: number) {
  const w = (W - 160) / stats.length;
  stats.forEach(([v, l], i) => {
    const x = 80 + w * i + w / 2;
    ctx.fillStyle = 'rgba(233,191,94,0.12)';
    ctx.fillRect(x - w / 2 + 8, y - 60, w - 16, 120);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD_HI;
    ctx.font = `800 52px ${HEAD}`;
    ctx.fillText(v, x, y + 4);
    ctx.fillStyle = MUTED;
    ctx.font = `26px ${BODY}`;
    ctx.fillText(l, x, y + 44);
  });
}

export async function renderShareCard(s: GameState, k: ShareKind): Promise<HTMLCanvasElement> {
  try { await document.fonts?.ready; } catch { /* ignore */ }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  background(ctx);
  header(ctx, s);

  if (k.kind === 'chapter') {
    mapSnapshot(ctx, W / 2, 400, 170);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = `600 34px ${HEAD}`;
    ctx.fillText(`DAY ${k.day} · CHAPTER COMPLETE`, W / 2, 640);
    // The stats sit just above the footer; the recap and hook shrink to fit the space above them.
    const STATS_Y = 1075, TEXT_TOP = 710, TEXT_BOTTOM = STATS_Y - 90;
    let size = 40;
    for (; size > 28; size -= 2) {
      ctx.font = `${size}px ${BODY}`;
      const recapH = Math.min(6, countLines(ctx, k.recap, W - 200)) * size * 1.35;
      ctx.font = `italic ${Math.round(size * 0.85)}px ${BODY}`;
      const hookH = Math.min(2, countLines(ctx, k.hook, W - 220)) * size * 1.15;
      if (TEXT_TOP + recapH + 16 + hookH <= TEXT_BOTTOM) break;
    }
    const recapLh = size * 1.35, hookLh = size * 1.15;
    const recapMax = Math.max(1, Math.floor((TEXT_BOTTOM - TEXT_TOP - 16 - hookLh) / recapLh));
    ctx.fillStyle = INK;
    ctx.font = `${size}px ${BODY}`;
    let y = wrap(ctx, k.recap, W / 2, TEXT_TOP, W - 200, recapLh, Math.min(6, recapMax), 'center');
    ctx.fillStyle = '#e8b07a';
    ctx.font = `italic ${Math.round(size * 0.85)}px ${BODY}`;
    const hookMax = Math.max(0, Math.min(2, Math.floor((TEXT_BOTTOM + hookLh - (y + 16)) / hookLh)));
    if (hookMax) wrap(ctx, k.hook, W / 2, y + 16, W - 220, hookLh, hookMax, 'center');
    statsRow(ctx, k.stats, STATS_Y);
  } else if (k.kind === 'crit') {
    const glow = ctx.createRadialGradient(W / 2, 520, 20, W / 2, 520, 360);
    glow.addColorStop(0, 'rgba(255,215,106,0.55)');
    glow.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 160, W, 720);
    const svg = d20Svg(20)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(/var\(--die-hi\)/g, '#fff0a8').replace(/var\(--die-mid\)/g, '#e6a92e').replace(/var\(--die-lo\)/g, '#8a5a10').replace(/var\(--die-edge\)/g, '#fff6d0')
      .replace('class="d20-num"', 'fill="#ffffff" font-family="Georgia, serif" font-weight="bold" font-size="22" stroke="#5a3a08" stroke-width="1.2"');
    try {
      const img = await loadSvg(svg);
      ctx.drawImage(img, W / 2 - 230, 290, 460, 460);
    } catch { /* ignore */ }
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD_HI;
    ctx.font = `800 96px ${HEAD}`;
    ctx.shadowColor = 'rgba(255,180,60,0.8)';
    ctx.shadowBlur = 30;
    ctx.fillText('NATURAL 20!', W / 2, 860);
    ctx.shadowBlur = 0;
    ctx.fillStyle = INK;
    ctx.font = `600 42px ${HEAD}`;
    ctx.fillText(k.title, W / 2, 940);
    ctx.fillStyle = MUTED;
    ctx.font = `italic 38px ${BODY}`;
    wrap(ctx, `“${k.subtitle}”`, W / 2, 1000, W - 220, 48, 2, 'center');
    ctx.fillStyle = INK;
    ctx.font = `36px ${BODY}`;
    ctx.fillText(`Total ${k.total} vs DC ${k.dc}`, W / 2, 1100);
  } else if (k.kind === 'achievement') {
    const cy = 560;
    const glow = ctx.createRadialGradient(W / 2, cy, 20, W / 2, cy, 330);
    glow.addColorStop(0, 'rgba(255,215,106,0.45)');
    glow.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 200, W, 720);
    hexPath(ctx, W / 2, cy, 210);
    const mg = ctx.createLinearGradient(0, cy - 210, 0, cy + 210);
    mg.addColorStop(0, '#f6d27a');
    mg.addColorStop(1, '#9a6a1c');
    ctx.fillStyle = mg;
    ctx.fill();
    hexPath(ctx, W / 2, cy, 180);
    ctx.fillStyle = '#1c1a30';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `170px ${BODY}`;
    ctx.fillStyle = GOLD_HI;
    ctx.fillText(k.ach.icon, W / 2, cy + 8);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = GOLD;
    ctx.font = `600 34px ${HEAD}`;
    ctx.fillText('ACHIEVEMENT UNLOCKED', W / 2, 860);
    ctx.fillStyle = INK;
    ctx.font = `800 70px ${HEAD}`;
    ctx.fillText(k.ach.name, W / 2, 950);
    ctx.fillStyle = MUTED;
    ctx.font = `40px ${BODY}`;
    wrap(ctx, k.ach.desc, W / 2, 1020, W - 220, 50, 2, 'center');
  } else {
    mapSnapshot(ctx, W / 2, 400, 170);
    const st = s.stats;
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = `600 34px ${HEAD}`;
    ctx.fillText(s.quest ? `NOW SEEKING: ${s.quest.title.toUpperCase()}` : 'THE TALE SO FAR', W / 2, 640);
    ctx.fillStyle = INK;
    ctx.font = `40px ${BODY}`;
    const last = s.chapters[s.chapters.length - 1]?.recap ?? s.world.hook;
    wrap(ctx, last, W / 2, 710, W - 200, 54, 5, 'center');
    const allies = party(s).map((n) => n.name.split(' ')[0]);
    statsRow(ctx, [
      [String(s.questsDone), 'quests'],
      [String(st.kills), 'foes'],
      [String(st.crits), 'nat 20s'],
      [String(allies.length ? allies.length : st.friends), allies.length ? 'companions' : 'friends'],
    ], 1060);
  }
  await footer(ctx, s);
  return cv;
}

const caption = (s: GameState, k: ShareKind) => {
  if (k.kind === 'chapter') return `Day ${k.day} of my Hexbound saga: ${k.recap}`;
  if (k.kind === 'crit') return `Natural 20! ${s.player.name} nailed a ${k.title.toLowerCase()} in Hexbound.`;
  if (k.kind === 'achievement') return `Achievement unlocked in Hexbound: ${k.ach.icon} ${k.ach.name}`;
  return `${s.player.name}, level ${s.player.level} ${CLASSES[s.player.cls].name}, adventuring in ${s.world.name}.`;
};

/** Render, preview, and share (or download) a card. */
export async function shareCard(s: GameState, k: ShareKind) {
  sfx.tap();
  const m = modal('share');
  m.card.append(h('div', { class: 'spin-die small-spin' }), h('p', { class: 'muted' }, 'Painting your card…'));
  const cv = await renderShareCard(s, k);
  const blob: Blob | null = await new Promise((r) => cv.toBlob(r, 'image/png'));
  m.card.innerHTML = '';
  if (!blob) {
    m.close();
    return toast('Could not create the image.', 'bad');
  }
  const file = new File([blob], `hexbound-${k.kind}.png`, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const text = caption(s, k);
  const canShareFiles = !!navigator.canShare?.({ files: [file] });
  const close = () => { m.close(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  m.card.append(
    h('img', { src: url, alt: text, class: 'share-preview' }),
    ...(canShareFiles ? [h('button', { class: 'btn btn-primary', onclick: async () => {
          try {
            await navigator.share({ files: [file], title: 'Hexbound', text });
            close();
          } catch (e) {
            if ((e as Error).name !== 'AbortError') toast('Sharing failed — try Save image.', 'bad');
          }
        } }, '📤 Share')] : []),
    h('a', { class: `btn ${canShareFiles ? '' : 'btn-primary'}`, href: url, download: file.name, onclick: () => toast('Image saved', 'good') }, '⬇️ Save image'),
    h('button', { class: 'btn', onclick: async () => {
      try { await navigator.clipboard.writeText(text); toast('Caption copied', 'good'); } catch { toast(text, 'info', 5000); }
    } }, '📋 Copy caption'),
    h('button', { class: 'btn', onclick: close }, 'Close'),
  );
}
