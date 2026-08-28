import type { ImportJobTransport, RemoteImportJobSnapshot } from './jobs';

export type ImportAccessTokenProvider = () => Promise<string>;

function baseUrl(): string {
  const value = process.env.EXPO_PUBLIC_IMPORT_API_URL?.trim();
  if (!value) throw new Error('Smart import service is not configured for this build.');
  return value.replace(/\/$/, '');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Import service returned an unreadable response.');
  }
}

function isSnapshot(value: unknown): value is RemoteImportJobSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.serverJobId === 'string' && typeof record.status === 'string';
}

export class HttpImportJobTransport implements ImportJobTransport {
  constructor(private readonly getAccessToken: ImportAccessTokenProvider) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const body = await readJson(response);
    if (!response.ok) {
      const message = body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
        ? String((body as Record<string, unknown>).message)
        : `Import service request failed (${response.status}).`;
      throw new Error(message);
    }
    return body;
  }

  async submit(input: Parameters<ImportJobTransport['submit']>[0]): Promise<RemoteImportJobSnapshot> {
    const body = await this.request('/v1/import-jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(input),
    });
    if (!isSnapshot(body)) throw new Error('Import service returned an invalid job.');
    return body;
  }

  async get(serverJobId: string): Promise<RemoteImportJobSnapshot> {
    const body = await this.request(`/v1/import-jobs/${encodeURIComponent(serverJobId)}`);
    if (!isSnapshot(body)) throw new Error('Import service returned an invalid job.');
    return body;
  }

  async retry(serverJobId: string): Promise<RemoteImportJobSnapshot> {
    const body = await this.request(`/v1/import-jobs/${encodeURIComponent(serverJobId)}/retry`, { method: 'POST' });
    if (!isSnapshot(body)) throw new Error('Import service returned an invalid job.');
    return body;
  }

  async cancel(serverJobId: string): Promise<void> {
    await this.request(`/v1/import-jobs/${encodeURIComponent(serverJobId)}/cancel`, { method: 'POST' });
  }
}
