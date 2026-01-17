-- ============================================
-- Migration: Create guardian_students table
-- Execute this in Supabase SQL Editor
-- This script creates the guardian_students table for one-to-one relationship
-- (one student can have only one guardian)
-- ============================================

-- ============================================
-- 1. Create guardian_students table
-- ============================================

create table if not exists public.guardian_students (
  id uuid default gen_random_uuid() primary key,
  guardian_id uuid references public.profiles on delete cascade not null,
  student_id uuid references public.students on delete cascade not null,
  academy_id uuid references public.academies on delete cascade not null,
  relationship text check (char_length(relationship) <= 50), -- e.g., "Padre", "Madre", "Tutor"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(guardian_id, student_id),
  unique(student_id) -- Ensures one student can only have one guardian
);

-- Create indexes for faster queries
create index if not exists idx_guardian_students_guardian
  on public.guardian_students(guardian_id);

create index if not exists idx_guardian_students_student
  on public.guardian_students(student_id);

create index if not exists idx_guardian_students_academy
  on public.guardian_students(academy_id);

-- Add unique constraint on student_id to ensure one student = one guardian
-- This constraint is already in the table definition, but we add it here for safety
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guardian_students_student_id_key'
    and conrelid = 'public.guardian_students'::regclass
  ) then
    alter table public.guardian_students
    add constraint guardian_students_student_id_key unique (student_id);
  end if;
end $$;

-- ============================================
-- 2. Migrate existing guardian_id from students to guardian_students
-- ============================================

-- Migrate existing relationships from students.guardian_id
do $$
begin
  insert into public.guardian_students (guardian_id, student_id, academy_id, relationship)
  select 
    students.guardian_id,
    students.id,
    students.academy_id,
    'Asignado' as relationship
  from public.students
  where students.guardian_id is not null
  and not exists (
    select 1 from public.guardian_students
    where guardian_students.guardian_id = students.guardian_id
    and guardian_students.student_id = students.id
  );
end $$;

-- ============================================
-- 3. Create updated_at trigger
-- ============================================

drop trigger if exists handle_updated_at on public.guardian_students;
create trigger handle_updated_at
  before update on public.guardian_students
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- 4. Enable RLS on guardian_students
-- ============================================

alter table public.guardian_students enable row level security;

-- ============================================
-- 5. Create RLS policies for guardian_students
-- ============================================

-- Drop existing policies if they exist
drop policy if exists "Super admins can do everything with guardian_students" on public.guardian_students;
drop policy if exists "Directors can manage guardian_students in their academy" on public.guardian_students;
drop policy if exists "Guardians can view their own student assignments" on public.guardian_students;

-- Super admins can do everything
create policy "Super admins can do everything with guardian_students"
  on public.guardian_students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

-- Directors can manage guardian_students in their academy
create policy "Directors can manage guardian_students in their academy"
  on public.guardian_students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = guardian_students.academy_id
    and profiles.role = 'director'
  ));

-- Guardians can view their own student assignments
create policy "Guardians can view their own student assignments"
  on public.guardian_students
  as permissive
  for select
  to authenticated
  using (guardian_id = auth.uid());

-- ============================================
-- 6. Update students policy to use guardian_students
-- ============================================

-- Drop old policy
drop policy if exists "Guardians can view their assigned students" on public.students;

-- Create new policy using guardian_students table
create policy "Guardians can view their assigned students"
  on public.students
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.guardian_students
    where guardian_students.guardian_id = auth.uid()
    and guardian_students.student_id = students.id
  ));

-- ============================================
-- 6b. Update schedules policy to use guardian_students
-- ============================================

-- Drop old policy that depends on students.guardian_id
drop policy if exists "Guardians can view schedules for their children" on public.schedules;

-- Create new policy using guardian_students table
create policy "Guardians can view schedules for their children"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.guardian_students on guardian_students.guardian_id = profiles.id
    inner join public.enrollments on enrollments.student_id = guardian_students.student_id
    where profiles.id = auth.uid()
    and profiles.role = 'guardian'
    and enrollments.schedule_id = schedules.id
  ));

-- ============================================
-- 7. Remove guardian_id column from students table
-- ============================================

-- First, drop any policies that depend on students.guardian_id
-- This includes policies on schedules, enrollments, or any other tables
drop policy if exists "Guardians can view schedules for their children" on public.schedules;
drop policy if exists "Guardians can view schedules of their students" on public.schedules;

-- Ensure all data has been migrated before dropping the column
do $$
declare
  unmigrated_count integer;
begin
  -- Check if there are any students with guardian_id that haven't been migrated
  select count(*) into unmigrated_count
  from public.students
  where guardian_id is not null
  and not exists (
    select 1 from public.guardian_students
    where guardian_students.student_id = students.id
  );

  if unmigrated_count > 0 then
    raise exception 'There are % students with guardian_id that have not been migrated to guardian_students', unmigrated_count;
  end if;
end $$;

-- Drop the column (CASCADE will handle any remaining dependencies)
alter table public.students drop column if exists guardian_id cascade;

-- ============================================
-- Migration completed!
-- ============================================
-- 
-- Summary:
-- 1. Created guardian_students table (one-to-one: one student = one guardian)
-- 2. Migrated existing guardian_id relationships from students table
-- 3. Added indexes and unique constraints for performance and data integrity
-- 4. Added triggers and RLS policies
-- 5. Updated students RLS policy to use guardian_students
-- 6. Removed guardian_id column from students table
-- ============================================
