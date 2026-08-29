export const IMPORT_POLICY = {
  text: {
    maxCharacters: 12_000,
    maxCandidates: 24,
    maxListCandidates: 60,
    aiListBatchSize: 30,
  },
  pdf: {
    maxBytes: 25 * 1024 * 1024,
    maxCandidates: 40,
    artifactRetentionHours: 24,
  },
  youtube: {
    maxUrlCharacters: 2_048,
    maxCandidates: 32,
  },
  photo: {
    maxBytes: 10 * 1024 * 1024,
    artifactRetentionHours: 24,
  },
  retry: {
    maxAttempts: 3,
  },
} as const;

export type ImportFailureCategory =
  | 'LIMIT_EXCEEDED'
  | 'UNSUPPORTED_SOURCE'
  | 'PROVIDER_UNAVAILABLE'
  | 'EXTRACTION_FAILED'
  | 'ENRICHMENT_FAILED'
  | 'AUTH_REQUIRED'
  | 'NETWORK_OR_SERVER';

export function classifyImportFailure(message: string): ImportFailureCategory {
  const normalized = message.toUpperCase();
  if (normalized.includes('LIMIT') || normalized.includes('TOO LARGE') || normalized.includes('25 MB') || normalized.includes('10 MB')) return 'LIMIT_EXCEEDED';
  if (normalized.includes('UNSUPPORTED') || normalized.includes('SCANNED') || normalized.includes('PRIVATE') || normalized.includes('UNLISTED')) return 'UNSUPPORTED_SOURCE';
  if (normalized.includes('UNAVAILABLE') || normalized.includes('429') || normalized.includes('503') || normalized.includes('TIMEOUT')) return 'PROVIDER_UNAVAILABLE';
  if (normalized.includes('EXTRACT') || normalized.includes('UNREADABLE') || normalized.includes('NO_CANDIDATES')) return 'EXTRACTION_FAILED';
  if (normalized.includes('ENRICH') || normalized.includes('INVALID_MODEL_OUTPUT')) return 'ENRICHMENT_FAILED';
  if (normalized.includes('SIGN IN') || normalized.includes('AUTH')) return 'AUTH_REQUIRED';
  return 'NETWORK_OR_SERVER';
}

export function canRetryImport(retryCount: number): boolean {
  return Number.isInteger(retryCount) && retryCount < IMPORT_POLICY.retry.maxAttempts;
}
