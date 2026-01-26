-- ============================================
-- Migration: Add profile_id to course_registrations
-- Vincula cada matrícula a un curso (profesor + materia + periodo)
-- ============================================
-- Ejecutar en el SQL Editor de Supabase

-- 1. Añadir columna profile_id (nullable para poder backfillear)
ALTER TABLE public.course_registrations
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Backfill: asignar un profesor cuando exista professor_subject_periods para ese subject_id y period_id
UPDATE public.course_registrations cr
SET profile_id = (
  SELECT psp.profile_id
  FROM public.professor_subject_periods psp
  WHERE psp.subject_id = cr.subject_id
    AND psp.period_id = cr.period_id
  LIMIT 1
)
WHERE cr.profile_id IS NULL;

-- 3. Quitar la unique antigua (student_id, subject_id, period_id)
ALTER TABLE public.course_registrations
  DROP CONSTRAINT IF EXISTS course_registrations_student_id_subject_id_period_id_key;

-- 4. Nueva unique: (student_id, subject_id, period_id, profile_id) cuando profile_id no es null
--    Así el mismo estudiante puede estar en la misma materia y periodo con distintos profesores.
CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_student_subject_period_profile_key
  ON public.course_registrations (student_id, subject_id, period_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- 5. Para registros legacy con profile_id NULL: mantener a lo sumo uno por (student, subject, period)
CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_legacy_unique
  ON public.course_registrations (student_id, subject_id, period_id)
  WHERE profile_id IS NULL;

-- 6. Índice para filtrar por curso (profile_id)
CREATE INDEX IF NOT EXISTS idx_course_registrations_profile_id
  ON public.course_registrations(profile_id)
  WHERE profile_id IS NOT NULL;

-- ============================================
-- Nota: Las matrículas con profile_id NULL no se mostrarán en la nueva vista por curso.
-- Las nuevas matrículas creadas desde "Agregar Estudiante" en un curso siempre tendrán profile_id.
-- ============================================
