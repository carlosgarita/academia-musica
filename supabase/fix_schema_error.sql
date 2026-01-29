-- ============================================
-- Ejecutar en SQL Editor para corregir
-- "Database error querying schema" en login
-- ============================================
-- Ejecuta en: Supabase Dashboard > SQL Editor (o Studio local).
-- Si usas Docker local: después de ejecutar esto, reinicia:
--   supabase stop && supabase start
-- Luego prueba el login de nuevo.
-- ============================================

-- 1. Exponer esquema public a PostgREST (rol authenticator)
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';

-- 2. Recargar esquema en PostgREST
NOTIFY pgrst, 'reload schema';

-- 3. Asegurar que anon y authenticated pueden usar el esquema public
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 4. Verificación: ver qué esquemas tiene configurados el authenticator (opcional)
-- SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'authenticator';
