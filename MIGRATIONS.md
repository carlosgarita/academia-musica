# Guía de Migraciones de Base de Datos

Este proyecto usa **Supabase Migrations** para versionar y gestionar cambios en la base de datos, similar a como Git versiona el código.

## 📋 Requisitos Previos

1. Instalar Supabase CLI:

```bash
npm install -g supabase
# O con Homebrew (macOS):
brew install supabase/tap/supabase
```

2. Verificar instalación:

```bash
supabase --version
```

## 🚀 Configuración Inicial

### 1. Vincular tu proyecto de Supabase

```bash
# Inicia sesión en Supabase
supabase login

# Vincula tu proyecto local con tu proyecto remoto
supabase link --project-ref tu-project-ref-id
```

Puedes encontrar tu `project-ref-id` en:

- Supabase Dashboard → Settings → General → Reference ID

### 2. Estructura de Migraciones

Las migraciones se guardan en `supabase/migrations/` con el formato:

```
YYYYMMDDHHMMSS_nombre_descriptivo.sql
```

Ejemplo: `20240115143000_add_course_registrations.sql`

## 📝 Crear una Nueva Migración

### Opción 1: Crear migración desde cero

```bash
# Crea un archivo de migración vacío con timestamp
supabase migration new nombre_descriptivo

# Esto creará: supabase/migrations/YYYYMMDDHHMMSS_nombre_descriptivo.sql
```

### Opción 2: Generar migración desde cambios locales

Si tienes cambios en tu base de datos local:

```bash
# 1. Aplica tus cambios manualmente en la DB local o Supabase Dashboard
# 2. Genera la migración automáticamente
supabase db diff -f nombre_descriptivo
```

### Opción 3: Migrar archivos existentes

Si ya tienes archivos SQL de migración (como los que tienes en `supabase/`):

```bash
# 1. Mueve tus archivos SQL a supabase/migrations/
# 2. Renómbralos con el formato correcto: YYYYMMDDHHMMSS_nombre.sql
# 3. Aplica las migraciones
```

## 🔄 Aplicar Migraciones

### Aplicar migraciones pendientes a producción

```bash
# Aplica todas las migraciones pendientes a tu proyecto remoto
supabase db push
```

### Aplicar migraciones a base de datos local

```bash
# Inicia Supabase localmente (si no está corriendo)
supabase start

# Aplica migraciones
supabase migration up
```

### Ver estado de migraciones

```bash
# Ver qué migraciones están aplicadas y cuáles pendientes
supabase migration list
```

## 📦 Migrar Archivos Existentes

Ya tienes varios archivos de migración. Para organizarlos:

1. **Crea el directorio de migraciones:**

```bash
mkdir -p supabase/migrations
```

2. **Mueve y renombra tus migraciones existentes** siguiendo el orden cronológico:
   - Usa timestamps que reflejen el orden en que fueron creadas
   - Formato: `YYYYMMDDHHMMSS_nombre.sql`

Ejemplo de orden sugerido:

```
20240101000000_initial_schema.sql (schema.sql base)
20240102000000_create_periods.sql
20240103000000_create_songs.sql
20240104000000_create_course_registrations.sql
...
```

## 🔍 Buenas Prácticas

### 1. Nombres descriptivos

```sql
-- ✅ Bueno
20240115143000_add_profile_id_to_course_registrations.sql

-- ❌ Malo
20240115143000_update.sql
```

### 2. Migraciones reversibles

Siempre que sea posible, incluye una forma de revertir:

```sql
-- Migración
ALTER TABLE students ADD COLUMN middle_name TEXT;

-- Rollback (en comentarios o migración separada)
-- ALTER TABLE students DROP COLUMN middle_name;
```

### 3. Una migración = un cambio lógico

No mezcles múltiples cambios no relacionados en una sola migración.

### 4. Probar antes de aplicar

```bash
# Prueba localmente primero
supabase start
supabase migration up

# Verifica que todo funcione
# Luego aplica a producción
supabase db push
```

## 🔄 Flujo de Trabajo Recomendado

1. **Crear migración:**

   ```bash
   supabase migration new agregar_campo_nuevo
   ```

2. **Editar el archivo SQL** generado en `supabase/migrations/`

3. **Probar localmente:**

   ```bash
   supabase start
   supabase migration up
   ```

4. **Commitear a Git:**

   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): agregar campo nuevo a tabla X"
   ```

5. **Aplicar a producción:**
   ```bash
   supabase db push
   ```

## 📚 Comandos Útiles

```bash
# Ver estado de migraciones
supabase migration list

# Aplicar migraciones pendientes
supabase migration up

# Revertir última migración (si está soportado)
supabase migration down

# Resetear base de datos local (CUIDADO: borra todos los datos)
supabase db reset

# Generar tipos TypeScript desde el schema
supabase gen types typescript --local > lib/database.types.ts
```

## ⚠️ Importante

- **Nunca edites migraciones ya aplicadas** - crea nuevas migraciones para cambios
- **Siempre prueba localmente** antes de aplicar a producción
- **Haz backup** antes de migraciones importantes en producción
- **Coordina con tu equipo** - las migraciones deben aplicarse en orden

## 🔗 Recursos

- [Documentación de Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
