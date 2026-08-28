-- T020: monotonic change stream for incremental device pulls.
-- Review events remain append-only. Mutable deletions are tombstones.

CREATE TABLE IF NOT EXISTS public.sync_changes (
  cursor bigserial PRIMARY KEY,
  owner_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_version bigint NOT NULL CHECK(entity_version > 0),
  operation text NOT NULL CHECK(operation IN ('UPSERT','DELETE','APPEND')),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_changes_owner_cursor_idx
  ON public.sync_changes(owner_id, cursor);

ALTER TABLE public.sync_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_changes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_select ON public.sync_changes;
CREATE POLICY owner_select ON public.sync_changes
  FOR SELECT TO app_authenticated
  USING (owner_id = app_private.current_user_id());
GRANT SELECT ON public.sync_changes TO app_authenticated;

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
  row_id := COALESCE(
    payload ->> 'id',
    payload ->> 'card_id',
    payload ->> 'key',
    concat_ws(':', payload ->> 'collection_id', payload ->> 'card_id')
  );

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

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'language_pairs','terms','senses','cards','collections','collection_items','sources',
    'source_occurrences','user_card_states','review_events','app_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS sync_change_after_write ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER sync_change_after_write AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.record_sync_change()',
      table_name
    );
  END LOOP;
END $$;
