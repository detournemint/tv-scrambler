import type { Frame, ScrambleParams } from '../types';

const BEND_DEPTH = 90; // px at tear=1 for the coherent picture bend
const LINE_TEAR_CHANCE = 0.01; // per row at tear=1: rare hard discontinuity
const HUM_BRIGHTNESS = 22; // peak brightness add of the rolling hum bar
const SNOW_CHANCE = 0.06; // per pixel at snow=1
const BAR_FRACTION = 0.12; // width of the drifting H-blanking bar
const VBI_FRACTION = 0.06; // height of the vertical blanking band shown mid-flop

function hash01(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** SSAVI-style inversion flicker: pseudo-random per 2-frame field block (~65% inverted). */
export function invertActive(t: number): boolean {
  return hash01(Math.floor(t / 2)) > 0.35;
}

/**
 * Lurching vertical roll: the picture holds steady for ~85% of the cycle,
 * then flops through a full frame height and re-locks. roll scales cycle speed.
 */
export function rollOffset(t: number, roll: number, h: number): number {
  if (roll <= 0) return 0;
  const f = (t * roll * 0.02) % 1;
  const x = (f - 0.85) / 0.15;
  if (x <= 0) return 0;
  const s = x * x * (3 - 2 * x);
  return Math.floor(h * s) % h;
}

/** Drifting horizontal-blanking bar left edge; wanders across and wraps around. */
export function barPosition(t: number, w: number, barW: number): number {
  const span = w + barW;
  const x = t * 0.9 + Math.sin(t * 0.013) * 30;
  return ((x % span) + span) % span - barW;
}

/**
 * Two passes, in order:
 * 1. Geometric (sync suppression): a coherent low-frequency horizontal bend
 *    (neighboring lines shift almost identically, so the picture shears and
 *    folds) with rare per-line discontinuities, a lurching vertical roll, a
 *    visible vertical-blanking band while mid-flop, and the drifting
 *    horizontal-blanking bar (black bar + white sync-pulse stripe).
 *    Reads from src, writes into out. Wraps on X and Y.
 * 2. Per-pixel: flickering invert -> chroma swap -> hum band -> snow, in
 *    place on out. The blanking bar inverts with the field, as on a real set.
 */
export function scramble(src: Frame, out: Frame, p: ScrambleParams): Frame {
  const { width: w, height: h } = src;
  const s = src.data;
  const d = out.data;
  const { effects, amounts, t, rand } = p;

  const rollOff = effects.sync ? rollOffset(t, amounts.roll, h) : 0;
  const barW = Math.max(4, Math.round(w * BAR_FRACTION));
  const barX = effects.sync ? barPosition(t, w, barW) : 0;
  const barSlant = 0.05 * Math.sin(t * 0.017);
  const vbiH = Math.max(2, Math.round(h * VBI_FRACTION));

  for (let y = 0; y < h; y++) {
    let shift = 0;
    if (effects.sync) {
      const bend =
        Math.sin(y * 0.008 + t * 0.05) * 0.65 + Math.sin(y * 0.02 - t * 0.11) * 0.35;
      shift = bend * BEND_DEPTH * amounts.tear;
      if (rand() < LINE_TEAR_CHANCE * amounts.tear) {
        shift += (rand() - 0.5) * w * 0.6 * amounts.tear;
      }
      shift = Math.round(shift);
    }
    const srcY = (y + rollOff) % h;
    const srcRow = srcY * w * 4;
    const dstRow = y * w * 4;

    if (effects.sync && rollOff !== 0 && srcY < vbiH) {
      // vertical blanking band rolling through while the picture flops
      for (let x = 0; x < w; x++) {
        const di = dstRow + x * 4;
        d[di] = 4;
        d[di + 1] = 4;
        d[di + 2] = 4;
        d[di + 3] = 255;
      }
      continue;
    }

    for (let x = 0; x < w; x++) {
      const sx = (((x - shift) % w) + w) % w;
      const si = srcRow + sx * 4;
      const di = dstRow + x * 4;
      d[di] = s[si];
      d[di + 1] = s[si + 1];
      d[di + 2] = s[si + 2];
      d[di + 3] = 255;
    }

    if (effects.sync) {
      // drifting H-blanking bar: black interval with a bright sync-pulse stripe
      const bx = Math.round(barX + y * barSlant);
      for (let i = 0; i < barW; i++) {
        const px = bx + i;
        if (px < 0 || px >= w) continue;
        const inPulse = i > barW * 0.42 && i < barW * 0.56;
        const v = inPulse ? 235 : 6;
        const di = dstRow + px * 4;
        d[di] = v;
        d[di + 1] = v;
        d[di + 2] = v;
      }
    }
  }

  const invertNow = effects.invert && invertActive(t);
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
      if (invertNow) {
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
