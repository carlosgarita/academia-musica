-- ============================================
-- Migration: Alter course_registrations to use subject_id (Subjects) instead of schedule_id (Schedules)
-- Run this if you already have course_registrations with schedule_id.
-- Execute in Supabase SQL Editor
-- ============================================

-- Add subject_id
ALTER TABLE public.course_registrations
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects ON DELETE CASCADE;

-- Backfill from schedule's subject_id (only where schedule exists and has subject_id)
UPDATE public.course_registrations cr
SET subject_id = (SELECT s.subject_id FROM public.schedules s WHERE s.id = cr.schedule_id AND s.deleted_at IS NULL)
WHERE cr.schedule_id IS NOT NULL;

-- Remove rows that could not be backfilled (no subject_id)
DELETE FROM public.course_registrations WHERE subject_id IS NULL AND schedule_id IS NOT NULL;

-- Drop old unique constraint (name may vary; try common pattern)
ALTER TABLE public.course_registrations DROP CONSTRAINT IF EXISTS course_registrations_student_id_schedule_id_period_id_key;

-- Drop schedule_id and its index
DROP INDEX IF EXISTS idx_course_registrations_schedule_id;
ALTER TABLE public.course_registrations DROP COLUMN IF EXISTS schedule_id;

-- Make subject_id NOT NULL (only if no nulls remain; delete any that can't be fixed)
DELETE FROM public.course_registrations WHERE subject_id IS NULL;
ALTER TABLE public.course_registrations ALTER COLUMN subject_id SET NOT NULL;

-- New unique and index (drop first so migration is idempotent)
ALTER TABLE public.course_registrations DROP CONSTRAINT IF EXISTS course_registrations_student_id_subject_id_period_id_key;
ALTER TABLE public.course_registrations
  ADD CONSTRAINT course_registrations_student_id_subject_id_period_id_key
  UNIQUE (student_id, subject_id, period_id);

CREATE INDEX IF NOT EXISTS idx_course_registrations_subject_id ON public.course_registrations(subject_id);

-- ============================================
-- Migration completed!
-- ============================================
