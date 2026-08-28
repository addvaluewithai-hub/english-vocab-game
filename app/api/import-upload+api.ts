import { authorizeLanguagePair } from '@/server/import-auth';
import {
  createImportUploadUrl,
  importObjectKey,
  validateImportUpload,
} from '@/server/object-storage';

type UploadRequest = {
  languagePairId: string;
  localJobId: string;
  sourceType: 'PDF' | 'PHOTO';
  fileName: string;
  contentType: string;
  size: number;
};

function parseUploadRequest(value: unknown): UploadRequest | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.languagePairId !== 'string'
    || typeof row.localJobId !== 'string'
    || (row.sourceType !== 'PDF' && row.sourceType !== 'PHOTO')
    || typeof row.fileName !== 'string'
    || typeof row.contentType !== 'string'
    || typeof row.size !== 'number') return null;
  return {
    languagePairId: row.languagePairId,
    localJobId: row.localJobId,
    sourceType: row.sourceType,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
  };
}

function storageError(caught: unknown): Response {
  const message = caught instanceof Error ? caught.message : '';
  if (message === 'AUTH_REQUIRED') return Response.json({ message: 'Sign in before uploading import files.' }, { status: 401 });
  if (message === 'LANGUAGE_PAIR_FORBIDDEN') return Response.json({ message: 'This language pair is not available to your account.' }, { status: 403 });
  if (message === 'PDF_TOO_LARGE') return Response.json({ message: 'PDF imports are limited to 25 MB.' }, { status: 413 });
  if (message === 'PHOTO_TOO_LARGE') return Response.json({ message: 'Photo imports are limited to 10 MB.' }, { status: 413 });
  if (message === 'PDF_TYPE_REQUIRED') return Response.json({ message: 'Choose a PDF file.' }, { status: 415 });
  if (message === 'IMAGE_TYPE_REQUIRED') return Response.json({ message: 'Choose a supported image file.' }, { status: 415 });
  if (message === 'EMPTY_FILE') return Response.json({ message: 'The selected file is empty.' }, { status: 422 });
  if (message.startsWith('STORAGE_NOT_CONFIGURED:')) return Response.json({ message: 'Import file storage is not configured yet.' }, { status: 503 });
  return Response.json({ message: 'Could not prepare this upload.' }, { status: 502 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = parseUploadRequest(await request.json());
    if (!body) return Response.json({ message: 'Invalid upload request.' }, { status: 400 });
    validateImportUpload(body);
    const pair = await authorizeLanguagePair(request, body.languagePairId);
    const key = importObjectKey({
      ownerId: pair.ownerId,
      languagePairId: body.languagePairId,
      localJobId: body.localJobId,
      fileName: body.fileName,
    });
    const signed = await createImportUploadUrl({ key, contentType: body.contentType });
    return Response.json({ ...signed, objectKey: key });
  } catch (caught) {
    return storageError(caught);
  }
}
