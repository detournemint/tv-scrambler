# TV Scrambler (Ch·99 Descrambler Unit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `prototype/scrambler.html` single-file analog-cable-scrambling emulator as a Vite vanilla-TS project, add an EXPORT feature that records the scrambled canvas+audio to a downloadable `.webm`, and deploy it as a GitHub Pages site.

**Architecture:** A 640×480 offscreen buffer canvas receives the clean source (dropped video file or generated test pattern) each RAF frame; when "scrambled", `getImageData` → a pure `scramble()` pixel pipeline (geometric sync-suppression pass, then per-pixel invert/chroma/hum/snow pass) → `putImageData` to the visible canvas. Audio garble is a Web Audio ring-mod graph on the `<video>` element. Export uses `canvas.captureStream()` + a `MediaStreamAudioDestinationNode` + `MediaRecorder`.

**Tech Stack:** Vite (vanilla-ts template layout, hand-rolled), TypeScript strict, Vitest for pure-logic tests, GitHub Actions → GitHub Pages. No framework, no runtime dependencies.

## Global Constraints

- Internal canvas resolution is exactly **640×480** (period-correct 4:3); display scales via CSS.
- Every canvas that is read with `getImageData` must be created with `getContext('2d', { willReadFrequently: true })`.
- **Audio toggle is OFF by default.** The Web Audio graph is created on first file load; `resume()` is called on toggle/export clicks (autoplay policy).
- `createMediaElementSource(video)` may be called **once ever** — guard with a `connected` flag.
- Wrap `drawImage(video, …)` in try/catch (early frames before `readyState >= 2` throw).
- YouTube cannot be sampled (cross-origin tainted canvas). **No YouTube mode is built** — the optional overlay mode from the spec is explicitly out of scope; file drop is the "works on a YouTube clip" path.
- `vite.config.ts` must set `base: './'` so the build works at `https://<user>.github.io/tv-scrambler/`.
- Reuse the output `ImageData` across frames (no per-frame allocation besides the unavoidable `getImageData`).
- Faceplate copy is fixed: brand `CH·99 CABLE / ADDRESSABLE DESCRAMBLER UNIT`; button copy `DESCRAMBLE ▸ pay $ to view` / `RE-SCRAMBLE ▸ lock channel`; lamp text `SCRAMBLED` / `CLEAR`; footer `EMULATION ONLY · SYNC-SUPPRESSION LOOK IS FAKED IN CANVAS · NO REAL SIGNAL IS DECODED`.
- `prefers-reduced-motion: reduce` damps tear/roll amounts to 15% and adds +0.25 snow (static-heavy variant instead of motion).
- Visible keyboard focus via `:focus-visible` outline on all controls.
- Node 20, npm. Repo is its **own git repo** (`git init -b main` inside `tv-scrambler/` — the parent `~/dev` repo is unrelated).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
tv-scrambler/
  index.html                 # full faceplate markup (Vite entry)
  vite.config.ts             # base './'
  tsconfig.json
  package.json
  .gitignore
  prototype/scrambler.html   # reference prototype (already saved)
  src/
    main.ts                  # wiring, state, RAF loop, export flow
    types.ts                 # Effects, Amounts, State, Frame, ScrambleParams
    pipeline/
      scramble.ts            # pure pixel pipeline (Frame in → Frame out)
      fit.ts                 # coverFit() math
      testpattern.ts         # barRects() + drawTestPattern()
    source/
      fileSource.ts          # drag/drop + file input → <video>
    audio/
      garble.ts              # Garble class: ring-mod graph + recording stream
    export/
      record.ts              # pickMimeType, startRecording, downloadBlob
    ui/
      faceplate.ts           # DOM lookup, lamp/status updates
      styles.css             # faceplate aesthetic (ported from prototype)
  tests/
    scramble.test.ts
    fit.test.ts
    testpattern.test.ts
    record.test.ts
  .github/workflows/deploy.yml
  README.md
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html` (placeholder), `src/main.ts` (placeholder)

**Interfaces:**
- Produces: `npm run dev|build|test` scripts; TS strict config every later task compiles under.

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "tv-scrambler",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
```

`.gitignore`:
```
node_modules/
dist/
```

`index.html` (placeholder, replaced in Task 7):
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ch. 99 — Descrambler Unit</title>
</head>
<body>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts` (placeholder, replaced in Task 8):
```ts
console.log('ch99 descrambler boot');
export {};
```

- [ ] **Step 2: Init repo and install**

Run:
```bash
cd /home/gigawatt/dev/tv-scrambler
git init -b main
npm install
```
Expected: lockfile created, `node_modules/` present.

- [ ] **Step 3: Verify build works**

Run: `npm run build`
Expected: `dist/index.html` produced, exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite vanilla-ts project with prototype reference

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Types + scramble pixel pipeline (TDD)

**Files:**
- Create: `src/types.ts`, `src/pipeline/scramble.ts`
- Test: `tests/scramble.test.ts`

**Interfaces:**
- Produces:
  - `type Effects = { sync: boolean; invert: boolean; chroma: boolean; rf: boolean; audio: boolean }`
  - `type Amounts = { tear: number; roll: number; snow: number }` (0..1)
  - `type SourceKind = 'test' | 'file'`
  - `type State = { scrambled: boolean; source: SourceKind; t: number }`
  - `type Frame = { width: number; height: number; data: Uint8ClampedArray }` (ImageData is structurally assignable)
  - `type ScrambleParams = { effects: Effects; amounts: Amounts; t: number; rand: () => number }`
  - `scramble(src: Frame, out: Frame, p: ScrambleParams): Frame` — writes into `out`, returns it.

- [ ] **Step 1: Write `src/types.ts`**

```ts
export type Effects = {
  sync: boolean;
  invert: boolean;
  chroma: boolean;
  rf: boolean;
  audio: boolean;
};

export type Amounts = {
  tear: number; // 0..1
  roll: number; // 0..1
  snow: number; // 0..1
};

export type SourceKind = 'test' | 'file';

export type State = {
  scrambled: boolean;
  source: SourceKind;
  t: number;
};

// Structural subset of ImageData so the pipeline is testable without a DOM.
export type Frame = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ScrambleParams = {
  effects: Effects;
  amounts: Amounts;
  t: number;
  rand: () => number;
};
```

- [ ] **Step 2: Write the failing tests** — `tests/scramble.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/scramble.test.ts`
Expected: FAIL — cannot resolve `../src/pipeline/scramble`.

- [ ] **Step 4: Write `src/pipeline/scramble.ts`**

Constants are lifted from the prototype so the rebuilt look matches it. Per-pixel order (cosmetic, fixed here): **invert → chroma swap → hum → snow**; snow overwrites the pixel.

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/scramble.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/pipeline/scramble.ts tests/scramble.test.ts
git commit -m "feat: pure scramble pixel pipeline (sync/invert/chroma/hum/snow)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: coverFit + test pattern (TDD)

**Files:**
- Create: `src/pipeline/fit.ts`, `src/pipeline/testpattern.ts`
- Test: `tests/fit.test.ts`, `tests/testpattern.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `coverFit(srcW: number, srcH: number, dstW: number, dstH: number): { dx: number; dy: number; dw: number; dh: number }`
  - `BAR_COLORS: string[]` (7 entries)
  - `barRects(w: number, count?: number): { x: number; width: number }[]`
  - `drawTestPattern(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, clock: string): void`

- [ ] **Step 1: Write the failing tests**

`tests/fit.test.ts`:
```ts
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
```

`tests/testpattern.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/fit.test.ts tests/testpattern.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`src/pipeline/fit.ts`:
```ts
/** Scale a source rect to cover a destination rect, centered (negative offsets crop). */
export function coverFit(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}
```

`src/pipeline/testpattern.ts`:
```ts
export const BAR_COLORS = [
  '#c0c0c0',
  '#c0c000',
  '#00c0c0',
  '#00c000',
  '#c000c0',
  '#c00000',
  '#0000c0',
];

export function barRects(w: number, count = BAR_COLORS.length): { x: number; width: number }[] {
  const rects: { x: number; width: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round((i * w) / count);
    const next = Math.round(((i + 1) * w) / count);
    rects.push({ x, width: next - x });
  }
  return rects;
}

/** SMPTE-ish bars, castellations, a moving block and a clock so tear/roll read clearly. */
export function drawTestPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  clock: string,
): void {
  const barsH = Math.round(h * 0.66);
  barRects(w).forEach((r, i) => {
    ctx.fillStyle = BAR_COLORS[i];
    ctx.fillRect(r.x, 0, r.width, barsH);
  });
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, barsH, w, h - barsH);
  ctx.fillStyle = '#0a3a6b';
  ctx.fillRect(0, barsH, w / 7, h - barsH);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect((w * 6) / 7, barsH, w / 7, h - barsH);
  const x = (t * 2) % w;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, h * 0.72, 60, 60);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('CH 99', w / 2 - 46, h * 0.85);
  ctx.fillStyle = '#ffb531';
  ctx.font = '16px monospace';
  ctx.fillText(clock, w / 2 - 52, h * 0.92);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/fit.test.ts tests/testpattern.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/fit.ts src/pipeline/testpattern.ts tests/fit.test.ts tests/testpattern.test.ts
git commit -m "feat: cover-fit math and SMPTE-ish test pattern

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Export/record module (TDD for mime pick)

**Files:**
- Create: `src/export/record.ts`
- Test: `tests/record.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pickMimeType(isSupported?: (m: string) => boolean): string`
  - `type RecordHandle = { stop: () => void; done: Promise<Blob> }`
  - `startRecording(canvas: HTMLCanvasElement, audioStream: MediaStream | null): RecordHandle`
  - `downloadBlob(blob: Blob, filename: string): void`

- [ ] **Step 1: Write the failing test** — `tests/record.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickMimeType } from '../src/export/record';

describe('pickMimeType', () => {
  it('prefers vp9, falls back to vp8, then bare webm, then empty', () => {
    expect(pickMimeType((m) => m.includes('vp9'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType((m) => m.includes('vp8'))).toBe('video/webm;codecs=vp8,opus');
    expect(pickMimeType((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickMimeType(() => false)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/record.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/export/record.ts`**

```ts
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType(
  isSupported: (m: string) => boolean = (m) => MediaRecorder.isTypeSupported(m),
): string {
  return MIME_CANDIDATES.find(isSupported) ?? '';
}

export type RecordHandle = { stop: () => void; done: Promise<Blob> };

export function startRecording(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
): RecordHandle {
  const stream = canvas.captureStream(30);
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
  }
  const mime = pickMimeType();
  const rec = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined,
  );
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }));
  });
  rec.start(250);
  return {
    stop: () => {
      if (rec.state !== 'inactive') rec.stop();
    },
    done,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/record.test.ts`
Expected: 1 passed. (The default `isSupported` referencing `MediaRecorder` is never evaluated in node because tests always pass an explicit function.)

- [ ] **Step 5: Commit**

```bash
git add src/export/record.ts tests/record.test.ts
git commit -m "feat: canvas+audio webm recorder with codec fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: File source module

**Files:**
- Create: `src/source/fileSource.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `setupFileSource(opts: { video: HTMLVideoElement; dropZone: HTMLElement; fileInput: HTMLInputElement; onLoad: (name: string) => void }): void`

No unit test — this is thin DOM/event glue verified in the Task 8 browser smoke test.

- [ ] **Step 1: Write `src/source/fileSource.ts`**

```ts
export function setupFileSource(opts: {
  video: HTMLVideoElement;
  dropZone: HTMLElement;
  fileInput: HTMLInputElement;
  onLoad: (name: string) => void;
}): void {
  const { video, dropZone, fileInput, onLoad } = opts;
  let currentUrl: string | null = null;

  function load(file: File): void {
    if (!file.type.startsWith('video/')) return;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);
    video.src = currentUrl;
    video.load();
    onLoad(file.name);
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) load(f);
    fileInput.value = '';
  });
  for (const ev of ['dragover', 'dragenter'] as const) {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  }
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) load(f);
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/source/fileSource.ts
git commit -m "feat: drag/drop and file-input video source

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Audio garble module

**Files:**
- Create: `src/audio/garble.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class Garble` with `connect(video: HTMLVideoElement): void`, `setGarbled(on: boolean): void`, `resume(): void`, `recordingStream(): MediaStream | null`.

Ring modulation (~2.8 kHz sine carrier multiplied against the signal) approximates the frequency-inversion "Donald Duck" garble. The graph mirrors the prototype exactly, plus a `MediaStreamAudioDestinationNode` tap so exports can capture whatever mix is audible. No unit test (Web Audio has no node implementation); verified in the Task 8 smoke test.

- [ ] **Step 1: Write `src/audio/garble.ts`**

```ts
export class Garble {
  private ctx: AudioContext | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private recDest: MediaStreamAudioDestinationNode | null = null;
  private connected = false;

  /** Build the graph on first file load. createMediaElementSource is once-per-element. */
  connect(video: HTMLVideoElement): void {
    if (this.connected) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(video);
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = 2800;
      // Ring mod: a gain node at 0 whose gain is driven by the carrier => out = in * carrier.
      const mult = ctx.createGain();
      mult.gain.value = 0;
      carrier.connect(mult.gain);
      const dry = ctx.createGain();
      dry.gain.value = 1;
      const wet = ctx.createGain();
      wet.gain.value = 0;
      src.connect(mult).connect(wet).connect(ctx.destination);
      src.connect(dry).connect(ctx.destination);
      const recDest = ctx.createMediaStreamDestination();
      wet.connect(recDest);
      dry.connect(recDest);
      carrier.start();
      video.muted = false;
      this.ctx = ctx;
      this.dry = dry;
      this.wet = wet;
      this.recDest = recDest;
      this.connected = true;
    } catch (e) {
      console.warn('audio graph:', e);
    }
  }

  setGarbled(on: boolean): void {
    if (!this.ctx || !this.dry || !this.wet) return;
    const t = this.ctx.currentTime;
    this.wet.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.02);
    this.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.02);
  }

  /** Call from click handlers — AudioContext starts suspended until a user gesture. */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  recordingStream(): MediaStream | null {
    return this.recDest?.stream ?? null;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/audio/garble.ts
git commit -m "feat: ring-mod audio garble graph with recording tap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Faceplate UI (markup, styles, DOM module)

**Files:**
- Create: `src/ui/styles.css`, `src/ui/faceplate.ts`
- Modify: `index.html` (replace placeholder with full faceplate)

**Interfaces:**
- Consumes: `Effects`, `Amounts` key names from `src/types.ts`.
- Produces: `initFaceplate()` returning `{ canvas, video, stage, hint, descramble, fileInput, testBtn, playBtn, exportBtn, toggles: Record<keyof Effects, HTMLInputElement>, sliders: Record<keyof Amounts, { input: HTMLInputElement; readout: HTMLElement }>, setScrambled(on: boolean): void, setState(text: string): void }` and `type Faceplate`.

- [ ] **Step 1: Replace `index.html`** (prototype markup + EXPORT button; CSS moves to `src/ui/styles.css`, imported by `main.ts`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ch. 99 — Descrambler Unit</title>
</head>
<body>
<main class="box">
  <div class="plate">
    <div class="brand">CH·99 CABLE<small>ADDRESSABLE DESCRAMBLER UNIT</small></div>
    <div class="lamp"><span id="stateTxt" role="status">SCRAMBLED</span><span id="lamp" class="dot on-red" aria-hidden="true"></span></div>
  </div>

  <div class="screen-wrap" id="stage" aria-label="TV screen. Drop a video file here.">
    <canvas id="cv" width="640" height="480"></canvas>
    <video id="vid" playsinline muted loop></video>
    <div class="drop-hint" id="hint">NO SUBSCRIPTION SIGNAL<span>drop an mp4/webm here, or LOAD FILE — or run the test pattern</span></div>
  </div>

  <div class="rack">
    <div class="row">
      <button id="descramble" class="armed">DESCRAMBLE ▸ pay $ to view</button>
      <label class="file-btn">LOAD FILE<input type="file" id="file" accept="video/*"></label>
      <button id="testbtn">TEST PATTERN</button>
      <button id="playbtn">▶ PLAY / ❚❚</button>
      <button id="exportbtn">⬇ EXPORT WEBM</button>
    </div>

    <div class="toggles">
      <div class="tog"><label for="tSync">Sync suppression (tear/roll)</label><input type="checkbox" id="tSync" checked></div>
      <div class="tog"><label for="tInvert">Video inversion (negative)</label><input type="checkbox" id="tInvert" checked></div>
      <div class="tog"><label for="tHue">Chroma phase error</label><input type="checkbox" id="tHue" checked></div>
      <div class="tog"><label for="tNoise">RF snow / hum bar</label><input type="checkbox" id="tNoise" checked></div>
      <div class="tog"><label for="tAudio">Audio garble (freq invert)</label><input type="checkbox" id="tAudio"></div>
    </div>

    <div class="sliders">
      <div class="sld"><div class="cap"><span>TEAR DEPTH</span><span id="vTear">55</span></div><input type="range" id="sTear" min="0" max="100" value="55" aria-label="Tear depth"></div>
      <div class="sld"><div class="cap"><span>ROLL SPEED</span><span id="vRoll">30</span></div><input type="range" id="sRoll" min="0" max="100" value="30" aria-label="Roll speed"></div>
      <div class="sld"><div class="cap"><span>SNOW LEVEL</span><span id="vSnow">40</span></div><input type="range" id="sSnow" min="0" max="100" value="40" aria-label="Snow level"></div>
    </div>
  </div>
  <div class="foot">EMULATION ONLY · SYNC-SUPPRESSION LOOK IS FAKED IN CANVAS · NO REAL SIGNAL IS DECODED</div>
</main>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/ui/styles.css`** (prototype CSS ported verbatim, plus `:focus-visible` outlines and a visible focus ring for the toggle inputs):

```css
@import url('https://fonts.googleapis.com/css2?family=VT323&family=DM+Mono:wght@400;500&display=swap');

:root{
  --set-black:#0a0b0a;
  --set-panel:#141613;
  --phosphor:#ffb531;
  --phosphor-dim:#7a5410;
  --led-red:#ff3b30;
  --led-grn:#37d067;
  --hairline:#2a2c26;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:radial-gradient(120% 80% at 50% -10%, #17190f 0%, var(--set-black) 60%);
  color:var(--phosphor);
  font-family:'DM Mono',monospace;
  min-height:100%;
  display:flex;align-items:center;justify-content:center;
  padding:24px;
}

.box{
  width:min(880px,100%);
  background:linear-gradient(180deg,#16180f,#0d0e0a);
  border:1px solid var(--hairline);
  border-radius:10px;
  box-shadow:0 30px 80px -30px #000, inset 0 1px 0 #ffffff0a;
  overflow:hidden;
}

.plate{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;
  border-bottom:1px solid var(--hairline);
  background:linear-gradient(180deg,#1b1d12,#111309);
}
.brand{font-family:'VT323',monospace;font-size:30px;line-height:1;letter-spacing:1px}
.brand small{display:block;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3px;color:var(--phosphor-dim)}
.lamp{display:flex;align-items:center;gap:8px;font-family:'VT323',monospace;font-size:20px}
.dot{width:11px;height:11px;border-radius:50%;background:#333;box-shadow:0 0 0 1px #0006 inset}
.dot.on-red{background:var(--led-red);box-shadow:0 0 10px 1px var(--led-red)}
.dot.on-grn{background:var(--led-grn);box-shadow:0 0 10px 1px var(--led-grn)}

.screen-wrap{position:relative;background:#000;aspect-ratio:4/3}
canvas{display:block;width:100%;height:100%}
video{display:none}
.drop-hint{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:6px;
  font-family:'VT323',monospace;font-size:22px;color:#ffb53199;
  pointer-events:none;text-align:center;padding:20px;
}
.drop-hint span{font-family:'DM Mono',monospace;font-size:12px;color:#ffb53155}
.screen-wrap.dragover{outline:2px dashed var(--phosphor);outline-offset:-8px}

.rack{padding:16px 18px 20px;display:grid;gap:16px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
button, .file-btn{
  font-family:'VT323',monospace;font-size:19px;letter-spacing:.5px;
  background:#1d1f13;color:var(--phosphor);
  border:1px solid var(--hairline);border-radius:6px;
  padding:8px 14px;cursor:pointer;user-select:none;
  transition:transform .04s ease, background .15s;
}
button:hover,.file-btn:hover{background:#262813}
button:active{transform:translateY(1px)}
button.armed{background:var(--led-red);color:#170000;border-color:#ff6b60}
button:disabled{opacity:.45;cursor:wait}
.file-btn input{position:absolute;width:1px;height:1px;opacity:0}
.file-btn{position:relative}

.toggles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.tog{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:10px 12px;border:1px solid var(--hairline);border-radius:6px;
  background:#101208;font-size:12px;
}
.tog label{font-family:'VT323',monospace;font-size:18px;letter-spacing:.5px;cursor:pointer}
.tog input{appearance:none;width:42px;height:22px;border-radius:12px;background:#2a2c20;position:relative;cursor:pointer;border:1px solid var(--hairline)}
.tog input:checked{background:var(--phosphor-dim)}
.tog input::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#ffb53155;transition:.15s}
.tog input:checked::after{left:22px;background:var(--phosphor)}

.sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.sld{display:grid;gap:5px}
.sld .cap{display:flex;justify-content:space-between;font-size:11px;letter-spacing:2px;color:var(--phosphor-dim)}
input[type=range]{appearance:none;height:4px;border-radius:2px;background:#2a2c20}
input[type=range]::-webkit-slider-thumb{appearance:none;width:15px;height:15px;border-radius:50%;background:var(--phosphor);cursor:pointer;box-shadow:0 0 6px var(--phosphor)}
input[type=range]::-moz-range-thumb{width:15px;height:15px;border:none;border-radius:50%;background:var(--phosphor);cursor:pointer}

.foot{font-size:10px;letter-spacing:1.5px;color:var(--phosphor-dim);padding:0 18px 16px}

:focus-visible{outline:2px solid var(--phosphor);outline-offset:2px}
.file-btn:has(input:focus-visible){outline:2px solid var(--phosphor);outline-offset:2px}

@media (max-width:560px){
  body{padding:10px}
  .plate{flex-direction:column;gap:8px;align-items:flex-start}
}
```

- [ ] **Step 3: Write `src/ui/faceplate.ts`**

```ts
import type { Amounts, Effects } from '../types';

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

export function initFaceplate() {
  const lamp = must<HTMLElement>('lamp');
  const stateTxt = must<HTMLElement>('stateTxt');
  const descramble = must<HTMLButtonElement>('descramble');
  return {
    canvas: must<HTMLCanvasElement>('cv'),
    video: must<HTMLVideoElement>('vid'),
    stage: must<HTMLElement>('stage'),
    hint: must<HTMLElement>('hint'),
    descramble,
    fileInput: must<HTMLInputElement>('file'),
    testBtn: must<HTMLButtonElement>('testbtn'),
    playBtn: must<HTMLButtonElement>('playbtn'),
    exportBtn: must<HTMLButtonElement>('exportbtn'),
    toggles: {
      sync: must<HTMLInputElement>('tSync'),
      invert: must<HTMLInputElement>('tInvert'),
      chroma: must<HTMLInputElement>('tHue'),
      rf: must<HTMLInputElement>('tNoise'),
      audio: must<HTMLInputElement>('tAudio'),
    } satisfies Record<keyof Effects, HTMLInputElement>,
    sliders: {
      tear: { input: must<HTMLInputElement>('sTear'), readout: must<HTMLElement>('vTear') },
      roll: { input: must<HTMLInputElement>('sRoll'), readout: must<HTMLElement>('vRoll') },
      snow: { input: must<HTMLInputElement>('sSnow'), readout: must<HTMLElement>('vSnow') },
    } satisfies Record<keyof Amounts, { input: HTMLInputElement; readout: HTMLElement }>,
    setScrambled(on: boolean): void {
      descramble.classList.toggle('armed', on);
      descramble.textContent = on ? 'DESCRAMBLE ▸ pay $ to view' : 'RE-SCRAMBLE ▸ lock channel';
      lamp.className = 'dot ' + (on ? 'on-red' : 'on-grn');
      stateTxt.textContent = on ? 'SCRAMBLED' : 'CLEAR';
    },
    setState(text: string): void {
      stateTxt.textContent = text;
    },
  };
}

export type Faceplate = ReturnType<typeof initFaceplate>;
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc`
Expected: exit 0. (`index.html` still loads the placeholder `main.ts`; full wiring lands in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/styles.css src/ui/faceplate.ts
git commit -m "feat: CH-99 faceplate markup, styles, and DOM module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Main wiring — RAF loop, state, export flow

**Files:**
- Modify: `src/main.ts` (replace placeholder)

**Interfaces:**
- Consumes: everything produced by Tasks 2–7 — `scramble(src, out, params)`, `coverFit(srcW, srcH, dstW, dstH)`, `drawTestPattern(ctx, w, h, t, clock)`, `setupFileSource(opts)`, `class Garble` (`connect/setGarbled/resume/recordingStream`), `startRecording(canvas, audioStream)`, `downloadBlob(blob, name)`, `initFaceplate()`.

- [ ] **Step 1: Write `src/main.ts`**

```ts
import './ui/styles.css';
import { scramble } from './pipeline/scramble';
import { coverFit } from './pipeline/fit';
import { drawTestPattern } from './pipeline/testpattern';
import { setupFileSource } from './source/fileSource';
import { Garble } from './audio/garble';
import { startRecording, downloadBlob } from './export/record';
import { initFaceplate } from './ui/faceplate';
import type { Amounts, Effects, State } from './types';

const W = 640;
const H = 480;

const ui = initFaceplate();
const video = ui.video;
const visCtx = ui.canvas.getContext('2d')!;
const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const bufCtx = buffer.getContext('2d', { willReadFrequently: true })!;
const outFrame = visCtx.createImageData(W, H);

const effects: Effects = { sync: true, invert: true, chroma: true, rf: true, audio: false };
const amounts: Amounts = { tear: 0.55, roll: 0.3, snow: 0.4 };
const state: State = { scrambled: true, source: 'test', t: 0 };

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const garble = new Garble();
let exporting = false;

function syncAudio(): void {
  garble.resume();
  garble.setGarbled(state.scrambled && effects.audio);
}

ui.descramble.addEventListener('click', () => {
  state.scrambled = !state.scrambled;
  ui.setScrambled(state.scrambled);
  syncAudio();
});

ui.testBtn.addEventListener('click', () => {
  state.source = 'test';
  video.pause();
  ui.hint.style.display = 'none';
});

ui.playBtn.addEventListener('click', () => {
  if (state.source !== 'file') return;
  if (video.paused) void video.play();
  else video.pause();
});

for (const key of Object.keys(ui.toggles) as (keyof Effects)[]) {
  ui.toggles[key].addEventListener('change', () => {
    effects[key] = ui.toggles[key].checked;
    if (key === 'audio') syncAudio();
  });
}

for (const key of Object.keys(ui.sliders) as (keyof Amounts)[]) {
  const { input, readout } = ui.sliders[key];
  input.addEventListener('input', () => {
    amounts[key] = Number(input.value) / 100;
    readout.textContent = input.value;
  });
}

setupFileSource({
  video,
  dropZone: ui.stage,
  fileInput: ui.fileInput,
  onLoad: () => {
    state.source = 'file';
    ui.hint.style.display = 'none';
    garble.connect(video);
    syncAudio();
    video.play().catch(() => {});
  },
});

ui.exportBtn.addEventListener('click', () => {
  if (!exporting) void exportRecording();
});

async function exportRecording(): Promise<void> {
  exporting = true;
  ui.exportBtn.disabled = true;
  ui.setState('REC ●');
  garble.resume();
  const handle = startRecording(ui.canvas, garble.recordingStream());
  let cleanup = (): void => {};
  try {
    if (state.source === 'file') {
      video.loop = false;
      video.currentTime = 0;
      const onEnd = (): void => handle.stop();
      video.addEventListener('ended', onEnd);
      cleanup = () => {
        video.removeEventListener('ended', onEnd);
        video.loop = true;
      };
      await video.play();
    } else {
      const id = setTimeout(() => handle.stop(), 10_000);
      cleanup = () => clearTimeout(id);
    }
    const blob = await handle.done;
    downloadBlob(blob, state.scrambled ? 'ch99-scrambled.webm' : 'ch99-clean.webm');
  } finally {
    cleanup();
    exporting = false;
    ui.exportBtn.disabled = false;
    ui.setScrambled(state.scrambled);
  }
}

function drawSource(): boolean {
  if (state.source === 'test') {
    drawTestPattern(bufCtx, W, H, state.t, new Date().toLocaleTimeString());
    return true;
  }
  if (video.readyState >= 2) {
    const { dx, dy, dw, dh } = coverFit(video.videoWidth, video.videoHeight, W, H);
    bufCtx.fillStyle = '#000';
    bufCtx.fillRect(0, 0, W, H);
    try {
      bufCtx.drawImage(video, dx, dy, dw, dh);
    } catch {
      return false;
    }
    return true;
  }
  return false;
}

function frame(): void {
  state.t++;
  if (drawSource()) {
    if (state.scrambled) {
      const motion = reducedMotion.matches ? 0.15 : 1;
      const src = bufCtx.getImageData(0, 0, W, H);
      scramble(src, outFrame, {
        effects,
        amounts: {
          tear: amounts.tear * motion,
          roll: amounts.roll * motion,
          snow: reducedMotion.matches ? Math.min(1, amounts.snow + 0.25) : amounts.snow,
        },
        t: state.t,
        rand: Math.random,
      });
      visCtx.putImageData(outFrame, 0, 0);
    } else {
      visCtx.drawImage(buffer, 0, 0);
    }
  }
  requestAnimationFrame(frame);
}

ui.setScrambled(state.scrambled);
frame();
```

Note: `outFrame` is an `ImageData`; `scramble` accepts it because `ImageData` is structurally a `Frame`. The test-pattern source runs immediately on load (acceptance: works with zero input); the hint overlay sits on top until the user loads a file or presses TEST PATTERN.

- [ ] **Step 2: Full test suite + typecheck + build**

Run: `npm test && npm run build`
Expected: all tests pass, build exits 0.

- [ ] **Step 3: Browser smoke test**

Run: `npm run dev -- --host` and open `http://<lan-ip>:5173` (user is on the LAN — serve via LAN IP per standing preference).
Verify manually (or via user):
- Scrambled test pattern animates at load, no console errors.
- DESCRAMBLE shows clean bars; lamp flips red→green.
- All five toggles and three sliders change output live.
- Dropping an mp4 plays it scrambled; audio toggle garbles sound.
- EXPORT WEBM downloads a playable file.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire faceplate, RAF scramble loop, and webm export

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: README, Pages workflow, GitHub repo + deploy

**Files:**
- Create: `README.md`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run build` from Task 1.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `README.md`**

```markdown
# CH·99 — Scrambled-Channel Simulator

Reproduces the look and sound of 1980s–90s analog premium-cable scrambling
(sync suppression, video inversion, chroma corruption, RF hum/snow, ring-mod
audio garble) in the browser. Drop in a video file, watch it scrambled,
DESCRAMBLE it back, and EXPORT the scrambled result as a downloadable `.webm`.

**Emulation only — no real signal is decoded.**

## Use it

Live: deployed via GitHub Pages (see repo settings → Pages for the URL).

- **LOAD FILE** or drag-and-drop an mp4/webm onto the screen (files stay
  local — nothing is uploaded).
- **TEST PATTERN** runs a generated SMPTE-ish pattern with zero input.
- **DESCRAMBLE / RE-SCRAMBLE** flips the whole pipeline.
- Effect toggles (sync, invert, chroma, RF, audio) and sliders (tear, roll,
  snow) change the output live.
- **EXPORT WEBM** re-plays the clip through the scrambler and downloads the
  recording (audio included if the garble toggle is on).

Why file drop instead of a YouTube URL? A cross-origin iframe taints the
canvas, so per-frame pixel scrambling of an embed is impossible in a browser.
Download the clip and drop it in.

## Develop

```bash
npm install
npm run dev    # local dev server
npm test       # vitest unit tests (pure pixel-pipeline logic)
npm run build  # typecheck + production build to dist/
```

The original single-file prototype lives in `prototype/scrambler.html`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md .github/workflows/deploy.yml
git commit -m "docs: README and GitHub Pages deploy workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Create GitHub repo and push**

Run:
```bash
gh auth status
```
If NOT authenticated: STOP and report — the user must run `! gh auth login` (this is the one genuine user-input blocker).

If authenticated:
```bash
cd /home/gigawatt/dev/tv-scrambler
gh repo create tv-scrambler --public --source . --push
```
Expected: repo created, main pushed, Actions run starts.

- [ ] **Step 5: Verify the Pages deploy**

Run:
```bash
gh run watch --exit-status
gh api repos/{owner}/tv-scrambler/pages --jq .html_url
curl -sI <pages-url> | head -3
```
Expected: workflow green; Pages URL returns `HTTP/2 200`; report the live URL to the user.

---

## Self-Review Notes

- **Spec coverage:** sync/invert/chroma/RF/audio effects (Task 2/6), test pattern (Task 3), file source + drag-drop (Task 5), faceplate UI with lamps/toggles/sliders/disclaimer (Task 7), RAF data flow with offscreen buffer + descramble path (Task 8), gotchas (willReadFrequently Task 8, audio gesture/resume Task 6/8, single createMediaElementSource Task 6, cover-fit Task 3, 640×480 Task 8, try/catch drawImage Task 8), reduced-motion + focus-visible (Tasks 7/8), reused output buffer (Task 8). New requirements: export/download (Tasks 4/8), GitHub Pages (Task 9). YouTube overlay mode deliberately not built (spec: optional; not requested).
- **Type consistency:** `Frame` used by `scramble`; `ImageData` structurally satisfies it. `Effects`/`Amounts` key names (`sync/invert/chroma/rf/audio`, `tear/roll/snow`) are shared by `faceplate.ts` toggles/sliders maps and `main.ts` loops.
- **Known deviation from prototype:** the rebuilt loop starts on the test pattern instead of a black screen (spec acceptance criterion "runs test pattern with zero input" wins); the hint overlay still advertises file drop until first interaction.
