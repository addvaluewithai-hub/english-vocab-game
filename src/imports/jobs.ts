import type { SQLiteDatabase } from 'expo-sqlite';
import { asSqlDatabase } from '@/data/database';
import { PreferencesRepository } from '@/data/preferences';
import { createId } from '@/utils/id';
import { ImportStagingService, type ProposedVocabulary } from './staging';
import { canRetryImport, classifyImportFailure } from './policy';
import { DEFAULT_LEARNER_LEVEL, isLearnerLevel } from './ranking';
import type {
  ImportJob,
  ImportJobStatus,
  ImportJobTransport,
  ImportSourceType,
  NormalizedImportCandidate,
  RemoteImportJobSnapshot,
} from './contracts';

export type {
  ImportJob,
  ImportJobStatus,
  ImportJobTransport,
  ImportSourceType,
  NormalizedImportCandidate,
  RemoteImportJobSnapshot,
} from './contracts';

type ImportJobRow = {
  id: string;
  language_pair_id: string;
  source_type: ImportSourceType;
  source_fingerprint: string;
  source_label: string | null;
  status: ImportJobStatus;
  server_job_id: string | null;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  artifact_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function safeCandidates(value: string | null): NormalizedImportCandidate[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as NormalizedImportCandidate[] : null;
  } catch {
    return null;
  }
}

function mapRow(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    languagePairId: row.language_pair_id,
    sourceType: row.source_type,
    sourceFingerprint: row.source_fingerprint,
    sourceLabel: row.source_label,
    status: row.status,
    serverJobId: row.server_job_id,
    candidates: safeCandidates(row.result_json),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    artifactExpiresAt: row.artifact_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanFingerprint(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function importIdempotencyKey(input: {
  languagePairId: string;
  sourceType: ImportSourceType;
  sourceFingerprint: string;
}): string {
  return `${input.languagePairId}:${input.sourceType}:${cleanFingerprint(input.sourceFingerprint)}`;
}

function toStagingCandidate(candidate: NormalizedImportCandidate): ProposedVocabulary {
  return {
    term: candidate.term,
    translation: candidate.translation,
    ...(candidate.definition ? { definition: candidate.definition } : {}),
    ...(candidate.context ? { contextSentence: candidate.context } : {}),
    ...(candidate.partOfSpeech ? { partOfSpeech: candidate.partOfSpeech } : {}),
    ...(candidate.usefulness === null ? {} : { usefulnessScore: candidate.usefulness }),
    ...(candidate.confidence === null ? {} : { confidenceScore: candidate.confidence }),
    ...(candidate.cefrLevel === null ? {} : { cefrLevel: candidate.cefrLevel }),
    ...(candidate.occurrence.sourceUri ? { sourceUri: candidate.occurrence.sourceUri } : {}),
    ...(candidate.occurrence.locator ? { sourceLocator: candidate.occurrence.locator } : {}),
    ...(candidate.occurrence.pageNumber === null ? {} : { sourcePageNumber: candidate.occurrence.pageNumber }),
    ...(candidate.occurrence.timestampSeconds === null ? {} : { sourceTimestampSeconds: candidate.occurrence.timestampSeconds }),
    ...(candidate.isVisuallyConcrete === null ? {} : { isVisuallyConcrete: candidate.isVisuallyConcrete }),
  };
}

export class ImportJobRepository {
  constructor(private readonly sqlite: SQLiteDatabase) {}

  async createOrReuse(input: {
    languagePairId: string;
    sourceType: ImportSourceType;
    sourceFingerprint: string;
    sourceLabel?: string | null;
  }, now = new Date()): Promise<ImportJob> {
    const fingerprint = cleanFingerprint(input.sourceFingerprint);
    const existing = await this.sqlite.getFirstAsync<ImportJobRow>(
      `SELECT * FROM import_jobs WHERE language_pair_id=? AND source_type=? AND source_fingerprint=? LIMIT 1`,
      input.languagePairId,
      input.sourceType,
      fingerprint,
    );
    if (existing) return mapRow(existing);

    const timestamp = now.toISOString();
    const id = createId('import-job');
    await this.sqlite.runAsync(
      `INSERT INTO import_jobs(id,language_pair_id,source_type,source_fingerprint,source_label,status,server_job_id,result_json,error_code,error_message,retry_count,artifact_expires_at,created_at,updated_at)
       VALUES(?,?,?,?,?,'QUEUED',NULL,NULL,NULL,NULL,0,NULL,?,?)`,
      id,
      input.languagePairId,
      input.sourceType,
      fingerprint,
      input.sourceLabel?.trim() || null,
      timestamp,
      timestamp,
    );
    return (await this.get(id))!;
  }

  async get(id: string): Promise<ImportJob | null> {
    const row = await this.sqlite.getFirstAsync<ImportJobRow>('SELECT * FROM import_jobs WHERE id=?', id);
    return row ? mapRow(row) : null;
  }

  async list(languagePairId: string): Promise<ImportJob[]> {
    const rows = await this.sqlite.getAllAsync<ImportJobRow>(
      `SELECT * FROM import_jobs WHERE language_pair_id=? ORDER BY updated_at DESC, id DESC`,
      languagePairId,
    );
    return rows.map(mapRow);
  }

  async saveLocalCandidates(
    id: string,
    candidates: NormalizedImportCandidate[],
    status: Extract<ImportJobStatus, 'PROCESSING' | 'NEEDS_REVIEW'> = 'PROCESSING',
    now = new Date(),
  ): Promise<ImportJob> {
    await this.sqlite.runAsync(
      `UPDATE import_jobs
       SET status=?,result_json=?,error_code=NULL,error_message=NULL,updated_at=?
       WHERE id=?`,
      status,
      JSON.stringify(candidates),
      now.toISOString(),
      id,
    );
    const updated = await this.get(id);
    if (!updated) throw new Error('Import job no longer exists on this device.');
    return updated;
  }

  async applyRemoteSnapshot(id: string, snapshot: RemoteImportJobSnapshot, now = new Date()): Promise<ImportJob> {
    const current = await this.get(id);
    if (!current) throw new Error('Import job no longer exists on this device.');
    const resultJson = snapshot.candidates ? JSON.stringify(snapshot.candidates) : current.candidates ? JSON.stringify(current.candidates) : null;
    await this.sqlite.runAsync(
      `UPDATE import_jobs
       SET server_job_id=?, status=?, result_json=?, error_code=?, error_message=?, artifact_expires_at=?, updated_at=?
       WHERE id=?`,
      snapshot.serverJobId,
      snapshot.status,
      resultJson,
      snapshot.errorCode ?? null,
      snapshot.errorMessage ?? null,
      snapshot.artifactExpiresAt ?? current.artifactExpiresAt,
      now.toISOString(),
      id,
    );
    return (await this.get(id))!;
  }

  async markFailed(id: string, code: string, message: string, now = new Date()): Promise<void> {
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET status='FAILED',error_code=?,error_message=?,updated_at=? WHERE id=?`,
      code,
      message,
      now.toISOString(),
      id,
    );
  }

  async prepareRetry(id: string, now = new Date()): Promise<ImportJob> {
    const job = await this.get(id);
    if (!job) throw new Error('Import job not found.');
    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') return job;
    if (!canRetryImport(job.retryCount)) throw new Error('This import reached its retry limit. Start a new import only if the source has changed.');
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET status='QUEUED',error_code=NULL,error_message=NULL,retry_count=retry_count+1,updated_at=? WHERE id=?`,
      now.toISOString(),
      id,
    );
    return (await this.get(id))!;
  }

  async recordServerRetry(id: string, now = new Date()): Promise<ImportJob> {
    const job = await this.get(id);
    if (!job) throw new Error('Import job not found.');
    if (!canRetryImport(job.retryCount)) throw new Error('This import reached its retry limit.');
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET retry_count=retry_count+1,error_code=NULL,error_message=NULL,updated_at=? WHERE id=?`,
      now.toISOString(),
      id,
    );
    return (await this.get(id))!;
  }

  async cancel(id: string, now = new Date()): Promise<void> {
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET status='CANCELLED',updated_at=? WHERE id=? AND status IN ('QUEUED','PROCESSING','FAILED')`,
      now.toISOString(),
      id,
    );
  }

  async sendToStaging(id: string, now = new Date()): Promise<string> {
    const job = await this.get(id);
    if (!job) throw new Error('Import job not found.');
    if (!job.candidates?.length) throw new Error('This import has no candidates to review.');
    if (job.candidates.some((candidate) => !candidate.translation.trim())) {
      throw new Error('This import still has vocabulary waiting for enrichment.');
    }

    const existing = await this.sqlite.getFirstAsync<{ id: string }>(
      'SELECT id FROM import_batches WHERE job_id=? ORDER BY created_at DESC LIMIT 1',
      id,
    );
    if (existing) return existing.id;

    const batchId = await new ImportStagingService(this.sqlite).createBatch(
      job.languagePairId,
      job.sourceType,
      job.sourceLabel,
      job.candidates.map(toStagingCandidate),
      now,
    );
    await this.sqlite.runAsync('UPDATE import_batches SET job_id=? WHERE id=?', id, batchId);
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET status='NEEDS_REVIEW',updated_at=? WHERE id=?`,
      now.toISOString(),
      id,
    );
    return batchId;
  }

  async completeIfReviewed(id: string, now = new Date()): Promise<boolean> {
    const pending = await this.sqlite.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) count FROM import_candidates c JOIN import_batches b ON b.id=c.batch_id
       WHERE b.job_id=? AND c.status='PENDING'`,
      id,
    );
    if (Number(pending?.count ?? 0) > 0) return false;
    await this.sqlite.runAsync(
      `UPDATE import_jobs SET status='COMPLETED',updated_at=? WHERE id=? AND status='NEEDS_REVIEW'`,
      now.toISOString(),
      id,
    );
    return true;
  }
}

export class ImportJobService {
  private readonly repository: ImportJobRepository;
  private readonly sqlite: SQLiteDatabase;

  constructor(
    sqlite: SQLiteDatabase,
    private readonly transport: ImportJobTransport,
  ) {
    this.sqlite = sqlite;
    this.repository = new ImportJobRepository(sqlite);
  }

  private async learnerLevel() {
    const value = await new PreferencesRepository(asSqlDatabase(this.sqlite)).get('learner_level');
    return isLearnerLevel(value) ? value : DEFAULT_LEARNER_LEVEL;
  }

  async submit(jobId: string, sourcePayload: unknown): Promise<ImportJob> {
    const job = await this.repository.get(jobId);
    if (!job) throw new Error('Import job not found.');
    if (job.status === 'NEEDS_REVIEW' || job.status === 'COMPLETED') return job;

    try {
      const snapshot = await this.transport.submit({
        idempotencyKey: importIdempotencyKey(job),
        localJobId: job.id,
        languagePairId: job.languagePairId,
        sourceType: job.sourceType,
        sourceFingerprint: job.sourceFingerprint,
        sourceLabel: job.sourceLabel,
        learnerLevel: await this.learnerLevel(),
        sourcePayload,
      });
      const updated = await this.repository.applyRemoteSnapshot(job.id, snapshot);
      if (updated.status === 'NEEDS_REVIEW' && updated.candidates?.length) await this.repository.sendToStaging(updated.id);
      return (await this.repository.get(job.id))!;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Import service is unavailable.';
      await this.repository.markFailed(job.id, classifyImportFailure(message), message);
      throw caught;
    }
  }

  async refresh(jobId: string): Promise<ImportJob> {
    const job = await this.repository.get(jobId);
    if (!job) throw new Error('Import job not found.');
    if (!job.serverJobId || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) return job;
    const snapshot = await this.transport.get(job.serverJobId);
    const updated = await this.repository.applyRemoteSnapshot(job.id, snapshot);
    if (updated.status === 'NEEDS_REVIEW' && updated.candidates?.length) await this.repository.sendToStaging(updated.id);
    return (await this.repository.get(job.id))!;
  }

  async retry(jobId: string): Promise<ImportJob> {
    const current = await this.repository.get(jobId);
    if (!current) throw new Error('Import job not found.');
    if (!canRetryImport(current.retryCount)) throw new Error('This import reached its retry limit.');
    if (!current.serverJobId) return this.repository.prepareRetry(jobId);

    const snapshot = await this.transport.retry(current.serverJobId);
    await this.repository.applyRemoteSnapshot(jobId, snapshot);
    return this.repository.recordServerRetry(jobId);
  }

  async cancel(jobId: string): Promise<void> {
    const current = await this.repository.get(jobId);
    if (!current) return;
    if (current.serverJobId) await this.transport.cancel(current.serverJobId);
    await this.repository.cancel(jobId);
  }
}
