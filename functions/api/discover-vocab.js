import { cleanText, json, routeGemini } from '../_shared/gemini-router.js';
import { routeGeminiMedia, routeGeminiYouTube } from '../_shared/gemini-media.js';
import { checkBestEffortRateLimit, isSameOriginRequest } from '../_shared/request-guard.js';

const MAX_CANDIDATES = 80;
const MAX_TEXT_LENGTH = 30_000;
const MAX_MEDIA_BASE64_CHARS = 12_000_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

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

function normalizeCandidates(text) {
  const parsed = parseJsonObject(text);
  if (!parsed || !Array.isArray(parsed.candidates)) return null;
  const seen = new Set();
  const candidates = [];
  for (const raw of parsed.candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const term = cleanText(raw.term, 160).replace(/\s+/g, ' ');
    if (!term) continue;
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = raw.kind === 'PHRASE' || term.includes(' ') ? 'PHRASE' : 'WORD';
    const usefulnessScore = Number(raw.usefulnessScore);
    const confidenceScore = Number(raw.confidenceScore);
    candidates.push({
      term,
      kind,
      contextHint: cleanText(raw.contextHint, 180),
      usefulnessScore: Number.isFinite(usefulnessScore) ? Math.max(0, Math.min(1, usefulnessScore)) : 0.7,
      confidenceScore: Number.isFinite(confidenceScore) ? Math.max(0, Math.min(1, confidenceScore)) : 0.7,
    });
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  return candidates.length ? candidates : null;
}

function discoveryPrompt(sourceLabel) {
  return [
    `Extract useful English vocabulary and short reusable phrases from this ${sourceLabel} for an English learner.`,
    'This is discovery only: do NOT translate and do NOT write definitions yet.',
    `Return at most ${MAX_CANDIDATES} unique high-value candidates.`,
    'Prefer everyday vocabulary, phrasal verbs, collocations and reusable sentence chunks.',
    'Skip names, URLs, isolated punctuation, obvious OCR garbage, and repeated variants unless the variant teaches a distinct useful phrase.',
    'Keep the term close to how it appears or is spoken in the source.',
    'contextHint should be a very short source-context clue that helps select the intended meaning; use an empty string when unavailable.',
    'Return only JSON in this exact shape:',
    '{"candidates":[{"term":"...","kind":"WORD|PHRASE","contextHint":"...","usefulnessScore":0.0,"confidenceScore":0.0}]}',
  ].join('\n');
}

function validYoutubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be');
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  if (!isSameOriginRequest(context.request)) return json({ error: 'origin-not-allowed' }, 403);

  const declaredLength = Number(context.request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 16 * 1024 * 1024) {
    return json({ error: 'request-too-large', message: 'Keep the selected media under the import size limit.' }, 413);
  }

  const rate = checkBestEffortRateLimit(context.request, {
    namespace: 'vocabulary-discovery',
    limit: 10,
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

  const sourceType = cleanText(body?.sourceType, 20).toUpperCase();
  let result;

  if (sourceType === 'TEXT') {
    const text = cleanText(body?.text, MAX_TEXT_LENGTH);
    if (!text) return json({ error: 'text-required' }, 400);
    const prompt = `${discoveryPrompt('text')}\n\nSOURCE TEXT:\n${text}`;
    result = await routeGemini({
      apiKey: context.env.GEMINI_API_KEY,
      system: 'You extract learner-useful English vocabulary from supplied source material and return strict JSON only.',
      prompt,
      task: 'vocabulary-discovery-text',
      maxOutputTokens: 1800,
      overallTimeoutMs: 14_000,
      acceptText: (value) => Boolean(normalizeCandidates(value)),
    });
  } else if (sourceType === 'PHOTO') {
    const images = Array.isArray(body?.images) ? body.images.slice(0, 3) : [];
    let totalChars = 0;
    const parts = [];
    for (const image of images) {
      const mimeType = cleanText(image?.mimeType, 60).toLowerCase();
      const data = typeof image?.data === 'string' ? image.data : '';
      if (!IMAGE_TYPES.has(mimeType) || !data) continue;
      totalChars += data.length;
      if (totalChars > MAX_MEDIA_BASE64_CHARS) return json({ error: 'media-too-large' }, 413);
      parts.push({ inlineData: { mimeType, data } });
    }
    if (!parts.length) return json({ error: 'images-required' }, 400);
    parts.push({ text: discoveryPrompt(images.length > 1 ? 'set of images' : 'image') });
    result = await routeGeminiMedia({
      apiKey: context.env.GEMINI_API_KEY,
      parts,
      maxOutputTokens: 1800,
      acceptText: (value) => Boolean(normalizeCandidates(value)),
    });
  } else if (sourceType === 'PDF') {
    const file = body?.file && typeof body.file === 'object' ? body.file : null;
    const data = typeof file?.data === 'string' ? file.data : '';
    if (!data || data.length > MAX_MEDIA_BASE64_CHARS) return json({ error: data ? 'media-too-large' : 'pdf-required' }, data ? 413 : 400);
    const parts = [
      { inlineData: { mimeType: 'application/pdf', data } },
      { text: discoveryPrompt('PDF document') },
    ];
    result = await routeGeminiMedia({
      apiKey: context.env.GEMINI_API_KEY,
      parts,
      maxOutputTokens: 2200,
      acceptText: (value) => Boolean(normalizeCandidates(value)),
    });
  } else if (sourceType === 'YOUTUBE') {
    const url = cleanText(body?.url, 500);
    if (!validYoutubeUrl(url)) return json({ error: 'youtube-url-required' }, 400);
    result = await routeGeminiYouTube({
      apiKey: context.env.GEMINI_API_KEY,
      url,
      prompt: discoveryPrompt('public YouTube video, using both spoken audio and useful visible text'),
      acceptText: (value) => Boolean(normalizeCandidates(value)),
    });
  } else {
    return json({ error: 'unsupported-source-type' }, 400);
  }

  if (!result.ok) {
    console.warn('Gemini vocabulary discovery failed', { sourceType, error: result.error, status: result.status, attempts: result.attempts });
    return json({ error: result.error, attempts: result.attempts }, result.status === 401 || result.status === 403 ? result.status : 503);
  }

  const candidates = normalizeCandidates(result.text);
  if (!candidates) return json({ error: 'invalid-model-output' }, 502);
  return json({ candidates, model: result.model, fallbackCount: result.fallbackCount });
}

export function onRequestGet() {
  return json({ ok: true, service: 'gemini-vocabulary-discovery', supported: ['TEXT', 'PHOTO', 'PDF', 'YOUTUBE'] });
}
