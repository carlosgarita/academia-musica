# 📋 Resumen: Migración Sección Aula

## ✅ Migración Creada

**Archivo**: `supabase/migrations/20260129041907_create_aula_tables.sql`

## 🗄️ Tablas Creadas

### 1. **evaluation_rubrics** - Rubros de Evaluación

- Catálogo de rubros por academia
- Rubros predeterminados: Digitación, Coordinación, Lectura Rítmica, Lectura Melódica

### 2. **evaluation_scales** - Escala de Calificación

- Escala global por academia
- Escala predeterminada: Completamente Satisfactorio (3), En Progreso (2), No resuelto por falta de comprensión (1), No resuelto por falta de estudio (0)

### 3. **subject_rubrics** - Rubros por Materia

- Relación many-to-many entre subjects y rubros
- Define qué rubros se usan para evaluar cada materia

### 4. **song_evaluations** - Calificaciones de Canciones

- Calificaciones por estudiante, canción, sesión y rubro
- Historial completo con timestamps (solo cambios de valor)

### 5. **session_attendances** - Asistencia

- Control de asistencia por sesión y estudiante
- Estados: presente, ausente, tardanza, justificado

### 6. **session_comments** - Comentarios del Profesor

- Comentarios por sesión y estudiante (máx. 1500 caracteres)

### 7. **session_assignments** - Tareas Individuales

- Tareas asignadas individualmente por sesión (máx. 1500 caracteres)

### 8. **course_group_assignments** - Tareas Grupales

- Tareas asignadas a todo el curso (título + contenido, máx. 2000 caracteres)
- Inmutables una vez creadas

### 9. **badges** - Catálogo de Badges

- Badges disponibles por academia (nombre, descripción, imagen URL)

### 10. **student_badges** - Badges Asignados

- Badges asignados a estudiantes en un curso/periodo
- Acumulativos durante todo el periodo

## 🔧 Modificaciones a Tablas Existentes

### **period_dates**

- ✅ Agregado `profile_id` para vincular sesiones a cursos específicos
- ✅ Índice creado para búsquedas eficientes

### **audit_logs**

- ✅ Agregados campos: `changed_by`, `old_value`, `new_value`, `change_type`, `related_student_id`, `related_session_id`
- ✅ Índices creados para auditoría

## 🔐 Políticas RLS Implementadas

Todas las tablas tienen políticas RLS configuradas para:

- **Super Admin**: Acceso completo
- **Directores**: Gestión completa en su academia
- **Profesores**: Gestión de sus cursos, visualización en su academia
- **Estudiantes**: Visualización de sus propios datos
- **Encargados**: Visualización de datos de sus estudiantes asignados

## 📊 Datos Predeterminados

### Función Automática

- ✅ Función `insert_default_evaluation_data()` creada
- ✅ Trigger automático al crear nueva academia
- ✅ Backfill para academias existentes

### Rubros Predeterminados (por academia)

1. Digitación
2. Coordinación
3. Lectura Rítmica
4. Lectura Melódica

### Escala Predeterminada (por academia)

1. Completamente Satisfactorio (valor: 3)
2. En Progreso (valor: 2)
3. No resuelto por falta de comprensión (valor: 1)
4. No resuelto por falta de estudio (valor: 0)

## 📝 Próximos Pasos

### 1. Aplicar la Migración

```bash
# Opción 1: Copiar y pegar en SQL Editor de Supabase
# Abrir: supabase/migrations/20260129041907_create_aula_tables.sql
# Copiar todo el contenido y ejecutar en Supabase SQL Editor

# Opción 2: Usar Supabase CLI (si está configurado)
npm run db:push
```

### 2. Verificar la Migración

```sql
-- Verificar que las tablas se crearon
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'evaluation_rubrics',
  'evaluation_scales',
  'subject_rubrics',
  'song_evaluations',
  'session_attendances',
  'session_comments',
  'session_assignments',
  'course_group_assignments',
  'badges',
  'student_badges'
);

-- Verificar datos predeterminados
SELECT * FROM public.evaluation_rubrics WHERE is_default = true;
SELECT * FROM public.evaluation_scales WHERE is_default = true;
```

### 3. Generar Tipos TypeScript

```bash
npm run db:types
```

### 4. Desarrollo Frontend

Ahora puedes comenzar a desarrollar:

- Páginas de navegación (Dashboard Aula → Curso → Sesión → Expediente)
- Componentes de calificación
- Componentes de asistencia
- Componentes de tareas (grupales e individuales)
- Componentes de badges
- Componentes de repertorio

## ⚠️ Notas Importantes

1. **Sesiones (`period_dates`)**: Ahora tienen `profile_id` para vincularse a cursos específicos. Las sesiones existentes tendrán `profile_id = NULL` hasta que se actualicen.

2. **Calificaciones**: Solo se registran cambios de valor. Si un profesor vuelve a poner la misma calificación, no se crea nuevo registro.

3. **Tareas Grupales**: Son inmutables una vez creadas. Considera agregar un campo `is_sent` o similar si necesitas un estado de "borrador".

4. **Badges**: Se acumulan durante todo el periodo del curso. Un badge solo se puede asignar una vez por curso.

5. **Auditoría**: Todos los cambios deben registrarse en `audit_logs` usando los nuevos campos (`change_type`, `changed_by`, etc.).

## 📚 Documentación Relacionada

- `DISEÑO-AULA.md` - Diseño completo de la base de datos
- `COMANDOS-GUARDAR-CAMBIOS.md` - Comandos para guardar cambios
- `MIGRATIONS.md` - Guía de migraciones
