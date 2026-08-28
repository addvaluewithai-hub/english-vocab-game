import { describe, expect, it } from 'vitest';
import { isLocalAudioUri, pronunciationCacheKey, pronunciationFileExtension } from '@/audio/cache-key';

describe('pronunciation cache keys', () => {
  it('creates deterministic filenames while preserving supported extensions', () => {
    const uri = 'https://cdn.example.test/audio/hello.M4A?token=abc';
    expect(pronunciationCacheKey(uri)).toBe(pronunciationCacheKey(uri));
    expect(pronunciationCacheKey(uri)).not.toBe(pronunciationCacheKey(`${uri}2`));
    expect(pronunciationFileExtension(uri)).toBe('.m4a');
  });

  it('uses a playback-friendly fallback extension and leaves local files alone', () => {
    expect(pronunciationFileExtension('https://cdn.example.test/pronunciation?id=1')).toBe('.mp3');
    expect(isLocalAudioUri('file:///data/audio.mp3')).toBe(true);
    expect(isLocalAudioUri('https://cdn.example.test/audio.mp3')).toBe(false);
  });
});
