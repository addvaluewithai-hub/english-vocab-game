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
    if (body.error === 'gemini-not-configured') return 'Gemini is not configured on the server yet.';
    if (body.error === 'too-many-requests') return 'Gemini is busy for this device. Try again in a minute.';
    if (body.error === 'media-too-large' || body.error === 'request-too-large') return 'That source is too large for the quick import path. Use a smaller file or fewer images.';
    if (body.error === 'public-url-required') return 'Paste a public web URL that does not require a login.';
    if (body.error === 'all-models-unavailable') return 'All Gemini models are temporarily busy. Try again shortly.';
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
  if (!response.ok) throw new Error(errorMessage(body, 'Gemini could not analyze this source.'));
  const candidates = Array.isArray(body.candidates) ? body.candidates.filter(isDiscovered) : [];
  if (!candidates.length) throw new Error('No useful English vocabulary was found in that source.');
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
    if (!response.ok) throw new Error(errorMessage(body, 'Gemini could not enrich the selected vocabulary.'));
    const result = Array.isArray(body.items) ? body.items.filter(isEnriched) : [];
    if (result.length !== chunk.length) throw new Error('Gemini returned an incomplete vocabulary batch. Try again.');

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
        usefulnessScore: discovered?.usefulnessScore,
        confidenceScore: discovered?.confidenceScore,
      });
    }
  }

  return enriched;
}
