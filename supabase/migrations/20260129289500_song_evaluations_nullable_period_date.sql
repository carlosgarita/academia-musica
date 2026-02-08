-- Allow song_evaluations to use course_session_id without period_date_id
-- (period_date_id will be dropped in the next migration)
-- Run only if column exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'song_evaluations'
      AND column_name = 'period_date_id'
  ) THEN
    ALTER TABLE public.song_evaluations ALTER COLUMN period_date_id DROP NOT NULL;
  END IF;
END $$;
