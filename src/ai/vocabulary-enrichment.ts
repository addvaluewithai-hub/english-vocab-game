import type { TermKind } from '@/domain/types';

export interface VocabularyEnrichment {
  translation: string;
  definition: string;
  contextSentence: string;
  exampleTranslation: string;
  partOfSpeech: string;
  model: string;
  fallbackCount: number;
}

export async function enrichVocabularyWithGemini(term: string, kind: TermKind): Promise<VocabularyEnrichment> {
  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/enrich-word`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ term: term.trim(), kind }),
  });

  const payload = await response.json().catch(() => ({})) as Partial<VocabularyEnrichment> & { error?: string };
  if (!response.ok) {
    if (payload.error === 'gemini-not-configured') throw new Error('Gemini لسه مش متظبط على النسخة دي.');
    if (payload.error === 'all-models-unavailable') throw new Error('Gemini مش متاح دلوقتي. جرّب كمان شوية.');
    throw new Error('مقدرناش نكمل الكلمة بـ Gemini دلوقتي.');
  }

  if (!payload.translation || !payload.contextSentence || !payload.model) {
    throw new Error('Gemini رجّع بيانات ناقصة. جرّب تاني.');
  }

  return {
    translation: payload.translation,
    definition: payload.definition ?? '',
    contextSentence: payload.contextSentence,
    exampleTranslation: payload.exampleTranslation ?? '',
    partOfSpeech: payload.partOfSpeech ?? '',
    model: payload.model,
    fallbackCount: payload.fallbackCount ?? 0,
  };
}
