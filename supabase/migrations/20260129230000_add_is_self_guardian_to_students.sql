-- Add is_self_guardian column to students table
-- TRUE when the student is an adult and in charge of themselves (same person as guardian)
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS is_self_guardian boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.students.is_self_guardian IS 'True when the student is an adult and their own guardian (mayor de edad, a cargo de sí mismo)';
