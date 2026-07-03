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
