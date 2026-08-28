export interface AuthorizedLanguagePair {
  id: string;
  ownerId: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
}

export interface AuthorizedImportJob {
  id: string;
  ownerId: string;
  languagePairId: string;
  sourceType: string;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new Error('AUTH_REQUIRED');
  return match[1];
}

function dataApiUrl(): string {
  const value = process.env.NEON_DATA_API_URL?.trim() || process.env.EXPO_PUBLIC_NEON_DATA_API_URL?.trim();
  if (!value) throw new Error('SERVER_DATA_API_NOT_CONFIGURED');
  return value.replace(/\/$/, '');
}

async function authorizedRow(
  request: Request,
  table: string,
  select: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  const token = bearerToken(request);
  const query = new URLSearchParams({ select, id: `eq.${id}`, limit: '1' });
  const response = await fetch(`${dataApiUrl()}/${table}?${query.toString()}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  if (!response.ok) throw new Error(`AUTH_VALIDATION_FAILED:${response.status}`);
  const body: unknown = await response.json();
  return Array.isArray(body) && body.length > 0 && body[0] && typeof body[0] === 'object'
    ? body[0] as Record<string, unknown>
    : null;
}

export async function authorizeLanguagePair(
  request: Request,
  languagePairId: string,
): Promise<AuthorizedLanguagePair> {
  const row = await authorizedRow(
    request,
    'language_pairs',
    'id,owner_id,target_language_code,reference_language_code',
    languagePairId,
  );
  if (!row) throw new Error('LANGUAGE_PAIR_FORBIDDEN');
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    targetLanguageCode: String(row.target_language_code),
    referenceLanguageCode: String(row.reference_language_code),
  };
}

export async function authorizeImportJob(request: Request, jobId: string): Promise<AuthorizedImportJob> {
  const row = await authorizedRow(request, 'import_jobs', 'id,owner_id,language_pair_id,source_type', jobId);
  if (!row) throw new Error('IMPORT_JOB_FORBIDDEN');
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    languagePairId: String(row.language_pair_id),
    sourceType: String(row.source_type),
  };
}
