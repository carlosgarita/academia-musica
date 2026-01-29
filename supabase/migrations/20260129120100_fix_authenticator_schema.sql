-- ============================================
-- Fix: "Database error querying schema" en login
-- ============================================
-- PostgREST expone solo los esquemas listados en el rol authenticator
-- (pgrst.db_schemas). Sin esto, las consultas a public.profiles fallan.
--
-- IMPORTANTE (Docker): Tras aplicar migraciones, reiniciar para que
-- PostgREST lea la nueva config:  supabase stop && supabase start
-- ============================================

-- Permisos de uso del esquema public (por si faltan)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Exponer public (y graphql_public) a PostgREST; solo si existe el rol
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator SET pgrst.db_schemas = ''public, graphql_public''';
  END IF;
END
$$;

-- Pedir a PostgREST que recargue esquema (puede no surtir efecto hasta reinicio)
NOTIFY pgrst, 'reload schema';
