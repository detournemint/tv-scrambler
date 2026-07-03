import { describe, it, expect } from 'vitest';
import { scramble, rollOffset, barPosition } from '../src/pipeline/scramble';
import type { Effects, Frame, ScrambleParams } from '../src/types';

const OFF: Effects = { sync: false, invert: false, chroma: false, rf: false, audio: false };

function makeFrame(w: number, h: number, rgb: [number, number, number] = [0, 0, 0]): Frame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

function params(over: Partial<ScrambleParams> = {}): ScrambleParams {
  return {
    effects: { ...OFF },
    amounts: { tear: 0, roll: 0, snow: 0 },
    t: 0,
    rand: () => 0.99,
    ...over,
  };
}

describe('scramble', () => {
  it('is an identity copy when every effect is off', () => {
    const src = makeFrame(8, 8, [10, 200, 30]);
    const out = makeFrame(8, 8);
    scramble(src, out, params());
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('inverts every channel steadily when invert is on (no flicker — seizure safety)', () => {
    const src = makeFrame(2, 2, [10, 200, 30]);
    for (const t of [0, 1, 7, 31, 100]) {
      const out = makeFrame(2, 2);
      scramble(src, out, params({ effects: { ...OFF, invert: true }, t }));
      expect([out.data[0], out.data[1], out.data[2]]).toEqual([245, 55, 225]);
    }
  });

  it('swaps red and blue when chroma is on', () => {
    const src = makeFrame(2, 2, [10, 200, 30]);
    const out = makeFrame(2, 2);
    scramble(src, out, params({ effects: { ...OFF, chroma: true } }));
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([30, 200, 10]);
  });

  it('paints snow pixels when rf is on and rand fires', () => {
    const src = makeFrame(2, 1, [255, 255, 255]);
    const out = makeFrame(2, 1);
    scramble(
      src,
      out,
      params({ effects: { ...OFF, rf: true }, amounts: { tear: 0, roll: 0, snow: 1 }, rand: () => 0 }),
    );
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([0, 0, 0]);
  });
});

describe('rollOffset (lurching vertical roll)', () => {
  it('holds at zero for most of the cycle', () => {
    // f = t * roll * 0.02 = 0.2 at t=10, roll=1 — inside the 85% hold window
    expect(rollOffset(10, 1, 480)).toBe(0);
  });

  it('flops through the frame near the end of the cycle', () => {
    // f = 0.94 at t=47, roll=1 — inside the flop window
    const off = rollOffset(47, 1, 480);
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThan(480);
  });

  it('is zero when roll amount is zero', () => {
    expect(rollOffset(1234, 0, 480)).toBe(0);
  });
});

describe('barPosition', () => {
  it('stays within the drift span and keeps drifting', () => {
    const w = 640;
    const bw = 76;
    const positions = Array.from({ length: 500 }, (_, t) => barPosition(t, w, bw));
    for (const p of positions) {
      expect(p).toBeGreaterThanOrEqual(-bw);
      expect(p).toBeLessThan(w);
    }
    expect(new Set(positions.map((p) => Math.round(p))).size).toBeGreaterThan(50);
  });
});
