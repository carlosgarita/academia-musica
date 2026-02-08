-- ============================================
-- Script: Limpiar DB para nuevas pruebas
-- Mantiene: perfil super_admin, perfil director y academia del director
-- Credenciales: superadmin@test.local / director@test.local (contraseña: TestPassword123)
-- ============================================

BEGIN;

-- IDs a conservar. Cambia estos UUIDs si usas perfiles distintos al seed.
DO $$
DECLARE
  v_super_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_director_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_director_academy_id uuid;
BEGIN
  -- Obtener academia del director (puede ser NULL si no está en seed)
  SELECT academy_id INTO v_director_academy_id
  FROM public.profiles
  WHERE id = v_director_id AND role = 'director';

  -- Si el director no existe o no tiene academia, usar la academia del seed
  IF v_director_academy_id IS NULL THEN
    v_director_academy_id := 'b0000000-0000-0000-0000-000000000001';
  END IF;

  -- 1. Eliminar auth.identities de usuarios que NO son super_admin ni director
  DELETE FROM auth.identities
  WHERE user_id NOT IN (v_super_admin_id, v_director_id);

  -- 2. Eliminar auth.users (excepto super_admin y director)
  DELETE FROM auth.users
  WHERE id NOT IN (v_super_admin_id, v_director_id);

  -- 3. Tablas que referencian a otras (orden: hijos primero)
  DELETE FROM public.contract_invoices;
  DELETE FROM public.contract_course_registrations;
  DELETE FROM public.contracts;

  DELETE FROM public.task_completions;

  DELETE FROM public.session_group_assignments;
  DELETE FROM public.session_attendances;
  DELETE FROM public.session_comments;
  DELETE FROM public.session_assignments;
  DELETE FROM public.song_evaluations;

  DELETE FROM public.course_registration_songs;
  DELETE FROM public.student_badges;

  DELETE FROM public.course_registrations;
  DELETE FROM public.guardian_students;

  DELETE FROM public.course_sessions;
  DELETE FROM public.schedules;

  DELETE FROM public.courses;
  DELETE FROM public.songs;

  DELETE FROM public.evaluation_rubrics;
  DELETE FROM public.evaluation_scales;

  DELETE FROM public.badges;
  DELETE FROM public.students;

  DELETE FROM public.audit_logs;

  -- 4. Eliminar perfiles excepto super_admin y director
  DELETE FROM public.profiles
  WHERE id NOT IN (v_super_admin_id, v_director_id);

  -- 5. Eliminar academias excepto la del director
  DELETE FROM public.academies
  WHERE id != v_director_academy_id;

  -- 6. Si la academia del director fue eliminada (p. ej. no existía), crearla para que el director pueda trabajar
  INSERT INTO public.academies (id, name, address, status, created_at, updated_at)
  VALUES (
    v_director_academy_id,
    'Academia de Prueba',
    'Dirección de prueba',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 7. Actualizar director para que tenga academy_id (por si se perdió)
  UPDATE public.profiles
  SET academy_id = v_director_academy_id, deleted_at = NULL, status = 'active'
  WHERE id = v_director_id AND role = 'director';

END $$;

COMMIT;

-- ============================================
-- Credenciales para login
-- ============================================
-- Super Admin: superadmin@test.local  | Contraseña: TestPassword123
-- Director:    director@test.local   | Contraseña: TestPassword123
-- ============================================
