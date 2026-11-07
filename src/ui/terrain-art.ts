// Procedural vector art for hex tiles: palettes per sub-style, decorations, rivers and midhex landmarks.
import type { Biome } from '../core/types';
import type { LandmarkKind } from '../core/terrain';

export type Ctx = CanvasRenderingContext2D;

export function hexPath(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = cx + s * Math.cos(a), y = cy + s * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const BASE: Record<Biome, [string, string, string]> = {
  deep: ['#28508f', '#173465', '#0d1f40'],
  water: ['#3f8cc9', '#2a69a3', '#1b4672'],
  sand: ['#f0dba0', '#d8b874', '#a9884b'],
  grass: ['#93c55a', '#68a03c', '#476e2a'],
  forest: ['#5f9a45', '#3e7530', '#2a4f20'],
  swamp: ['#7b9160', '#556b45', '#3a4a30'],
  hills: ['#b9c06e', '#939a52', '#686e39'],
  mountain: ['#9a9aa8', '#74747f', '#4e4e58'],
  snow: ['#f3f7fc', '#cdd9ea', '#94a6c0'],
  desert: ['#f2c46d', '#d99f4c', '#a8733a'],
};

const STYLE_PALETTE: Record<string, [string, string, string]> = {
  'grass:bloom': ['#a2d061', '#74aa42', '#4b722b'],
  'grass:steppe': ['#cfc47c', '#a99e58', '#78703c'],
  'grass:farm': ['#a9c85e', '#82a843', '#56742c'],
  'forest:pine': ['#4f8a4c', '#2f6a3a', '#204a28'],
  'forest:autumn': ['#b59a4e', '#8a7236', '#5e4c22'],
  'forest:birch': ['#9cc864', '#76a446', '#4f722e'],
  'forest:jungle': ['#3fa055', '#22743c', '#164e28'],
  'hills:heather': ['#b2a77a', '#8d8158', '#635a3c'],
  'hills:rocky': ['#aaa28c', '#867e69', '#5d5747'],
  'mountain:red': ['#b47a66', '#8c5444', '#5f372c'],
  'mountain:volcanic': ['#5e4e4e', '#3b2e2e', '#221818'],
  'snow:ice': ['#dcf0fc', '#a9cdea', '#7a9cc0'],
  'snow:tundra': ['#ccd5c6', '#a3ae9d', '#76816e'],
  'desert:mesa': ['#e09a62', '#bb6e42', '#84482a'],
  'desert:saltflat': ['#f2ede2', '#d9d0bd', '#a99f8b'],
  'swamp:mangrove': ['#62905c', '#3f6c46', '#294a2f'],
  'swamp:dead': ['#7f7e6b', '#5c5b4c', '#3f3e33'],
  'sand:pebble': ['#ddd1b5', '#bbae8e', '#8a7e62'],
  'water:lily': ['#3f94c4', '#2a729f', '#1b4a70'],
  'deep:kelp': ['#24548a', '#173863', '#0d203f'],
};

export function palette(biome: Biome, style: string): [string, string, string] {
  return STYLE_PALETTE[`${biome}:${style}`] ?? BASE[biome];
}

// ---------- Primitive helpers ----------
function circ(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, a0 = 0, a1 = Math.PI * 2) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, a0, a1);
  ctx.fill();
}
function poly(ctx: Ctx, pts: number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
function line(ctx: Ctx, pts: number[], stroke: string, w: number) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

// ---------- Trees & peaks ----------
type TreeKind = 'pine' | 'round' | 'birch' | 'palm' | 'dead' | 'mangrove';
function tree(ctx: Ctx, x: number, y: number, s: number, kind: TreeKind, leaf = '#2f6b2f', leaf2 = '#4c9a43', snow = false) {
  if (kind === 'pine') {
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(x - s * 0.04, y - s * 0.08, s * 0.08, s * 0.12);
    for (const [w, top] of [[0.26, 0.28], [0.21, 0.42], [0.15, 0.55]]) {
      poly(ctx, [x - s * w, y - s * (top - 0.2), x, y - s * top - s * 0.06, x + s * w, y - s * (top - 0.2)], '#2d6a35');
      poly(ctx, [x - s * w, y - s * (top - 0.2), x, y - s * top - s * 0.06, x, y - s * (top - 0.2)], snow ? '#e8f0f8' : '#3f8a46');
    }
  } else if (kind === 'round') {
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(x - s * 0.035, y - s * 0.12, s * 0.07, s * 0.16);
    circ(ctx, x, y - s * 0.24, s * 0.19, leaf);
    circ(ctx, x - s * 0.06, y - s * 0.29, s * 0.11, leaf2);
  } else if (kind === 'birch') {
    ctx.fillStyle = '#f2f0e6';
    ctx.fillRect(x - s * 0.025, y - s * 0.3, s * 0.05, s * 0.34);
    ctx.fillStyle = '#333';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - s * 0.025, y - s * (0.08 + i * 0.08), s * 0.03, s * 0.015);
    ell(ctx, x, y - s * 0.36, s * 0.12, s * 0.17, '#8fc254');
    ell(ctx, x - s * 0.03, y - s * 0.4, s * 0.06, s * 0.09, '#b4dc78');
  } else if (kind === 'palm') {
    line(ctx, [x, y, x + s * 0.04, y - s * 0.2, x + s * 0.02, y - s * 0.38], '#8a6236', s * 0.045);
    const tx = x + s * 0.02, ty = y - s * 0.38;
    for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1]) {
      ctx.strokeStyle = '#2f8a3a';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.14, ty + Math.sin(a) * s * 0.14 - s * 0.04, tx + Math.cos(a) * s * 0.24, ty + Math.sin(a) * s * 0.18 + s * 0.06);
      ctx.stroke();
    }
  } else if (kind === 'dead') {
    line(ctx, [x, y, x, y - s * 0.38], '#5d5446', s * 0.05);
    line(ctx, [x, y - s * 0.2, x - s * 0.13, y - s * 0.32], '#5d5446', s * 0.03);
    line(ctx, [x, y - s * 0.28, x + s * 0.12, y - s * 0.4], '#5d5446', s * 0.03);
    line(ctx, [x - s * 0.08, y - s * 0.27, x - s * 0.08, y - s * 0.36], '#5d5446', s * 0.02);
  } else {
    // mangrove: arching roots
    ctx.strokeStyle = '#6b5235';
    ctx.lineWidth = s * 0.025;
    for (const dx of [-0.12, -0.05, 0.05, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(x + s * dx, y);
      ctx.quadraticCurveTo(x + s * dx * 0.5, y - s * 0.14, x, y - s * 0.16);
      ctx.stroke();
    }
    line(ctx, [x, y - s * 0.16, x, y - s * 0.24], '#6b5235', s * 0.04);
    ell(ctx, x, y - s * 0.32, s * 0.2, s * 0.12, '#2f6a3a');
    ell(ctx, x - s * 0.05, y - s * 0.35, s * 0.1, s * 0.06, '#4f8f50');
  }
}

function peak(ctx: Ctx, x: number, base: number, w: number, hgt: number, dark: string, light: string, cap: string | null) {
  poly(ctx, [x - w, base, x, base - hgt, x + w, base], dark);
  poly(ctx, [x - w, base, x, base - hgt, x + w * 0.15, base], light);
  if (cap) poly(ctx, [x - w * 0.36, base - hgt * 0.64, x, base - hgt, x + w * 0.36, base - hgt * 0.64, x + w * 0.12, base - hgt * 0.7, x - w * 0.05, base - hgt * 0.6, x - w * 0.2, base - hgt * 0.7], cap);
}

// ---------- Rivers ----------
const SQ = Math.sqrt(3) / 2;
export function riverSegments(mask: number, cx: number, cy: number, s: number) {
  const segs: [number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    if (!(mask & (1 << i))) continue;
    const a = (-60 * i * Math.PI) / 180;
    segs.push([cx, cy, cx + Math.cos(a) * s * SQ, cy + Math.sin(a) * s * SQ]);
  }
  return segs;
}

export function drawRiver(ctx: Ctx, mask: number, cx: number, cy: number, s: number, r: () => number) {
  const segs = riverSegments(mask, cx, cy, s);
  const layers: [string, number][] = [['#7a6a48', 0.24], ['#3f8fd0', 0.16], ['#7cc4f0', 0.07]];
  if (segs.length === 0) {
    ell(ctx, cx, cy, s * 0.28, s * 0.16, '#7a6a48');
    ell(ctx, cx, cy, s * 0.24, s * 0.13, '#3f8fd0');
    ell(ctx, cx - s * 0.05, cy - s * 0.03, s * 0.1, s * 0.04, '#7cc4f0');
    return;
  }
  const bends = segs.map(() => (r() - 0.5) * s * 0.25);
  for (const [col, w] of layers) {
    ctx.strokeStyle = col;
    ctx.lineWidth = s * w;
    ctx.lineCap = 'round';
    for (let i = 0; i < segs.length; i++) {
      const [x0, y0, x1, y1] = segs[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const nx = -(y1 - y0), ny = x1 - x0;
      const len = Math.hypot(nx, ny) || 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx + (nx / len) * bends[i], my + (ny / len) * bends[i], x1, y1);
      ctx.stroke();
    }
    circ(ctx, cx, cy, (s * w) / 2, col);
  }
  if (segs.length === 1) {
    ell(ctx, cx, cy, s * 0.16, s * 0.1, '#3f8fd0');
  }
}

// ---------- Decorations ----------
export function decorate(ctx: Ctx, biome: Biome, style: string, cx: number, cy: number, s: number, r: () => number, avoid: (x: number, y: number) => boolean) {
  const inHex = (): [number, number] => {
    for (let k = 0; k < 10; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * s * 0.58;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.85;
      if (!avoid(x, y)) return [x, y];
    }
    return [NaN, NaN];
  };
  const pts = (n: number) => Array.from({ length: n }, inHex).filter(([x]) => !Number.isNaN(x)).sort((a, b) => a[1] - b[1]);
  const id = `${biome}:${style}`;
  ctx.lineCap = 'round';

  const tufts = (n: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, s * 0.04);
    for (const [x, y] of pts(n)) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.05, y - s * 0.07);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s * 0.05, y - s * 0.08);
      ctx.stroke();
    }
  };
  const dots = (n: number, cols: string[], rad: number) => {
    for (const [x, y] of pts(n)) circ(ctx, x, y, s * rad, cols[Math.floor(r() * cols.length)]);
  };

  switch (id) {
    case 'grass:meadow':
      tufts(7, '#4f8a2d');
      if (r() < 0.45) dots(4, [['#ffe36e', '#ff8fa3', '#ffffff', '#c39bff'][Math.floor(r() * 4)]], 0.035);
      return;
    case 'grass:bloom':
      tufts(5, '#4f8a2d');
      dots(14, ['#ffe36e', '#ff8fa3', '#ffffff', '#c39bff', '#ff7a4a'], 0.035);
      return;
    case 'grass:steppe':
      tufts(9, '#8f8238');
      dots(3, ['#9a917c', '#86806e'], 0.04);
      return;
    case 'grass:farm': {
      ctx.save();
      hexPath(ctx, cx, cy, s * 0.92);
      ctx.clip();
      const ang = r() < 0.5 ? 0.5 : -0.5;
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const crop = r() < 0.5 ? '#d9b94a' : '#7fae45';
      for (let i = -5; i <= 5; i++) {
        ctx.fillStyle = i % 2 ? crop : 'rgba(110,80,40,0.25)';
        ctx.fillRect(-s * 1.2, i * s * 0.12 - s * 0.03, s * 2.4, s * 0.07);
      }
      ctx.restore();
      return;
    }
    case 'forest:pine':
      for (const [x, y] of pts(6)) tree(ctx, x, y + s * 0.15, s * (0.8 + r() * 0.3), 'pine');
      return;
    case 'forest:broadleaf':
      for (const [x, y] of pts(5)) tree(ctx, x, y + s * 0.15, s * (0.85 + r() * 0.3), r() < 0.7 ? 'round' : 'pine');
      return;
    case 'forest:autumn': {
      const cols: [string, string][] = [['#c4561e', '#e8843a'], ['#d4a020', '#f0c850'], ['#a8301e', '#d4583a'], ['#7a8a2a', '#a4b048']];
      for (const [x, y] of pts(5)) {
        const [a, b] = cols[Math.floor(r() * cols.length)];
        tree(ctx, x, y + s * 0.15, s * (0.85 + r() * 0.3), 'round', a, b);
      }
      dots(5, ['#d4782a', '#c4561e', '#e8b040'], 0.03);
      return;
    }
    case 'forest:birch':
      for (const [x, y] of pts(6)) tree(ctx, x, y + s * 0.15, s * (0.8 + r() * 0.3), 'birch');
      return;
    case 'forest:jungle':
      for (const [x, y] of pts(5)) {
        if (r() < 0.5) tree(ctx, x, y + s * 0.15, s * (0.9 + r() * 0.3), 'palm');
        else tree(ctx, x, y + s * 0.15, s * (0.95 + r() * 0.3), 'round', '#1f6a34', '#3aa050');
      }
      for (const [x, y] of pts(3)) {
        ell(ctx, x, y, s * 0.1, s * 0.05, '#2a8a40');
        ell(ctx, x + s * 0.06, y - s * 0.02, s * 0.08, s * 0.04, '#46b05a');
      }
      return;
    case 'hills:green':
    case 'hills:heather':
    case 'hills:rocky': {
      const [hump, hi] = style === 'rocky' ? ['#7a735f', '#b4ac94'] : style === 'heather' ? ['#7c7448', '#c0b884'] : ['#7f8a45', '#c4cc80'];
      for (const [x, y] of pts(3)) {
        const w = s * (0.22 + r() * 0.1);
        ell(ctx, x, y, w, w * 0.65, hump, Math.PI, 0);
        ell(ctx, x - w * 0.25, y - w * 0.1, w * 0.55, w * 0.45, hi, Math.PI, 0);
      }
      if (style === 'heather') dots(12, ['#9a5fb8', '#b87ad0', '#7a4a9a'], 0.03);
      if (style === 'rocky') for (const [x, y] of pts(3)) { ell(ctx, x, y, s * 0.07, s * 0.05, '#8a8478'); ell(ctx, x - s * 0.02, y - s * 0.015, s * 0.04, s * 0.025, '#b4ae9e'); }
      return;
    }
    case 'mountain:grey':
    case 'mountain:red': {
      const [d, l, cap] = style === 'red' ? ['#7a4234', '#c08068', r() < 0.3 ? '#f4f0ea' : null] : ['#6a6a78', '#a9a9b8', '#f4f7fb'];
      if (r() < 0.5) peak(ctx, cx + (r() - 0.5) * s * 0.2, cy + s * 0.45, s * 0.55, s * (1.05 + r() * 0.25), d, l, cap);
      else {
        peak(ctx, cx - s * 0.25, cy + s * 0.35, s * 0.4, s * 0.8, d, l, r() < 0.6 ? cap : null);
        peak(ctx, cx + s * 0.22, cy + s * 0.5, s * 0.45, s * 1.0, d, l, cap);
      }
      return;
    }
    case 'mountain:volcanic': {
      if (r() < 0.45) {
        // ash field with glowing fissures
        for (const [x, y] of pts(4)) { ell(ctx, x, y, s * 0.07, s * 0.045, '#2a2222'); ell(ctx, x - s * 0.02, y - s * 0.015, s * 0.035, s * 0.02, '#5a4a4a'); }
        for (let i = 0; i < 2; i++) {
          const [x, y] = inHex();
          if (Number.isNaN(x)) continue;
          const pts2 = [x - s * 0.2, y, x - s * 0.08, y - s * 0.04, x + s * 0.02, y + s * 0.02, x + s * 0.18, y - s * 0.03];
          line(ctx, pts2, '#ff6a1a', s * 0.04);
          line(ctx, pts2, '#ffd36a', s * 0.015);
        }
        return;
      }
      const k = 0.75 + r() * 0.45;
      const base = cy + s * 0.45;
      const ox = (r() - 0.5) * s * 0.2;
      ctx.save();
      ctx.translate(cx + ox, base);
      ctx.scale(k, k);
      ctx.translate(-cx, -base);
      poly(ctx, [cx - s * 0.6, base, cx - s * 0.14, base - s * 0.95, cx + s * 0.14, base - s * 0.95, cx + s * 0.6, base], '#3a2c2c');
      poly(ctx, [cx - s * 0.6, base, cx - s * 0.14, base - s * 0.95, cx, base - s * 0.95, cx - s * 0.05, base], '#5a4848');
      ell(ctx, cx, base - s * 0.95, s * 0.14, s * 0.05, '#ff7a1a');
      ell(ctx, cx, base - s * 0.95, s * 0.08, s * 0.025, '#ffd36a');
      line(ctx, [cx + s * 0.02, base - s * 0.92, cx + s * 0.1, base - s * 0.6, cx + s * 0.04, base - s * 0.35, cx + s * 0.14, base - s * 0.1], '#ff6a1a', s * 0.04);
      ctx.restore();
      return;
    }
    case 'snow:drift':
      if (r() < 0.5) for (const [x, y] of pts(3)) tree(ctx, x, y + s * 0.15, s * 0.85, 'pine', '', '', true);
      else for (const [x, y] of pts(3)) ell(ctx, x, y, s * 0.2, s * 0.08, '#b7c7de', Math.PI, 0);
      dots(6, ['#ffffff'], 0.02);
      return;
    case 'snow:ice': {
      ctx.strokeStyle = 'rgba(90,140,200,0.55)';
      ctx.lineWidth = Math.max(1, s * 0.025);
      for (let i = 0; i < 4; i++) {
        const [x, y] = inHex();
        if (Number.isNaN(x)) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * s * 0.4, y + (r() - 0.5) * s * 0.25);
        ctx.lineTo(x + (r() - 0.5) * s * 0.5, y + (r() - 0.5) * s * 0.3);
        ctx.stroke();
      }
      for (const [x, y] of pts(3)) poly(ctx, [x - s * 0.05, y, x, y - s * 0.12, x + s * 0.05, y], 'rgba(255,255,255,0.8)');
      return;
    }
    case 'snow:tundra':
      for (const [x, y] of pts(5)) { circ(ctx, x, y, s * 0.05, '#5f7a52'); circ(ctx, x - s * 0.02, y - s * 0.02, s * 0.025, '#7f9a6a'); }
      for (const [x, y] of pts(3)) ell(ctx, x, y, s * 0.12, s * 0.05, '#eef3f8');
      dots(3, ['#8a8478'], 0.035);
      return;
    case 'desert:dunes': {
      ctx.strokeStyle = '#c4843a';
      ctx.lineWidth = Math.max(1, s * 0.045);
      for (const [x, y] of pts(3)) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y);
        ctx.quadraticCurveTo(x, y - s * 0.16, x + s * 0.25, y);
        ctx.stroke();
      }
      if (r() < 0.35) for (const [x, y] of pts(1)) {
        ctx.fillStyle = '#4c8a3c';
        ctx.fillRect(x - s * 0.04, y - s * 0.3, s * 0.08, s * 0.3);
        ctx.fillRect(x - s * 0.15, y - s * 0.2, s * 0.06, s * 0.12);
        ctx.fillRect(x - s * 0.15, y - s * 0.12, s * 0.12, s * 0.05);
        ctx.fillRect(x + s * 0.09, y - s * 0.24, s * 0.06, s * 0.12);
        ctx.fillRect(x + s * 0.03, y - s * 0.16, s * 0.12, s * 0.05);
      }
      return;
    }
    case 'desert:mesa':
      for (const [x, y] of pts(2)) {
        const w = s * (0.22 + r() * 0.1), hgt = s * (0.22 + r() * 0.15);
        poly(ctx, [x - w, y, x - w * 0.7, y - hgt, x + w * 0.7, y - hgt, x + w, y], '#a8552e');
        poly(ctx, [x - w, y, x - w * 0.7, y - hgt, x, y - hgt, x - w * 0.1, y], '#d07a48');
        ctx.fillStyle = 'rgba(255,230,190,0.35)';
        ctx.fillRect(x - w * 0.85, y - hgt * 0.45, w * 1.7, s * 0.025);
      }
      return;
    case 'desert:saltflat': {
      ctx.save();
      hexPath(ctx, cx, cy, s * 0.95);
      ctx.clip();
      ctx.strokeStyle = 'rgba(160,140,110,0.55)';
      ctx.lineWidth = Math.max(1, s * 0.02);
      for (let i = 0; i < 9; i++) {
        const x = cx + (r() - 0.5) * s * 1.6, y = cy + (r() - 0.5) * s * 1.6;
        hexPath(ctx, x, y, s * (0.14 + r() * 0.08));
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case 'swamp:reed':
    case 'swamp:mangrove':
    case 'swamp:dead': {
      for (const [x, y] of pts(2)) {
        ell(ctx, x, y, s * 0.2, s * 0.09, style === 'dead' ? '#3f4a42' : '#3c5a58');
        ell(ctx, x - s * 0.05, y - s * 0.02, s * 0.08, s * 0.03, '#5f8a7a');
      }
      if (style === 'mangrove') for (const [x, y] of pts(3)) tree(ctx, x, y + s * 0.12, s * (0.85 + r() * 0.2), 'mangrove');
      else if (style === 'dead') for (const [x, y] of pts(3)) tree(ctx, x, y + s * 0.12, s * (0.8 + r() * 0.3), 'dead');
      else {
        ctx.strokeStyle = '#a3a865';
        ctx.lineWidth = Math.max(1, s * 0.03);
        for (const [x, y] of pts(6)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (r() - 0.5) * s * 0.06, y - s * 0.2);
          ctx.stroke();
          ctx.fillStyle = '#6b4a2a';
          ctx.fillRect(x - s * 0.015, y - s * 0.22, s * 0.03, s * 0.07);
        }
      }
      return;
    }
    case 'sand:beach':
      dots(8, ['#c9a868'], 0.025);
      if (r() < 0.4) for (const [x, y] of pts(1)) ell(ctx, x, y, s * 0.06, s * 0.06, '#ffd1dc', Math.PI, 0);
      return;
    case 'sand:pebble':
      for (const [x, y] of pts(9)) { ell(ctx, x, y, s * 0.045, s * 0.03, '#8f8a80'); ell(ctx, x - s * 0.01, y - s * 0.01, s * 0.02, s * 0.012, '#c4beb2'); }
      return;
    case 'water:lily':
      for (const [x, y] of pts(4)) {
        ctx.fillStyle = '#4f9a48';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, s * 0.07, 0.3, Math.PI * 2 - 0.3);
        ctx.closePath();
        ctx.fill();
        if (r() < 0.4) circ(ctx, x + s * 0.02, y - s * 0.02, s * 0.025, '#ff9ac0');
      }
      return;
    case 'deep:kelp':
      ctx.strokeStyle = 'rgba(40,110,70,0.75)';
      ctx.lineWidth = Math.max(1, s * 0.035);
      for (const [x, y] of pts(5)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - s * 0.06, y - s * 0.08, x + s * 0.06, y - s * 0.14, x, y - s * 0.22);
        ctx.stroke();
      }
      return;
    default: {
      // water:shallow, deep:deep
      ctx.strokeStyle = biome === 'water' ? 'rgba(190,230,255,0.55)' : 'rgba(120,170,230,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (const [x, y] of pts(3)) {
        ctx.beginPath();
        ctx.arc(x - s * 0.08, y, s * 0.08, Math.PI * 1.1, Math.PI * 1.9);
        ctx.arc(x + s * 0.08, y, s * 0.08, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
  }
}

// ---------- Landmarks (drawn live, in hex units: 1 = hex radius) ----------
export function drawLandmark(ctx: Ctx, kind: LandmarkKind, x: number, y: number, s: number, t: number, v: number) {
  ctx.save();
  ctx.translate(x, y + s * 0.12);
  ctx.scale(s, s);
  const glow = (gx: number, gy: number, rad: number, col: string, a: number) => {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
    g.addColorStop(0, col.replace('A', String(a)));
    g.addColorStop(1, col.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  ell(ctx, 0, 0.14, 0.32, 0.09, 'rgba(0,0,0,0.25)');
  const pulse = 0.5 + 0.5 * Math.sin(t / 600 + v);
  switch (kind) {
    case 'standing_stones':
      for (const [sx, sy, hh] of [[-0.3, 0.08, 0.34], [-0.1, -0.02, 0.44], [0.1, -0.02, 0.44], [0.3, 0.08, 0.32]]) {
        poly(ctx, [sx - 0.06, sy + 0.04, sx - 0.05, sy - hh, sx + 0.05, sy - hh - 0.02, sx + 0.06, sy + 0.04], '#7c7a8a');
        poly(ctx, [sx - 0.06, sy + 0.04, sx - 0.05, sy - hh, sx, sy - hh - 0.01, sx, sy + 0.04], '#a7a5b6');
      }
      poly(ctx, [-0.18, -0.46, 0.18, -0.48, 0.18, -0.41, -0.18, -0.39], '#8e8c9c');
      ell(ctx, -0.05, 0.02, 0.04, 0.02, '#4f8a3a');
      break;
    case 'statue':
      poly(ctx, [-0.15, 0.12, 0.15, 0.12, 0.13, 0.0, -0.13, 0.0], '#857f70');
      poly(ctx, [-0.09, 0.0, -0.06, -0.32, 0.06, -0.32, 0.09, 0.0], '#c2bcab');
      poly(ctx, [-0.09, 0.0, -0.06, -0.32, 0.0, -0.32, 0.0, 0.0], '#d8d2c1');
      circ(ctx, 0, -0.38, 0.065, '#c9c3b2');
      line(ctx, [0.05, -0.28, 0.17, -0.48], '#c2bcab', 0.04);
      ell(ctx, -0.05, -0.1, 0.035, 0.05, '#5f8a3a');
      break;
    case 'well':
      line(ctx, [-0.17, 0.0, -0.17, -0.42], '#6b4a2a', 0.035);
      line(ctx, [0.17, 0.0, 0.17, -0.42], '#6b4a2a', 0.035);
      poly(ctx, [-0.25, -0.38, 0, -0.56, 0.25, -0.38], '#8c3a2a');
      poly(ctx, [-0.25, -0.38, 0, -0.56, 0, -0.38], '#b04e38');
      ctx.fillStyle = '#9a948a';
      ctx.fillRect(-0.2, -0.12, 0.4, 0.2);
      ell(ctx, 0, -0.12, 0.2, 0.06, '#6b6a72');
      ell(ctx, 0, -0.12, 0.15, 0.04, '#1e3048');
      ctx.fillStyle = '#7c776e';
      for (let i = 0; i < 3; i++) ctx.fillRect(-0.2, -0.06 + i * 0.05, 0.4, 0.01);
      line(ctx, [0, -0.38, 0, -0.22], '#ccc', 0.012);
      ctx.fillStyle = '#7a5530';
      ctx.fillRect(-0.035, -0.24, 0.07, 0.06);
      break;
    case 'signpost':
      line(ctx, [0, 0.1, 0, -0.45], '#6b4a2a', 0.05);
      poly(ctx, [-0.02, -0.42, 0.24, -0.42, 0.3, -0.37, 0.24, -0.32, -0.02, -0.32], '#b08a52');
      poly(ctx, [0.02, -0.26, -0.24, -0.26, -0.3, -0.21, -0.24, -0.16, 0.02, -0.16], '#a07a46');
      line(ctx, [0.03, -0.37, 0.2, -0.37], '#6b4a2a', 0.012);
      line(ctx, [-0.03, -0.21, -0.2, -0.21], '#6b4a2a', 0.012);
      break;
    case 'windmill': {
      poly(ctx, [-0.14, 0.1, -0.09, -0.36, 0.09, -0.36, 0.14, 0.1], '#e8dcc0');
      poly(ctx, [-0.14, 0.1, -0.09, -0.36, 0, -0.36, 0, 0.1], '#f6eedb');
      poly(ctx, [-0.12, -0.34, 0, -0.5, 0.12, -0.34], '#8c3a2a');
      ctx.fillStyle = '#5a3b22';
      ctx.fillRect(-0.03, -0.04, 0.06, 0.14);
      ctx.save();
      ctx.translate(0, -0.36);
      ctx.rotate(t / 1100 + v);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(-0.012, 0, 0.024, 0.34);
        ctx.fillStyle = 'rgba(245,240,225,0.95)';
        ctx.fillRect(0.012, 0.08, 0.07, 0.25);
      }
      ctx.restore();
      circ(ctx, 0, -0.36, 0.03, '#3a2a1a');
      break;
    }
    case 'scarecrow':
      line(ctx, [0, 0.12, 0, -0.38], '#6b4a2a', 0.035);
      line(ctx, [-0.22, -0.22, 0.22, -0.22], '#6b4a2a', 0.03);
      poly(ctx, [-0.12, -0.26, 0.12, -0.26, 0.09, 0.0, -0.09, 0.0], '#8a6a3a');
      line(ctx, [-0.22, -0.22, -0.12, -0.24], '#c9a050', 0.05);
      line(ctx, [0.22, -0.22, 0.12, -0.24], '#c9a050', 0.05);
      circ(ctx, 0, -0.35, 0.085, '#e8892a');
      poly(ctx, [-0.05, -0.37, -0.02, -0.37, -0.035, -0.34], '#3a2010');
      poly(ctx, [0.02, -0.37, 0.05, -0.37, 0.035, -0.34], '#3a2010');
      poly(ctx, [-0.14, -0.42, 0.14, -0.42, 0.06, -0.44, 0, -0.58, -0.06, -0.44], '#4a3a22');
      break;
    case 'great_tree':
      poly(ctx, [-0.08, 0.12, -0.05, -0.25, 0.05, -0.25, 0.08, 0.12], '#5a3b22');
      line(ctx, [-0.08, 0.12, -0.18, 0.15], '#5a3b22', 0.035);
      line(ctx, [0.08, 0.12, 0.18, 0.15], '#5a3b22', 0.035);
      circ(ctx, -0.18, -0.38, 0.2, '#2a6a32');
      circ(ctx, 0.18, -0.38, 0.2, '#2a6a32');
      circ(ctx, 0, -0.55, 0.24, '#2f7a3a');
      circ(ctx, -0.06, -0.6, 0.14, '#4a9a4a');
      circ(ctx, 0.14, -0.42, 0.1, '#4a9a4a');
      for (const [rx, ry, c] of [[-0.2, -0.22, '#e84a5a'], [0.16, -0.24, '#f0c040'], [0.02, -0.3, '#5ab0f0']] as [number, number, string][]) line(ctx, [rx, ry, rx + 0.01, ry + 0.09], c, 0.02);
      break;
    case 'cart':
      ctx.save();
      ctx.rotate(-0.12);
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-0.24, -0.2, 0.4, 0.16);
      ctx.fillStyle = '#a8844a';
      ctx.fillRect(-0.24, -0.2, 0.4, 0.04);
      line(ctx, [0.16, -0.08, 0.32, -0.02], '#6b4a2a', 0.025);
      ctx.restore();
      circ(ctx, -0.12, 0.0, 0.08, '#5a3b22');
      circ(ctx, -0.12, 0.0, 0.05, '#8a6a3a');
      ell(ctx, 0.14, 0.06, 0.09, 0.03, '#5a3b22');
      ctx.fillStyle = '#b08a52';
      ctx.fillRect(0.2, -0.04, 0.1, 0.1);
      break;
    case 'sword_stone':
      glow(0, -0.25, 0.4, 'rgba(160,210,255,A)', 0.25 + 0.25 * pulse);
      ell(ctx, 0, 0.02, 0.26, 0.15, '#7c7c88');
      ell(ctx, -0.06, -0.02, 0.16, 0.09, '#9a9aa8');
      poly(ctx, [-0.025, -0.06, 0.025, -0.06, 0.02, -0.4, -0.02, -0.4], '#dfe6f0');
      line(ctx, [0, -0.4, 0, -0.06], '#ffffff', 0.008);
      ctx.fillStyle = '#d4a64a';
      ctx.fillRect(-0.1, -0.43, 0.2, 0.035);
      ctx.fillStyle = '#5a3b22';
      ctx.fillRect(-0.018, -0.55, 0.036, 0.12);
      circ(ctx, 0, -0.56, 0.028, '#d4a64a');
      break;
    case 'banner': {
      line(ctx, [-0.1, 0.12, -0.1, -0.6], '#6b4a2a', 0.03);
      const w = Math.sin(t / 350 + v) * 0.04;
      ctx.fillStyle = '#b03030';
      ctx.beginPath();
      ctx.moveTo(-0.1, -0.58);
      ctx.quadraticCurveTo(0.08, -0.6 + w, 0.26, -0.55);
      ctx.lineTo(0.22, -0.42 + w);
      ctx.quadraticCurveTo(0.06, -0.38 - w, -0.1, -0.36);
      ctx.closePath();
      ctx.fill();
      circ(ctx, 0.06, -0.47, 0.04, '#f0d060');
      break;
    }
    case 'ashes':
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ell(ctx, Math.cos(a) * 0.17, Math.sin(a) * 0.08, 0.05, 0.035, '#8a8478'); }
      ell(ctx, 0, 0, 0.12, 0.05, '#3a3632');
      glow(0, -0.01, 0.14, 'rgba(255,120,40,A)', 0.3 + 0.3 * pulse);
      circ(ctx, 0.03, -0.01, 0.015, '#ff8a2a');
      ctx.fillStyle = `rgba(200,200,200,${0.25 * pulse})`;
      circ(ctx, 0.02, -0.18 - pulse * 0.08, 0.04, ctx.fillStyle as string);
      break;
    case 'mushrooms':
      glow(0, -0.12, 0.4, 'rgba(110,220,255,A)', 0.2 + 0.25 * pulse);
      for (const [mx, my, sc, c] of [[-0.18, 0.04, 0.9, '#5ad0ff'], [0.02, -0.02, 1.2, '#a07aff'], [0.18, 0.06, 0.8, '#5ad0ff'], [-0.04, 0.1, 0.6, '#ff7ad0']] as [number, number, number, string][]) {
        ctx.fillStyle = '#efe6d0';
        ctx.fillRect(mx - 0.02 * sc, my - 0.12 * sc, 0.04 * sc, 0.12 * sc);
        ell(ctx, mx, my - 0.12 * sc, 0.09 * sc, 0.06 * sc, c, Math.PI, 0);
        circ(ctx, mx - 0.03 * sc, my - 0.15 * sc, 0.012 * sc, '#ffffff');
      }
      break;
    case 'stump':
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-0.18, -0.16, 0.36, 0.2);
      ell(ctx, 0, 0.04, 0.18, 0.06, '#6b4a2a');
      ell(ctx, 0, -0.16, 0.18, 0.07, '#c49a62');
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 0.01;
      for (const rr of [0.05, 0.1, 0.14]) { ctx.beginPath(); ctx.ellipse(0, -0.16, rr, rr * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); }
      ell(ctx, -0.12, 0.0, 0.05, 0.03, '#4f8a3a');
      break;
    case 'totem': {
      const cols = ['#b5462e', '#2f6b8a', '#d4a64a', '#3d7a3d'];
      for (let i = 0; i < 4; i++) {
        const yy = 0.04 - i * 0.14;
        ctx.fillStyle = cols[(i + v) % 4];
        ctx.fillRect(-0.09, yy - 0.13, 0.18, 0.13);
        circ(ctx, -0.04, yy - 0.08, 0.018, '#111');
        circ(ctx, 0.04, yy - 0.08, 0.018, '#111');
        ctx.fillStyle = '#111';
        ctx.fillRect(-0.03, yy - 0.04, 0.06, 0.012);
      }
      poly(ctx, [-0.09, -0.48, -0.3, -0.56, -0.09, -0.42], '#d4a64a');
      poly(ctx, [0.09, -0.48, 0.3, -0.56, 0.09, -0.42], '#d4a64a');
      break;
    }
    case 'lantern': {
      const f = 0.6 + 0.4 * Math.sin(t / 130 + v) * Math.sin(t / 47);
      line(ctx, [0, 0.12, 0, -0.42], '#3a3a3a', 0.03);
      line(ctx, [0, -0.42, 0.12, -0.42], '#3a3a3a', 0.025);
      glow(0.12, -0.3, 0.3, 'rgba(255,200,90,A)', 0.35 * f + 0.15);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0.07, -0.38, 0.1, 0.14);
      ctx.fillStyle = `rgba(255,${190 + 40 * f},90,1)`;
      ctx.fillRect(0.085, -0.36, 0.07, 0.1);
      break;
    }
    case 'cairn':
      for (const [cy2, w] of [[0.06, 0.2], [-0.06, 0.16], [-0.16, 0.12], [-0.25, 0.085], [-0.32, 0.055]]) { ell(ctx, 0, cy2, w, 0.055, '#7c7a72'); ell(ctx, -0.02, cy2 - 0.015, w * 0.7, 0.03, '#a8a49a'); }
      break;
    case 'obelisk':
      glow(0, -0.3, 0.38, 'rgba(160,140,255,A)', 0.15 + 0.2 * pulse);
      poly(ctx, [-0.1, 0.1, -0.06, -0.55, 0, -0.66, 0.06, -0.55, 0.1, 0.1], '#1e1b2a');
      poly(ctx, [-0.1, 0.1, -0.06, -0.55, 0, -0.66, 0, 0.1], '#2f2a40');
      for (const [sx, sy] of [[-0.03, -0.45], [0.03, -0.35], [-0.02, -0.22], [0.035, -0.1], [0, -0.3]]) circ(ctx, sx, sy, 0.012, `rgba(220,210,255,${0.5 + 0.5 * pulse})`);
      break;
    case 'crystals':
      glow(0, -0.2, 0.42, 'rgba(190,120,255,A)', 0.2 + 0.25 * pulse);
      for (const [cx2, hh, w, a] of [[-0.14, 0.32, 0.07, -0.25], [0.02, 0.5, 0.09, 0.05], [0.16, 0.3, 0.07, 0.3], [-0.04, 0.22, 0.05, -0.5]]) {
        ctx.save();
        ctx.translate(cx2, 0.06);
        ctx.rotate(a);
        poly(ctx, [-w, 0, -w, -hh * 0.75, 0, -hh, w, -hh * 0.75, w, 0], '#7a4ac8');
        poly(ctx, [-w, 0, -w, -hh * 0.75, 0, -hh, 0, 0], '#b48af0');
        ctx.restore();
      }
      break;
    case 'lava_vent':
      ell(ctx, 0, 0.0, 0.28, 0.12, '#2a2020');
      glow(0, -0.02, 0.32, 'rgba(255,110,30,A)', 0.35 + 0.3 * pulse);
      line(ctx, [-0.2, 0.0, -0.08, -0.03, 0.02, 0.02, 0.12, -0.02, 0.2, 0.01], '#ff7a1a', 0.05);
      line(ctx, [-0.08, -0.03, 0.02, 0.02, 0.12, -0.02], '#ffd36a', 0.02);
      for (let i = 0; i < 3; i++) {
        const ph = (t / 1600 + i / 3 + v * 0.1) % 1;
        circ(ctx, 0.04 + ph * 0.1, -0.12 - ph * 0.45, 0.05 + ph * 0.07, `rgba(90,80,80,${0.5 * (1 - ph)})`);
      }
      break;
    case 'geyser':
      ell(ctx, 0, 0.02, 0.26, 0.1, '#c9c2b0');
      ell(ctx, 0, 0.02, 0.21, 0.075, '#5ac0e0');
      ell(ctx, -0.05, 0.0, 0.08, 0.025, '#b0ecff');
      for (let i = 0; i < 4; i++) {
        const ph = (t / 1400 + i / 4 + v * 0.1) % 1;
        circ(ctx, Math.sin(ph * 6 + i) * 0.06, -0.05 - ph * 0.55, 0.05 + ph * 0.08, `rgba(255,255,255,${0.55 * (1 - ph)})`);
      }
      break;
    case 'ice_spire':
      glow(0, -0.3, 0.35, 'rgba(160,220,255,A)', 0.25);
      poly(ctx, [-0.13, 0.1, -0.03, -0.72, 0.04, -0.55, 0.13, 0.1], 'rgba(120,180,235,0.92)');
      poly(ctx, [-0.13, 0.1, -0.03, -0.72, -0.01, 0.1], 'rgba(210,240,255,0.95)');
      poly(ctx, [0.06, 0.1, 0.16, -0.3, 0.22, 0.1], 'rgba(140,195,240,0.9)');
      break;
    case 'ribcage':
      line(ctx, [-0.34, 0.05, 0.34, 0.02], '#e8e2d2', 0.035);
      for (let i = 0; i < 5; i++) {
        const rx = -0.26 + i * 0.13, hh = 0.32 + Math.sin((i / 4) * Math.PI) * 0.2;
        ctx.strokeStyle = '#efe9da';
        ctx.lineWidth = 0.032;
        ctx.beginPath();
        ctx.moveTo(rx, 0.04);
        ctx.quadraticCurveTo(rx - 0.12, -hh * 0.7, rx + 0.02, -hh);
        ctx.stroke();
      }
      circ(ctx, 0.38, -0.02, 0.07, '#efe9da');
      break;
    case 'bones':
      line(ctx, [-0.18, 0.06, 0.12, -0.02], '#e8e2d2', 0.035);
      line(ctx, [-0.14, -0.04, 0.16, 0.06], '#e8e2d2', 0.035);
      circ(ctx, 0.04, -0.12, 0.08, '#efe9da');
      ctx.fillStyle = '#efe9da';
      ctx.fillRect(0.0, -0.08, 0.08, 0.05);
      circ(ctx, 0.015, -0.13, 0.018, '#3a3a3a');
      circ(ctx, 0.065, -0.13, 0.018, '#3a3a3a');
      break;
    case 'oasis':
      ell(ctx, 0, 0.04, 0.3, 0.12, '#d8c08a');
      ell(ctx, 0, 0.04, 0.25, 0.09, '#3fb0d8');
      ell(ctx, -0.07, 0.02, 0.09, 0.025, '#a8e8ff');
      tree(ctx, -0.22, 0.02, 1.0, 'palm');
      tree(ctx, 0.2, -0.02, 0.85, 'palm');
      break;
    case 'shipwreck':
      ctx.save();
      ctx.rotate(-0.25);
      poly(ctx, [-0.32, -0.08, 0.3, -0.12, 0.22, 0.06, -0.24, 0.08], '#6b4628');
      poly(ctx, [-0.32, -0.08, 0.3, -0.12, 0.28, -0.07, -0.3, -0.03], '#8a6038');
      ctx.fillStyle = '#4a2e18';
      for (let i = 0; i < 4; i++) ctx.fillRect(-0.2 + i * 0.12, -0.08, 0.02, 0.14);
      line(ctx, [0.0, -0.1, 0.04, -0.55], '#5a3b22', 0.03);
      poly(ctx, [0.04, -0.52, 0.2, -0.42, 0.06, -0.3], 'rgba(230,220,200,0.85)');
      ctx.restore();
      break;
    case 'tidepool':
      ell(ctx, 0, 0.03, 0.27, 0.12, '#8f8a80');
      ell(ctx, 0, 0.03, 0.22, 0.09, '#3f9ac8');
      ell(ctx, 0.05, 0.01, 0.08, 0.025, '#a8e0ff');
      ctx.save();
      ctx.translate(-0.08, 0.03);
      ctx.fillStyle = '#ff8a3a';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.025 : 0.06;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ell(ctx, 0.16, 0.1, 0.04, 0.03, '#ffd1dc', Math.PI, 0);
      break;
  }
  ctx.restore();
}

/** Subtle animated glints on water tiles. */
export function waterGlint(ctx: Ctx, x: number, y: number, s: number, t: number, phase: number) {
  const a = 0.5 + 0.5 * Math.sin(t / 900 + phase);
  if (a < 0.35) return;
  ctx.strokeStyle = `rgba(220,245,255,${(a - 0.35) * 0.7})`;
  ctx.lineWidth = Math.max(1, s * 0.03);
  const ox = Math.cos(phase * 3) * s * 0.3, oy = Math.sin(phase * 5) * s * 0.25;
  ctx.beginPath();
  ctx.moveTo(x + ox - s * 0.08, y + oy);
  ctx.lineTo(x + ox + s * 0.08, y + oy);
  ctx.stroke();
}
