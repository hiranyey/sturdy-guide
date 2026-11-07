// Axial hex coordinates, pointy-top orientation.
export interface Hex { q: number; r: number }

export const SQRT3 = Math.sqrt(3);

export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const key = (h: Hex) => `${h.q},${h.r}`;
export const parseKey = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
};
export const eq = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export function neighbors(h: Hex): Hex[] {
  return DIRS.map((d) => add(h, d));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function toPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

export function fromPixel(x: number, y: number, size: number): Hex {
  const q = ((SQRT3 / 3) * x - y / 3) / size;
  const r = ((2 / 3) * y) / size;
  return round(q, r);
}

export function round(fq: number, fr: number): Hex {
  const fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

export function ring(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let h = add(center, { q: DIRS[4].q * radius, r: DIRS[4].r * radius });
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      out.push(h);
      h = add(h, DIRS[i]);
    }
  }
  return out;
}

export function spiral(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let k = 0; k <= radius; k++) out.push(...ring(center, k));
  return out;
}

/** Compass label for a direction vector in pixel space. */
export function compass(dx: number, dy: number): string {
  const ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = east, 90 = north
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const idx = Math.round(((ang + 360) % 360) / 45) % 8;
  return names[idx];
}
