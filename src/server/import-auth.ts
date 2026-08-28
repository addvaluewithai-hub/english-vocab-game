import { createClient } from '@neondatabase/neon-js';

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
  return value;
}

export async function authorizeLanguagePair(
  request: Request,
  languagePairId: string,
): Promise<AuthorizedLanguagePair> {
  const token = bearerToken(request);
  const client = createClient({
    dataApi: {
      url: dataApiUrl(),
      getToken: async () => token,
    },
  });
  const { data, error } = await client
    .from('language_pairs')
    .select('id,owner_id,target_language_code,reference_language_code')
    .eq('id', languagePairId)
    .limit(1);
  if (error) throw new Error(`AUTH_VALIDATION_FAILED:${error.message}`);
  const row = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!row) throw new Error('LANGUAGE_PAIR_FORBIDDEN');
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    targetLanguageCode: String(row.target_language_code),
    referenceLanguageCode: String(row.reference_language_code),
  };
}
