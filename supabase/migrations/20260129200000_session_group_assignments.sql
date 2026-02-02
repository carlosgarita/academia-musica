-- ============================================
-- Tarea grupal por sesión (session_group_assignments)
-- Una tarea grupal por sesión (period_date), visible para todos los estudiantes del curso
-- ============================================

CREATE TABLE IF NOT EXISTS public.session_group_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_date_id uuid REFERENCES public.period_dates(id) ON DELETE CASCADE NOT NULL UNIQUE,
  assignment_text text NOT NULL CHECK (char_length(assignment_text) <= 1500),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_group_assignments_period_date
  ON public.session_group_assignments(period_date_id);

-- Trigger updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.session_group_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.session_group_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins: todo
CREATE POLICY "Super admins can do everything with session_group_assignments"
  ON public.session_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

-- Directors: gestionar si la sesión pertenece a su academia (period_dates -> periods -> academy_id)
CREATE POLICY "Directors can manage session_group_assignments in their academy"
  ON public.session_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.period_dates pd on pd.id = session_group_assignments.period_date_id
    join public.periods per on per.id = pd.period_id
    where p.id = auth.uid() and p.role = 'director' and p.academy_id = per.academy_id
  ));

-- Professors: gestionar si la sesión es de un curso que imparten (period_dates tiene period_id, subject_id; psp tiene profile_id, period_id, subject_id)
CREATE POLICY "Professors can manage session_group_assignments for their courses"
  ON public.session_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.period_dates pd on pd.id = session_group_assignments.period_date_id
    join public.professor_subject_periods psp on psp.period_id = pd.period_id and psp.subject_id = pd.subject_id
    where p.id = auth.uid() and p.role = 'professor' and psp.profile_id = p.id
  ));

-- Students: ver tareas grupales de sesiones de sus cursos
CREATE POLICY "Students can view session_group_assignments for their courses"
  ON public.session_group_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (
    select 1 from public.students s
    join public.course_registrations cr on cr.student_id = s.id
    join public.period_dates pd on pd.id = session_group_assignments.period_date_id
    where s.user_id = auth.uid() and cr.period_id = pd.period_id and cr.subject_id = pd.subject_id
  ));

-- Guardians: ver tareas grupales de sesiones de cursos de sus hijos
CREATE POLICY "Guardians can view session_group_assignments for their children"
  ON public.session_group_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (
    select 1 from public.guardian_students gs
    join public.course_registrations cr on cr.student_id = gs.student_id
    join public.period_dates pd on pd.id = session_group_assignments.period_date_id
    where gs.guardian_id = auth.uid() and cr.period_id = pd.period_id and cr.subject_id = pd.subject_id
  ));
