-- Add mensualidad (monthly fee) to professor_subject_periods
-- Used as default when creating contracts for students enrolled in this course
ALTER TABLE public.professor_subject_periods
  ADD COLUMN IF NOT EXISTS mensualidad numeric(12, 2) CHECK (mensualidad IS NULL OR mensualidad >= 0);

COMMENT ON COLUMN public.professor_subject_periods.mensualidad IS 'Monto mensual del curso. Usado como valor por defecto en contratos.';
