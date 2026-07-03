import { describe, it, expect } from 'vitest';
import { barRects, BAR_COLORS } from '../src/pipeline/testpattern';

describe('barRects', () => {
  it('produces one rect per color, contiguous and spanning the full width', () => {
    const rects = barRects(640);
    expect(rects).toHaveLength(BAR_COLORS.length);
    let end = 0;
    for (const r of rects) {
      expect(r.x).toBe(end);
      end = r.x + r.width;
    }
    expect(end).toBe(640);
  });

  it('absorbs rounding into the bar edges for non-divisible widths', () => {
    const rects = barRects(641);
    expect(rects.reduce((sum, r) => sum + r.width, 0)).toBe(641);
  });
});
