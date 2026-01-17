Especificaciones Técnicas: Módulo de Gestión de Horarios

1. Definición de la Entidad "Clase"

El sistema debe permitir al Director crear una Clase (o sesión recurrente) con los siguientes parámetros obligatorios:

- Nombre de la Clase: (Ej: "Piano Nivel 1").
- Profesor Responsable: Selección de la lista de usuarios con `role: 'teacher'` activos.
- Día de la Semana: Selección múltiple (Lunes a Domingo).
- Bloque Horario: Hora de inicio y hora de fin (Rango de 7:00 am a 10:00 pm).

2. Lógica de "Sistema de Choques" (Validación Crítica)

El sistema debe validar en tiempo real antes de guardar cualquier Clase o asignación:

- Conflicto del Profesor: Impedir la creación si el profesor seleccionado ya tiene otra clase asignada en el mismo día y rango horario (o con traslape parcial).
- Conflicto del Alumno: Al intentar asignar un alumno a una clase, el sistema debe alertar si el alumno ya está inscrito en otra actividad que ocurra al mismo tiempo.

3. Flujo de Asignación de Estudiantes a las Clases

El portal del Director debe incluir una interfaz de "Asignación Masiva":

- Selección de Clase: Lista desplegable de clases creadas.
- Filtro de Alumnos: Lista de estudiantes activos con checkbox para selección múltiple.
- Visualización Actual: Al seleccionar una clase, el sistema debe mostrar instantáneamente la lista de alumnos ya inscritos y el contador de estudiantes asignados a la clase actualmente.
- Acción de Asignar: Botón para vincular a los alumnos seleccionados a la clase.

4. Gestión y Edición

- Edición de Horarios: Si se modifica el horario de una clase existente, el sistema debe re-validar los choques tanto para el profesor como para todos los alumnos ya inscritos.
- Eliminación: Opción para eliminar una clase o desvincular alumnos individualmente.

- 5. Requerimientos de Base de Datos (Back-end)

- Multitenancy: Todas las clases y asignaciones deben estar ligadas al `academia_id` de la academia para asegurar que los horarios no se mezclen entre sedes.
- Tablas Necesarias: Implementación de la tabla `schedules`. La tabla relacional `enrollments` ya existe, pero puede que necesite ser modificada en sus columnas.

---

Excelente. Aquí tienes las reglas de seguridad RLS (Row Level Security) que el programador debe configurar en Supabase para proteger el módulo de horarios.

Estas reglas garantizan que, aunque la base de datos sea compartida, cada usuario solo acceda a lo que le corresponde según su rol y su academia (`tenant_id`).

---

Reglas de Seguridad (RLS) para Horarios

1. Tabla: `schedules` (Clases/Horarios)

- Directores: Tienen permisos totales (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) pero solo para filas donde el `academy_id` coincida con el suyo.
- Profesores: Solo pueden realizar `SELECT` de las clases donde su `user_id` aparezca como profesor asignado.
 Padres/Alumnos: Solo pueden realizar `SELECT` de las clases en las que el alumno asociado esté inscrito.

2. Tabla: `class_enrollments` (Inscripciones a Clases)

- Directores: Control total para inscribir o remover alumnos de su propia academia.
- Profesores: Permiso de solo lectura (`SELECT`) para ver la lista de alumnos inscritos en sus propias clases.
- Padres: Permiso de solo lectura (`SELECT`) para ver las inscripciones que pertenezcan exclusivamente a sus hijos.

---

Resumen del Modelo de Datos para el Programador

Para que la lógica de choques funcione, el programador debe implementar esta estructura:

- Entidad `schedules`: Debe incluir `day_of_week`, `start_time`, `end_time`, `teacher_id` y `academy_id`.
- Entidad `enrollments`: Debe vincular `student_id` con `schedule_id`.

Validación Técnica Sugerida

Si te parece conveniente, implementa una Función de Base de Datos (RPC) o un Trigger para la validación de choques. Al parecer eso es más seguro hacerlo directamente en la base de datos que en el código de la aplicación, ya que evita que dos registros se solapen por milisegundos de diferencia.