-- T021: align the cloud schema with Neon Data API role semantics.
-- Tested on a Neon child branch before any production application.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO authenticated;

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
    EXECUTE format('DROP POLICY IF EXISTS owner_update ON public.%I', table_name);
    EXECUTE format('CREATE POLICY owner_select ON public.%I FOR SELECT TO authenticated USING (owner_id = app_private.current_user_id())', table_name);
    EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = app_private.current_user_id())', table_name);
    IF table_name <> 'review_events' THEN
      EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING (owner_id = app_private.current_user_id()) WITH CHECK (owner_id = app_private.current_user_id())', table_name);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.language_pairs, public.terms, public.senses, public.cards,
  public.collections, public.collection_items, public.sources, public.source_occurrences,
  public.user_card_states, public.app_settings, public.sync_clients TO authenticated;
GRANT SELECT, INSERT ON public.review_events TO authenticated;
REVOKE UPDATE, DELETE ON public.review_events FROM authenticated;

ALTER TABLE public.sync_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_changes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_select ON public.sync_changes;
CREATE POLICY owner_select ON public.sync_changes
  FOR SELECT TO authenticated
  USING (owner_id = app_private.current_user_id());
GRANT SELECT ON public.sync_changes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sync_changes_cursor_seq TO authenticated;

CREATE OR REPLACE FUNCTION app_private.record_sync_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
  row_owner text;
  row_id text;
  row_version bigint;
  row_deleted_at timestamptz;
  event_operation text;
BEGIN
  row_owner := payload ->> 'owner_id';
  row_id := CASE
    WHEN TG_TABLE_NAME = 'collection_items' THEN concat_ws(':', payload ->> 'collection_id', payload ->> 'card_id')
    WHEN TG_TABLE_NAME = 'app_settings' THEN payload ->> 'key'
    WHEN TG_TABLE_NAME = 'user_card_states' THEN payload ->> 'card_id'
    ELSE payload ->> 'id'
  END;

  IF TG_TABLE_NAME = 'review_events' THEN
    row_version := 1;
    event_operation := 'APPEND';
  ELSE
    row_version := COALESCE((payload ->> 'version')::bigint, 1);
    row_deleted_at := NULLIF(payload ->> 'deleted_at', '')::timestamptz;
    event_operation := CASE WHEN row_deleted_at IS NOT NULL THEN 'DELETE' ELSE 'UPSERT' END;
  END IF;

  IF row_owner IS NULL OR row_id IS NULL THEN
    RAISE EXCEPTION 'sync change trigger could not identify owner/entity for %', TG_TABLE_NAME;
  END IF;

  INSERT INTO public.sync_changes(owner_id, entity_type, entity_id, entity_version, operation)
  VALUES (row_owner, TG_TABLE_NAME, row_id, row_version, event_operation);
  RETURN NEW;
END
$$;
