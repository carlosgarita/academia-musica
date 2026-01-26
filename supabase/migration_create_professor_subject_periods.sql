-- ============================================
-- Migration: Create professor_subject_periods (profesor–clase–periodo)
-- Para Aula: qué profesor imparte qué clase (subject) en qué periodo.
-- Execute in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.professor_subject_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES public.subjects ON DELETE CASCADE NOT NULL,
  period_id uuid REFERENCES public.periods ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, subject_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_professor_subject_periods_profile ON public.professor_subject_periods(profile_id);
CREATE INDEX IF NOT EXISTS idx_professor_subject_periods_subject ON public.professor_subject_periods(subject_id);
CREATE INDEX IF NOT EXISTS idx_professor_subject_periods_period ON public.professor_subject_periods(period_id);

-- Trigger
DROP TRIGGER IF EXISTS handle_updated_at ON public.professor_subject_periods;
-- (no updated_at column; omit trigger if not needed)

-- RLS
ALTER TABLE public.professor_subject_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can do everything with professor_subject_periods" ON public.professor_subject_periods;
DROP POLICY IF EXISTS "Directors can manage professor_subject_periods in their academy" ON public.professor_subject_periods;
DROP POLICY IF EXISTS "Professors can view own professor_subject_periods" ON public.professor_subject_periods;

CREATE POLICY "Super admins can do everything with professor_subject_periods"
  ON public.professor_subject_periods
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

CREATE POLICY "Directors can manage professor_subject_periods in their academy"
  ON public.professor_subject_periods
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.subjects s ON s.id = professor_subject_periods.subject_id
      WHERE p.id = auth.uid() AND p.role = 'director' AND p.academy_id = s.academy_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.subjects s ON s.id = professor_subject_periods.subject_id
      WHERE p.id = auth.uid() AND p.role = 'director' AND p.academy_id = s.academy_id
    )
  );

CREATE POLICY "Professors can view own professor_subject_periods"
  ON public.professor_subject_periods
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ============================================
-- Migration completed!
-- ============================================
