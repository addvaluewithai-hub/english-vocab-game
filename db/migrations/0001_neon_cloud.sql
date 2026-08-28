-- T018: Neon cloud schema. Tested on a child branch before production.
-- The Expo client never receives a privileged Postgres connection string.

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_authenticated') THEN
    CREATE ROLE app_authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app_private TO app_authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO app_authenticated;

CREATE TABLE IF NOT EXISTS public.language_pairs (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  target_language_code text NOT NULL,
  target_language_name text NOT NULL,
  reference_language_code text NOT NULL,
  reference_language_name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.terms (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  language_pair_id text NOT NULL,
  text text NOT NULL,
  normalized_text text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('WORD','PHRASE')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id),
  FOREIGN KEY(owner_id, language_pair_id) REFERENCES public.language_pairs(owner_id, id)
);
CREATE INDEX IF NOT EXISTS terms_owner_pair_text_idx ON public.terms(owner_id, language_pair_id, normalized_text) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.senses (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  term_id text NOT NULL,
  translation text NOT NULL,
  definition text,
  part_of_speech text,
  pronunciation_text text,
  example_translation text,
  note text,
  image_uri text,
  audio_uri text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id),
  FOREIGN KEY(owner_id, term_id) REFERENCES public.terms(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.cards (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  sense_id text NOT NULL,
  prompt_mode text NOT NULL DEFAULT 'TARGET_TO_MEANING' CHECK(prompt_mode = 'TARGET_TO_MEANING'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id),
  UNIQUE(owner_id, sense_id, prompt_mode),
  FOREIGN KEY(owner_id, sense_id) REFERENCES public.senses(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.collections (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  language_pair_id text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id),
  FOREIGN KEY(owner_id, language_pair_id) REFERENCES public.language_pairs(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.collection_items (
  owner_id text NOT NULL,
  collection_id text NOT NULL,
  card_id text NOT NULL,
  created_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  deleted_at timestamptz,
  PRIMARY KEY(owner_id, collection_id, card_id),
  FOREIGN KEY(owner_id, collection_id) REFERENCES public.collections(owner_id, id),
  FOREIGN KEY(owner_id, card_id) REFERENCES public.cards(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.sources (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  type text NOT NULL CHECK(type IN ('MANUAL','TEXT','PDF','YOUTUBE','URL','PHOTO','GENERATED')),
  title text,
  external_id text,
  uri text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.source_occurrences (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  source_id text NOT NULL,
  sense_id text NOT NULL,
  original_sentence text,
  page_number integer CHECK(page_number IS NULL OR page_number > 0),
  timestamp_seconds double precision CHECK(timestamp_seconds IS NULL OR timestamp_seconds >= 0),
  locator text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  deleted_at timestamptz,
  UNIQUE(owner_id, id),
  FOREIGN KEY(owner_id, source_id) REFERENCES public.sources(owner_id, id),
  FOREIGN KEY(owner_id, sense_id) REFERENCES public.senses(owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.user_card_states (
  owner_id text NOT NULL,
  card_id text NOT NULL,
  lifecycle text NOT NULL CHECK(lifecycle IN ('NEW','LEARNING','REVIEW','MASTERED')),
  repetitions integer NOT NULL DEFAULT 0 CHECK(repetitions >= 0),
  lapses integer NOT NULL DEFAULT 0 CHECK(lapses >= 0),
  last_reviewed_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  PRIMARY KEY(owner_id, card_id),
  FOREIGN KEY(owner_id, card_id) REFERENCES public.cards(owner_id, id)
);
CREATE INDEX IF NOT EXISTS card_states_owner_due_idx ON public.user_card_states(owner_id, next_due_at);

CREATE TABLE IF NOT EXISTS public.review_events (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  card_id text NOT NULL,
  session_id text NOT NULL,
  grade text NOT NULL CHECK(grade IN ('KNEW','FORGOT')),
  reviewed_at timestamptz NOT NULL,
  response_ms integer CHECK(response_ms IS NULL OR response_ms >= 0),
  created_at timestamptz NOT NULL,
  UNIQUE(owner_id, id),
  FOREIGN KEY(owner_id, card_id) REFERENCES public.cards(owner_id, id)
);
CREATE INDEX IF NOT EXISTS review_events_owner_card_time_idx ON public.review_events(owner_id, card_id, reviewed_at, id);

CREATE TABLE IF NOT EXISTS public.app_settings (
  owner_id text NOT NULL,
  key text NOT NULL,
  value_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  PRIMARY KEY(owner_id, key)
);

CREATE TABLE IF NOT EXISTS public.sync_clients (
  owner_id text NOT NULL,
  client_id text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  last_pull_cursor bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(owner_id, client_id)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'language_pairs','terms','senses','cards','collections','collection_items','sources',
    'source_occurrences','user_card_states','review_events','app_settings','sync_clients'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS owner_select ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS owner_insert ON public.%I', table_name);
    EXECUTE format('CREATE POLICY owner_select ON public.%I FOR SELECT TO app_authenticated USING (owner_id = app_private.current_user_id())', table_name);
    EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO app_authenticated WITH CHECK (owner_id = app_private.current_user_id())', table_name);
    IF table_name <> 'review_events' THEN
      EXECUTE format('DROP POLICY IF EXISTS owner_update ON public.%I', table_name);
      EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO app_authenticated USING (owner_id = app_private.current_user_id()) WITH CHECK (owner_id = app_private.current_user_id())', table_name);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.language_pairs, public.terms, public.senses, public.cards,
  public.collections, public.collection_items, public.sources, public.source_occurrences,
  public.user_card_states, public.app_settings, public.sync_clients TO app_authenticated;
GRANT SELECT, INSERT ON public.review_events TO app_authenticated;
REVOKE UPDATE, DELETE ON public.review_events FROM app_authenticated;
