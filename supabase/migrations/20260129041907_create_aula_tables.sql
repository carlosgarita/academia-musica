-- ============================================
-- Migration: Crear tablas para Sección Aula
-- ============================================
-- Esta migración crea todas las tablas necesarias para la funcionalidad de Aula:
-- - Rubros y escalas de evaluación
-- - Calificaciones de canciones
-- - Asistencia, comentarios y tareas por sesión
-- - Tareas grupales por curso
-- - Badges
-- ============================================

BEGIN;

-- ============================================
-- 1. Tabla: evaluation_rubrics (Rubros de Evaluación)
-- ============================================
CREATE TABLE IF NOT EXISTS public.evaluation_rubrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 100),
  description text CHECK (char_length(description) <= 500),
  is_default boolean DEFAULT false,
  display_order integer DEFAULT 0,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_rubrics_academy_id ON public.evaluation_rubrics(academy_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_rubrics_display_order ON public.evaluation_rubrics(display_order);

-- ============================================
-- 2. Tabla: evaluation_scales (Escala de Calificación)
-- ============================================
CREATE TABLE IF NOT EXISTS public.evaluation_scales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 100),
  description text CHECK (char_length(description) <= 500),
  numeric_value integer NOT NULL,
  is_default boolean DEFAULT false,
  display_order integer DEFAULT 0,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_scales_academy_id ON public.evaluation_scales(academy_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_scales_display_order ON public.evaluation_scales(display_order);
CREATE INDEX IF NOT EXISTS idx_evaluation_scales_numeric_value ON public.evaluation_scales(numeric_value);

-- ============================================
-- 3. Tabla: subject_rubrics (Rubros por Materia)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subject_rubrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  rubric_id uuid REFERENCES public.evaluation_rubrics(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(subject_id, rubric_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_rubrics_subject_id ON public.subject_rubrics(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_rubrics_rubric_id ON public.subject_rubrics(rubric_id);

-- ============================================
-- 4. Tabla: song_evaluations (Calificaciones de Canciones)
-- ============================================
CREATE TABLE IF NOT EXISTS public.song_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_registration_id uuid REFERENCES public.course_registrations(id) ON DELETE CASCADE NOT NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  period_date_id uuid REFERENCES public.period_dates(id) ON DELETE CASCADE NOT NULL,
  rubric_id uuid REFERENCES public.evaluation_rubrics(id) ON DELETE CASCADE NOT NULL,
  scale_id uuid REFERENCES public.evaluation_scales(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_registration_id, song_id, period_date_id, rubric_id)
);

CREATE INDEX IF NOT EXISTS idx_song_evaluations_course_registration ON public.song_evaluations(course_registration_id);
CREATE INDEX IF NOT EXISTS idx_song_evaluations_song ON public.song_evaluations(song_id);
CREATE INDEX IF NOT EXISTS idx_song_evaluations_period_date ON public.song_evaluations(period_date_id);
CREATE INDEX IF NOT EXISTS idx_song_evaluations_rubric ON public.song_evaluations(rubric_id);
CREATE INDEX IF NOT EXISTS idx_song_evaluations_created_at ON public.song_evaluations(created_at);

-- ============================================
-- 5. Tabla: session_attendances (Asistencia)
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_attendances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_registration_id uuid REFERENCES public.course_registrations(id) ON DELETE CASCADE NOT NULL,
  period_date_id uuid REFERENCES public.period_dates(id) ON DELETE CASCADE NOT NULL,
  attendance_status text NOT NULL CHECK (attendance_status IN ('presente', 'ausente', 'tardanza', 'justificado')),
  notes text CHECK (char_length(notes) <= 500),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_registration_id, period_date_id)
);

CREATE INDEX IF NOT EXISTS idx_session_attendances_course_registration ON public.session_attendances(course_registration_id);
CREATE INDEX IF NOT EXISTS idx_session_attendances_period_date ON public.session_attendances(period_date_id);
CREATE INDEX IF NOT EXISTS idx_session_attendances_status ON public.session_attendances(attendance_status);

-- ============================================
-- 6. Tabla: session_comments (Comentarios del Profesor)
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_registration_id uuid REFERENCES public.course_registrations(id) ON DELETE CASCADE NOT NULL,
  period_date_id uuid REFERENCES public.period_dates(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL CHECK (char_length(comment) <= 1500),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_registration_id, period_date_id)
);

CREATE INDEX IF NOT EXISTS idx_session_comments_course_registration ON public.session_comments(course_registration_id);
CREATE INDEX IF NOT EXISTS idx_session_comments_period_date ON public.session_comments(period_date_id);

-- ============================================
-- 7. Tabla: session_assignments (Tareas Individuales)
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_registration_id uuid REFERENCES public.course_registrations(id) ON DELETE CASCADE NOT NULL,
  period_date_id uuid REFERENCES public.period_dates(id) ON DELETE CASCADE NOT NULL,
  assignment_text text NOT NULL CHECK (char_length(assignment_text) <= 1500),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_registration_id, period_date_id)
);

CREATE INDEX IF NOT EXISTS idx_session_assignments_course_registration ON public.session_assignments(course_registration_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_period_date ON public.session_assignments(period_date_id);

-- ============================================
-- 8. Tabla: course_group_assignments (Tareas Grupales)
-- ============================================
CREATE TABLE IF NOT EXISTS public.course_group_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_subject_period_id uuid REFERENCES public.professor_subject_periods(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL CHECK (char_length(title) <= 200),
  content text NOT NULL CHECK (char_length(content) <= 2000),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_group_assignments_course ON public.course_group_assignments(professor_subject_period_id);
CREATE INDEX IF NOT EXISTS idx_course_group_assignments_created_by ON public.course_group_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_course_group_assignments_created_at ON public.course_group_assignments(created_at);

-- ============================================
-- 9. Tabla: badges (Catálogo de Badges)
-- ============================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid REFERENCES public.academies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 100),
  description text CHECK (char_length(description) <= 500),
  image_url text NOT NULL CHECK (char_length(image_url) <= 500),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badges_academy_id ON public.badges(academy_id);

-- ============================================
-- 10. Tabla: student_badges (Badges Asignados)
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_registration_id uuid REFERENCES public.course_registrations(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes text CHECK (char_length(notes) <= 500),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(course_registration_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_student_badges_course_registration ON public.student_badges(course_registration_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_badge ON public.student_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_assigned_by ON public.student_badges(assigned_by);

-- ============================================
-- 11. Modificar period_dates: Agregar profile_id
-- ============================================
ALTER TABLE public.period_dates
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_period_dates_profile_id 
  ON public.period_dates(profile_id) 
  WHERE profile_id IS NOT NULL;

-- ============================================
-- 12. Modificar audit_logs: Agregar campos adicionales
-- ============================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS change_type text CHECK (char_length(change_type) <= 50),
  ADD COLUMN IF NOT EXISTS related_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_session_id uuid REFERENCES public.period_dates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_change_type ON public.audit_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_student ON public.audit_logs(related_student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_session ON public.audit_logs(related_session_id);

-- ============================================
-- 13. Triggers para updated_at
-- ============================================
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.evaluation_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.evaluation_scales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.song_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.session_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.session_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.session_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.course_group_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.badges
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 14. Habilitar RLS en todas las nuevas tablas
-- ============================================
ALTER TABLE public.evaluation_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 15. Políticas RLS: evaluation_rubrics
-- ============================================
CREATE POLICY "Super admins can do everything with evaluation_rubrics"
  ON public.evaluation_rubrics
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage evaluation_rubrics in their academy"
  ON public.evaluation_rubrics
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = evaluation_rubrics.academy_id));

CREATE POLICY "Professors can view evaluation_rubrics in their academy"
  ON public.evaluation_rubrics
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = evaluation_rubrics.academy_id));

-- ============================================
-- 16. Políticas RLS: evaluation_scales
-- ============================================
CREATE POLICY "Super admins can do everything with evaluation_scales"
  ON public.evaluation_scales
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage evaluation_scales in their academy"
  ON public.evaluation_scales
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = evaluation_scales.academy_id));

CREATE POLICY "Professors can view evaluation_scales in their academy"
  ON public.evaluation_scales
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = evaluation_scales.academy_id));

-- ============================================
-- 17. Políticas RLS: subject_rubrics
-- ============================================
CREATE POLICY "Super admins can do everything with subject_rubrics"
  ON public.subject_rubrics
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage subject_rubrics in their academy"
  ON public.subject_rubrics
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.subjects s on s.id = subject_rubrics.subject_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = s.academy_id));

CREATE POLICY "Professors can view subject_rubrics in their academy"
  ON public.subject_rubrics
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.subjects s on s.id = subject_rubrics.subject_id where p.id = auth.uid() and p.role = 'professor' and p.academy_id = s.academy_id));

-- ============================================
-- 18. Políticas RLS: song_evaluations
-- ============================================
CREATE POLICY "Super admins can do everything with song_evaluations"
  ON public.song_evaluations
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage song_evaluations in their academy"
  ON public.song_evaluations
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.course_registrations cr on cr.id = song_evaluations.course_registration_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = cr.academy_id));

CREATE POLICY "Professors can manage song_evaluations for their courses"
  ON public.song_evaluations
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_registrations cr on cr.id = song_evaluations.course_registration_id
    join public.professor_subject_periods psp on psp.profile_id = p.id and psp.subject_id = cr.subject_id and psp.period_id = cr.period_id
    where p.id = auth.uid() and p.role = 'professor'
  ));

CREATE POLICY "Students can view own song_evaluations"
  ON public.song_evaluations
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.students s join public.course_registrations cr on cr.id = song_evaluations.course_registration_id where s.user_id = auth.uid() and s.id = cr.student_id));

CREATE POLICY "Guardians can view song_evaluations for their children"
  ON public.song_evaluations
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.id = song_evaluations.course_registration_id where gs.guardian_id = auth.uid() and gs.student_id = cr.student_id));

-- ============================================
-- 19. Políticas RLS: session_attendances
-- ============================================
CREATE POLICY "Super admins can do everything with session_attendances"
  ON public.session_attendances
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage session_attendances in their academy"
  ON public.session_attendances
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.course_registrations cr on cr.id = session_attendances.course_registration_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = cr.academy_id));

CREATE POLICY "Professors can manage session_attendances for their courses"
  ON public.session_attendances
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_registrations cr on cr.id = session_attendances.course_registration_id
    join public.professor_subject_periods psp on psp.profile_id = p.id and psp.subject_id = cr.subject_id and psp.period_id = cr.period_id
    where p.id = auth.uid() and p.role = 'professor'
  ));

CREATE POLICY "Students can view own session_attendances"
  ON public.session_attendances
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.students s join public.course_registrations cr on cr.id = session_attendances.course_registration_id where s.user_id = auth.uid() and s.id = cr.student_id));

CREATE POLICY "Guardians can view session_attendances for their children"
  ON public.session_attendances
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.id = session_attendances.course_registration_id where gs.guardian_id = auth.uid() and gs.student_id = cr.student_id));

-- ============================================
-- 20. Políticas RLS: session_comments
-- ============================================
CREATE POLICY "Super admins can do everything with session_comments"
  ON public.session_comments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage session_comments in their academy"
  ON public.session_comments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.course_registrations cr on cr.id = session_comments.course_registration_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = cr.academy_id));

CREATE POLICY "Professors can manage session_comments for their courses"
  ON public.session_comments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_registrations cr on cr.id = session_comments.course_registration_id
    join public.professor_subject_periods psp on psp.profile_id = p.id and psp.subject_id = cr.subject_id and psp.period_id = cr.period_id
    where p.id = auth.uid() and p.role = 'professor'
  ));

CREATE POLICY "Students can view own session_comments"
  ON public.session_comments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.students s join public.course_registrations cr on cr.id = session_comments.course_registration_id where s.user_id = auth.uid() and s.id = cr.student_id));

CREATE POLICY "Guardians can view session_comments for their children"
  ON public.session_comments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.id = session_comments.course_registration_id where gs.guardian_id = auth.uid() and gs.student_id = cr.student_id));

-- ============================================
-- 21. Políticas RLS: session_assignments
-- ============================================
CREATE POLICY "Super admins can do everything with session_assignments"
  ON public.session_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage session_assignments in their academy"
  ON public.session_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.course_registrations cr on cr.id = session_assignments.course_registration_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = cr.academy_id));

CREATE POLICY "Professors can manage session_assignments for their courses"
  ON public.session_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_registrations cr on cr.id = session_assignments.course_registration_id
    join public.professor_subject_periods psp on psp.profile_id = p.id and psp.subject_id = cr.subject_id and psp.period_id = cr.period_id
    where p.id = auth.uid() and p.role = 'professor'
  ));

CREATE POLICY "Students can view own session_assignments"
  ON public.session_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.students s join public.course_registrations cr on cr.id = session_assignments.course_registration_id where s.user_id = auth.uid() and s.id = cr.student_id));

CREATE POLICY "Guardians can view session_assignments for their children"
  ON public.session_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.id = session_assignments.course_registration_id where gs.guardian_id = auth.uid() and gs.student_id = cr.student_id));

-- ============================================
-- 22. Políticas RLS: course_group_assignments
-- ============================================
CREATE POLICY "Super admins can do everything with course_group_assignments"
  ON public.course_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage course_group_assignments in their academy"
  ON public.course_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.professor_subject_periods psp on psp.id = course_group_assignments.professor_subject_period_id
    join public.subjects s on s.id = psp.subject_id
    where p.id = auth.uid() and p.role = 'director' and p.academy_id = s.academy_id
  ));

CREATE POLICY "Professors can manage course_group_assignments for their courses"
  ON public.course_group_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.professor_subject_periods psp on psp.id = course_group_assignments.professor_subject_period_id
    where p.id = auth.uid() and p.role = 'professor' and psp.profile_id = p.id
  ));

CREATE POLICY "Students can view course_group_assignments for their courses"
  ON public.course_group_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (
    select 1 from public.students s
    join public.course_registrations cr on cr.student_id = s.id
    join public.professor_subject_periods psp on psp.id = course_group_assignments.professor_subject_period_id
    where s.user_id = auth.uid() and cr.subject_id = psp.subject_id and cr.period_id = psp.period_id
  ));

CREATE POLICY "Guardians can view course_group_assignments for their children's courses"
  ON public.course_group_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (
    select 1 from public.guardian_students gs
    join public.course_registrations cr on cr.student_id = gs.student_id
    join public.professor_subject_periods psp on psp.id = course_group_assignments.professor_subject_period_id
    where gs.guardian_id = auth.uid() and cr.subject_id = psp.subject_id and cr.period_id = psp.period_id
  ));

-- ============================================
-- 23. Políticas RLS: badges
-- ============================================
CREATE POLICY "Super admins can do everything with badges"
  ON public.badges
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage badges in their academy"
  ON public.badges
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = badges.academy_id));

CREATE POLICY "Professors can view badges in their academy"
  ON public.badges
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = badges.academy_id));

CREATE POLICY "Students can view badges in their academy"
  ON public.badges
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.students s on s.user_id = p.id where p.id = auth.uid() and p.role = 'student' and s.academy_id = badges.academy_id));

CREATE POLICY "Guardians can view badges in their children's academy"
  ON public.badges
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.students s on s.id = gs.student_id where gs.guardian_id = auth.uid() and s.academy_id = badges.academy_id));

-- ============================================
-- 24. Políticas RLS: student_badges
-- ============================================
CREATE POLICY "Super admins can do everything with student_badges"
  ON public.student_badges
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

CREATE POLICY "Directors can manage student_badges in their academy"
  ON public.student_badges
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (select 1 from public.profiles p join public.course_registrations cr on cr.id = student_badges.course_registration_id where p.id = auth.uid() and p.role = 'director' and p.academy_id = cr.academy_id));

CREATE POLICY "Professors can manage student_badges for their courses"
  ON public.student_badges
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (exists (
    select 1 from public.profiles p
    join public.course_registrations cr on cr.id = student_badges.course_registration_id
    join public.professor_subject_periods psp on psp.profile_id = p.id and psp.subject_id = cr.subject_id and psp.period_id = cr.period_id
    where p.id = auth.uid() and p.role = 'professor'
  ));

CREATE POLICY "Students can view own student_badges"
  ON public.student_badges
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.students s join public.course_registrations cr on cr.id = student_badges.course_registration_id where s.user_id = auth.uid() and s.id = cr.student_id));

CREATE POLICY "Guardians can view student_badges for their children"
  ON public.student_badges
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (exists (select 1 from public.guardian_students gs join public.course_registrations cr on cr.id = student_badges.course_registration_id where gs.guardian_id = auth.uid() and gs.student_id = cr.student_id));

-- ============================================
-- 25. Función: Insertar datos predeterminados por academia
-- ============================================
CREATE OR REPLACE FUNCTION public.insert_default_evaluation_data(academy_uuid uuid)
RETURNS void AS $$
BEGIN
  -- Insertar rubros predeterminados
  INSERT INTO public.evaluation_rubrics (academy_id, name, description, is_default, display_order)
  VALUES
    (academy_uuid, 'Digitación', 'Evaluación de la técnica de digitación', true, 1),
    (academy_uuid, 'Coordinación', 'Evaluación de la coordinación entre manos', true, 2),
    (academy_uuid, 'Lectura Rítmica', 'Evaluación de la lectura rítmica', true, 3),
    (academy_uuid, 'Lectura Melódica', 'Evaluación de la lectura melódica', true, 4)
  ON CONFLICT DO NOTHING;

  -- Insertar escala predeterminada
  INSERT INTO public.evaluation_scales (academy_id, name, description, numeric_value, is_default, display_order)
  VALUES
    (academy_uuid, 'Completamente Satisfactorio', 'El estudiante ha cumplido completamente con el objetivo', 3, true, 1),
    (academy_uuid, 'En Progreso', 'El estudiante está avanzando pero aún no cumple completamente', 2, true, 2),
    (academy_uuid, 'No resuelto por falta de comprensión', 'El estudiante no ha comprendido el concepto', 1, true, 3),
    (academy_uuid, 'No resuelto por falta de estudio', 'El estudiante no ha estudiado lo suficiente', 0, true, 4)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 26. Trigger: Insertar datos predeterminados al crear academia
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_insert_default_evaluation_data()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.insert_default_evaluation_data(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_academy_default_evaluation_data ON public.academies;
CREATE TRIGGER trigger_academy_default_evaluation_data
  AFTER INSERT ON public.academies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_insert_default_evaluation_data();

-- ============================================
-- 27. Backfill: Insertar datos predeterminados para academias existentes
-- ============================================
DO $$
DECLARE
  academy_record RECORD;
BEGIN
  FOR academy_record IN SELECT id FROM public.academies LOOP
    PERFORM public.insert_default_evaluation_data(academy_record.id);
  END LOOP;
END $$;

COMMIT;
