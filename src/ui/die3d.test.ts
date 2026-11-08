import { describe, it, expect } from 'vitest';
import { FACES, VERTS, faceUp, mul, mmul, rot, type M3 } from './die3d';

const det = (m: M3) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

describe('3D d20', () => {
  it('is an icosahedron numbered like a real d20', () => {
    expect(VERTS).toHaveLength(12);
    expect(FACES).toHaveLength(20);
    expect(FACES.map((f) => f.num).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const f of FACES) {
      const opp = FACES.find((g) => g.n[0] * f.n[0] + g.n[1] * f.n[1] + g.n[2] * f.n[2] < -0.999)!;
      expect(f.num + opp.num).toBe(21);
      // normals point outward
      expect(f.n[0] * f.c[0] + f.n[1] * f.c[1] + f.n[2] * f.c[2]).toBeGreaterThan(0);
    }
  });

  it('lands with the rolled number facing you, upright and unmirrored', () => {
    for (let n = 1; n <= 20; n++) {
      const m = faceUp(n);
      expect(det(m)).toBeCloseTo(1, 6); // a real rotation, not a mirror
      const f = FACES.find((x) => x.num === n)!;
      const nz = mul(m, f.n), right = mul(m, f.r), down = mul(m, f.d);
      expect(nz[2]).toBeCloseTo(1, 6);
      expect(right[0]).toBeCloseTo(1, 6);
      expect(down[1]).toBeCloseTo(1, 6);
      // exactly one face points straight at you
      expect(FACES.filter((g) => mul(m, g.n)[2] > 0.99)).toHaveLength(1);
    }
  });

  it('rotations compose and undo', () => {
    const a = rot([0.3, 1, -0.2], 1.1);
    const back = mmul(rot([0.3, 1, -0.2], -1.1), a);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(back[i][j]).toBeCloseTo(i === j ? 1 : 0, 6);
  });
});
