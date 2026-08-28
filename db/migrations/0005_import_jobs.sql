-- T030: source-agnostic smart-import job persistence.
-- Mobile clients may observe their own jobs/candidates; server workers own writes.

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  language_pair_id text NOT NULL,
  source_type text NOT NULL CHECK(source_type IN ('TEXT','PDF','YOUTUBE','URL','PHOTO')),
  source_fingerprint text NOT NULL,
  source_label text,
  status text NOT NULL CHECK(status IN ('QUEUED','PROCESSING','NEEDS_REVIEW','COMPLETED','FAILED','CANCELLED')),
  error_code text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
  artifact_key text,
  artifact_expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(owner_id, id),
  UNIQUE(owner_id, language_pair_id, source_type, source_fingerprint),
  FOREIGN KEY(owner_id, language_pair_id) REFERENCES public.language_pairs(owner_id, id)
);
CREATE INDEX IF NOT EXISTS import_jobs_owner_status_idx ON public.import_jobs(owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.import_job_candidates (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  job_id text NOT NULL,
  candidate_key text NOT NULL,
  term text NOT NULL,
  translation text NOT NULL,
  definition text,
  part_of_speech text,
  context_text text,
  source_occurrence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence double precision,
  usefulness double precision,
  duplicate_hint text CHECK(duplicate_hint IN ('NONE','EXACT','LIKELY')),
  is_visually_concrete boolean,
  created_at timestamptz NOT NULL,
  UNIQUE(owner_id, id),
  UNIQUE(owner_id, job_id, candidate_key),
  FOREIGN KEY(owner_id, job_id) REFERENCES public.import_jobs(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS import_job_candidates_owner_job_idx ON public.import_job_candidates(owner_id, job_id, created_at, id);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_candidates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_select ON public.import_jobs;
CREATE POLICY owner_select ON public.import_jobs
  FOR SELECT TO authenticated
  USING (owner_id = app_private.current_user_id());

DROP POLICY IF EXISTS owner_select ON public.import_job_candidates;
CREATE POLICY owner_select ON public.import_job_candidates
  FOR SELECT TO authenticated
  USING (owner_id = app_private.current_user_id());

GRANT SELECT ON public.import_jobs, public.import_job_candidates TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.import_jobs, public.import_job_candidates FROM authenticated;
