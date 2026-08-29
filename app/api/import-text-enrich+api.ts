import { AI_LIST_BATCH_SIZE, type ParsedVocabularyListItem } from '@/imports/text-parser';
import { isLearnerLevel } from '@/imports/ranking';
import { enrichVocabularyListBatch } from '@/imports/text-server';
import { authorizeLanguagePair } from '@/server/import-auth';

function parsedItems(value: unknown): ParsedVocabularyListItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > AI_LIST_BATCH_SIZE) return null;
  const items: ParsedVocabularyListItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.itemKey !== 'string' || typeof row.term !== 'string') return null;
    const term = row.term.trim();
    if (!term || term.length > 120) return null;
    const translation = row.translation === null || row.translation === undefined
      ? null
      : typeof row.translation === 'string'
        ? row.translation.trim() || null
        : undefined;
    if (translation === undefined) return null;
    items.push({ itemKey: row.itemKey, term, translation });
  }
  return items;
}

function errorResponse(caught: unknown): Response {
  const message = caught instanceof Error ? caught.message : 'Vocabulary enrichment failed.';
  if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to enrich vocabulary with AI.' }, { status: 401 });
  if (message === 'LANGUAGE_PAIR_FORBIDDEN') return Response.json({ message: 'This language pair is not available to the signed-in account.' }, { status: 403 });
  if (message.startsWith('AUTH_VALIDATION_FAILED:')) return Response.json({ message: 'Could not verify the signed-in account.' }, { status: 401 });
  if (message.includes('not configured')) return Response.json({ message: 'AI vocabulary enrichment is not configured yet.' }, { status: 503 });
  if (message.includes('temporarily unavailable') || message.includes('rejected')) {
    return Response.json({ message: 'AI vocabulary enrichment is temporarily unavailable. Retry this batch later.' }, { status: 503 });
  }
  return Response.json({ message }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return Response.json({ message: 'Invalid enrichment request.' }, { status: 400 });
    const row = body as Record<string, unknown>;
    if (typeof row.languagePairId !== 'string' || !isLearnerLevel(row.learnerLevel)) {
      return Response.json({ message: 'Invalid enrichment request.' }, { status: 400 });
    }
    const items = parsedItems(row.items);
    if (!items) return Response.json({ message: `Send between 1 and ${AI_LIST_BATCH_SIZE} vocabulary items per batch.` }, { status: 400 });

    const pair = await authorizeLanguagePair(request, row.languagePairId);
    const startedAt = Date.now();
    const extraction = await enrichVocabularyListBatch({
      items,
      targetLanguageCode: pair.targetLanguageCode,
      referenceLanguageCode: pair.referenceLanguageCode,
      learnerLevel: row.learnerLevel,
    });
    return Response.json({
      candidates: extraction.candidates,
      metrics: {
        durationMs: Date.now() - startedAt,
        itemCount: items.length,
        model: extraction.model,
        fallbackCount: extraction.fallbackCount,
        attempts: extraction.attempts,
        ...(extraction.usage ? { usage: extraction.usage } : {}),
      },
    });
  } catch (caught) {
    return errorResponse(caught);
  }
}
