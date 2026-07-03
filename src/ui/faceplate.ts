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
    recBadge: must<HTMLElement>('recbadge'),
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
