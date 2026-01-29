-- ============================================
-- Migration: Seed test users (solo entorno local)
-- ============================================
-- Inserta usuarios de prueba en auth.users, auth.identities y public.profiles
-- con UUIDs fijos para poder loguearse siempre con los mismos datos.
-- Roles usados en la app: 'super_admin', 'director', 'professor', 'student', 'guardian'
-- ============================================

-- Solo ejecutar si estamos en entorno local (opcional: quitar el DO si quieres en remoto también)
-- Para Docker local: ejecutar esta migración; en producción no incluyas este archivo o usa un flag.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- UUIDs fijos (documentados al final del archivo).
-- Contraseña común: TestPassword123 (hasheada con bcrypt/blowfish)
DO $$
DECLARE
  v_super_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_seed_academy_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_director_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_professor_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_student_id uuid := 'e0000000-0000-0000-0000-000000000001';
  v_guardian_id uuid := 'f0000000-0000-0000-0000-000000000001';
  v_encrypted_pw text := crypt('TestPassword123', gen_salt('bf'));
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_app_meta jsonb := '{"provider":"email","providers":["email"]}'::jsonb;
BEGIN
  -- 1. Academia de prueba (para director, professor, student, guardian)
  INSERT INTO public.academies (id, name, address, status, created_at, updated_at)
  VALUES (
    v_seed_academy_id,
    'Academia de Prueba',
    'Dirección de prueba',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Super Admin en auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    v_super_admin_id,
    v_instance_id,
    'authenticated',
    'authenticated',
    'superadmin@test.local',
    v_encrypted_pw,
    now(),
    v_app_meta,
    '{"first_name":"Super","last_name":"Admin"}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. Director en auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_director_id, v_instance_id, 'authenticated', 'authenticated',
    'director@test.local', v_encrypted_pw, now(), v_app_meta,
    '{"first_name":"Director","last_name":"Prueba"}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4. Professor en auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_professor_id, v_instance_id, 'authenticated', 'authenticated',
    'profesor@test.local', v_encrypted_pw, now(), v_app_meta,
    '{"first_name":"Profesor","last_name":"Prueba"}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 5. Student en auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_student_id, v_instance_id, 'authenticated', 'authenticated',
    'estudiante@test.local', v_encrypted_pw, now(), v_app_meta,
    '{"first_name":"Estudiante","last_name":"Prueba"}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 6. Guardian en auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_guardian_id, v_instance_id, 'authenticated', 'authenticated',
    'encargado@test.local', v_encrypted_pw, now(), v_app_meta,
    '{"first_name":"Encargado","last_name":"Prueba"}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 7. Identities (necesario para que el login funcione)
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES
    (v_super_admin_id, v_super_admin_id, format('{"sub":"%s","email":"superadmin@test.local"}', v_super_admin_id)::jsonb, 'email', v_super_admin_id::text, now(), now(), now()),
    (v_director_id, v_director_id, format('{"sub":"%s","email":"director@test.local"}', v_director_id)::jsonb, 'email', v_director_id::text, now(), now(), now()),
    (v_professor_id, v_professor_id, format('{"sub":"%s","email":"profesor@test.local"}', v_professor_id)::jsonb, 'email', v_professor_id::text, now(), now(), now()),
    (v_student_id, v_student_id, format('{"sub":"%s","email":"estudiante@test.local"}', v_student_id)::jsonb, 'email', v_student_id::text, now(), now(), now()),
    (v_guardian_id, v_guardian_id, format('{"sub":"%s","email":"encargado@test.local"}', v_guardian_id)::jsonb, 'email', v_guardian_id::text, now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 8. Perfiles en public.profiles (roles exactos del código: super_admin, director, professor, student, guardian)
  INSERT INTO public.profiles (id, email, first_name, last_name, role, academy_id, status, created_at, updated_at)
  VALUES
    (v_super_admin_id, 'superadmin@test.local', 'Super', 'Admin', 'super_admin', NULL, 'active', now(), now()),
    (v_director_id, 'director@test.local', 'Director', 'Prueba', 'director', v_seed_academy_id, 'active', now(), now()),
    (v_professor_id, 'profesor@test.local', 'Profesor', 'Prueba', 'professor', v_seed_academy_id, 'active', now(), now()),
    (v_student_id, 'estudiante@test.local', 'Estudiante', 'Prueba', 'student', v_seed_academy_id, 'active', now(), now()),
    (v_guardian_id, 'encargado@test.local', 'Encargado', 'Prueba', 'guardian', v_seed_academy_id, 'active', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    academy_id = EXCLUDED.academy_id,
    status = EXCLUDED.status,
    updated_at = now();

END $$;

-- ============================================
-- CREDENCIALES PARA ENTORNO LOCAL (Docker)
-- ============================================
-- Contraseña para todos: TestPassword123
--
-- | Rol         | Email                  |
-- |-------------|------------------------|
-- | super_admin | superadmin@test.local  |
-- | director    | director@test.local    |
-- | professor   | profesor@test.local    |
-- | student     | estudiante@test.local  |
-- | guardian    | encargado@test.local   |
