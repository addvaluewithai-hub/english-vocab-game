-- T024/T026: persistent FSRS memory state and recall-mode metadata.
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS stability double precision NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS difficulty double precision NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS elapsed_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS scheduled_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS learning_steps integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS fsrs_state integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_card_states ADD COLUMN IF NOT EXISTS scheduler_version text NOT NULL DEFAULT 'simple-v1';

ALTER TABLE public.review_events ADD COLUMN IF NOT EXISTS recall_mode text NOT NULL DEFAULT 'TARGET_TO_MEANING';
ALTER TABLE public.review_events ADD COLUMN IF NOT EXISTS mode_result text NOT NULL DEFAULT 'SELF_GRADED';
ALTER TABLE public.review_events ADD COLUMN IF NOT EXISTS scheduler_rating integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_events_recall_mode_check') THEN
    ALTER TABLE public.review_events ADD CONSTRAINT review_events_recall_mode_check
      CHECK (recall_mode IN ('TARGET_TO_MEANING','MEANING_TO_TARGET','CLOZE','LISTENING','TYPING'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_events_mode_result_check') THEN
    ALTER TABLE public.review_events ADD CONSTRAINT review_events_mode_result_check
      CHECK (mode_result IN ('SELF_GRADED','CORRECT','INCORRECT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_events_scheduler_rating_check') THEN
    ALTER TABLE public.review_events ADD CONSTRAINT review_events_scheduler_rating_check
      CHECK (scheduler_rating IS NULL OR scheduler_rating BETWEEN 1 AND 4);
  END IF;
END $$;
