export const MEDIA_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

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

async function callGenerateContent({ apiKey, model, parts, maxOutputTokens }) {
  const startedAt = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
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

async function callInteraction({ apiKey, model, input }) {
  const startedAt = Date.now();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
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

async function routeChain(call, acceptText) {
  const attempts = [];
  for (const model of MEDIA_MODEL_CHAIN) {
    try {
      const result = await call(model);
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
        latencyMs: 0,
        ok: false,
      });
    }
  }
  return { ok: false, error: 'all-models-unavailable', attempts };
}

export async function routeGeminiMedia({ apiKey, parts, maxOutputTokens = 1600, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model) => callGenerateContent({ apiKey, model, parts, maxOutputTokens }),
    acceptText,
  );
}

export async function routeGeminiYouTube({ apiKey, url, prompt, acceptText = () => true }) {
  if (!apiKey) return { ok: false, error: 'missing-api-key', attempts: [] };
  return routeChain(
    (model) => callInteraction({
      apiKey,
      model,
      input: [
        { type: 'video', uri: url },
        { type: 'text', text: prompt },
      ],
    }),
    acceptText,
  );
}
