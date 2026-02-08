-- ============================================
-- Migration: Simplify courses - remove subjects and periods
-- - New courses table: name (text), profile_id, year from start_date
-- - New course_sessions table: replaces period_dates for class sessions
-- - course_registrations: links to course_id
-- - schedules: links to course_id
-- ============================================

BEGIN;

-- 1. Create courses table (replaces professor_subject_periods for new flow)
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 200),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  mensualidad numeric(12,2) CHECK (mensualidad >= 0),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_courses_academy_id ON public.courses(academy_id);
CREATE INDEX idx_courses_profile_id ON public.courses(profile_id);
CREATE INDEX idx_courses_year ON public.courses(year);

-- 2. Create course_sessions table (replaces period_dates for "clase" type)
CREATE TABLE IF NOT EXISTS public.course_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_id, date)
);

CREATE INDEX idx_course_sessions_course_id ON public.course_sessions(course_id);
CREATE INDEX idx_course_sessions_date ON public.course_sessions(date);

-- 3. Add course_id to schedules (turnos)
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_schedules_course_id ON public.schedules(course_id) WHERE course_id IS NOT NULL;

-- 4. Add course_id and profile_id to course_registrations
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_course_registrations_course_id ON public.course_registrations(course_id) WHERE course_id IS NOT NULL;

-- 5. Add course_session_id to tables that reference period_dates for class sessions
-- session_attendances, session_comments, session_assignments, song_evaluations, session_group_assignments
ALTER TABLE public.session_attendances ADD COLUMN IF NOT EXISTS course_session_id uuid REFERENCES public.course_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.session_comments ADD COLUMN IF NOT EXISTS course_session_id uuid REFERENCES public.course_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.session_assignments ADD COLUMN IF NOT EXISTS course_session_id uuid REFERENCES public.course_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.song_evaluations ADD COLUMN IF NOT EXISTS course_session_id uuid REFERENCES public.course_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.session_group_assignments ADD COLUMN IF NOT EXISTS course_session_id uuid REFERENCES public.course_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_session_attendances_course_session ON public.session_attendances(course_session_id) WHERE course_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_comments_course_session ON public.session_comments(course_session_id) WHERE course_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_assignments_course_session ON public.session_assignments(course_session_id) WHERE course_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_song_evaluations_course_session ON public.song_evaluations(course_session_id) WHERE course_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_group_assignments_course_session ON public.session_group_assignments(course_session_id) WHERE course_session_id IS NOT NULL;

-- 6. Triggers for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Enable RLS on new tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for courses
CREATE POLICY "Super admins can do everything with courses"
  ON public.courses AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage courses in their academy"
  ON public.courses AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = courses.academy_id))
  WITH CHECK (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = courses.academy_id));

CREATE POLICY "Professors can view courses in their academy"
  ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = courses.academy_id));

CREATE POLICY "Students can view courses in their academy"
  ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (select 1 from public.profiles p join public.students s on s.user_id = p.id where p.id = auth.uid() and p.role = 'student' and s.academy_id = courses.academy_id));

CREATE POLICY "Guardians can view courses in their children academy"
  ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.students s on s.id = gs.student_id where gs.guardian_id = auth.uid() and s.academy_id = courses.academy_id));

-- 9. RLS policies for course_sessions
CREATE POLICY "Super admins can do everything with course_sessions"
  ON public.course_sessions AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage course_sessions in their academy"
  ON public.course_sessions AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (select 1 from public.courses c join public.profiles p on p.academy_id = c.academy_id where c.id = course_sessions.course_id and p.id = auth.uid() and p.role = 'director'))
  WITH CHECK (exists (select 1 from public.courses c join public.profiles p on p.academy_id = c.academy_id where c.id = course_sessions.course_id and p.id = auth.uid() and p.role = 'director'));

CREATE POLICY "Professors can manage course_sessions for their courses"
  ON public.course_sessions AS PERMISSIVE FOR ALL TO authenticated
  USING (exists (select 1 from public.courses c where c.id = course_sessions.course_id and c.profile_id = auth.uid()))
  WITH CHECK (exists (select 1 from public.courses c where c.id = course_sessions.course_id and c.profile_id = auth.uid()));

CREATE POLICY "Students can view course_sessions"
  ON public.course_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (select 1 from public.course_registrations cr join public.students s on s.id = cr.student_id where cr.course_id = course_sessions.course_id and s.user_id = auth.uid()));

CREATE POLICY "Guardians can view course_sessions"
  ON public.course_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.student_id = gs.student_id where cr.course_id = course_sessions.course_id and gs.guardian_id = auth.uid()));

COMMIT;
