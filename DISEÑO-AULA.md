# 🎓 Diseño de Base de Datos: Sección Aula

## 📋 Resumen de Requerimientos

### Estructura de Navegación

```
Dashboard Aula → [Curso] → [Sesión] → [Expediente Estudiante]
```

### Entidades Principales

- **Curso**: `professor_subject_periods` (profesor + materia + periodo)
- **Sesión**: `period_dates` (fechas de clase del curso)
- **Estudiante**: `course_registrations` (matrícula al curso)
- **Canciones**: `course_registration_songs` (canciones asignadas)

---

## 🗄️ Nuevas Tablas Necesarias

### 1. `evaluation_rubrics` - Rubros de Evaluación

**Propósito**: Catálogo de rubros globales por academia

```sql
- id (uuid, PK)
- academy_id (uuid, FK → academies)
- name (text, max 100 chars) -- Ej: "Digitación", "Coordinación"
- description (text, max 500 chars, nullable)
- is_default (boolean, default false) -- Para rubros predeterminados
- display_order (integer) -- Para ordenar en UI
- deleted_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

**Rubros predeterminados** (se insertan automáticamente):

- Digitación
- Coordinación
- Lectura Rítmica
- Lectura Melódica

---

### 2. `evaluation_scales` - Escala de Calificación

**Propósito**: Escala global de calificación por academia

```sql
- id (uuid, PK)
- academy_id (uuid, FK → academies)
- name (text, max 100 chars) -- Ej: "Completamente Satisfactorio"
- description (text, max 500 chars, nullable)
- numeric_value (integer) -- 0-3 por default, pero configurable
- is_default (boolean, default false) -- Para valores predeterminados
- display_order (integer) -- Para ordenar en UI
- deleted_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

**Escala predeterminada** (se inserta automáticamente):

- Sin Calificar (NULL, no tiene registro)
- Completamente Satisfactorio (3)
- En Progreso (2)
- No resuelto por falta de comprensión (1)
- No resuelto por falta de estudio (0)

---

### 3. `subject_rubrics` - Rubros por Materia

**Propósito**: Relación many-to-many entre subjects y rubros

```sql
- id (uuid, PK)
- subject_id (uuid, FK → subjects, CASCADE)
- rubric_id (uuid, FK → evaluation_rubrics, CASCADE)
- created_at (timestamp)
- UNIQUE(subject_id, rubric_id)
```

**Nota**: Cuando se crea/edita un `subject`, se asignan los rubros que se usarán para evaluar esa materia.

---

### 4. `song_evaluations` - Calificaciones de Canciones

**Propósito**: Calificaciones de canciones por estudiante, sesión y rubro

```sql
- id (uuid, PK)
- course_registration_id (uuid, FK → course_registrations, CASCADE)
- song_id (uuid, FK → songs, CASCADE)
- period_date_id (uuid, FK → period_dates, CASCADE) -- Sesión donde se calificó
- rubric_id (uuid, FK → evaluation_rubrics, CASCADE)
- scale_id (uuid, FK → evaluation_scales, nullable) -- NULL = Sin Calificar
- created_at (timestamp) -- Para historial
- updated_at (timestamp)
- UNIQUE(course_registration_id, song_id, period_date_id, rubric_id)
```

**Reglas**:

- Solo se registra cuando cambia el valor (evitar duplicados)
- Si se vuelve a poner el mismo valor, no se crea nuevo registro
- Historial completo con timestamps

---

### 5. `session_attendances` - Asistencia por Sesión

**Propósito**: Control de asistencia de estudiantes por sesión

```sql
- id (uuid, PK)
- course_registration_id (uuid, FK → course_registrations, CASCADE)
- period_date_id (uuid, FK → period_dates, CASCADE)
- attendance_status (text) -- 'presente', 'ausente', 'tardanza', 'justificado'
- notes (text, max 500 chars, nullable) -- Notas adicionales
- created_at (timestamp)
- updated_at (timestamp)
- UNIQUE(course_registration_id, period_date_id)
```

**Valores posibles**: presente, ausente, tardanza, justificado

---

### 6. `session_comments` - Comentarios del Profesor

**Propósito**: Comentarios del profesor por sesión y estudiante

```sql
- id (uuid, PK)
- course_registration_id (uuid, FK → course_registrations, CASCADE)
- period_date_id (uuid, FK → period_dates, CASCADE)
- comment (text, max 1500 chars)
- created_at (timestamp)
- updated_at (timestamp)
- UNIQUE(course_registration_id, period_date_id)
```

**Nota**: Un comentario por sesión por estudiante. Se muestra solo el de la sesión actual/seleccionada.

---

### 7. `session_assignments` - Tareas Individuales

**Propósito**: Tareas asignadas individualmente por sesión y estudiante

```sql
- id (uuid, PK)
- course_registration_id (uuid, FK → course_registrations, CASCADE)
- period_date_id (uuid, FK → period_dates, CASCADE)
- assignment_text (text, max 1500 chars) -- Contenido de la tarea
- created_at (timestamp)
- updated_at (timestamp)
- UNIQUE(course_registration_id, period_date_id)
```

**Nota**: Una tarea por sesión por estudiante.

---

### 8. `course_group_assignments` - Tareas Grupales

**Propósito**: Tareas asignadas a todo el curso

```sql
- id (uuid, PK)
- professor_subject_period_id (uuid, FK → professor_subject_periods, CASCADE)
- title (text, max 200 chars) -- Título de la tarea
- content (text, max 2000 chars) -- Contenido de la tarea
- created_by (uuid, FK → profiles, CASCADE) -- Quién la creó
- created_at (timestamp)
- updated_at (timestamp)
```

**Reglas**:

- Se acumulan (múltiples por curso)
- Una vez creada, queda fija (no se puede editar/eliminar)
- Los estudiantes ven historial completo

---

### 9. `badges` - Catálogo de Badges

**Propósito**: Catálogo de badges disponibles por academia

```sql
- id (uuid, PK)
- academy_id (uuid, FK → academies, CASCADE)
- name (text, max 100 chars) -- Nombre del badge
- description (text, max 500 chars, nullable)
- image_url (text, max 500 chars) -- URL de la imagen
- deleted_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

---

### 10. `student_badges` - Badges Asignados

**Propósito**: Badges asignados a estudiantes en un curso/periodo

```sql
- id (uuid, PK)
- course_registration_id (uuid, FK → course_registrations, CASCADE)
- badge_id (uuid, FK → badges, CASCADE)
- assigned_by (uuid, FK → profiles, CASCADE) -- Profesor/director que lo asignó
- assigned_at (timestamp, default now)
- notes (text, max 500 chars, nullable) -- Notas opcionales
- created_at (timestamp)
- UNIQUE(course_registration_id, badge_id) -- Un badge solo se asigna una vez por curso
```

**Reglas**:

- Badges son específicos por curso/periodo (no por sesión)
- Se acumulan durante todo el periodo
- Se muestran todos en la sección "Badges" del expediente

---

## 🔧 Modificaciones a Tablas Existentes

### 1. `period_dates` - Agregar profile_id

**Razón**: Las sesiones deben pertenecer a un curso específico (profesor + materia + periodo)

```sql
ALTER TABLE public.period_dates
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_period_dates_profile_id
  ON public.period_dates(profile_id)
  WHERE profile_id IS NOT NULL;

-- Actualizar unique constraint si es necesario
-- Las sesiones ahora son únicas por: period_id + subject_id + profile_id + date
```

**Nota**: Esto permite que cada profesor tenga sus propias sesiones incluso si enseñan la misma materia en el mismo periodo.

---

### 2. `audit_logs` - Extender para cambios en sesiones

**Razón**: Necesitamos registrar cambios detallados en sesiones

```sql
-- Agregar campos adicionales si no existen:
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS change_type text, -- 'attendance', 'evaluation', 'comment', 'assignment', 'badge'
  ADD COLUMN IF NOT EXISTS related_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_session_id uuid REFERENCES public.period_dates(id) ON DELETE SET NULL;

-- Índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_change_type ON public.audit_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_student ON public.audit_logs(related_student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_session ON public.audit_logs(related_session_id);
```

---

## 📊 Relaciones Clave

### Sesiones → Cursos

```
period_dates.profile_id + period_dates.subject_id + period_dates.period_id
= professor_subject_periods.profile_id + professor_subject_periods.subject_id + professor_subject_periods.period_id
```

### Estudiantes en Sesión

```
course_registrations (donde profile_id + subject_id + period_id coinciden con el curso)
```

### Calificaciones

```
song_evaluations.course_registration_id → course_registrations.id
song_evaluations.song_id → songs.id (de course_registration_songs)
song_evaluations.period_date_id → period_dates.id (sesión)
song_evaluations.rubric_id → evaluation_rubrics.id (rubro asignado al subject)
```

---

## 🔐 Políticas RLS (Row Level Security)

### Profesores

- Pueden ver/editar solo sus propios cursos (`professor_subject_periods.profile_id = auth.uid()`)
- Pueden ver/editar datos de estudiantes en sus cursos
- Pueden asignar badges a estudiantes en sus cursos

### Directores

- Pueden ver/editar todos los cursos de su academia
- Pueden ver/editar datos de todos los estudiantes
- Pueden asignar badges
- Todos los cambios se registran en `audit_logs`

### Estudiantes

- Pueden ver sus propias calificaciones, tareas, badges
- Pueden ver tareas grupales de sus cursos

### Encargados

- Pueden ver calificaciones, tareas, badges de sus estudiantes asignados
- Pueden ver tareas grupales de los cursos de sus estudiantes

---

## 📝 Datos Predeterminados

### Rubros Predeterminados (por academia)

Al crear una academia, se insertan automáticamente:

1. Digitación
2. Coordinación
3. Lectura Rítmica
4. Lectura Melódica

### Escala Predeterminada (por academia)

Al crear una academia, se inserta automáticamente:

1. Completamente Satisfactorio (3)
2. En Progreso (2)
3. No resuelto por falta de comprensión (1)
4. No resuelto por falta de estudio (0)

**Nota**: "Sin Calificar" no tiene registro, se maneja como NULL.

---

## 🔄 Flujos de Datos

### Asignación de Rubros a Materia

1. Director crea/edita `subject`
2. Selecciona rubros de `evaluation_rubrics`
3. Se crean registros en `subject_rubrics`
4. Esos rubros se usarán para todas las calificaciones de esa materia

### Calificación de Canción

1. Profesor entra a sesión específica (`period_date_id`)
2. Selecciona estudiante (`course_registration_id`)
3. Ve canciones asignadas (`course_registration_songs`)
4. Para cada canción + rubro, selecciona calificación (`evaluation_scales`)
5. Se crea/actualiza registro en `song_evaluations`
6. Si cambia el valor, se crea nuevo registro con timestamp
7. Se registra en `audit_logs`

### Asignación de Badge

1. Profesor/Director entra a expediente de estudiante
2. Selecciona badge de `badges`
3. Se crea registro en `student_badges`
4. Badge aparece en sección "Badges" del expediente
5. Se registra en `audit_logs`

---

## ⚠️ Consideraciones Importantes

1. **Sesiones**: Necesitan `profile_id` para vincularse a cursos específicos
2. **Calificaciones**: Historial completo con timestamps, solo cambios significativos
3. **Tareas grupales**: Inmutables una vez creadas
4. **Badges**: Acumulativos durante todo el periodo
5. **Auditoría**: Todo cambio debe registrarse, especialmente si lo hace el director

---

## 📋 Checklist de Implementación

- [ ] Crear tabla `evaluation_rubrics`
- [ ] Crear tabla `evaluation_scales`
- [ ] Crear tabla `subject_rubrics`
- [ ] Crear tabla `song_evaluations`
- [ ] Crear tabla `session_attendances`
- [ ] Crear tabla `session_comments`
- [ ] Crear tabla `session_assignments`
- [ ] Crear tabla `course_group_assignments`
- [ ] Crear tabla `badges`
- [ ] Crear tabla `student_badges`
- [ ] Modificar `period_dates` (agregar `profile_id`)
- [ ] Modificar `audit_logs` (agregar campos adicionales)
- [ ] Insertar datos predeterminados (rubros y escala)
- [ ] Crear políticas RLS para todas las tablas
- [ ] Crear índices necesarios
- [ ] Crear triggers para `updated_at`
