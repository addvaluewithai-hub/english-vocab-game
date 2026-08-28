-- T032-T038: durable server-side import processing metadata.
-- Applied first on a Neon child branch. Production promotion happens at the release migration gate.

ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS provider_kind text;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS provider_job_id text;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS import_jobs_provider_job_idx
  ON public.import_jobs(owner_id, provider_kind, provider_job_id)
  WHERE provider_job_id IS NOT NULL;
