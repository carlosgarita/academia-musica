-- ============================================
-- Migration: Ensure subject_id and period_id are nullable in course_registrations
-- Required for the new courses flow (matrículas with course_id only)
-- ============================================

-- Make subject_id and period_id nullable (idempotent - safe if already nullable)
ALTER TABLE public.course_registrations
  ALTER COLUMN subject_id DROP NOT NULL,
  ALTER COLUMN period_id DROP NOT NULL;
