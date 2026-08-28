export interface AuthorizedLanguagePair {
  id: string;
  ownerId: string;
  targetLanguageCode: string;
  referenceLanguageCode: string;
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

export async function authorizeLanguagePair(
  request: Request,
  languagePairId: string,
): Promise<AuthorizedLanguagePair> {
  const token = bearerToken(request);
  const query = new URLSearchParams({
    select: 'id,owner_id,target_language_code,reference_language_code',
    id: `eq.${languagePairId}`,
    limit: '1',
  });
  const response = await fetch(`${dataApiUrl()}/language_pairs?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  if (!response.ok) throw new Error(`AUTH_VALIDATION_FAILED:${response.status}`);
  const body: unknown = await response.json();
  const row = Array.isArray(body) && body.length > 0 && body[0] && typeof body[0] === 'object'
    ? body[0] as Record<string, unknown>
    : null;
  if (!row) throw new Error('LANGUAGE_PAIR_FORBIDDEN');
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    targetLanguageCode: String(row.target_language_code),
    referenceLanguageCode: String(row.reference_language_code),
  };
}
