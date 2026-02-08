-- ============================================
-- Migration: Remove legacy model (subjects, periods, professor_subject_periods)
-- All flows now use courses and course_sessions
-- ============================================

BEGIN;

-- 1. Drop subject_rubrics (links subjects to evaluation rubrics)
DROP TABLE IF EXISTS public.subject_rubrics CASCADE;

-- 2a. Drop RLS policies that depend on period_date_id (must run before dropping column)
DROP POLICY IF EXISTS "Directors can manage session_group_assignments in their academy" ON public.session_group_assignments;
DROP POLICY IF EXISTS "Professors can manage session_group_assignments for their courses" ON public.session_group_assignments;
DROP POLICY IF EXISTS "Students can view session_group_assignments for their courses" ON public.session_group_assignments;
DROP POLICY IF EXISTS "Guardians can view session_group_assignments for their children" ON public.session_group_assignments;

-- 2b. Drop columns that reference period_dates (before dropping period_dates)
ALTER TABLE public.session_attendances DROP COLUMN IF EXISTS period_date_id;
ALTER TABLE public.session_comments DROP COLUMN IF EXISTS period_date_id;
ALTER TABLE public.session_assignments DROP COLUMN IF EXISTS period_date_id;
ALTER TABLE public.song_evaluations DROP COLUMN IF EXISTS period_date_id;
ALTER TABLE public.session_group_assignments DROP COLUMN IF EXISTS period_date_id;

-- 2c. Recreate RLS policies for session_group_assignments using course_session_id
CREATE POLICY "Directors can manage session_group_assignments in their academy"
  ON public.session_group_assignments AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_sessions cs on cs.id = session_group_assignments.course_session_id
    join public.courses c on c.id = cs.course_id
    where p.id = auth.uid() and p.role = 'director' and p.academy_id = c.academy_id
  ))
  WITH CHECK (exists (
    select 1 from public.profiles p
    join public.course_sessions cs on cs.id = session_group_assignments.course_session_id
    join public.courses c on c.id = cs.course_id
    where p.id = auth.uid() and p.role = 'director' and p.academy_id = c.academy_id
  ));

CREATE POLICY "Professors can manage session_group_assignments for their courses"
  ON public.session_group_assignments AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (
    select 1 from public.course_sessions cs
    join public.courses c on c.id = cs.course_id
    where cs.id = session_group_assignments.course_session_id and c.profile_id = auth.uid()
  ))
  WITH CHECK (exists (
    select 1 from public.course_sessions cs
    join public.courses c on c.id = cs.course_id
    where cs.id = session_group_assignments.course_session_id and c.profile_id = auth.uid()
  ));

CREATE POLICY "Students can view session_group_assignments for their courses"
  ON public.session_group_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (
    select 1 from public.students s
    join public.course_registrations cr on cr.student_id = s.id
    join public.course_sessions cs on cs.course_id = cr.course_id
    where s.user_id = auth.uid() and cs.id = session_group_assignments.course_session_id
  ));

CREATE POLICY "Guardians can view session_group_assignments for their children"
  ON public.session_group_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (
    select 1 from public.guardian_students gs
    join public.course_registrations cr on cr.student_id = gs.student_id
    join public.course_sessions cs on cs.course_id = cr.course_id
    where gs.guardian_id = auth.uid() and cs.id = session_group_assignments.course_session_id
  ));

-- 3. Drop period_dates
DROP TABLE IF EXISTS public.period_dates CASCADE;

-- 4. Drop professor_subject_periods
DROP TABLE IF EXISTS public.professor_subject_periods CASCADE;

-- 5. Drop professor_subjects
DROP TABLE IF EXISTS public.professor_subjects CASCADE;

-- 6. Drop periods
DROP TABLE IF EXISTS public.periods CASCADE;

-- 7. Drop subjects
DROP TABLE IF EXISTS public.subjects CASCADE;

-- 8. Drop legacy columns from course_registrations
ALTER TABLE public.course_registrations DROP COLUMN IF EXISTS subject_id;
ALTER TABLE public.course_registrations DROP COLUMN IF EXISTS period_id;

-- 9. Drop legacy columns from schedules (use course_id only)
ALTER TABLE public.schedules DROP COLUMN IF EXISTS subject_id;
ALTER TABLE public.schedules DROP COLUMN IF EXISTS period_id;

COMMIT;
