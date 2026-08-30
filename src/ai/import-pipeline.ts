import type { TermKind } from '@/domain/types';
import type { ProposedVocabulary } from '@/imports/staging';

export type GeminiImportSourceType = 'TEXT' | 'PHOTO' | 'PDF' | 'YOUTUBE' | 'URL';

export interface DiscoveredVocabulary {
  term: string;
  kind: TermKind;
  contextHint: string;
  usefulnessScore: number;
  confidenceScore: number;
}

export type DiscoveryInput =
  | { sourceType: 'TEXT'; text: string }
  | { sourceType: 'PHOTO'; images: { mimeType: string; data: string }[] }
  | { sourceType: 'PDF'; file: { name: string; data: string } }
  | { sourceType: 'YOUTUBE'; url: string }
  | { sourceType: 'URL'; url: string };

function apiUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (typeof body.error === 'string' && body.error.trim()) {
    if (body.error === 'gemini-not-configured') return 'Gemini لسه مش متظبط على السيرفر.';
    if (body.error === 'too-many-requests') return 'في طلبات كتير من الجهاز ده. استنى دقيقة وجرب تاني.';
    if (body.error === 'media-too-large' || body.error === 'request-too-large') return 'المصدر كبير على الإضافة السريعة. جرّب ملف أصغر أو صور أقل.';
    if (body.error === 'public-url-required') return 'حط لينك عام يفتح من غير تسجيل دخول.';
    if (body.error === 'all-models-unavailable') return 'Gemini مش متاح دلوقتي. جرّب كمان شوية.';
    if (body.error === 'media-timeout') return 'التحليل أخد وقت أطول من المتوقع. جرّب تاني أو استخدم ملف/فيديو أقصر.';
    if (body.error === 'rate-limited') return 'وصلنا لحد الاستخدام مؤقتًا. استنى شوية وجرب تاني.';
    if (body.error === 'model-not-available') return 'الموديل مش متاح للمصدر ده دلوقتي.';
    if (body.error === 'provider-rejected-request') return 'Gemini رفض الطلب ده. اتأكد إن المصدر عام وصالح وجرب تاني.';
    return body.error.replaceAll('-', ' ');
  }
  return fallback;
}

function isDiscovered(value: unknown): value is DiscoveredVocabulary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.term === 'string'
    && (item.kind === 'WORD' || item.kind === 'PHRASE')
    && typeof item.contextHint === 'string'
    && typeof item.usefulnessScore === 'number'
    && typeof item.confidenceScore === 'number';
}

export async function discoverVocabulary(input: DiscoveryInput): Promise<DiscoveredVocabulary[]> {
  const response = await fetch(apiUrl('/api/discover-vocab'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(errorMessage(body, 'Gemini معرفش يحلل المصدر ده. جرّب تاني.'));
  const candidates = Array.isArray(body.candidates) ? body.candidates.filter(isDiscovered) : [];
  if (!candidates.length) throw new Error('ملقيناش كلمات إنجليزي مفيدة في المصدر ده.');
  return candidates;
}

interface ApiEnrichedVocabulary {
  term: string;
  translation: string;
  definition: string;
  contextSentence: string;
  exampleTranslation: string;
  partOfSpeech: string;
}

function isEnriched(value: unknown): value is ApiEnrichedVocabulary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.term === 'string'
    && typeof item.translation === 'string'
    && typeof item.definition === 'string'
    && typeof item.contextSentence === 'string'
    && typeof item.exampleTranslation === 'string'
    && typeof item.partOfSpeech === 'string';
}

export async function enrichDiscoveredVocabulary(items: DiscoveredVocabulary[]): Promise<ProposedVocabulary[]> {
  const enriched: ProposedVocabulary[] = [];
  const chunkSize = 30;

  for (let offset = 0; offset < items.length; offset += chunkSize) {
    const chunk = items.slice(offset, offset + chunkSize);
    const response = await fetch(apiUrl('/api/enrich-vocab'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: chunk.map(({ term, kind, contextHint }) => ({ term, kind, contextHint })),
      }),
    });
    const body = await readJsonResponse(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Gemini معرفش يكمل بيانات الكلمات اللي اخترتها.'));
    const result = Array.isArray(body.items) ? body.items.filter(isEnriched) : [];
    if (result.length !== chunk.length) throw new Error('Gemini رجّع جزء من الكلمات بس. جرّب تاني.');

    const discoveryByTerm = new Map(chunk.map((item) => [item.term.toLocaleLowerCase(), item]));
    for (const item of result) {
      const discovered = discoveryByTerm.get(item.term.toLocaleLowerCase());
      enriched.push({
        term: item.term,
        translation: item.translation,
        definition: item.definition,
        contextSentence: item.contextSentence,
        exampleTranslation: item.exampleTranslation,
        partOfSpeech: item.partOfSpeech,
        ...(discovered ? { usefulnessScore: discovered.usefulnessScore, confidenceScore: discovered.confidenceScore } : {}),
      });
    }
  }

  return enriched;
}
