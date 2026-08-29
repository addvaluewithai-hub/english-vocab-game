ALTER TABLE import_job_candidates
ADD COLUMN IF NOT EXISTS cefr_level TEXT
CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2'));
