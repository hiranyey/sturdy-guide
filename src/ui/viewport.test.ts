import { describe, it, expect } from 'vitest';
import { viewportGap } from './viewport';

describe('viewportGap', () => {
  it('measures the strip iOS leaves under a short page', () => {
    expect(viewportGap(390, 785, 390, 844)).toBe(59);
  });
  it('is ignored when the page fills the screen', () => {
    expect(viewportGap(390, 844, 390, 844)).toBe(-1);
  });
  it('ignores the keyboard and split windows', () => {
    expect(viewportGap(390, 500, 390, 844)).toBe(-1);
  });
  it('handles landscape', () => {
    expect(viewportGap(844, 360, 390, 844)).toBe(30);
  });
});
