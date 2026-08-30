import { cleanText, json, routeGemini } from '../_shared/gemini-router.js';

function parseJsonObject(text) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizePayload(value) {
  if (!value || typeof value !== 'object') return null;
  const translation = cleanText(value.translation, 220);
  const definition = cleanText(value.definition, 320);
  const contextSentence = cleanText(value.contextSentence, 320);
  const exampleTranslation = cleanText(value.exampleTranslation, 320);
  const partOfSpeech = cleanText(value.partOfSpeech, 60).toLowerCase();

  if (!translation || !contextSentence) return null;
  return { translation, definition, contextSentence, exampleTranslation, partOfSpeech };
}

function parseEnrichment(text) {
  return normalizePayload(parseJsonObject(text));
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }

  const term = cleanText(body?.term, 160);
  const kind = body?.kind === 'PHRASE' ? 'phrase' : 'word';
  if (!term) return json({ error: 'term-required' }, 400);
  if (!context.env.GEMINI_API_KEY) return json({ error: 'gemini-not-configured' }, 503);

  const system = [
    'You are the vocabulary enrichment engine for an English-to-Arabic learning app.',
    'Return only one JSON object. No markdown, no commentary.',
    'Use Modern Standard Arabic for the concise learner-facing meaning.',
    'Choose the most useful everyday meaning unless the supplied English text clearly implies a different sense.',
    'Write one short natural English example sentence that demonstrates the selected meaning.',
    'Translate that example sentence naturally into Arabic.',
    'Keep the English definition concise and learner friendly.',
  ].join(' ');

  const prompt = `Enrich this English ${kind}: ${JSON.stringify(term)}\n\nReturn exactly these JSON keys:\n{\n  "translation": "Arabic meaning",\n  "definition": "short English definition",\n  "contextSentence": "natural English example sentence",\n  "exampleTranslation": "Arabic translation of the example",\n  "partOfSpeech": "noun|verb|adjective|adverb|phrase|other"\n}`;

  const result = await routeGemini({
    apiKey: context.env.GEMINI_API_KEY,
    system,
    prompt,
    task: 'vocabulary-enrichment',
    maxOutputTokens: 420,
    acceptText: (text) => Boolean(parseEnrichment(text)),
  });

  if (!result.ok) {
    console.warn('Gemini vocabulary enrichment failed', {
      error: result.error,
      status: result.status,
      attempts: result.attempts,
    });
    return json({ error: result.error, attempts: result.attempts }, result.status === 401 || result.status === 403 ? result.status : 503);
  }

  const parsed = parseEnrichment(result.text);
  if (!parsed) return json({ error: 'invalid-model-output' }, 502);

  return json({
    ...parsed,
    model: result.model,
    fallbackCount: result.fallbackCount,
  });
}

export function onRequestGet() {
  return json({ ok: true, service: 'gemini-vocabulary-enrichment' });
}
