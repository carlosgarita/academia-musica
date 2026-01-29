# Usuarios de prueba (entorno local Docker)

La migración `20260129120000_seed_test_users.sql` crea usuarios de prueba en `auth.users`, `auth.identities` y `public.profiles` con **UUIDs fijos** para poder iniciar sesión siempre con los mismos datos.

## Contraseña común

**`TestPassword123`**

## Credenciales por rol

| Rol (en código) | Email                     | Uso típico       |
| --------------- | ------------------------- | ---------------- |
| `super_admin`   | **superadmin@test.local** | Panel global     |
| `director`      | **director@test.local**   | Gestión academia |
| `professor`     | **profesor@test.local**   | Aula / clases    |
| `student`       | **estudiante@test.local** | Vista estudiante |
| `guardian`      | **encargado@test.local**  | Vista encargado  |

## Cómo aplicar

- **Con Supabase local (Docker):**  
  `supabase db reset` o aplicar migraciones con `supabase db push` / `supabase migration up`.
- **Solo este seed (SQL Editor):**  
  Ejecutar el contenido de `supabase/migrations/20260129120000_seed_test_users.sql` en el SQL Editor del proyecto.

## UUIDs fijos (por si los necesitas)

- Super Admin: `a0000000-0000-0000-0000-000000000001`
- Academia de prueba: `b0000000-0000-0000-0000-000000000001`
- Director: `c0000000-0000-0000-0000-000000000001`
- Professor: `d0000000-0000-0000-0000-000000000001`
- Student: `e0000000-0000-0000-0000-000000000001`
- Guardian: `f0000000-0000-0000-0000-000000000001`

**Importante:** Esta migración está pensada para **entorno local**. No incluyas o no ejecutes este seed en producción con datos reales.
