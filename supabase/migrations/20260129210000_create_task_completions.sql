-- Migration: Create task_completions table
-- Allows guardians to mark tasks (individual or group) as completed for their students

-- Create the task_completions table
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_assignment_id UUID REFERENCES session_assignments(id) ON DELETE CASCADE,
  session_group_assignment_id UUID REFERENCES session_group_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Exactly one of session_assignment_id or session_group_assignment_id must be set
  CONSTRAINT task_completions_exactly_one_assignment CHECK (
    (session_assignment_id IS NOT NULL AND session_group_assignment_id IS NULL) OR
    (session_assignment_id IS NULL AND session_group_assignment_id IS NOT NULL)
  ),
  
  -- Unique constraint: one completion per assignment per student
  CONSTRAINT task_completions_unique_individual UNIQUE (session_assignment_id, student_id),
  CONSTRAINT task_completions_unique_group UNIQUE (session_group_assignment_id, student_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_completions_student_id ON task_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_completed_by ON task_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_task_completions_session_assignment ON task_completions(session_assignment_id) WHERE session_assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_completions_session_group_assignment ON task_completions(session_group_assignment_id) WHERE session_group_assignment_id IS NOT NULL;

-- Enable RLS
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Super admin: full access
CREATE POLICY "super_admin_task_completions_all"
  ON task_completions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Director: can view/manage completions for students in their academy
CREATE POLICY "director_task_completions_all"
  ON task_completions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN students s ON s.academy_id = p.academy_id
      WHERE p.id = auth.uid()
      AND p.role = 'director'
      AND s.id = task_completions.student_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN students s ON s.academy_id = p.academy_id
      WHERE p.id = auth.uid()
      AND p.role = 'director'
      AND s.id = task_completions.student_id
    )
  );

-- Professor: can view completions for students in their courses
CREATE POLICY "professor_task_completions_select"
  ON task_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN professor_subject_periods psp ON psp.profile_id = p.id
      JOIN course_registrations cr ON cr.period_id = psp.period_id AND cr.subject_id = psp.subject_id
      WHERE p.id = auth.uid()
      AND p.role = 'professor'
      AND cr.student_id = task_completions.student_id
      AND cr.deleted_at IS NULL
    )
  );

-- Guardian: can manage completions for their own students
CREATE POLICY "guardian_task_completions_all"
  ON task_completions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN guardian_students gs ON gs.guardian_id = p.id
      WHERE p.id = auth.uid()
      AND p.role = 'guardian'
      AND gs.student_id = task_completions.student_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN guardian_students gs ON gs.guardian_id = p.id
      WHERE p.id = auth.uid()
      AND p.role = 'guardian'
      AND gs.student_id = task_completions.student_id
    )
    AND completed_by = auth.uid()
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON task_completions TO authenticated;

-- Add comment
COMMENT ON TABLE task_completions IS 'Records when guardians mark tasks as completed for their students';
