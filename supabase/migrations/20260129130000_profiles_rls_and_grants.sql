-- ============================================
-- Migration: RLS y políticas en profiles + permisos esquema public
-- ============================================
-- - Habilita RLS en public.profiles
-- - SELECT: cualquier usuario (anon o authenticated) puede leer todos los perfiles
-- - UPDATE: solo el propio usuario (auth.uid() = id)
-- - USAGE en schema public para anon y authenticated
-- ============================================

BEGIN;

-- 1. Permisos de uso del esquema public (por si acaso)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas antiguas de profiles (evitar duplicados o conflictos)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 4. SELECT: cualquier usuario (autenticado o no) puede leer todos los perfiles
CREATE POLICY "profiles_select_any"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. UPDATE: solo el usuario puede actualizar su propio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. INSERT: mantener inserción del propio perfil (p. ej. al registrarse)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 7. Garantizar GRANT en la tabla profiles
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

COMMIT;
