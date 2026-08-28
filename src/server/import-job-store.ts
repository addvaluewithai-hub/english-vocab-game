import type {
  ImportJobStatus,
  ImportSourceType,
  NormalizedImportCandidate,
  RemoteImportJobSnapshot,
} from '@/imports/contracts';
import { serverSql } from './database';

export interface ServerImportJob {
  id: string;
  ownerId: string;
  languagePairId: string;
  sourceType: ImportSourceType;
  sourceFingerprint: string;
  sourceLabel: string | null;
  status: ImportJobStatus;
  providerKind: string | null;
  providerJobId: string | null;
  artifactKey: string | null;
  artifactExpiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  sourcePayload: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

type JobRow = {
  id: string;
  owner_id: string;
  language_pair_id: string;
  source_type: ImportSourceType;
  source_fingerprint: string;
  source_label: string | null;
  status: ImportJobStatus;
  provider_kind: string | null;
  provider_job_id: string | null;
  artifact_key: string | null;
  artifact_expires_at: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  source_payload: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
};

function mapJob(row: JobRow): ServerImportJob {
  return {
    id: row.id,
    ownerId: row.owner_id,
    languagePairId: row.language_pair_id,
    sourceType: row.source_type,
    sourceFingerprint: row.source_fingerprint,
    sourceLabel: row.source_label,
    status: row.status,
    providerKind: row.provider_kind,
    providerJobId: row.provider_job_id,
    artifactKey: row.artifact_key,
    artifactExpiresAt: row.artifact_expires_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryCount: Number(row.retry_count),
    sourcePayload: row.source_payload ?? {},
    metrics: row.metrics ?? {},
  };
}

export async function createOrGetServerImportJob(input: {
  id: string;
  ownerId: string;
  languagePairId: string;
  sourceType: ImportSourceType;
  sourceFingerprint: string;
  sourceLabel: string | null;
  sourcePayload: Record<string, unknown>;
  artifactKey?: string | null;
}): Promise<ServerImportJob> {
  const sql = serverSql();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO import_jobs(
      id, owner_id, language_pair_id, source_type, source_fingerprint, source_label,
      status, artifact_key, source_payload, created_at, updated_at
    ) VALUES (
      ${input.id}, ${input.ownerId}, ${input.languagePairId}, ${input.sourceType},
      ${input.sourceFingerprint}, ${input.sourceLabel}, 'QUEUED', ${input.artifactKey ?? null},
      ${JSON.stringify(input.sourcePayload)}::jsonb, ${now}, ${now}
    )
    ON CONFLICT (owner_id, language_pair_id, source_type, source_fingerprint)
    DO UPDATE SET updated_at = import_jobs.updated_at
  `;
  const rows = await sql`
    SELECT id,owner_id,language_pair_id,source_type,source_fingerprint,source_label,status,
      provider_kind,provider_job_id,artifact_key,artifact_expires_at,error_code,error_message,
      retry_count,source_payload,metrics
    FROM import_jobs
    WHERE owner_id=${input.ownerId} AND language_pair_id=${input.languagePairId}
      AND source_type=${input.sourceType} AND source_fingerprint=${input.sourceFingerprint}
    LIMIT 1
  ` as unknown as JobRow[];
  if (!rows[0]) throw new Error('SERVER_JOB_WRITE_FAILED');
  return mapJob(rows[0]);
}

export async function getServerImportJob(ownerId: string, id: string): Promise<ServerImportJob | null> {
  const sql = serverSql();
  const rows = await sql`
    SELECT id,owner_id,language_pair_id,source_type,source_fingerprint,source_label,status,
      provider_kind,provider_job_id,artifact_key,artifact_expires_at,error_code,error_message,
      retry_count,source_payload,metrics
    FROM import_jobs WHERE owner_id=${ownerId} AND id=${id} LIMIT 1
  ` as unknown as JobRow[];
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function markServerJobProcessing(input: {
  ownerId: string;
  id: string;
  providerKind: string;
  providerJobId?: string | null;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const sql = serverSql();
  await sql`
    UPDATE import_jobs SET status='PROCESSING', provider_kind=${input.providerKind},
      provider_job_id=${input.providerJobId ?? null}, metrics=${JSON.stringify(input.metrics ?? {})}::jsonb,
      error_code=NULL,error_message=NULL,updated_at=${new Date().toISOString()}
    WHERE owner_id=${input.ownerId} AND id=${input.id} AND status='QUEUED'
  `;
}

export async function markServerJobFailed(input: {
  ownerId: string;
  id: string;
  code: string;
  message: string;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const sql = serverSql();
  await sql`
    UPDATE import_jobs SET status='FAILED', error_code=${input.code}, error_message=${input.message},
      metrics=${JSON.stringify(input.metrics ?? {})}::jsonb, updated_at=${new Date().toISOString()}
    WHERE owner_id=${input.ownerId} AND id=${input.id} AND status <> 'CANCELLED'
  `;
}

export async function storeServerCandidates(input: {
  ownerId: string;
  jobId: string;
  candidates: NormalizedImportCandidate[];
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const sql = serverSql();
  const job = await getServerImportJob(input.ownerId, input.jobId);
  if (!job || job.status === 'CANCELLED') return;

  await sql`DELETE FROM import_job_candidates WHERE owner_id=${input.ownerId} AND job_id=${input.jobId}`;
  const createdAt = new Date().toISOString();
  for (const candidate of input.candidates) {
    await sql`
      INSERT INTO import_job_candidates(
        id,owner_id,job_id,candidate_key,term,translation,definition,part_of_speech,context_text,
        source_occurrence,confidence,usefulness,cefr_level,duplicate_hint,is_visually_concrete,created_at
      ) VALUES (
        ${`${input.jobId}:${candidate.candidateKey}`},${input.ownerId},${input.jobId},${candidate.candidateKey},
        ${candidate.term},${candidate.translation},${candidate.definition},${candidate.partOfSpeech},${candidate.context},
        ${JSON.stringify(candidate.occurrence)}::jsonb,${candidate.confidence},${candidate.usefulness},${candidate.cefrLevel},
        ${candidate.duplicateHint},${candidate.isVisuallyConcrete},${createdAt}
      )
    `;
  }
  const updated = await sql`
    UPDATE import_jobs SET status='NEEDS_REVIEW', error_code=NULL,error_message=NULL,
      metrics=${JSON.stringify(input.metrics ?? {})}::jsonb, completed_at=${createdAt}, updated_at=${createdAt}
    WHERE owner_id=${input.ownerId} AND id=${input.jobId} AND status <> 'CANCELLED'
    RETURNING id
  ` as unknown as Array<{ id: string }>;
  if (updated.length === 0) {
    await sql`DELETE FROM import_job_candidates WHERE owner_id=${input.ownerId} AND job_id=${input.jobId}`;
  }
}

export async function serverJobSnapshot(ownerId: string, jobId: string): Promise<RemoteImportJobSnapshot | null> {
  const job = await getServerImportJob(ownerId, jobId);
  if (!job) return null;
  const sql = serverSql();
  const rows = await sql`
    SELECT candidate_key,term,translation,definition,part_of_speech,context_text,source_occurrence,
      confidence,usefulness,cefr_level,duplicate_hint,is_visually_concrete
    FROM import_job_candidates
    WHERE owner_id=${ownerId} AND job_id=${jobId}
    ORDER BY created_at,id
  ` as unknown as Array<{
    candidate_key: string;
    term: string;
    translation: string;
    definition: string | null;
    part_of_speech: string | null;
    context_text: string | null;
    source_occurrence: NormalizedImportCandidate['occurrence'];
    confidence: number | null;
    usefulness: number | null;
    cefr_level: NormalizedImportCandidate['cefrLevel'];
    duplicate_hint: NormalizedImportCandidate['duplicateHint'];
    is_visually_concrete: boolean | null;
  }>;
  return {
    serverJobId: job.id,
    status: job.status,
    ...(rows.length ? {
      candidates: rows.map((row) => ({
        candidateKey: row.candidate_key,
        term: row.term,
        translation: row.translation,
        definition: row.definition,
        partOfSpeech: row.part_of_speech,
        context: row.context_text,
        occurrence: row.source_occurrence,
        confidence: row.confidence,
        usefulness: row.usefulness,
        cefrLevel: row.cefr_level,
        duplicateHint: row.duplicate_hint,
        isVisuallyConcrete: row.is_visually_concrete,
      })),
    } : {}),
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artifactExpiresAt: job.artifactExpiresAt,
  };
}
