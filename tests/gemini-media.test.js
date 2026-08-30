import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEDIA_ATTEMPT_TIMEOUT_MS,
  MEDIA_MODEL_CHAIN,
  YOUTUBE_ATTEMPT_TIMEOUT_MS,
  routeGeminiMedia,
  routeGeminiYouTube,
} from '../functions/_shared/gemini-media.js';

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Gemini media router', () => {
  it('keeps the approved media model chain unchanged', () => {
    expect(MEDIA_MODEL_CHAIN).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
    ]);
  });

  it('uses longer media and YouTube timeout budgets', () => {
    expect(MEDIA_ATTEMPT_TIMEOUT_MS).toBe(30_000);
    expect(YOUTUBE_ATTEMPT_TIMEOUT_MS).toBe(60_000);
  });

  it('falls back to the second approved model after a retryable media failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: '{"candidates":[{"term":"hello"}]}' }] } }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeGeminiMedia({
      apiKey: 'test-key',
      parts: [{ text: 'test' }],
      acceptText: (text) => text.includes('hello'),
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(result.fallbackCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/gemini-3.1-flash-lite:generateContent');
    expect(fetchMock.mock.calls[1][0]).toContain('/gemini-3.5-flash-lite:generateContent');
  });

  it('gives regular media calls a 30 second attempt timer', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
    })));

    const result = await routeGeminiMedia({
      apiKey: 'test-key',
      parts: [{ text: 'test' }],
      acceptText: () => true,
    });

    expect(result.ok).toBe(true);
    expect(timeoutSpy.mock.calls.some((call) => call[1] === MEDIA_ATTEMPT_TIMEOUT_MS)).toBe(true);
  });

  it('gives YouTube calls a 60 second attempt timer and preserves the video input', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { output_text: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://www.youtube.com/watch?v=test123';
    const result = await routeGeminiYouTube({
      apiKey: 'test-key',
      url,
      prompt: 'extract vocabulary',
      acceptText: () => true,
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(timeoutSpy.mock.calls.some((call) => call[1] === YOUTUBE_ATTEMPT_TIMEOUT_MS)).toBe(true);

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.model).toBe('gemini-3.1-flash-lite');
    expect(request.input).toEqual([
      { type: 'video', uri: url },
      { type: 'text', text: 'extract vocabulary' },
    ]);
  });
});
