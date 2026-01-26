-- ============================================
-- Migration: period_dates — replace schedule_id with subject_id
-- La clase (subject) se toma de subjects; schedules solo para horario (día/hora).
-- Execute in Supabase SQL Editor
-- ============================================

-- 1. Add subject_id
ALTER TABLE public.period_dates
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects ON DELETE SET NULL;

-- 2. Backfill from schedules.subject_id (one-time; existing data)
UPDATE public.period_dates pd
SET subject_id = (
  SELECT s.subject_id FROM public.schedules s
  WHERE s.id = pd.schedule_id AND s.deleted_at IS NULL
)
WHERE pd.schedule_id IS NOT NULL;

-- 3. Drop old index and column
DROP INDEX IF EXISTS idx_period_dates_schedule_id;
ALTER TABLE public.period_dates DROP COLUMN IF EXISTS schedule_id;

-- 4. Index for filtering sessions by class (subject)
CREATE INDEX IF NOT EXISTS idx_period_dates_subject_id
  ON public.period_dates(subject_id) WHERE subject_id IS NOT NULL;

-- ============================================
-- Migration completed!
-- ============================================
