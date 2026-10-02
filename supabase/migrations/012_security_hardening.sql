-- =============================================================
-- 012_security_hardening.sql — live-verified RLS lockdown
-- Verified against prod (akgjpqvpcugbmdenpxny) on 2026-09-24:
--   * notices has target_roles/is_active/expiry_date
--   * face_embeddings never read directly by frontend (service key only)
--   * conversations already hardened live — untouched here
-- Idempotent: safe to re-run. One transaction.
-- =============================================================

-- ── 1. NOTICES: drop fail-open anon read, add audience-aware read ──
DROP POLICY IF EXISTS "notices_anyone_read" ON public.notices;
DROP POLICY IF EXISTS "notices_audience_read" ON public.notices;
CREATE POLICY "notices_audience_read" ON public.notices
  FOR SELECT TO authenticated USING (
    (is_active IS NOT DISTINCT FROM TRUE)
    AND (expiry_date IS NULL OR expiry_date > NOW())
    AND (
      target_roles IS NULL
      OR cardinality(target_roles) = 0
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.role = ANY (notices.target_roles)
      )
    )
  );

-- ── 2. Audit/security INSERTs: service_role only (was WITH CHECK true) ──
DROP POLICY IF EXISTS "service_insert_login_history" ON public.login_history;
CREATE POLICY "service_insert_login_history" ON public.login_history
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_security_events" ON public.security_events;
CREATE POLICY "service_insert_security_events" ON public.security_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_geo" ON public.geo_verifications;
CREATE POLICY "service_insert_geo" ON public.geo_verifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_api_log" ON public.api_request_log;
CREATE POLICY "service_insert_api_log" ON public.api_request_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_attendance" ON public.attendance;
CREATE POLICY "service_insert_attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_notifications" ON public.notifications;
CREATE POLICY "service_insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ── 3. TIMETABLE: authenticated users only (was anon-readable) ──
DROP POLICY IF EXISTS "timetable_anyone_read" ON public.timetable_entries;
CREATE POLICY "timetable_anyone_read" ON public.timetable_entries
  FOR SELECT TO authenticated USING (true);

-- ── 4. DEPARTMENTS: enable RLS (was fully open; existing policies preserved) ──
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ── 5. PASSWORD_RESETS: enable RLS + service-only (was fully open, 0 rows) ──
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_all_password_resets" ON public.password_resets;
CREATE POLICY "service_all_password_resets" ON public.password_resets
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 6. FACE_EMBEDDINGS: drop public ALL USING true, service + self-read ──
DROP POLICY IF EXISTS "Service Role Full Access Face Embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "service_all_face_embeddings" ON public.face_embeddings;
DROP POLICY IF EXISTS "students_self_read_face_embeddings" ON public.face_embeddings;
CREATE POLICY "service_all_face_embeddings" ON public.face_embeddings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "students_self_read_face_embeddings" ON public.face_embeddings
  FOR SELECT TO authenticated USING (
    student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  );

-- ── 7. Hot-path indexes (IF NOT EXISTS) ──
CREATE INDEX IF NOT EXISTS idx_notices_active_expiry
  ON public.notices (is_active, expiry_date DESC) WHERE is_active IS NOT DISTINCT FROM TRUE;
CREATE INDEX IF NOT EXISTS idx_geo_verifications_user_created
  ON public.geo_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date_status
  ON public.attendance (student_id, date DESC, status);
