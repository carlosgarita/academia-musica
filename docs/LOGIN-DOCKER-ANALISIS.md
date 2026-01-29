# Análisis: "Database error querying schema" en login (Docker)

## Flujo de login en tu código

1. **Login** (`app/(auth)/login/auth-form.tsx`): Auth UI llama a Supabase Auth (GoTrue). No toca PostgREST.
2. **Callback** (`app/(auth)/callback/route.ts`): `exchangeCodeForSession(code)` y redirección a `/`.
3. **Middleware** (`middleware.ts`): En cada request hace `supabase.from("profiles").select("role").eq("id", user.id).single()`.

El error aparece cuando el **middleware** (o la Auth UI tras el redirect) llama a **PostgREST** para leer `public.profiles`. PostgREST devuelve un error que el cliente muestra como "Database error querying schema" (típicamente **PGRST106**: el esquema `public` no está expuesto).

## Qué revisan las migraciones

| Requisito                                        | Dónde está                                                     | ¿Cubierto?                              |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------- |
| Tabla `public.profiles`                          | `20260128223748_remote_schema.sql`                             | Sí                                      |
| RLS en `profiles`                                | `remote_schema` + `20260129130000_profiles_rls_and_grants.sql` | Sí                                      |
| Políticas SELECT/UPDATE en `profiles`            | `20260129130000_profiles_rls_and_grants.sql`                   | Sí (SELECT cualquiera, UPDATE propio)   |
| USAGE en schema `public` para anon/authenticated | `20260129120100` y `20260129130000`                            | Sí                                      |
| **Exponer esquema `public` a PostgREST**         | `20260129120100_fix_authenticator_schema.sql`                  | Sí, pero **PostgREST debe reiniciarse** |
| Extensión pgcrypto (seed)                        | `remote_schema` (extensions) + `seed_test_users`               | Sí                                      |

## Causa del error en Docker

PostgREST decide qué esquemas expone leyendo el rol `authenticator` en la base de datos (`pgrst.db_schemas`). Tu migración `20260129120100_fix_authenticator_schema.sql` hace:

- `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';`
- `NOTIFY pgrst, 'reload schema';`

Eso está bien, pero:

1. Si haces **`supabase db reset`** o **`supabase migration up`** con los contenedores ya levantados, PostgREST **ya está corriendo** y puede haber leído la config antes de que la migración aplicara el `ALTER ROLE`. El `NOTIFY` a veces no llega si PostgREST no está escuchando en esa misma conexión.
2. En ese caso, PostgREST sigue con la lista de esquemas antigua (o vacía) y cualquier petición a `public.profiles` devuelve PGRST106 → "Database error querying schema".

## Solución obligatoria en Docker

Después de aplicar migraciones, **reiniciar** los servicios para que PostgREST vuelva a conectar y lea el rol `authenticator`:

```bash
supabase stop
supabase start
```

Si acabas de hacer `supabase db reset`, también:

```bash
supabase stop
supabase start
```

## Resumen

- No falta tabla, ni extensión, ni política de seguridad en las migraciones para el login.
- El fallo viene de que PostgREST no tiene expuesto el esquema `public` en el momento de la petición; la migración que lo corrige sí existe, pero el proceso de PostgREST debe reiniciarse para aplicarla.
