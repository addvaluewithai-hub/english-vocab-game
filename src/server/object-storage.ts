import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const IMPORT_BUCKET = 'vocab-imports';
export const PDF_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const PHOTO_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const READ_URL_TTL_SECONDS = 15 * 60;

function requiredEnv(name: 'AWS_ACCESS_KEY_ID' | 'AWS_SECRET_ACCESS_KEY' | 'AWS_ENDPOINT_URL_S3' | 'AWS_REGION'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`STORAGE_NOT_CONFIGURED:${name}`);
  return value;
}

function storageClient(): S3Client {
  return new S3Client({
    region: requiredEnv('AWS_REGION'),
    endpoint: requiredEnv('AWS_ENDPOINT_URL_S3'),
    credentials: {
      accessKeyId: requiredEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('AWS_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}

function safeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';
}

export function importObjectKey(input: {
  ownerId: string;
  languagePairId: string;
  localJobId: string;
  fileName: string;
}): string {
  return [
    'imports',
    safeSegment(input.ownerId),
    safeSegment(input.languagePairId),
    safeSegment(input.localJobId),
    safeSegment(input.fileName),
  ].join('/');
}

export async function createImportUploadUrl(input: {
  key: string;
  contentType: string;
}): Promise<{ url: string; method: 'PUT'; headers: Record<string, string>; expiresIn: number }> {
  const url = await getSignedUrl(
    storageClient(),
    new PutObjectCommand({
      Bucket: IMPORT_BUCKET,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
  return {
    url,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  };
}

export async function createImportReadUrl(key: string): Promise<string> {
  return getSignedUrl(
    storageClient(),
    new GetObjectCommand({ Bucket: IMPORT_BUCKET, Key: key }),
    { expiresIn: READ_URL_TTL_SECONDS },
  );
}

export function validateImportUpload(input: {
  sourceType: 'PDF' | 'PHOTO';
  contentType: string;
  size: number;
}): void {
  if (!Number.isFinite(input.size) || input.size <= 0) throw new Error('EMPTY_FILE');
  if (input.sourceType === 'PDF') {
    if (input.contentType !== 'application/pdf') throw new Error('PDF_TYPE_REQUIRED');
    if (input.size > PDF_UPLOAD_LIMIT_BYTES) throw new Error('PDF_TOO_LARGE');
    return;
  }
  if (!input.contentType.startsWith('image/')) throw new Error('IMAGE_TYPE_REQUIRED');
  if (input.size > PHOTO_UPLOAD_LIMIT_BYTES) throw new Error('PHOTO_TOO_LARGE');
}
