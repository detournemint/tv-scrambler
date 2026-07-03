import { describe, it, expect } from 'vitest';
import { scramble } from '../src/pipeline/scramble';
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

  it('inverts every channel when invert is on', () => {
    const src = makeFrame(2, 2, [10, 200, 30]);
    const out = makeFrame(2, 2);
    scramble(src, out, params({ effects: { ...OFF, invert: true } }));
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([245, 55, 225]);
  });

  it('swaps red and blue when chroma is on', () => {
    const src = makeFrame(2, 2, [10, 200, 30]);
    const out = makeFrame(2, 2);
    scramble(src, out, params({ effects: { ...OFF, chroma: true } }));
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([30, 200, 10]);
  });

  it('rolls rows vertically when sync is on', () => {
    const src = makeFrame(4, 4);
    src.data[0] = 255; // single red pixel at (0,0)
    const out = makeFrame(4, 4);
    // rollOff = floor(t * roll * 3) % h = floor(1 * 1 * 3) % 4 = 3
    // output row y reads source row (y + 3) % 4, so source row 0 lands on output row 1
    scramble(
      src,
      out,
      params({ effects: { ...OFF, sync: true }, amounts: { tear: 0, roll: 1, snow: 0 }, t: 1 }),
    );
    const row1 = (1 * 4 + 0) * 4;
    expect(out.data[row1]).toBe(255);
    expect(out.data[0]).toBe(0);
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
