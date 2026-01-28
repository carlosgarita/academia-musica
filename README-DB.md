# 🗄️ Control de Versiones de Base de Datos

Este proyecto ahora usa **Supabase Migrations** para versionar cambios en la base de datos, igual que Git versiona el código.

## ⚡ Inicio Rápido

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
# O con Homebrew:
brew install supabase/tap/supabase
```

### 2. Vincular tu Proyecto

```bash
# Iniciar sesión
supabase login

# Vincular proyecto (reemplaza con tu Project Reference ID)
supabase link --project-ref tu-project-ref-id
```

Encuentra tu Project Reference ID en: **Supabase Dashboard → Settings → General → Reference ID**

### 3. Crear tu Primera Migración

```bash
npm run db:migrate:new nombre_descriptivo
# O directamente:
supabase migration new nombre_descriptivo
```

Esto crea: `supabase/migrations/YYYYMMDDHHMMSS_nombre_descriptivo.sql`

### 4. Aplicar Migraciones

```bash
# Aplicar a producción
npm run db:push
# O:
supabase db push

# Ver estado
npm run db:migrate:list
```

## 📚 Comandos NPM Disponibles

```bash
npm run db:migrate          # Aplicar migraciones pendientes (local)
npm run db:migrate:new      # Crear nueva migración
npm run db:migrate:list     # Listar migraciones
npm run db:push             # Aplicar migraciones a producción
npm run db:reset            # Resetear DB local (⚠️ borra datos)
npm run db:types            # Generar tipos TypeScript desde schema
npm run db:diff             # Ver diferencias entre local y remoto
```

## 📖 Documentación Completa

Ver [MIGRATIONS.md](./MIGRATIONS.md) para la guía completa.

## 🔄 Migrar Archivos Existentes

Si quieres organizar tus migraciones existentes:

```bash
# Ejecutar script de organización
./scripts/organize-migrations.sh

# O manualmente:
# 1. Mueve archivos SQL a supabase/migrations/
# 2. Renómbralos: YYYYMMDDHHMMSS_nombre.sql
# 3. Aplica: npm run db:push
```

## ✅ Ventajas

- ✅ **Versionado**: Cada cambio de DB está en Git
- ✅ **Historial**: Puedes ver quién hizo qué cambio y cuándo
- ✅ **Colaboración**: El equipo puede aplicar los mismos cambios
- ✅ **Rollback**: Puedes revertir cambios si es necesario
- ✅ **Testing**: Prueba migraciones localmente antes de producción
