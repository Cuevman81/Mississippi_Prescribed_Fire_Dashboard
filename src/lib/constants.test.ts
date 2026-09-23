import { describe, it, expect } from 'vitest';
import { getBurnQualityColor, getBurnQualityTextColor } from './constants';

// WCAG 2.x contrast ratio between two #rrggbb colours
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('burn-quality heatmap label contrast', () => {
  // One score from each band: Excellent, Good, Fair, Marginal, Poor
  it.each([95, 80, 60, 40, 10])('score %i label meets WCAG AA 4.5:1', (score) => {
    expect(contrast(getBurnQualityTextColor(score), getBurnQualityColor(score))).toBeGreaterThanOrEqual(4.5);
  });
});
