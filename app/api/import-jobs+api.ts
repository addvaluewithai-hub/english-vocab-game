import type { ImportJobSubmission, RemoteImportJobSnapshot } from '@/imports/contracts';
import { startPdfExtraction } from '@/imports/pdf-server';
import { extractTextImport } from '@/imports/text-server';
import { normalizeYouTubeUrl } from '@/imports/youtube';
import { extractYouTubeVocabulary } from '@/imports/youtube-server';
import { authorizeLanguagePair } from '@/server/import-auth';
import { setServerJobArtifact } from '@/server/import-job-control';
import {
  createOrGetServerImportJob,
  markServerJobFailed,
  markServerJobProcessing,
  serverJobSnapshot,
  storeServerCandidates,
} from '@/server/import-job-store';
import { importObjectKey } from '@/server/object-storage';

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

function youtubePayload(value: unknown): { url: string } | null {
  if (!value || typeof value !== 'object') return null;
  const url = (value as Record<string, unknown>).url;
  return typeof url === 'string' ? { url } : null;
}

function filePayload(value: unknown): { objectKey: string; fileName: string; contentType: string; size: number } | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.objectKey !== 'string' || typeof row.fileName !== 'string'
    || typeof row.contentType !== 'string' || typeof row.size !== 'number') return null;
  return { objectKey: row.objectKey, fileName: row.fileName, contentType: row.contentType, size: row.size };
}

function errorResponse(caught: unknown): Response {
  const message = caught instanceof Error ? caught.message : 'Import failed unexpectedly.';
  if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in to use cloud-assisted imports.' }, { status: 401 });
  if (message === 'LANGUAGE_PAIR_FORBIDDEN') return Response.json({ message: 'This language pair is not available to the signed-in account.' }, { status: 403 });
  if (message.startsWith('AUTH_VALIDATION_FAILED:')) return Response.json({ message: 'Could not verify the signed-in account.' }, { status: 401 });
  if (message === 'YOUTUBE_UNAVAILABLE_OR_NOT_PUBLIC') {
    return Response.json({ message: 'This video is unavailable, private, unlisted, or cannot be processed by the current YouTube importer.' }, { status: 422 });
  }
  if (message === 'SERVER_DATA_API_NOT_CONFIGURED' || message === 'SERVER_DATABASE_NOT_CONFIGURED'
    || message === 'AI_IMPORT_NOT_CONFIGURED' || message.includes('not configured')) {
    return Response.json({ message: 'The smart-import service is not configured yet.' }, { status: 503 });
  }
  if (message.includes('limited to') || message.includes('No useful vocabulary') || message === 'YOUTUBE_NO_CANDIDATES') {
    return Response.json({ message: message === 'YOUTUBE_NO_CANDIDATES' ? 'No useful vocabulary candidates were found in this video.' : message }, { status: 422 });
  }
  if (message === 'YOUTUBE_PROVIDER_UNAVAILABLE' || message.startsWith('YOUTUBE_PROVIDER_REJECTED:')) {
    return Response.json({ message: 'YouTube analysis is temporarily unavailable. Please retry later.' }, { status: 503 });
  }
  return Response.json({ message: 'Smart import could not process this source right now.' }, { status: 502 });
}

async function processText(
  body: ImportJobSubmission,
  pair: Awaited<ReturnType<typeof authorizeLanguagePair>>,
  startedAt: number,
): Promise<RemoteImportJobSnapshot> {
  const payload = textPayload(body.sourcePayload);
  if (!payload) throw new Error('TEXT_PAYLOAD_REQUIRED');
  const job = await createOrGetServerImportJob({
    id: body.localJobId,
    ownerId: pair.ownerId,
    languagePairId: body.languagePairId,
    sourceType: 'TEXT',
    sourceFingerprint: body.sourceFingerprint,
    sourceLabel: body.sourceLabel,
    sourcePayload: { charCount: payload.text.length, inputKind: 'PROSE' },
  });
  if (job.status === 'NEEDS_REVIEW' || job.status === 'COMPLETED') {
    const existing = await serverJobSnapshot(pair.ownerId, job.id);
    if (existing) return existing;
  }
  await markServerJobProcessing({ ownerId: pair.ownerId, id: job.id, providerKind: 'GEMINI_ROUTER' });
  try {
    const extraction = await extractTextImport({
      text: payload.text,
      targetLanguageCode: pair.targetLanguageCode,
      referenceLanguageCode: pair.referenceLanguageCode,
    });
    await storeServerCandidates({
      ownerId: pair.ownerId,
      jobId: job.id,
      candidates: extraction.candidates,
      metrics: {
        durationMs: Date.now() - startedAt,
        inputChars: payload.text.length,
        candidateCount: extraction.candidates.length,
        provider: extraction.provider,
        model: extraction.model,
        fallbackCount: extraction.fallbackCount,
        attempts: extraction.attempts,
        ...(extraction.usage ? { usage: extraction.usage } : {}),
      },
    });
    const snapshot = await serverJobSnapshot(pair.ownerId, job.id);
    if (!snapshot) throw new Error('SERVER_JOB_RESULT_MISSING');
    return snapshot;
  } catch (caught) {
    await markServerJobFailed({
      ownerId: pair.ownerId,
      id: job.id,
      code: 'TEXT_PROCESSING_FAILED',
      message: caught instanceof Error ? caught.message.slice(0, 300) : 'Text processing failed.',
      metrics: { durationMs: Date.now() - startedAt, provider: 'GEMINI_ROUTER' },
    });
    throw caught;
  }
}

async function processYouTube(
  body: ImportJobSubmission,
  pair: Awaited<ReturnType<typeof authorizeLanguagePair>>,
  startedAt: number,
): Promise<RemoteImportJobSnapshot> {
  const payload = youtubePayload(body.sourcePayload);
  if (!payload) throw new Error('YOUTUBE_PAYLOAD_REQUIRED');
  const source = normalizeYouTubeUrl(payload.url);
  if (body.sourceFingerprint !== source.fingerprint) throw new Error('YOUTUBE_FINGERPRINT_MISMATCH');

  const job = await createOrGetServerImportJob({
    id: body.localJobId,
    ownerId: pair.ownerId,
    languagePairId: body.languagePairId,
    sourceType: 'YOUTUBE',
    sourceFingerprint: source.fingerprint,
    sourceLabel: body.sourceLabel,
    sourcePayload: { videoId: source.videoId, canonicalUrl: source.canonicalUrl },
  });
  if (job.status === 'NEEDS_REVIEW' || job.status === 'COMPLETED') {
    const existing = await serverJobSnapshot(pair.ownerId, job.id);
    if (existing) return existing;
  }

  await markServerJobProcessing({ ownerId: pair.ownerId, id: job.id, providerKind: 'GEMINI_YOUTUBE_ROUTER' });
  try {
    const extraction = await extractYouTubeVocabulary({
      url: source.canonicalUrl,
      targetLanguageCode: pair.targetLanguageCode,
      referenceLanguageCode: pair.referenceLanguageCode,
    });
    await storeServerCandidates({
      ownerId: pair.ownerId,
      jobId: job.id,
      candidates: extraction.candidates,
      metrics: {
        durationMs: Date.now() - startedAt,
        candidateCount: extraction.candidates.length,
        provider: 'GEMINI_YOUTUBE_ROUTER',
        model: extraction.model,
        fallbackCount: extraction.fallbackCount,
        attempts: extraction.attempts,
        ...(extraction.usage ? { usage: extraction.usage } : {}),
      },
    });
    const snapshot = await serverJobSnapshot(pair.ownerId, job.id);
    if (!snapshot) throw new Error('SERVER_JOB_RESULT_MISSING');
    return snapshot;
  } catch (caught) {
    await markServerJobFailed({
      ownerId: pair.ownerId,
      id: job.id,
      code: 'YOUTUBE_PROCESSING_FAILED',
      message: caught instanceof Error ? caught.message.slice(0, 300) : 'YouTube processing failed.',
      metrics: { durationMs: Date.now() - startedAt, provider: 'GEMINI_YOUTUBE_ROUTER' },
    });
    throw caught;
  }
}

async function processPdf(
  body: ImportJobSubmission,
  pair: Awaited<ReturnType<typeof authorizeLanguagePair>>,
): Promise<RemoteImportJobSnapshot> {
  const payload = filePayload(body.sourcePayload);
  if (!payload || payload.contentType !== 'application/pdf') throw new Error('PDF_PAYLOAD_REQUIRED');
  const expectedKey = importObjectKey({
    ownerId: pair.ownerId,
    languagePairId: pair.id,
    localJobId: body.localJobId,
    fileName: payload.fileName,
  });
  if (payload.objectKey !== expectedKey) throw new Error('IMPORT_ARTIFACT_FORBIDDEN');

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const job = await createOrGetServerImportJob({
    id: body.localJobId,
    ownerId: pair.ownerId,
    languagePairId: pair.id,
    sourceType: 'PDF',
    sourceFingerprint: body.sourceFingerprint,
    sourceLabel: body.sourceLabel,
    sourcePayload: { fileName: payload.fileName, contentType: payload.contentType, size: payload.size },
    artifactKey: payload.objectKey,
  });
  await setServerJobArtifact({ ownerId: pair.ownerId, id: job.id, artifactKey: payload.objectKey, expiresAt });
  if (job.status === 'PROCESSING' || job.status === 'NEEDS_REVIEW' || job.status === 'COMPLETED') {
    const existing = await serverJobSnapshot(pair.ownerId, job.id);
    if (existing) return existing;
  }

  try {
    const providerJobId = await startPdfExtraction({
      jobId: job.id,
      objectKey: payload.objectKey,
      targetLanguageCode: pair.targetLanguageCode,
      referenceLanguageCode: pair.referenceLanguageCode,
    });
    await markServerJobProcessing({
      ownerId: pair.ownerId,
      id: job.id,
      providerKind: 'OPENAI_PDF_RESPONSES',
      providerJobId,
      metrics: { inputBytes: payload.size, provider: 'OPENAI_RESPONSES' },
    });
    return {
      serverJobId: job.id,
      status: 'PROCESSING',
      artifactExpiresAt: expiresAt,
    };
  } catch (caught) {
    await markServerJobFailed({
      ownerId: pair.ownerId,
      id: job.id,
      code: 'PDF_PROCESSING_FAILED',
      message: caught instanceof Error ? caught.message.slice(0, 300) : 'PDF processing failed.',
      metrics: { inputBytes: payload.size },
    });
    throw caught;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!isSubmission(body)) return Response.json({ message: 'Invalid import request.' }, { status: 400 });
    if (!['TEXT', 'PDF', 'YOUTUBE'].includes(body.sourceType)) {
      return Response.json({ message: `The ${body.sourceType} adapter is not enabled by this route yet.` }, { status: 422 });
    }
    const pair = await authorizeLanguagePair(request, body.languagePairId);
    const startedAt = Date.now();
    const snapshot = body.sourceType === 'TEXT'
      ? await processText(body, pair, startedAt)
      : body.sourceType === 'YOUTUBE'
        ? await processYouTube(body, pair, startedAt)
        : await processPdf(body, pair);
    return Response.json(snapshot);
  } catch (caught) {
    return errorResponse(caught);
  }
}
