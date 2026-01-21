-- ============================================
-- Migration: Add soft delete (deleted_at) to tables
-- MVP: GDPR compliance base
-- Run in Supabase SQL Editor
-- ============================================

-- Add deleted_at to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_at to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_at to subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_at to schedules
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- ============================================
-- Migration completed!
-- ============================================
