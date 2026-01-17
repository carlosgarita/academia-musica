-- ============================================
-- Migration: Add RLS policies for schedules table
-- Execute this in Supabase SQL Editor if schedules policies are missing
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Super admins can do everything with schedules" on public.schedules;
drop policy if exists "Directors can manage schedules in their academy" on public.schedules;
drop policy if exists "Professors can view their own schedules" on public.schedules;
drop policy if exists "Guardians can view schedules for their children" on public.schedules;
drop policy if exists "Guardians can view schedules of their students" on public.schedules;
drop policy if exists "Students can view their schedules" on public.schedules;
drop policy if exists "Students can view their enrolled schedules" on public.schedules;

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

-- Guardians can view schedules for their children (using guardian_students table)
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
-- Migration completed!
-- ============================================
