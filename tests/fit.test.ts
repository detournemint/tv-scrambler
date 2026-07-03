import { describe, it, expect } from 'vitest';
import { coverFit } from '../src/pipeline/fit';

describe('coverFit', () => {
  it('fills a 4:3 canvas with a 16:9 source by cropping the sides', () => {
    const { dx, dy, dw, dh } = coverFit(1280, 720, 640, 480);
    expect(dh).toBeCloseTo(480, 5);
    expect(dw).toBeCloseTo(853.33, 1);
    expect(dy).toBeCloseTo(0, 5);
    expect(dx).toBeCloseTo(-106.67, 1);
  });

  it('fills a 4:3 canvas with a tall source by cropping top and bottom', () => {
    const { dx, dy, dw, dh } = coverFit(480, 640, 640, 480);
    expect(dw).toBeCloseTo(640, 5);
    expect(dh).toBeCloseTo(853.33, 1);
    expect(dx).toBeCloseTo(0, 5);
    expect(dy).toBeCloseTo(-186.67, 1);
  });

  it('fills exactly with a matching-aspect source', () => {
    expect(coverFit(320, 240, 640, 480)).toEqual({ dx: 0, dy: 0, dw: 640, dh: 480 });
  });
});
