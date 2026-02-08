-- Restore unique constraint for song_evaluations (replaces the one dropped with period_date_id)
-- Ensures one evaluation per (registration, song, session, rubric)
CREATE UNIQUE INDEX IF NOT EXISTS idx_song_evaluations_unique_session
  ON public.song_evaluations(course_registration_id, song_id, course_session_id, rubric_id)
  WHERE course_session_id IS NOT NULL;
