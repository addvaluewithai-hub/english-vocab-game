import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { getNeonJwtToken } from '@/auth/neon-auth';

export interface PresignedImportUpload {
  objectKey: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

function apiBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!value) throw new Error('Smart import service is not configured for this build.');
  return value.replace(/\/$/, '');
}

function isSignedUpload(value: unknown): value is PresignedImportUpload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.objectKey === 'string'
    && typeof row.url === 'string'
    && row.method === 'PUT'
    && typeof row.headers === 'object'
    && row.headers !== null
    && typeof row.expiresIn === 'number';
}

export async function uploadImportFile(input: {
  languagePairId: string;
  localJobId: string;
  sourceType: 'PDF' | 'PHOTO';
  fileName: string;
  contentType: string;
  size: number;
  uri: string;
}): Promise<{ objectKey: string }> {
  const token = await getNeonJwtToken();
  const signingResponse = await fetch(`${apiBaseUrl()}/api/import-upload`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      languagePairId: input.languagePairId,
      localJobId: input.localJobId,
      sourceType: input.sourceType,
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
    }),
  });
  const body: unknown = await signingResponse.json();
  if (!signingResponse.ok || !isSignedUpload(body)) {
    const message = body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
      ? String((body as Record<string, unknown>).message)
      : 'Could not prepare a secure file upload.';
    throw new Error(message);
  }

  const uploadResponse = await expoFetch(body.url, {
    method: body.method,
    headers: body.headers,
    body: new File(input.uri),
  });
  if (!uploadResponse.ok) throw new Error(`File upload failed (${uploadResponse.status}).`);
  return { objectKey: body.objectKey };
}
