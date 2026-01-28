# 🏢 Configuración Profesional: Desarrollo, Staging y Producción

## 📋 Visión General

Cuando tengas clientes reales, necesitarás **3 entornos separados** para trabajar de forma segura:

1. **Desarrollo (Dev)** - Para desarrollar y probar cambios
2. **Staging** - Para pruebas finales antes de producción
3. **Producción (Prod)** - Base de datos real con datos de clientes

---

## 🎯 Estructura Recomendada

### Opción 1: Tres Proyectos de Supabase (Recomendado)

```
┌─────────────────┐
│   Desarrollo    │  ← Tu trabajo diario
│  (Supabase Dev) │
└─────────────────┘
         │
         │ Migraciones probadas
         ▼
┌─────────────────┐
│    Staging      │  ← Pruebas finales
│ (Supabase Stage)│
└─────────────────┘
         │
         │ Migraciones validadas
         ▼
┌─────────────────┐
│  Producción     │  ← Datos reales de clientes
│ (Supabase Prod) │
└─────────────────┘
```

**Ventajas:**
- ✅ Separación completa de datos
- ✅ Puedes resetear desarrollo sin miedo
- ✅ Pruebas seguras antes de producción
- ✅ Rollback fácil si algo falla

---

## 🚀 Configuración Paso a Paso

### 1. Crear Proyectos en Supabase

1. **Proyecto Desarrollo:**
   - Ve a [supabase.com](https://supabase.com)
   - Crea nuevo proyecto: `tu-app-dev`
   - Plan: Free tier está bien para desarrollo

2. **Proyecto Staging:**
   - Crea otro proyecto: `tu-app-staging`
   - Plan: Free tier o Pro (según necesidades)

3. **Proyecto Producción:**
   - Ya lo tienes: tu proyecto actual
   - Plan: Pro o según necesidades de clientes

### 2. Configurar Variables de Entorno

Crea archivos `.env` para cada entorno:

**`.env.development`**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-dev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-dev
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-dev
```

**`.env.staging`**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-staging
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-staging
```

**`.env.production`**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-prod
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-prod
```

### 3. Configurar Supabase CLI

```bash
# Vincular cada proyecto
supabase link --project-ref dev-project-ref
supabase link --project-ref staging-project-ref
supabase link --project-ref prod-project-ref

# O usar perfiles
supabase link --project-ref dev-project-ref --profile dev
supabase link --project-ref staging-project-ref --profile staging
supabase link --project-ref prod-project-ref --profile prod
```

---

## 🔄 Flujo de Trabajo Profesional

### Desarrollo Diario

1. **Trabajas en Desarrollo:**
   ```bash
   # Crear migración
   supabase migration new agregar_campo_nuevo --profile dev
   
   # Editar migración
   # Aplicar localmente o en dev
   supabase db push --profile dev
   
   # Probar
   npm run dev  # Conectado a dev
   ```

2. **Commit a Git:**
   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): agregar campo nuevo"
   git push
   ```

### Promoción a Staging

Cuando una feature está lista:

1. **Aplicar migraciones a Staging:**
   ```bash
   supabase db push --profile staging
   ```

2. **Probar en Staging:**
   - Deploy de la app a staging
   - Pruebas completas
   - Validación con el equipo

3. **Si todo está bien:** Proceder a producción
4. **Si hay problemas:** Corregir en desarrollo y repetir

### Deploy a Producción

Solo cuando Staging está validado:

1. **Backup de Producción** (IMPORTANTE):
   ```bash
   # Crear backup antes de cualquier cambio
   supabase db dump --profile prod > backup-$(date +%Y%m%d).sql
   ```

2. **Aplicar migraciones:**
   ```bash
   supabase db push --profile prod
   ```

3. **Deploy de la aplicación**

4. **Monitorear** por posibles errores

5. **Si hay problemas:** Rollback inmediato

---

## 🛡️ Buenas Prácticas de Seguridad

### 1. Migraciones Seguras

Siempre usa comandos que no rompan si se aplican dos veces:

```sql
-- ✅ Bueno
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name TEXT;
CREATE INDEX IF NOT EXISTS idx_students_middle_name ON students(middle_name);

-- ❌ Malo
ALTER TABLE students ADD COLUMN middle_name TEXT;  -- Falla si ya existe
```

### 2. Migraciones Reversibles

Incluye comentarios sobre cómo revertir:

```sql
-- Migración
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Rollback (en comentarios)
-- ALTER TABLE students DROP COLUMN IF EXISTS middle_name;
```

### 3. Migraciones de Datos

Cuando modifiques datos existentes, hazlo con cuidado:

```sql
-- ✅ Bueno: Backup implícito y seguro
BEGIN;
  -- Crear columna temporal
  ALTER TABLE students ADD COLUMN new_status TEXT;
  
  -- Migrar datos
  UPDATE students SET new_status = 
    CASE 
      WHEN enrollment_status = 'inscrito' THEN 'active'
      WHEN enrollment_status = 'retirado' THEN 'inactive'
      ELSE 'unknown'
    END;
  
  -- Verificar antes de commit
  -- SELECT COUNT(*) FROM students WHERE new_status IS NULL;
COMMIT;

-- Luego en migración separada:
-- ALTER TABLE students DROP COLUMN enrollment_status;
-- ALTER TABLE students RENAME COLUMN new_status TO enrollment_status;
```

### 4. Testing de Migraciones

```bash
# 1. Probar en desarrollo
supabase db reset --profile dev
supabase migration up --profile dev

# 2. Probar en staging (con datos similares a producción)
supabase db push --profile staging

# 3. Solo entonces: producción
supabase db push --profile prod
```

---

## 📊 Estrategias de Migración de Datos

### Migración Sin Downtime

Para cambios grandes sin afectar usuarios:

1. **Fase 1: Agregar nueva estructura**
   ```sql
   ALTER TABLE students ADD COLUMN new_field TEXT;
   ```

2. **Fase 2: Migrar datos gradualmente**
   ```sql
   UPDATE students SET new_field = old_field WHERE new_field IS NULL LIMIT 1000;
   -- Repetir hasta completar
   ```

3. **Fase 3: Validar datos**
   ```sql
   SELECT COUNT(*) FROM students WHERE new_field IS NULL;
   ```

4. **Fase 4: Cambiar aplicación para usar nuevo campo**

5. **Fase 5: Eliminar campo viejo** (en migración futura)

### Migración con Ventana de Mantenimiento

Para cambios que requieren downtime:

1. **Avisar a usuarios** con anticipación
2. **Programar ventana de mantenimiento**
3. **Backup completo**
4. **Aplicar migraciones**
5. **Validar**
6. **Abrir servicio**

---

## 🔍 Monitoreo y Rollback

### Verificar Estado de Migraciones

```bash
# Ver qué migraciones están aplicadas
supabase migration list --profile prod

# Ver diferencias entre entornos
supabase db diff --profile dev --profile staging
supabase db diff --profile staging --profile prod
```

### Rollback de Emergencia

Si algo sale mal en producción:

1. **Detener aplicación** (si es necesario)

2. **Revertir migración manualmente:**
   ```sql
   -- Ejecutar SQL de rollback en SQL Editor
   ALTER TABLE students DROP COLUMN IF EXISTS problematic_column;
   ```

3. **Revertir código:**
   ```bash
   git revert <commit-hash>
   git push
   ```

4. **Restaurar desde backup** (último recurso):
   ```bash
   psql -h db.xxx.supabase.co -U postgres -d postgres < backup-20240115.sql
   ```

---

## 📝 Checklist Pre-Producción

Antes de aplicar cualquier migración a producción:

- [ ] Migración probada en desarrollo
- [ ] Migración probada en staging
- [ ] Backup de producción creado
- [ ] Migración revisada por otro desarrollador (si hay equipo)
- [ ] Plan de rollback preparado
- [ ] Ventana de mantenimiento programada (si es necesario)
- [ ] Monitoreo activo después del deploy
- [ ] Documentación actualizada

---

## 🎓 Recursos Adicionales

- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Database Migration Best Practices](https://supabase.com/docs/guides/database/migrations)
- [Zero-Downtime Migrations](https://supabase.com/docs/guides/database/extensions)

---

## 💡 Resumen

**Ahora (sin clientes):**
- Una sola base de datos
- Aplicas directamente y pruebas

**Futuro (con clientes):**
- Tres entornos: Dev → Staging → Prod
- Migraciones probadas en cada etapa
- Backups antes de producción
- Plan de rollback siempre listo

**Principio clave:** Nunca toques producción sin probar primero en desarrollo y staging.
