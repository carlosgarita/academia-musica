-- Migration: Add subject_id to schedules
-- Run in Supabase SQL Editor if your DB already has schedules without this column.

alter table public.schedules
  add column if not exists subject_id uuid references public.subjects on delete set null;

create index if not exists idx_schedules_subject on public.schedules(subject_id);
