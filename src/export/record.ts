// mp4 first: X/Instagram/TikTok reject webm, and Chrome/Safari can record mp4 directly.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType(
  isSupported: (m: string) => boolean = (m) => MediaRecorder.isTypeSupported(m),
): string {
  return MIME_CANDIDATES.find(isSupported) ?? '';
}

export type RecordHandle = { stop: () => void; done: Promise<Blob>; mimeType: string };

/** File extension matching a picked mime type. */
export function extensionFor(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

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
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }));
  });
  rec.start(250);
  return {
    stop: () => {
      if (rec.state !== 'inactive') rec.stop();
    },
    done,
    mimeType: rec.mimeType || mime,
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
