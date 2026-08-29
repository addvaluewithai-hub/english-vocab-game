import { describe, expect, it } from 'vitest';
import {
  IMPORT_POLICY,
  canRetryImport,
  classifyImportFailure,
} from '@/imports/policy';

describe('import reliability policy', () => {
  it('bounds source sizes and candidate counts centrally', () => {
    expect(IMPORT_POLICY.text.maxCharacters).toBe(120_000);
    expect(IMPORT_POLICY.text.maxListCandidates).toBe(2_000);
    expect(IMPORT_POLICY.text.aiListBatchSize).toBe(40);
    expect(IMPORT_POLICY.pdf.maxBytes).toBe(25 * 1024 * 1024);
    expect(IMPORT_POLICY.youtube.maxCandidates).toBe(32);
    expect(IMPORT_POLICY.photo.maxBytes).toBe(10 * 1024 * 1024);
  });

  it('stops retrying once the configured ceiling is reached', () => {
    expect(canRetryImport(0)).toBe(true);
    expect(canRetryImport(IMPORT_POLICY.retry.maxAttempts - 1)).toBe(true);
    expect(canRetryImport(IMPORT_POLICY.retry.maxAttempts)).toBe(false);
    expect(canRetryImport(IMPORT_POLICY.retry.maxAttempts + 1)).toBe(false);
  });

  it('distinguishes common failure categories without source contents', () => {
    expect(classifyImportFailure('PDF imports are limited to 25 MB.')).toBe('LIMIT_EXCEEDED');
    expect(classifyImportFailure('PDF_SCANNED_UNSUPPORTED')).toBe('UNSUPPORTED_SOURCE');
    expect(classifyImportFailure('All models are temporarily unavailable (503)')).toBe('PROVIDER_UNAVAILABLE');
    expect(classifyImportFailure('PDF_NO_CANDIDATES')).toBe('EXTRACTION_FAILED');
    expect(classifyImportFailure('AI enrichment returned INVALID_MODEL_OUTPUT')).toBe('ENRICHMENT_FAILED');
    expect(classifyImportFailure('Sign in to use cloud-assisted imports.')).toBe('AUTH_REQUIRED');
    expect(classifyImportFailure('socket closed unexpectedly')).toBe('NETWORK_OR_SERVER');
  });
});
