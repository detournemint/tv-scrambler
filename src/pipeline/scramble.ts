import type { Frame, ScrambleParams } from '../types';

const JITTER_SHIFT = 18; // px at tear=1 for the sinusoidal per-line jitter
const BIG_TEAR_CHANCE = 0.04; // per row at tear=1
const HUM_BRIGHTNESS = 22; // peak brightness add of the rolling hum bar
const SNOW_CHANCE = 0.06; // per pixel at snow=1

/**
 * Two passes, in order:
 * 1. Geometric (sync suppression): per-row horizontal shift (small sinusoidal
 *    jitter + occasional large random tear) and a vertical roll offset that
 *    advances with t. Reads from src, writes into out. Wraps on X and Y.
 * 2. Per-pixel: invert -> chroma swap -> hum band -> snow, in place on out.
 */
export function scramble(src: Frame, out: Frame, p: ScrambleParams): Frame {
  const { width: w, height: h } = src;
  const s = src.data;
  const d = out.data;
  const { effects, amounts, t, rand } = p;

  const rollOff = effects.sync ? Math.floor(t * amounts.roll * 3) % h : 0;
  for (let y = 0; y < h; y++) {
    let shift = 0;
    if (effects.sync) {
      shift = Math.sin(y * 0.2 + t * 0.15) * JITTER_SHIFT * amounts.tear;
      if (rand() < BIG_TEAR_CHANCE * amounts.tear) {
        shift += (rand() - 0.5) * w * amounts.tear;
      }
      shift = Math.round(shift);
    }
    const srcRow = ((y + rollOff) % h) * w * 4;
    const dstRow = y * w * 4;
    for (let x = 0; x < w; x++) {
      const sx = (((x - shift) % w) + w) % w;
      const si = srcRow + sx * 4;
      const di = dstRow + x * 4;
      d[di] = s[si];
      d[di + 1] = s[si + 1];
      d[di + 2] = s[si + 2];
      d[di + 3] = 255;
    }
  }

  for (let y = 0; y < h; y++) {
    const humBand = effects.rf
      ? (Math.sin((y + t * 4) * 0.03) * 0.5 + 0.5) * HUM_BRIGHTNESS
      : 0;
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (effects.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
      if (effects.chroma) {
        const tmp = r;
        r = b;
        b = tmp;
      }
      if (humBand !== 0) {
        r += humBand;
        g += humBand;
        b += humBand;
      }
      if (effects.rf && rand() < SNOW_CHANCE * amounts.snow) {
        const n = rand() * 255;
        r = n;
        g = n;
        b = n;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  return out;
}
