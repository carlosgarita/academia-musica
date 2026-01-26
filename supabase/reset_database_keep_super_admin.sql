-- ============================================
-- RESET DE BASE DE DATOS (manteniendo super_admin)
-- ============================================
-- Borra todos los datos de la app EXCEPTO el perfil con role='super_admin'.
-- Tu usuario de auth (auth.users) no se toca; solo se limpia public.*
--
-- IMPORTANTE: Asegúrate de estar logueado con una cuenta que tenga
-- role='super_admin' en public.profiles. Tras el reset seguirás entrando
-- con el mismo email/contraseña.
--
-- Ejecutar en: Supabase → SQL Editor → New query → Pegar y Run.
-- ============================================

-- OPCIONAL: Comprobar que hay al menos un super_admin (ejecutar solo esto primero si quieres):
-- SELECT id, email, role FROM public.profiles WHERE role = 'super_admin';

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

-- 2) Perfiles: borrar todos excepto super_admin
DELETE FROM public.profiles
WHERE role IS DISTINCT FROM 'super_admin';

-- 3) Academias: borrar todas.
--    profiles.academy_id tiene ON DELETE SET NULL, así que al borrar
--    la academia del super_admin, su academy_id quedará en NULL.
DELETE FROM public.academies;

COMMIT;

-- ============================================
-- Resultado: solo queda tu perfil super_admin.
-- academy_id del super_admin quedará en NULL.
-- Puedes crear una nueva academia y probar con datos nuevos.
-- ============================================
