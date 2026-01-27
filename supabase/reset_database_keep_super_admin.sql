-- ============================================
-- RESET DE BASE DE DATOS (manteniendo super_admin, academia y director)
-- ============================================
-- Borra todos los datos de la app EXCEPTO:
--   - Perfiles con role='super_admin' o role='director'
--   - Todas las academias
-- Tu usuario de auth (auth.users) no se toca; solo se limpia public.*
--
-- IMPORTANTE: Asegúrate de estar logueado con una cuenta que tenga
-- role='super_admin' en public.profiles. Tras el reset seguirás entrando
-- con el mismo email/contraseña.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Pegar y Run.
-- ============================================

-- OPCIONAL: Comprobar que hay al menos un super_admin y director (ejecutar solo esto primero si quieres):
-- SELECT id, email, role, academy_id FROM public.profiles WHERE role IN ('super_admin', 'director');
-- SELECT id, name FROM public.academies;

BEGIN;

-- 1) Tablas que referencian a otras (borrar primero)
DELETE FROM public.course_registration_songs;
DELETE FROM public.course_registrations;
DELETE FROM public.enrollments;
DELETE FROM public.professor_subject_periods;
DELETE FROM public.period_dates;
DELETE FROM public.schedules;
DELETE FROM public.professor_subjects;
DELETE FROM public.guardian_students;
DELETE FROM public.students;
DELETE FROM public.periods;
DELETE FROM public.songs;
DELETE FROM public.subjects;
DELETE FROM public.audit_logs;

-- 2) Perfiles: borrar todos excepto super_admin y director
DELETE FROM public.profiles
WHERE role NOT IN ('super_admin', 'director');

-- 3) Academias: NO SE BORRAN (se conservan todas)

COMMIT;

-- ============================================
-- Resultado:
-- - Se conservan todos los perfiles con role='super_admin' o role='director'
-- - Se conservan todas las academias
-- - Se borran: estudiantes, materias, cursos, matrículas, horarios, periodos, canciones, etc.
-- - Puedes crear nuevos datos (materias, profesores, estudiantes, cursos) desde cero
-- ============================================
