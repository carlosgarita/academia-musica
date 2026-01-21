-- ============================================
-- Migration: Fix enrollments table constraints
-- Execute this in Supabase SQL Editor
-- This script removes conflicting unique constraints and ensures
-- only partial unique indexes are used
-- ============================================

-- First, ensure subject_id and schedule_id columns allow NULL values
-- This is critical for the constraint check to work properly
alter table public.enrollments
  alter column subject_id drop not null;

alter table public.enrollments
  alter column schedule_id drop not null;

-- Drop old unique constraints if they exist
do $$
begin
  -- Drop the old subject-based unique constraint
  if exists (
    select 1 from pg_constraint 
    where conname = 'enrollments_student_id_subject_id_teacher_id_key'
  ) then
    alter table public.enrollments
      drop constraint enrollments_student_id_subject_id_teacher_id_key;
    raise notice 'Dropped constraint enrollments_student_id_subject_id_teacher_id_key';
  end if;
  
  -- Drop the old schedule-based unique constraint (if it exists as a table constraint)
  if exists (
    select 1 from pg_constraint 
    where conname = 'enrollments_student_id_schedule_id_key'
  ) then
    alter table public.enrollments
      drop constraint enrollments_student_id_schedule_id_key;
    raise notice 'Dropped constraint enrollments_student_id_schedule_id_key';
  end if;
end $$;

-- Ensure the check constraint exists
alter table public.enrollments
  drop constraint if exists enrollments_subject_or_schedule_check;

alter table public.enrollments
  add constraint enrollments_subject_or_schedule_check 
  check (
    (subject_id is not null and schedule_id is null) or
    (subject_id is null and schedule_id is not null)
  );

-- Ensure partial unique indexes exist (these are better than table constraints for this use case)
drop index if exists enrollments_student_schedule_unique;
create unique index if not exists enrollments_student_schedule_unique
  on public.enrollments(student_id, schedule_id)
  where schedule_id is not null;

drop index if exists enrollments_student_subject_teacher_unique;
create unique index if not exists enrollments_student_subject_teacher_unique
  on public.enrollments(student_id, subject_id, teacher_id)
  where subject_id is not null;

-- ============================================
-- Migration completed!
-- ============================================
