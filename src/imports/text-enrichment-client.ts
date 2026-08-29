import type { NormalizedImportCandidate } from './contracts';
import type { LearnerLevel } from './ranking';
import type { ParsedVocabularyListItem } from './text-parser';

function baseUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!value) throw new Error('Smart import service is not configured for this build.');
  return value.replace(/\/$/, '');
}

function isCandidate(value: unknown): value is NormalizedImportCandidate {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.candidateKey === 'string'
    && typeof row.term === 'string'
    && typeof row.translation === 'string'
    && row.occurrence !== null
    && typeof row.occurrence === 'object';
}

export async function enrichTextItemsBatch(input: {
  getAccessToken: () => Promise<string>;
  languagePairId: string;
  learnerLevel: LearnerLevel;
  items: ParsedVocabularyListItem[];
}): Promise<NormalizedImportCandidate[]> {
  const token = await input.getAccessToken();
  const response = await fetch(`${baseUrl()}/api/import-text-enrich`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      languagePairId: input.languagePairId,
      learnerLevel: input.learnerLevel,
      items: input.items,
    }),
  });
  const rawText = await response.text();
  let body: unknown = null;
  if (rawText) {
    try { body = JSON.parse(rawText) as unknown; }
    catch { throw new Error('Import service returned an unreadable response.'); }
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
      ? String((body as Record<string, unknown>).message)
      : `Vocabulary enrichment failed (${response.status}).`;
    throw new Error(message);
  }
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).candidates)) {
    throw new Error('Import service returned an invalid enrichment result.');
  }
  const candidates = (body as Record<string, unknown>).candidates as unknown[];
  return candidates.filter(isCandidate);
}
