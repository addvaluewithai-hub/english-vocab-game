import type { SourceType } from '@/domain/types';
import type { LearnerLevel } from './ranking';

export type ImportSourceType = Exclude<SourceType, 'MANUAL' | 'GENERATED'>;
export type ImportJobStatus = 'QUEUED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface NormalizedSourceOccurrence {
  sentence: string | null;
  sourceUri: string | null;
  locator: string | null;
  pageNumber: number | null;
  timestampSeconds: number | null;
}

export interface NormalizedImportCandidate {
  candidateKey: string;
  term: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  context: string | null;
  occurrence: NormalizedSourceOccurrence;
  confidence: number | null;
  usefulness: number | null;
  cefrLevel: LearnerLevel | null;
  duplicateHint: 'NONE' | 'EXACT' | 'LIKELY' | null;
  isVisuallyConcrete: boolean | null;
}

export interface ImportJob {
  id: string;
  languagePairId: string;
  sourceType: ImportSourceType;
  sourceFingerprint: string;
  sourceLabel: string | null;
  status: ImportJobStatus;
  serverJobId: string | null;
  candidates: NormalizedImportCandidate[] | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  artifactExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteImportJobSnapshot {
  serverJobId: string;
  status: ImportJobStatus;
  candidates?: NormalizedImportCandidate[];
  errorCode?: string | null;
  errorMessage?: string | null;
  artifactExpiresAt?: string | null;
}

export interface ImportJobSubmission {
  idempotencyKey: string;
  localJobId: string;
  languagePairId: string;
  sourceType: ImportSourceType;
  sourceFingerprint: string;
  sourceLabel: string | null;
  learnerLevel: LearnerLevel;
  sourcePayload: unknown;
}

export interface ImportJobTransport {
  submit(input: ImportJobSubmission): Promise<RemoteImportJobSnapshot>;
  get(serverJobId: string): Promise<RemoteImportJobSnapshot>;
  retry(serverJobId: string): Promise<RemoteImportJobSnapshot>;
  cancel(serverJobId: string): Promise<void>;
}
