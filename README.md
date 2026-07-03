# CH·99 — Scrambled-Channel Simulator

Reproduces the look and sound of 1980s–90s analog premium-cable scrambling
(sync suppression, video inversion, chroma corruption, RF hum/snow, ring-mod
audio garble) in the browser. Drop in a video file, watch it scrambled,
DESCRAMBLE it back, and EXPORT the scrambled result as a downloadable `.webm`.

**Emulation only — no real signal is decoded.**

## Use it

Live: <https://detournemint.github.io/tv-scrambler/>

- **LOAD FILE** or drag-and-drop an mp4/webm onto the screen (files stay
  local — nothing is uploaded).
- **TEST PATTERN** runs a generated SMPTE-ish pattern with zero input.
- **DESCRAMBLE / RE-SCRAMBLE** flips the whole pipeline.
- Effect toggles (sync, invert, chroma, RF, audio) and sliders (tear, roll,
  snow) change the output live.
- **EXPORT CLIP** re-plays the clip through the scrambler and downloads the
  recording (audio included if the garble toggle is on). Records straight to
  **mp4** where the browser supports it (Chrome, Safari) — uploadable to
  X/Instagram/TikTok/YouTube as-is; otherwise falls back to **webm**, which
  YouTube accepts directly.

Why file drop instead of a YouTube URL? A cross-origin iframe taints the
canvas, so per-frame pixel scrambling of an embed is impossible in a browser.
Download the clip and drop it in.

## Develop

```bash
npm install
npm run dev    # local dev server
npm test       # vitest unit tests (pure pixel-pipeline logic)
npm run build  # typecheck + production build to dist/
npm run deploy # test + build + push dist/ to the gh-pages branch
```

Deploys go through the `gh-pages` branch (`npm run deploy`). A ready-made
GitHub Actions workflow lives in `docs/github-pages-workflow.yml` — move it
to `.github/workflows/deploy.yml` once your `gh` token has the `workflow`
scope (`gh auth refresh -s workflow`) if you'd rather deploy on every push.

The original single-file prototype lives in `prototype/scrambler.html`.
