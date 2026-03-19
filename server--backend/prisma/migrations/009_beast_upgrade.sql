-- =============================================================
-- CampusAI — Beast Upgrade Migration
-- 009_beast_upgrade.sql
-- =============================================================
-- Fixes:
--   1. attendance_sessions table (MISSING)
--   2. attendance.session_id column (MISSING)
--   3. conversations — add title, type, created_by, name
--   4. conversation_participants — add role column
--   5. messages — add is_read, read_at, reply_to_id, message_type
--   6. pgvector extension + face_embeddings vector column
--   7. students — add missing indexes
--   8. Performance indexes across all hot tables
--   9. RLS policies for missing tables
--  10. attendance_sessions RLS
--  11. system_settings seed (attendance weights, campus config)
--  12. notifications — missing service role policy
--  13. grades — missing RLS
--  14. subjects — missing service role insert
--  15. timetable_entries — missing service role insert
--  16. security_events — missing resolved_by FK
--  17. Cleanup: drop unused columns / fix nullability
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. pgvector extension (for real similarity search)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────
-- 2. attendance_sessions (was MISSING from DB)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id          UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id           UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  timetable_entry_id  UUID REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
  session_code        TEXT NOT NULL UNIQUE,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  radius_meters       DOUBLE PRECISION DEFAULT 100,
  is_active           BOOLEAN DEFAULT true,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class    ON public.attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty  ON public.attendance_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_code     ON public.attendance_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_active   ON public.attendance_sessions(is_active) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────
-- 3. attendance — add session_id FK (was MISSING)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id) WHERE session_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. conversations — upgrade to full-featured chat
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title        TEXT,
  ADD COLUMN IF NOT EXISTS type         TEXT NOT NULL DEFAULT 'DIRECT' CHECK (type IN ('DIRECT', 'GROUP', 'CLASS', 'ANNOUNCEMENT')),
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id     UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_conversations_created_by    ON public.conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_class         ON public.conversations(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message  ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type          ON public.conversations(type);

-- ─────────────────────────────────────────────────────────────
-- 5. conversation_participants — add role + unread count
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS role         TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 6. messages — add read tracking, reply threading, type
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_read      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_to_id  UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'FILE', 'SYSTEM'));

CREATE INDEX IF NOT EXISTS idx_messages_sender      ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read     ON public.messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_reply       ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Function to auto-update conversations.last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_last_message ON public.messages;
CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ─────────────────────────────────────────────────────────────
-- 7. pgvector — add proper vector column to face_embeddings
-- ─────────────────────────────────────────────────────────────
-- Add 512-dim vector column (ArcFace standard)
ALTER TABLE public.face_embeddings
  ADD COLUMN IF NOT EXISTS embedding_vec vector(512);

-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_face_embeddings_hnsw
  ON public.face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Function: search similar faces using cosine similarity
CREATE OR REPLACE FUNCTION public.search_similar_faces(
  query_embedding vector(512),
  similarity_threshold FLOAT DEFAULT 0.55,
  max_results INT DEFAULT 5
)
RETURNS TABLE (
  student_id UUID,
  similarity FLOAT,
  embedding_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.student_id,
    (1 - (fe.embedding_vec <=> query_embedding))::FLOAT AS similarity,
    fe.id AS embedding_id
  FROM public.face_embeddings fe
  WHERE fe.embedding_vec IS NOT NULL
    AND (1 - (fe.embedding_vec <=> query_embedding)) >= similarity_threshold
  ORDER BY fe.embedding_vec <=> query_embedding
  LIMIT max_results;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. Performance indexes (missing from current DB)
-- ─────────────────────────────────────────────────────────────

-- attendance — subject index was missing
CREATE INDEX IF NOT EXISTS idx_attendance_subject        ON public.attendance(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_method         ON public.attendance(method);
CREATE INDEX IF NOT EXISTS idx_attendance_timetable      ON public.attendance(timetable_entry_id) WHERE timetable_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_verified_by    ON public.attendance(verified_by) WHERE verified_by IS NOT NULL;

-- students
CREATE INDEX IF NOT EXISTS idx_students_active           ON public.students(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_students_batch_year       ON public.students(batch_year);
CREATE INDEX IF NOT EXISTS idx_students_semester         ON public.students(semester);
CREATE INDEX IF NOT EXISTS idx_students_face_registered  ON public.students(face_registered) WHERE face_registered = true;

-- faculty
CREATE INDEX IF NOT EXISTS idx_faculty_active            ON public.faculty(is_active) WHERE is_active = true;

-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates      ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved   ON public.leave_requests(approved_by) WHERE approved_by IS NOT NULL;

-- notices
CREATE INDEX IF NOT EXISTS idx_notices_active_pinned     ON public.notices(is_active, is_pinned) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notices_expiry            ON public.notices(expiry_date) WHERE expiry_date IS NOT NULL;

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread      ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type        ON public.notifications(type);

-- security_events
CREATE INDEX IF NOT EXISTS idx_security_events_resolved  ON public.security_events(resolved, created_at DESC) WHERE resolved = false;

-- login_history
CREATE INDEX IF NOT EXISTS idx_login_history_status      ON public.login_history(status);
CREATE INDEX IF NOT EXISTS idx_login_history_device      ON public.login_history(device_hash) WHERE device_hash IS NOT NULL;

-- timetable_entries
CREATE INDEX IF NOT EXISTS idx_timetable_day             ON public.timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_active          ON public.timetable_entries(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_timetable_subject         ON public.timetable_entries(subject_id);

-- grades
CREATE INDEX IF NOT EXISTS idx_grades_subject            ON public.grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_semester           ON public.grades(semester);

-- profiles — full text search on name
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — attendance_sessions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faculty_own_sessions" ON public.attendance_sessions
  FOR ALL USING (
    faculty_id IN (
      SELECT id FROM public.faculty WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "students_read_active_sessions" ON public.attendance_sessions
  FOR SELECT USING (is_active = true);

CREATE POLICY "admin_all_sessions" ON public.attendance_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 10. RLS — conversations (upgrade existing)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_participant" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;

CREATE POLICY "conversations_participant_read" ON public.conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "conversations_create" ON public.conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "conversations_admin_all" ON public.conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 11. RLS — messages (upgrade existing)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_self_read" ON public.messages;
DROP POLICY IF EXISTS "messages_self_send" ON public.messages;

CREATE POLICY "messages_participant_read" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "messages_participant_send" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "messages_own_edit" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_own_delete" ON public.messages
  FOR DELETE USING (sender_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 12. RLS — grades
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grades_self_read" ON public.grades
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "grades_faculty_read" ON public.grades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "grades_faculty_write" ON public.grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 13. RLS — attendance (add missing policies)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'attendance_self_read'
  ) THEN
    CREATE POLICY "attendance_self_read" ON public.attendance
      FOR SELECT USING (
        student_id IN (
          SELECT id FROM public.students WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'attendance_faculty_all'
  ) THEN
    CREATE POLICY "attendance_faculty_all" ON public.attendance
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND role IN ('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'service_insert_attendance'
  ) THEN
    CREATE POLICY "service_insert_attendance" ON public.attendance
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 14. RLS — notifications (add service role insert)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'service_insert_notifications'
  ) THEN
    CREATE POLICY "service_insert_notifications" ON public.notifications
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 15. RLS — subjects, timetable_entries (service role write)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'admin_manage_subjects'
  ) THEN
    CREATE POLICY "admin_manage_subjects" ON public.subjects
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'timetable_entries' AND policyname = 'admin_manage_timetable'
  ) THEN
    CREATE POLICY "admin_manage_timetable" ON public.timetable_entries
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'FACULTY', 'CLASS_INCHARGE')
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 16. RLS — leave_requests (students can insert their own)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'leave_self_read'
  ) THEN
    CREATE POLICY "leave_self_read" ON public.leave_requests
      FOR SELECT USING (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'leave_self_insert'
  ) THEN
    CREATE POLICY "leave_self_insert" ON public.leave_requests
      FOR INSERT WITH CHECK (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'leave_faculty_manage'
  ) THEN
    CREATE POLICY "leave_faculty_manage" ON public.leave_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND role IN ('FACULTY', 'CLASS_INCHARGE', 'ADMIN', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 17. System settings seed (default config values)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value, description, category, is_public) VALUES
  ('attendance_weights',
   '{"CLASS": 1, "LAB": 2}',
   'Weight multipliers for different session types in attendance calculation',
   'attendance', true),
  ('attendance_minimum_percentage',
   '75',
   'Minimum attendance percentage required',
   'attendance', true),
  ('face_confidence_threshold',
   '0.6',
   'Minimum face recognition confidence score (0-1)',
   'ai', false),
  ('face_liveness_enabled',
   'true',
   'Enable liveness detection for face attendance',
   'ai', false),
  ('geo_validation_enabled',
   'true',
   'Enable geolocation validation for attendance',
   'attendance', false),
  ('campus_latitude',
   '17.335',
   'Campus center latitude (Anurag University)',
   'geo', false),
  ('campus_longitude',
   '78.714',
   'Campus center longitude (Anurag University)',
   'geo', false),
  ('campus_radius_meters',
   '500',
   'Allowed radius from campus center for attendance (meters)',
   'geo', true),
  ('max_login_attempts',
   '5',
   'Maximum failed login attempts before lockout',
   'security', false),
  ('lockout_duration_minutes',
   '30',
   'Account lockout duration in minutes',
   'security', false),
  ('session_timeout_hours',
   '24',
   'JWT session timeout in hours',
   'security', false),
  ('blockchain_enabled',
   'true',
   'Enable blockchain hash verification for attendance',
   'blockchain', true),
  ('qr_session_duration_minutes',
   '15',
   'QR code attendance session duration in minutes',
   'attendance', true),
  ('notification_email_enabled',
   'false',
   'Enable email notifications',
   'notifications', false),
  ('notification_push_enabled',
   'false',
   'Enable push notifications',
   'notifications', false)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 18. Realtime — enable for key tables
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ─────────────────────────────────────────────────────────────
-- 19. Helper functions
-- ─────────────────────────────────────────────────────────────

-- Get student attendance percentage
CREATE OR REPLACE FUNCTION public.get_student_attendance_percentage(p_student_id UUID)
RETURNS FLOAT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INT;
  v_present INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('PRESENT', 'EXCUSED'))
  INTO v_total, v_present
  FROM public.attendance
  WHERE student_id = p_student_id;
  
  IF v_total = 0 THEN RETURN 0; END IF;
  RETURN ROUND((v_present::FLOAT / v_total::FLOAT * 100)::NUMERIC, 2)::FLOAT;
END;
$$;

-- Get at-risk students (below threshold)
CREATE OR REPLACE FUNCTION public.get_at_risk_students(p_threshold FLOAT DEFAULT 75.0)
RETURNS TABLE (
  student_id UUID,
  enrollment_id TEXT,
  first_name TEXT,
  last_name TEXT,
  percentage FLOAT,
  total_classes INT,
  attended INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.enrollment_id,
    p.first_name,
    p.last_name,
    ROUND((COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'EXCUSED'))::FLOAT / NULLIF(COUNT(a.id), 0)::FLOAT * 100)::NUMERIC, 2)::FLOAT AS percentage,
    COUNT(a.id)::INT AS total_classes,
    COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'EXCUSED'))::INT AS attended
  FROM public.students s
  JOIN public.profiles p ON s.user_id = p.user_id
  LEFT JOIN public.attendance a ON s.id = a.student_id
  GROUP BY s.id, s.enrollment_id, p.first_name, p.last_name
  HAVING ROUND((COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'EXCUSED'))::FLOAT / NULLIF(COUNT(a.id), 0)::FLOAT * 100)::NUMERIC, 2)::FLOAT < p_threshold
  ORDER BY percentage ASC;
END;
$$;

-- Auto-mark absent for sessions that expired without attendance
CREATE OR REPLACE FUNCTION public.auto_mark_absent_expired_sessions()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT := 0;
  v_session RECORD;
  v_student RECORD;
BEGIN
  FOR v_session IN
    SELECT s.*, c.id as class_id_val
    FROM public.attendance_sessions s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.is_active = false
      AND s.expires_at < now() - INTERVAL '1 hour'
      AND s.expires_at > now() - INTERVAL '24 hours'
  LOOP
    FOR v_student IN
      SELECT id FROM public.students WHERE class_id = v_session.class_id_val AND is_active = true
    LOOP
      INSERT INTO public.attendance (student_id, date, status, method, session_id, justification)
      VALUES (v_student.id, v_session.expires_at::DATE, 'ABSENT', 'MANUAL', v_session.id, 'Auto-marked: session expired')
      ON CONFLICT (student_id, date, subject_id) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 20. Updated_at trigger for attendance_sessions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sessions_updated_at ON public.attendance_sessions;
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────
