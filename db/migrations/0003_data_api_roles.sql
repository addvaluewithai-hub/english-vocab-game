-- T021: Neon Data API compatibility for the authenticated JWT role.
-- Tested on isolated Neon branch br-solitary-base-axeluzms before being versioned here.
-- We keep app_private.current_user_id() as the claim reader so this migration
-- remains valid before/after the Data API creates its convenience auth schema.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.language_pairs, public.terms, public.senses, public.cards,
  public.collections, public.collection_items, public.sources, public.source_occurrences,
  public.user_card_states, public.app_settings, public.sync_clients TO authenticated;
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT SELECT ON public.sync_changes TO authenticated;
REVOKE UPDATE, DELETE ON public.review_events FROM authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'language_pairs','terms','senses','cards','collections','collection_items','sources',
    'source_occurrences','user_card_states','review_events','app_settings','sync_clients','sync_changes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);

    EXECUTE format('DROP POLICY IF EXISTS api_owner_select ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY api_owner_select ON public.%I FOR SELECT TO authenticated USING (owner_id = app_private.current_user_id())',
      table_name
    );

    IF table_name <> 'sync_changes' THEN
      EXECUTE format('DROP POLICY IF EXISTS api_owner_insert ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY api_owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = app_private.current_user_id())',
        table_name
      );
    END IF;

    IF table_name NOT IN ('review_events','sync_changes') THEN
      EXECUTE format('DROP POLICY IF EXISTS api_owner_update ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY api_owner_update ON public.%I FOR UPDATE TO authenticated USING (owner_id = app_private.current_user_id()) WITH CHECK (owner_id = app_private.current_user_id())',
        table_name
      );
    END IF;
  END LOOP;
END $$;
