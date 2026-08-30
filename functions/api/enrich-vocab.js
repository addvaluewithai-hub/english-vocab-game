import { cleanText, json, routeGemini } from '../_shared/gemini-router.js';
import { checkBestEffortRateLimit, isSameOriginRequest } from '../_shared/request-guard.js';

const MAX_ITEMS = 40;

function parseJsonObject(text) {
  const trimmed = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeRequested(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    const term = cleanText(raw?.term, 160).replace(/\s+/g, ' ');
    if (!term) continue;
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      term,
      kind: raw?.kind === 'PHRASE' || term.includes(' ') ? 'PHRASE' : 'WORD',
      contextHint: cleanText(raw?.contextHint, 180),
    });
  }
  return items;
}

function normalizeEnriched(text, requested) {
  const parsed = parseJsonObject(text);
  if (!parsed || !Array.isArray(parsed.items)) return null;
  const byTerm = new Map();
  for (const raw of parsed.items) {
    if (!raw || typeof raw !== 'object') continue;
    const term = cleanText(raw.term, 160).replace(/\s+/g, ' ');
    const translation = cleanText(raw.translation, 240);
    const definition = cleanText(raw.definition, 360);
    const contextSentence = cleanText(raw.contextSentence, 360);
    const exampleTranslation = cleanText(raw.exampleTranslation, 360);
    const partOfSpeech = cleanText(raw.partOfSpeech, 70).toLowerCase();
    if (!term || !translation || !contextSentence) continue;
    byTerm.set(term.toLocaleLowerCase(), {
      term,
      translation,
      definition,
      contextSentence,
      exampleTranslation,
      partOfSpeech,
    });
  }
  const ordered = requested.map((item) => byTerm.get(item.term.toLocaleLowerCase())).filter(Boolean);
  return ordered.length === requested.length ? ordered : null;
}

export async function onRequestPost(context) {
  if (!isSameOriginRequest(context.request)) return json({ error: 'origin-not-allowed' }, 403);
  const declaredLength = Number(context.request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 32_000) return json({ error: 'request-too-large' }, 413);

  const rate = checkBestEffortRateLimit(context.request, {
    namespace: 'vocabulary-batch-enrichment',
    limit: 12,
    windowMs: 60_000,
  });
  if (!rate.allowed) return json({ error: 'too-many-requests', retryAt: rate.resetAt }, 429);
  if (!context.env.GEMINI_API_KEY) return json({ error: 'gemini-not-configured' }, 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }

  const requested = normalizeRequested(body?.items);
  if (!requested.length) return json({ error: 'items-required' }, 400);

  const system = [
    'You are the enrichment engine for an English-to-Arabic vocabulary learning app.',
    'Return strict JSON only, with one output item for every input item and preserve each term exactly.',
    'Choose the sense suggested by contextHint when present; otherwise choose the most useful everyday learner meaning.',
    'Use concise Modern Standard Arabic for the word or phrase meaning.',
    'Write a short learner-friendly English definition.',
    'Write one natural English example sentence that clearly demonstrates that meaning.',
    'Translate the example sentence naturally into Arabic.',
    'Do not add extra vocabulary items.',
  ].join(' ');

  const prompt = [
    'Enrich these selected vocabulary items:',
    JSON.stringify(requested),
    'Return exactly this shape:',
    '{"items":[{"term":"same input term","translation":"Arabic meaning","definition":"short English definition","contextSentence":"natural English example","exampleTranslation":"Arabic example translation","partOfSpeech":"noun|verb|adjective|adverb|phrase|other"}]}',
  ].join('\n\n');

  const result = await routeGemini({
    apiKey: context.env.GEMINI_API_KEY,
    system,
    prompt,
    task: 'vocabulary-batch-enrichment',
    maxOutputTokens: Math.min(6200, 220 + requested.length * 145),
    attemptTimeoutMs: 7_000,
    overallTimeoutMs: 22_000,
    acceptText: (value) => Boolean(normalizeEnriched(value, requested)),
  });

  if (!result.ok) {
    console.warn('Gemini batch enrichment failed', { error: result.error, status: result.status, attempts: result.attempts });
    return json({ error: result.error, attempts: result.attempts }, result.status === 401 || result.status === 403 ? result.status : 503);
  }

  const items = normalizeEnriched(result.text, requested);
  if (!items) return json({ error: 'invalid-model-output' }, 502);
  return json({ items, model: result.model, fallbackCount: result.fallbackCount });
}

export function onRequestGet() {
  return json({ ok: true, service: 'gemini-vocabulary-batch-enrichment', maxItems: MAX_ITEMS });
}
