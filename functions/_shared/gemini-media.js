export const MEDIA_MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export const MEDIA_ATTEMPT_TIMEOUT_MS = 30_000;
export const YOUTUBE_ATTEMPT_TIMEOUT_MS = 60_000;

const RETRYABLE_STATUSES = new Set([404, 408, 409, 429, 500, 502, 503, 504]);

function extractGenerateText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim() || '';
}

function extractInteractionText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  const stepText = Array.isArray(payload?.steps)
    ? payload.steps.flatMap((step) => Array.isArray(step?.content) ? step.content : [])
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()
    : '';
  if (stepText) return stepText;

  const found = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.text === 'string') found.push(value.text);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(payload);
  return found.join('').trim();
}

function providerMessage(payload) {
  const message = payload?.error?.message;
  return typeof message === 'string' ? message.slice(0, 240) : '';
}

function attemptSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  return {
    signal: controller.signal,
    dispose() { clearTimeout(timer); },
  };
}

async function callGenerateContent({ apiKey, model, parts, maxOutputTokens, tools, signal }) {
  const startedAt = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      ...(tools?.length ? { tools } : {}),
      generationConfig: { maxOutputTokens },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    text: extractGenerateText(payload),
    providerMessage: providerMessage(payload),
    latencyMs: Date.now() - startedAt,
  };
}

async function callInteraction({ apiKey, model, input, signal }) {
  const startedAt = Date.now();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({ model, input }),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    text: extractInteractionText(payload),
    providerMessage: providerMessage(payload),
    latencyMs: Date.now() - startedAt,
  };
}

function classifyFailure(attempts) {
  if (attempts.some((attempt) => attempt.status === 429)) return 'rate-limited';
  if (attempts.some((attempt) => attempt.status === 'timeout')) return 'media-timeout';
  if (attempts.length && attempts.every((attempt) => attempt.status === 404)) return 'model-not-available';
  return 'all-models-unavailable';
}

async function routeChain(call, acceptText, attemptTimeoutMs = MEDIA_ATTEMPT_TIMEOUT_MS, models = MEDIA_MODEL_CHAIN) {
  const attempts = [];
  for (const model of models) {
    const deadline = attemptSignal(attemptTimeoutMs);
    const startedAt = Date.now();
    try {
      const result = await call(model, deadline.signal);
      const accepted = result.ok && Boolean(result.text) && acceptText(result.text);
      attempts.push({
        model,
        status: result.ok && !accepted ? 'invalid-output' : result.status,
        latencyMs: result.latencyMs,
        ok: accepted,
        ...(result.providerMessage ? { providerMessage: result.providerMessage } : {}),
      });
      if (accepted) return { ok: true, model, text: result.text, fallbackCount: attempts.length - 1, attempts };
      if (!result.ok && !RETRYABLE_STATUSES.has(result.status)) {
        return { ok: false, error: 'provider-rejected-request', status: result.status, attempts };
      }
    } catch (error) {
      attempts.push({
        model,
        status: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network-error',
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
    } finally {
      deadline.dispose();
    }
  }
  return { ok: false, error: classifyFailure(attempts), attempts };
}

export async function routeGeminiMedia({ apiKey, parts, maxOutputTokens = 1600, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model, signal) => callGenerateContent({ apiKey, model, parts, maxOutputTokens, signal }),
    acceptText,
  );
}

export async function routeGeminiDocument({ apiKey, data, prompt, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model, signal) => callInteraction({
      apiKey,
      model,
      input: [
        { type: 'document', data, mime_type: 'application/pdf' },
        { type: 'text', text: prompt },
      ],
      signal,
    }),
    acceptText,
    MEDIA_ATTEMPT_TIMEOUT_MS,
    ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
  );
}

export async function routeGeminiUrl({ apiKey, url, prompt, maxOutputTokens = 1800, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model, signal) => callGenerateContent({
      apiKey,
      model,
      parts: [{ text: `${prompt}\n\nPUBLIC SOURCE URL:\n${url}` }],
      maxOutputTokens,
      tools: [{ url_context: {} }],
      signal,
    }),
    acceptText,
  );
}

export async function routeGeminiYouTube({ apiKey, url, prompt, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model, signal) => callInteraction({
      apiKey,
      model,
      input: [
        { type: 'text', text: prompt },
        { type: 'video', uri: url },
      ],
      signal,
    }),
    acceptText,
    YOUTUBE_ATTEMPT_TIMEOUT_MS,
    ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'],
  );
}
