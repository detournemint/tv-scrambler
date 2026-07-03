import { describe, it, expect } from 'vitest';
import { pickMimeType, extensionFor } from '../src/export/record';

describe('pickMimeType', () => {
  it('prefers mp4 (with codecs, then bare), then vp9/vp8/bare webm, then empty', () => {
    expect(pickMimeType((m) => m.startsWith('video/mp4'))).toBe(
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    );
    expect(pickMimeType((m) => m === 'video/mp4')).toBe('video/mp4');
    expect(pickMimeType((m) => m.includes('vp9'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType((m) => m.includes('vp8'))).toBe('video/webm;codecs=vp8,opus');
    expect(pickMimeType((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickMimeType(() => false)).toBe('');
  });
});

describe('extensionFor', () => {
  it('maps mime types to file extensions', () => {
    expect(extensionFor('video/mp4;codecs=avc1.42E01E,mp4a.40.2')).toBe('mp4');
    expect(extensionFor('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(extensionFor('')).toBe('webm');
  });
});
