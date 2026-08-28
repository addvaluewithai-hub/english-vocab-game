import type { ImportJobSubmission, RemoteImportJobSnapshot } from '@/imports/contracts';
import { extractTextImportCandidates } from '@/imports/text-server';
import { authorizeLanguagePair } from '@/server/import-auth';

function isSubmission(value: unknown): value is ImportJobSubmission {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.idempotencyKey === 'string'
    && typeof row.localJobId === 'string'
    && typeof row.languagePairId === 'string'
    && typeof row.sourceType === 'string'
    && typeof row.sourceFingerprint === 'string';
}

function textPayload(value: unknown): { text: string } | null {
  if (!value || typeof value !== 'object') return null;
  const text = (value as Record<string, unknown>).text;
  return typeof text === 'string' ? { text } : null;
}

function errorResponse(caught: unknown): Response {
  const message = caught instanceof Error ? caught.message : 'Import failed unexpectedly.';
  if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to use AI-assisted prose imports.' }, { status: 401 });
  if (message === 'LANGUAGE_PAIR_FORBIDDEN') return Response.json({ message: 'This language pair is not available to the signed-in account.' }, { status: 403 });
  if (message.startsWith('AUTH_VALIDATION_FAILED:')) return Response.json({ message: 'Could not verify the signed-in account.' }, { status: 401 });
  if (message === 'SERVER_DATA_API_NOT_CONFIGURED' || message.includes('not configured')) {
    return Response.json({ message: 'The smart-import service is not configured yet.' }, { status: 503 });
  }
  if (message.includes('limited to') || message.includes('No useful vocabulary')) {
    return Response.json({ message }, { status: 422 });
  }
  return Response.json({ message: 'Smart import could not process this source right now.' }, { status: 502 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!isSubmission(body)) return Response.json({ message: 'Invalid import request.' }, { status: 400 });
    if (body.sourceType !== 'TEXT') {
      return Response.json({ message: `The ${body.sourceType} adapter is not enabled by this route yet.` }, { status: 422 });
    }
    const payload = textPayload(body.sourcePayload);
    if (!payload) return Response.json({ message: 'Text import requires pasted text.' }, { status: 400 });

    const pair = await authorizeLanguagePair(request, body.languagePairId);
    const candidates = await extractTextImportCandidates({
      text: payload.text,
      targetLanguageCode: pair.targetLanguageCode,
      referenceLanguageCode: pair.referenceLanguageCode,
    });
    const snapshot: RemoteImportJobSnapshot = {
      serverJobId: body.localJobId,
      status: 'NEEDS_REVIEW',
      candidates,
      artifactExpiresAt: null,
    };
    return Response.json(snapshot, { status: 200 });
  } catch (caught) {
    return errorResponse(caught);
  }
}
