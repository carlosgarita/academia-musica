-- ============================================
-- Migration: Add additional_info column to students table
-- Execute this in Supabase SQL Editor
-- ============================================

-- Add additional_info column to students table
alter table public.students 
add column if not exists additional_info text check (char_length(additional_info) <= 500);

-- ============================================
-- Migration completed!
-- ============================================
