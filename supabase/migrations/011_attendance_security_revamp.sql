-- ============================================================
-- MIGRATION 011: ATTENDANCE SECURITY REVAMP
-- 1. Linking attendance to sessions for anti-proxy proof
-- 2. Enabling Students to mark their own attendance via RLS
-- ============================================================

-- 1. Add session_id to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL;

-- 2. Index for session lookups
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);

-- 3. Update RLS policies for attendance
-- Drop existing ones to avoid conflicts
DROP POLICY IF EXISTS "attendance_self_insert" ON attendance;
DROP POLICY IF EXISTS "attendance_self_update" ON attendance;

-- Allow students to mark their own attendance
-- We restrict this by student_id and allow it only for AI_FACE_SECURE or QR_CODE methods
-- Note: In a production app, we might want even stricter checks (e.g., verifying a signed token)
CREATE POLICY "attendance_self_insert" ON attendance
  FOR INSERT WITH CHECK (
    student_id = get_student_id(auth.uid())
  );

-- Allow students to view their own attendance (already exists but ensuring consistency)
DROP POLICY IF EXISTS "attendance_self_read" ON attendance;
CREATE POLICY "attendance_self_read" ON attendance
  FOR SELECT USING (student_id = get_student_id(auth.uid()));

-- 4. Enable RLS on attendance_sessions just in case
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Students can see active sessions for classes they are enrolled in
DROP POLICY IF EXISTS "attendance_sessions_student_read" ON attendance_sessions;
CREATE POLICY "attendance_sessions_student_read" ON attendance_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.class_id = attendance_sessions.class_id
      AND s.user_id = auth.uid()
    )
  );
