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
