export const MODEL_CHAIN = [
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

const RETRYABLE_STATUSES = new Set([404, 408, 409, 429, 500, 502, 503, 504]);
const DEADLINE_RESERVE_MS = 300;
const MIN_ATTEMPT_MS = 250;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\u0000/g, '').slice(0, maxLength);
}

export function extractText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim() || '';
}

function deadlineSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason ?? 'parent-abort');
  parentSignal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onAbort);
    },
  };
}

function computeAttemptTimeout({ attemptTimeoutMs, overallTimeoutMs, elapsedMs, remainingModels }) {
  const remainingOverallMs = Math.max(0, overallTimeoutMs - elapsedMs);
  if (remainingOverallMs <= DEADLINE_RESERVE_MS || remainingModels <= 0) return 0;
  const fairShareMs = Math.floor((remainingOverallMs - DEADLINE_RESERVE_MS) / remainingModels);
  return Math.max(MIN_ATTEMPT_MS, Math.min(attemptTimeoutMs, fairShareMs));
}

async function callModel({ apiKey, model, system, prompt, maxOutputTokens, timeoutMs, signal }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const attempt = deadlineSignal(timeoutMs, signal);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: attempt.signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.2,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    const text = extractText(payload);
    return {
      ok: response.ok && Boolean(text),
      status: response.status,
      text,
      latencyMs: Date.now() - startedAt,
      usage: payload?.usageMetadata
        ? {
            promptTokenCount: payload.usageMetadata.promptTokenCount,
            candidatesTokenCount: payload.usageMetadata.candidatesTokenCount,
            totalTokenCount: payload.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  } finally {
    attempt.dispose();
  }
}

export async function routeGemini({
  apiKey,
  system,
  prompt,
  task = 'vocabulary-enrichment',
  maxOutputTokens = 420,
  attemptTimeoutMs = 4_500,
  overallTimeoutMs = 10_000,
  acceptText = () => true,
}) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };

  const overall = deadlineSignal(overallTimeoutMs);
  const attempts = [];
  const startedAt = Date.now();

  try {
    for (let index = 0; index < MODEL_CHAIN.length; index += 1) {
      const model = MODEL_CHAIN[index];
      if (overall.signal.aborted) break;

      const timeoutMs = computeAttemptTimeout({
        attemptTimeoutMs,
        overallTimeoutMs,
        elapsedMs: Date.now() - startedAt,
        remainingModels: MODEL_CHAIN.length - index,
      });
      if (timeoutMs <= 0) break;

      try {
        const result = await callModel({
          apiKey,
          model,
          system,
          prompt,
          maxOutputTokens,
          timeoutMs,
          signal: overall.signal,
        });

        const accepted = result.ok && acceptText(result.text);
        attempts.push({
          model,
          status: result.ok && !accepted ? 'invalid-output' : result.status,
          latencyMs: result.latencyMs,
          ok: accepted,
        });

        if (accepted) {
          return {
            ok: true,
            model,
            text: result.text,
            task,
            latencyMs: Date.now() - startedAt,
            fallbackCount: attempts.length - 1,
            usage: result.usage,
            attempts,
          };
        }

        if (result.ok) continue;
        if (!RETRYABLE_STATUSES.has(result.status)) {
          return { ok: false, error: 'provider-rejected-request', status: result.status, task, attempts };
        }
      } catch (error) {
        attempts.push({
          model,
          status: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network-error',
          latencyMs: Math.max(0, Date.now() - startedAt - attempts.reduce((sum, item) => sum + item.latencyMs, 0)),
          ok: false,
        });
      }
    }
  } finally {
    overall.dispose();
  }

  return { ok: false, error: 'all-models-unavailable', task, attempts };
}
