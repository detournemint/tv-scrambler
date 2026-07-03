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
