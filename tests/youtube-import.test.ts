import { describe, expect, it } from 'vitest';
import { normalizeYouTubeUrl } from '@/imports/youtube';

describe('YouTube import source normalization', () => {
  it('canonicalizes common YouTube URL forms to one idempotency fingerprint', () => {
    const urls = [
      'https://www.youtube.com/watch?v=abc123XYZ_0&feature=share',
      'https://youtu.be/abc123XYZ_0?t=42',
      'https://www.youtube.com/shorts/abc123XYZ_0',
      'https://www.youtube.com/live/abc123XYZ_0?si=test',
    ];
    const normalized = urls.map(normalizeYouTubeUrl);
    expect(new Set(normalized.map((item) => item.fingerprint))).toEqual(new Set(['youtube:abc123XYZ_0']));
    expect(new Set(normalized.map((item) => item.canonicalUrl))).toEqual(new Set(['https://www.youtube.com/watch?v=abc123XYZ_0']));
  });

  it('rejects non-YouTube and malformed links', () => {
    expect(() => normalizeYouTubeUrl('https://example.com/watch?v=abc123XYZ_0')).toThrow(/YouTube/i);
    expect(() => normalizeYouTubeUrl('not a url')).toThrow(/valid YouTube URL/i);
  });
});
