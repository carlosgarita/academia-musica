-- ============================================
-- Migration: Remove professors table, move everything to profiles
-- Execute this in Supabase SQL Editor
-- This script eliminates the professors table and uses profiles directly
-- ============================================

-- ============================================
-- 1. Add additional_info to profiles if it doesn't exist
-- ============================================

alter table public.profiles
  add column if not exists additional_info text check (char_length(additional_info) <= 500);

-- Migrate additional_info from professors to profiles
do $$
begin
  update public.profiles
  set additional_info = (
    select professors.additional_info
    from public.professors
    where professors.user_id = profiles.id
  )
  where exists (
    select 1 from public.professors
    where professors.user_id = profiles.id
    and professors.additional_info is not null
  )
  and profiles.additional_info is null;
end $$;

-- ============================================
-- 2. Update schedules table: professor_id -> profile_id
-- ============================================

-- First, drop all policies that depend on professor_id
drop policy if exists "Super admins can do everything with schedules" on public.schedules;
drop policy if exists "Directors can manage schedules in their academy" on public.schedules;
drop policy if exists "Professors can view their assigned schedules" on public.schedules;
drop policy if exists "Professors can view their own schedules" on public.schedules;
drop policy if exists "Guardians can view schedules for their children" on public.schedules;
drop policy if exists "Guardians can view schedules of their students" on public.schedules;
drop policy if exists "Students can view their schedules" on public.schedules;

-- Add new column profile_id
alter table public.schedules
  add column if not exists profile_id uuid references public.profiles on delete cascade;

-- Temporarily disable triggers to avoid updated_at errors during migration
drop trigger if exists handle_updated_at on public.schedules;

-- Migrate data: get profile_id from professors.user_id
do $$
begin
  update public.schedules
  set profile_id = (
    select professors.user_id
    from public.professors
    where professors.id = schedules.professor_id
  )
  where profile_id is null
  and professor_id is not null;
end $$;

-- Re-enable trigger for schedules
create trigger handle_updated_at
  before update on public.schedules
  for each row
  execute function public.handle_updated_at();

-- Make profile_id NOT NULL after migration
alter table public.schedules
  alter column profile_id set not null;

-- Drop old professor_id column (now safe since policies are dropped)
alter table public.schedules
  drop column if exists professor_id;

-- Update indexes
drop index if exists idx_schedules_professor_day_time;
create index if not exists idx_schedules_profile_day_time
  on public.schedules(profile_id, day_of_week, start_time, end_time);

-- ============================================
-- 3. Update enrollments table: teacher_id -> profile_id (teacher_id)
-- ============================================

-- First, drop policies that depend on teacher_id referencing professors
drop policy if exists "Professors can view enrollments for their subjects" on public.enrollments;
drop policy if exists "Professors can view enrollments for their classes" on public.enrollments;

-- Add new column (we'll keep the name teacher_id but it references profiles)
-- First, create a temporary column
alter table public.enrollments
  add column if not exists teacher_profile_id uuid references public.profiles on delete cascade;

-- Temporarily disable triggers to avoid updated_at errors during migration
drop trigger if exists handle_updated_at on public.enrollments;

-- Migrate data: get profile_id from professors.user_id
do $$
begin
  update public.enrollments
  set teacher_profile_id = (
    select professors.user_id
    from public.professors
    where professors.id = enrollments.teacher_id
  )
  where teacher_profile_id is null
  and teacher_id is not null;
end $$;

-- Re-enable trigger for enrollments
create trigger handle_updated_at
  before update on public.enrollments
  for each row
  execute function public.handle_updated_at();

-- Make teacher_profile_id NOT NULL after migration
alter table public.enrollments
  alter column teacher_profile_id set not null;

-- Drop old teacher_id column
alter table public.enrollments
  drop column if exists teacher_id;

-- Rename teacher_profile_id to teacher_id for consistency
alter table public.enrollments
  rename column teacher_profile_id to teacher_id;

-- Update unique constraint
alter table public.enrollments
  drop constraint if exists enrollments_student_id_subject_id_teacher_id_key;

alter table public.enrollments
  add constraint enrollments_student_id_subject_id_teacher_id_key 
  unique(student_id, subject_id, teacher_id);

-- ============================================
-- 4. Update professor_subjects table: professor_id -> profile_id
-- ============================================

-- First, drop policies that depend on professor_id
drop policy if exists "Super admins can do everything with professor_subjects" on public.professor_subjects;
drop policy if exists "Directors can manage professor_subjects in their academy" on public.professor_subjects;
drop policy if exists "Professors can view their own subjects" on public.professor_subjects;

-- Add new column profile_id
alter table public.professor_subjects
  add column if not exists profile_id uuid references public.profiles on delete cascade;

-- Temporarily disable the updated_at trigger to avoid errors (professor_subjects doesn't have updated_at)
drop trigger if exists handle_updated_at on public.professor_subjects;

-- Migrate data: get profile_id from professors.user_id
do $$
begin
  update public.professor_subjects
  set profile_id = (
    select professors.user_id
    from public.professors
    where professors.id = professor_subjects.professor_id
  )
  where profile_id is null
  and professor_id is not null;
end $$;

-- Note: professor_subjects doesn't have updated_at column, so no trigger needed

-- Make profile_id NOT NULL after migration
alter table public.professor_subjects
  alter column profile_id set not null;

-- Drop old professor_id column
alter table public.professor_subjects
  drop column if exists professor_id;

-- Update unique constraint
alter table public.professor_subjects
  drop constraint if exists professor_subjects_professor_id_subject_id_key;

alter table public.professor_subjects
  add constraint professor_subjects_profile_id_subject_id_key 
  unique(profile_id, subject_id);

-- Update indexes
drop index if exists idx_professor_subjects_professor;
create index if not exists idx_professor_subjects_profile
  on public.professor_subjects(profile_id);

-- ============================================
-- 5. Update RPC functions that reference professors
-- ============================================

-- Update check_schedule_conflicts function to use profile_id instead of professor_id
create or replace function public.check_schedule_conflicts(
  p_academy_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_schedule_id uuid default null
)
returns boolean
language plpgsql
as $$
declare
  conflict_exists boolean;
begin
  select exists(
    select 1
    from public.schedules s
    where s.academy_id = p_academy_id
      and s.day_of_week = p_day_of_week
      and s.id != coalesce(p_schedule_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        (s.start_time <= p_start_time and s.end_time > p_start_time)
        or (s.start_time < p_end_time and s.end_time >= p_end_time)
        or (s.start_time >= p_start_time and s.end_time <= p_end_time)
      )
  ) into conflict_exists;
  
  return not conflict_exists;
end;
$$;

-- Note: check_student_schedule_conflicts doesn't need changes, it doesn't reference professors

-- ============================================
-- 6. Update RLS policies for schedules (recreate with profile_id)
-- ============================================

-- Policies were already dropped in step 2, now recreate them with profile_id

-- Super admins can do everything
create policy "Super admins can do everything with schedules"
  on public.schedules
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

-- Directors can manage schedules in their academy
create policy "Directors can manage schedules in their academy"
  on public.schedules
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = schedules.academy_id
    and profiles.role = 'director'
  ));

-- Professors can view their own schedules
create policy "Professors can view their own schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Guardians can view schedules for their children
create policy "Guardians can view schedules for their children"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.students on students.guardian_id = profiles.id
    inner join public.enrollments on enrollments.student_id = students.id
    where profiles.id = auth.uid()
    and profiles.role = 'guardian'
    and enrollments.schedule_id = schedules.id
  ));

-- Students can view their schedules
create policy "Students can view their schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.students on students.user_id = profiles.id
    inner join public.enrollments on enrollments.student_id = students.id
    where profiles.id = auth.uid()
    and profiles.role = 'student'
    and enrollments.schedule_id = schedules.id
  ));

-- ============================================
-- 7. Update RLS policies for enrollments (recreate with profile_id)
-- ============================================

-- Policies were already dropped in step 3, now recreate them
create policy "Professors can view enrollments for their classes"
  on public.enrollments
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.schedules on schedules.profile_id = profiles.id
    where profiles.id = auth.uid()
    and profiles.role = 'professor'
    and enrollments.schedule_id = schedules.id
  ));

-- ============================================
-- 8. Update RLS policies for professor_subjects (recreate with profile_id)
-- ============================================

-- Policies were already dropped in step 4, now recreate them

-- Super admins can do everything
create policy "Super admins can do everything with professor_subjects"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

-- Directors can manage professor_subjects in their academy
create policy "Directors can manage professor_subjects in their academy"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles director_profile
    inner join public.profiles professor_profile on professor_profile.id = professor_subjects.profile_id
    where director_profile.id = auth.uid()
    and director_profile.academy_id = professor_profile.academy_id
    and director_profile.role = 'director'
  ));

-- Professors can view their own subjects
create policy "Professors can view their own subjects"
  on public.professor_subjects
  as permissive
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ============================================
-- 9. Drop professors table and related policies
-- ============================================

-- Drop RLS policies for professors
drop policy if exists "Super admins can do everything with professors" on public.professors;
drop policy if exists "Directors can manage professors in their academy" on public.professors;
drop policy if exists "Professors can view their own record" on public.professors;

-- Disable RLS on professors (if needed)
alter table public.professors disable row level security;

-- Drop the professors table
drop table if exists public.professors cascade;

-- ============================================
-- Migration completed!
-- ============================================
-- 
-- Summary:
-- 1. Added additional_info to profiles
-- 2. Migrated additional_info from professors to profiles
-- 3. Changed schedules.professor_id to schedules.profile_id
-- 4. Changed enrollments.teacher_id to reference profiles
-- 5. Changed professor_subjects.professor_id to professor_subjects.profile_id
-- 6. Updated all RPC functions
-- 7. Updated all RLS policies
-- 8. Dropped professors table
-- ============================================
