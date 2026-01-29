# Volver a Supabase en la nube

Sigue estos pasos en orden.

---

## 1. Tener un proyecto en Supabase (nube)

- Entra en [https://supabase.com/dashboard](https://supabase.com/dashboard) e inicia sesión.
- Si ya tienes un proyecto para esta app, ábrelo y pasa al paso 2.
- Si no: **New project** → elige organización, nombre, contraseña de DB y región → **Create new project**. Espera a que termine de crearse.

---

## 2. Copiar URL y anon key del proyecto

- En el proyecto: **Project Settings** (icono de engranaje) → **API**.
- Anota:
  - **Project URL** (ej: `https://xxxxx.supabase.co`)
  - **anon public** (clave larga bajo "Project API keys").

---

## 3. Poner las variables en `.env.local`

En la raíz del proyecto, en `.env.local`:

- **Quita** cualquier URL y clave de Docker (ej: `http://127.0.0.1:54321`).
- **Pon** la URL y la anon key del paso 2:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Si usas Service Role para algo (APIs internas, etc.):

- En Dashboard → **Project Settings** → **API** → **service_role** (secret).
- Añade en `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Guarda el archivo.

---

## 4. Aplicar el esquema y migraciones en la nube

Tienes dos opciones.

### Opción A: SQL Editor (recomendado si no usas CLI contra la nube)

1. En el Dashboard del proyecto: **SQL Editor**.
2. Abre en tu repo, en orden, estos archivos y **ejecuta cada uno** en el Editor (copiar/pegar y Run):
   - `supabase/migrations/20260128223748_remote_schema.sql`
   - `supabase/migrations/20260129041907_create_aula_tables.sql`
   - `supabase/migrations/20260129120100_fix_authenticator_schema.sql`
   - `supabase/migrations/20260129130000_profiles_rls_and_grants.sql`
3. Si algún archivo da error de “ya existe”, suele ser normal; revisa que las tablas y políticas queden como quieres.

### Opción B: CLI vinculado al proyecto remoto

1. Instala Supabase CLI si no la tienes.
2. En la raíz del proyecto:
   ```bash
   npx supabase link --project-ref TU-PROJECT-REF
   ```
   (El **Project ref** está en Dashboard → **Project Settings** → **General**.)
3. Sube migraciones:
   ```bash
   npx supabase db push
   ```

---

## 5. Crear tu usuario en la nube

En la nube no usarás el seed de Docker; el usuario se crea desde el Dashboard o desde Auth:

- **Dashboard** → **Authentication** → **Users** → **Add user** → **Create new user**.
- Email y contraseña que quieras (ej: el que usabas en local).
- Después hay que tener un **perfil** en `public.profiles` con el mismo `id` que el usuario de Auth.

**Crear el perfil a mano (una vez):**

1. **Authentication** → **Users** → copia el **UUID** del usuario que creaste.
2. **SQL Editor** → ejecuta (sustituye `TU-UUID` y el email):

```sql
INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
VALUES (
  'TU-UUID',
  'tu-email@ejemplo.com',
  'Tu Nombre',
  'Tu Apellido',
  'super_admin',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status;
```

Con eso puedes iniciar sesión en la app con ese email/contraseña y rol `super_admin`.

---

## 6. Probar la app

1. Reinicia el servidor de Next.js (para que cargue el nuevo `.env.local`):
   ```bash
   npm run dev
   ```
2. Abre la app (ej: `http://localhost:3000`).
3. Ve a **Login** e inicia sesión con el usuario que creaste en el paso 5.

Si el login falla, revisa en el navegador (F12 → Network o Console) si la petición va a la URL de Supabase en la nube (no a `127.0.0.1`).

---

## 7. (Opcional) Dejar de usar Docker

- Para no usar Supabase local:
  - No ejecutes `supabase start` en este proyecto.
  - Si quieres, puedes borrar o ignorar `supabase/seed.sql` y el seed de usuarios de prueba; en la nube usas usuarios creados desde el Dashboard o Auth.
- Las migraciones en `supabase/migrations/` sí sirven para la nube (paso 4).

---

## Resumen rápido

1. Dashboard Supabase → proyecto (o crear uno).
2. Project Settings → API → copiar **URL** y **anon key**.
3. `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con esos valores.
4. Aplicar migraciones en la nube (SQL Editor o `supabase db push`).
5. Authentication → Add user; luego SQL Editor → `INSERT` en `public.profiles` con ese `id` y rol.
6. `npm run dev` → probar login.

Cuando todo funcione, ya estás de vuelta usando solo Supabase en la nube.
