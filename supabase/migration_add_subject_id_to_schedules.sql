-- ============================================
-- Migration: Add subject_id column to schedules table
-- IMPORTANT: Execute this in Supabase SQL Editor
-- ============================================

-- Add subject_id column to schedules table if it doesn't exist
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects ON DELETE SET NULL;

-- Create index on subject_id for better query performance
CREATE INDEX IF NOT EXISTS idx_schedules_subject ON public.schedules(subject_id);

-- ============================================
-- Migration completed!
-- ============================================
