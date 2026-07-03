import './ui/styles.css';
import { scramble } from './pipeline/scramble';
import { coverFit } from './pipeline/fit';
import { drawTestPattern } from './pipeline/testpattern';
import { setupFileSource } from './source/fileSource';
import { Garble } from './audio/garble';
import { startRecording, downloadBlob, extensionFor } from './export/record';
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
const amounts: Amounts = { tear: 0.45, roll: 0.2, snow: 0.18 };
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

const EXPORT_LABEL = '⬇ EXPORT CLIP';
const TEST_EXPORT_MS = 10_000;

async function exportRecording(): Promise<void> {
  exporting = true;
  const btn = ui.exportBtn;
  btn.disabled = true;
  btn.classList.add('recording');
  ui.recBadge.hidden = false;
  ui.setState('REC ●');
  garble.resume();
  const handle = startRecording(ui.canvas, garble.recordingStream());
  let cleanup = (): void => {};
  try {
    if (state.source === 'file') {
      video.loop = false;
      video.currentTime = 0;
      const onEnd = (): void => handle.stop();
      const onTime = (): void => {
        const pct = video.duration ? Math.round((video.currentTime / video.duration) * 100) : 0;
        btn.textContent = `● RECORDING… ${pct}%`;
      };
      video.addEventListener('ended', onEnd);
      video.addEventListener('timeupdate', onTime);
      cleanup = () => {
        video.removeEventListener('ended', onEnd);
        video.removeEventListener('timeupdate', onTime);
        video.loop = true;
      };
      btn.textContent = '● RECORDING… 0%';
      await video.play();
    } else {
      const startedAt = performance.now();
      const id = setTimeout(() => handle.stop(), TEST_EXPORT_MS);
      const tick = setInterval(() => {
        const left = Math.max(0, Math.ceil((TEST_EXPORT_MS - (performance.now() - startedAt)) / 1000));
        btn.textContent = `● RECORDING… ${left}s`;
      }, 250);
      cleanup = () => {
        clearTimeout(id);
        clearInterval(tick);
      };
      btn.textContent = `● RECORDING… ${TEST_EXPORT_MS / 1000}s`;
    }
    const blob = await handle.done;
    const ext = extensionFor(handle.mimeType);
    downloadBlob(blob, state.scrambled ? `ch99-scrambled.${ext}` : `ch99-clean.${ext}`);
    btn.textContent = '✓ SAVED — CHECK DOWNLOADS';
    setTimeout(() => {
      if (!exporting) btn.textContent = EXPORT_LABEL;
    }, 2500);
  } finally {
    cleanup();
    exporting = false;
    btn.disabled = false;
    btn.classList.remove('recording');
    ui.recBadge.hidden = true;
    ui.setScrambled(state.scrambled);
    if (btn.textContent?.startsWith('● REC')) btn.textContent = EXPORT_LABEL;
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
