import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GEMINI_TEXT_MODEL_CHAIN,
  GEMINI_VIDEO_MODEL_CHAIN,
  computeGeminiAttemptTimeout,
  routeGeminiContent,
  routeGeminiText,
} from '@/server/gemini-router';

function providerResponse(status: number, text = ''): Response {
  return new Response(JSON.stringify(text ? {
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { totalTokenCount: 12 },
  } : {}), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Gemini model router', () => {
  it('falls through a rate-limited text model to the next configured model', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(429))
      .mockResolvedValueOnce(providerResponse(200, '{"candidates":[]}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeGeminiText({
      apiKey: 'test-key',
      system: 'system',
      prompt: 'prompt',
      task: 'vocabulary_text_import',
      attemptTimeoutMs: 1_000,
      overallTimeoutMs: 3_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe(GEMINI_TEXT_MODEL_CHAIN[1]);
    expect(result.fallbackCount).toBe(1);
    expect(result.attempts).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('routes a YouTube video to the next video-capable model after a 429', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(429))
      .mockResolvedValueOnce(providerResponse(200, '{"candidates":[]}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeGeminiContent({
      apiKey: 'test-key',
      system: 'system',
      parts: [
        { file_data: { file_uri: 'https://www.youtube.com/watch?v=abc123XYZ_0', mime_type: 'video/*' } },
        { text: 'extract vocabulary' },
      ],
      task: 'vocabulary_youtube_import',
      models: GEMINI_VIDEO_MODEL_CHAIN,
      attemptTimeoutMs: 1_000,
      overallTimeoutMs: 3_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe(GEMINI_VIDEO_MODEL_CHAIN[1]);
    expect(result.fallbackCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(String(secondInit?.body)).toContain('youtube.com/watch');
  });

  it('stops immediately on a non-retryable provider rejection', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(400));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeGeminiText({
      apiKey: 'test-key',
      system: 'system',
      prompt: 'prompt',
      task: 'vocabulary_text_import',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider-rejected-request');
    expect(result.attempts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a safe failure after every configured text model is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse(503));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeGeminiText({
      apiKey: 'test-key',
      system: 'system',
      prompt: 'prompt',
      task: 'vocabulary_text_import',
      attemptTimeoutMs: 1_000,
      overallTimeoutMs: 5_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('all-models-unavailable');
    expect(result.attempts).toHaveLength(GEMINI_TEXT_MODEL_CHAIN.length);
  });

  it('reserves deadline budget for later fallbacks', () => {
    expect(computeGeminiAttemptTimeout({
      attemptTimeoutMs: 4_000,
      overallTimeoutMs: 9_000,
      elapsedMs: 0,
      remainingModels: 4,
    })).toBe(2_175);
    expect(computeGeminiAttemptTimeout({
      attemptTimeoutMs: 4_000,
      overallTimeoutMs: 9_000,
      elapsedMs: 4_400,
      remainingModels: 2,
    })).toBe(2_150);
  });
});
