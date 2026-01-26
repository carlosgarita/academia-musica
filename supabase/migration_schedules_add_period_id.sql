-- ============================================
-- Migration: Add period_id to schedules
-- Vincular horarios (turnos) al periodo/curso
-- ============================================

-- Add period_id (nullable for existing rows; new cursos will set it)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedules_period_id ON public.schedules(period_id) WHERE period_id IS NOT NULL;
