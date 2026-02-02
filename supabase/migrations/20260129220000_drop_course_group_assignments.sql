-- Remove unused table: course_group_assignments
-- Tareas grupales se gestionan por sesión con session_group_assignments

DROP TABLE IF EXISTS public.course_group_assignments CASCADE;
