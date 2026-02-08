-- ============================================
-- Migration: course_registrations - support course_id
-- - Make subject_id and period_id nullable (for new flow)
-- - Add unique(student_id, course_id) for course_id-based registrations
-- ============================================

BEGIN;

-- 1. Make subject_id and period_id nullable in course_registrations
ALTER TABLE public.course_registrations
  ALTER COLUMN subject_id DROP NOT NULL,
  ALTER COLUMN period_id DROP NOT NULL;

-- 2. Unique constraint: one registration per student per course (when course_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_registrations_student_course_unique
  ON public.course_registrations(student_id, course_id)
  WHERE course_id IS NOT NULL;

COMMIT;
