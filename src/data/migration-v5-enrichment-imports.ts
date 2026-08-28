export const MIGRATION_005 = `
CREATE TABLE IF NOT EXISTS sense_enrichments (
  id TEXT PRIMARY KEY NOT NULL,
  sense_id TEXT NOT NULL REFERENCES senses(id),
  kind TEXT NOT NULL CHECK(kind IN ('IMAGE','AUDIO','CONTEXT','EXPLANATION','EXAMPLE')),
  value_text TEXT,
  value_uri TEXT,
  provenance TEXT NOT NULL CHECK(provenance IN ('USER','RULE_ENGINE','IMPORTED','GENERATED')),
  source_id TEXT REFERENCES sources(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sense_enrichments_sense ON sense_enrichments(sense_id, kind, deleted_at);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  language_pair_id TEXT NOT NULL REFERENCES language_pairs(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('TEXT','PDF','YOUTUBE','URL','PHOTO')),
  source_fingerprint TEXT NOT NULL,
  source_label TEXT,
  status TEXT NOT NULL CHECK(status IN ('QUEUED','PROCESSING','NEEDS_REVIEW','COMPLETED','FAILED','CANCELLED')),
  server_job_id TEXT,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(language_pair_id, source_type, source_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_pair_status ON import_jobs(language_pair_id, status, updated_at DESC);

ALTER TABLE import_batches ADD COLUMN job_id TEXT REFERENCES import_jobs(id);
CREATE INDEX IF NOT EXISTS idx_import_batches_job ON import_batches(job_id);
`;
