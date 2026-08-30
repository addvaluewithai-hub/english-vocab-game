export const MEDIA_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

const RETRYABLE_STATUSES = new Set([404, 408, 409, 429, 500, 502, 503, 504]);
const DEFAULT_ATTEMPT_TIMEOUT_MS = 8_000;

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
      generationConfig: { maxOutputTokens, temperature: 0.1 },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    text: extractGenerateText(payload),
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
    latencyMs: Date.now() - startedAt,
  };
}

async function routeChain(call, acceptText, attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS) {
  const attempts = [];
  for (const model of MEDIA_MODEL_CHAIN) {
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
  return { ok: false, error: 'all-models-unavailable', attempts };
}

export async function routeGeminiMedia({ apiKey, parts, maxOutputTokens = 1600, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model, signal) => callGenerateContent({ apiKey, model, parts, maxOutputTokens, signal }),
    acceptText,
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
        { type: 'video', uri: url },
        { type: 'text', text: prompt },
      ],
      signal,
    }),
    acceptText,
    12_000,
  );
}
