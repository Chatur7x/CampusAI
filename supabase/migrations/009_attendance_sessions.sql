-- =====================================================
-- MIGRATION 009: ATTENDANCE SESSIONS (ANTI-PROXY)
-- Tracking faculty-initiated attendance windows with
-- geo-fencing and dynamic session codes.
-- =====================================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id         UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    class_id           UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id          UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    timetable_entry_id UUID REFERENCES timetable_entries(id) ON DELETE SET NULL,
    
    session_code       TEXT NOT NULL,            -- 6-digit dynamic code
    latitude           DOUBLE PRECISION NOT NULL, -- Faculty's current location (classroom center)
    longitude          DOUBLE PRECISION NOT NULL,
    radius_meters      INT NOT NULL DEFAULT 100,  -- Allowed radius (default 100m)
    
    is_active          BOOLEAN NOT NULL DEFAULT true,
    starts_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL,      -- Usually starts_at + 2 to 5 minutes
    
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by code and active status
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_code ON attendance_sessions(session_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty ON attendance_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id);

-- Update updated_at trigger
CREATE TRIGGER update_attendance_sessions_updated_at 
    BEFORE UPDATE ON attendance_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Faculty can manage their own sessions
CREATE POLICY "faculty_manage_sessions" ON attendance_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM faculty 
            WHERE id = faculty_id AND user_id = auth.uid()
        )
    );

-- Students can view active sessions for their class
CREATE POLICY "students_view_sessions" ON attendance_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE class_id = attendance_sessions.class_id AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Add foreign key to geo_verifications to link with session
ALTER TABLE geo_verifications ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES attendance_sessions(id);

-- Update security_dashboard_stats view to include proxy attempts (optional enhancement)
-- Not strictly needed for the migration but good for visibility later.
