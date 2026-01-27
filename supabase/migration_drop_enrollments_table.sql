-- ============================================
-- Migration: Eliminar tabla enrollments (legacy)
-- ============================================
-- La tabla enrollments fue reemplazada por course_registrations.
-- Los guardianes ahora ven course_registrations en lugar de enrollments.
-- Las rutas de schedules/enrollments fueron eliminadas.
--
-- IMPORTANTE: Ejecutar en Supabase SQL Editor después de verificar
-- que no hay datos importantes en enrollments.
-- ============================================

BEGIN;

-- 1. Eliminar políticas RLS de enrollments
DROP POLICY IF EXISTS "Super admins can do everything with enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Directors can manage enrollments in their academy" ON public.enrollments;
DROP POLICY IF EXISTS "Professors can view enrollments for their classes" ON public.enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Guardians can view enrollments for their children" ON public.enrollments;

-- 2. Deshabilitar RLS
ALTER TABLE public.enrollments DISABLE ROW LEVEL SECURITY;

-- 3. Eliminar triggers
DROP TRIGGER IF EXISTS handle_updated_at ON public.enrollments;

-- 4. Eliminar índices
DROP INDEX IF EXISTS enrollments_student_schedule_unique;
DROP INDEX IF EXISTS enrollments_student_subject_teacher_unique;

-- 5. Eliminar función que usa enrollments
DROP FUNCTION IF EXISTS public.check_student_schedule_conflicts(uuid, uuid, uuid, uuid);

-- 6. Actualizar políticas RLS de schedules que referencian enrollments
-- Eliminar políticas que usan enrollments
DROP POLICY IF EXISTS "Guardians can view schedules of their students" ON public.schedules;
DROP POLICY IF EXISTS "Students can view their enrolled schedules" ON public.schedules;

-- 7. Eliminar la tabla (CASCADE eliminará las referencias en otras tablas si las hay)
DROP TABLE IF EXISTS public.enrollments CASCADE;

COMMIT;

-- ============================================
-- Nota: Si hay referencias desde otras tablas (como guardian_students o schedules),
-- CASCADE las eliminará. Si prefieres mantener las tablas referenciantes pero
-- eliminar solo las FKs, primero elimina las FKs manualmente antes de ejecutar esto.
-- ============================================
