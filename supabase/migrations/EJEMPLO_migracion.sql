-- ============================================
-- Ejemplo de Migración
-- ============================================
-- Formato: YYYYMMDDHHMMSS_nombre_descriptivo.sql
-- Ejemplo: 20240115143000_add_new_column_to_students.sql
-- ============================================
-- Descripción: Breve descripción de qué hace esta migración
-- Autor: Tu nombre
-- Fecha: 2024-01-15
-- ============================================

BEGIN;

-- 1. Agregar nueva columna
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS middle_name TEXT CHECK (char_length(middle_name) <= 50);

-- 2. Crear índice si es necesario
CREATE INDEX IF NOT EXISTS idx_students_middle_name
  ON public.students(middle_name)
  WHERE middle_name IS NOT NULL;

-- 3. Comentario en la columna (opcional pero recomendado)
COMMENT ON COLUMN public.students.middle_name IS 'Segundo nombre del estudiante';

-- 4. Si necesitas actualizar datos existentes:
-- UPDATE public.students SET middle_name = '...' WHERE ...;

COMMIT;

-- ============================================
-- Rollback (para referencia, no se ejecuta automáticamente)
-- ============================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_students_middle_name;
-- ALTER TABLE public.students DROP COLUMN IF EXISTS middle_name;
-- COMMIT;
-- ============================================
