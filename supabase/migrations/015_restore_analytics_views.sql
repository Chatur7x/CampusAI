-- =============================================================
-- 015 — restore missing analytics views
--
-- WHY
-- `department_attendance_summary` and `student_attendance_overview` are declared
-- in 001_initial_schema.sql but are ABSENT from the live database, while
-- `daily_attendance_summary` is present. Verified against the live project.
--
-- 004_fix_camelcase_schema.sql also tries to create all three, but against
-- camelCase columns, so its CREATE VIEW statements fail and the views stay
-- missing. Live `public` columns are in fact snake_case, so 001's definitions
-- are the correct ones.
--
-- IMPACT
-- These views are queried in production code and were silently failing:
--   supabase/functions/analytics/index.ts  (department_attendance_summary x2,
--                                           student_attendance_overview)
--   supabase/functions/notifications/index.ts (student_attendance_overview)
--   src--frontend/lib/api.ts                (all three)
-- Analytics dashboards and at-risk-student reporting return empty/errors.
--
-- The definitions below are taken verbatim from 001_initial_schema.sql, so the
-- column names match what every consumer already selects:
--   total_records, present, absent, late, excused, attendance_percentage
--   department_id, department_name, total_students, total_attendance_records,
--   avg_attendance
--   student_id, enrollment_id, first_name, last_name, department, class_name,
--   total_classes, present, absent, attendance_percentage
-- =============================================================

CREATE OR REPLACE VIEW public.daily_attendance_summary AS
SELECT
  date,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status = 'LATE') as late,
  COUNT(*) FILTER (WHERE status = 'EXCUSED') as excused,
  ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM attendance
GROUP BY date
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.department_attendance_summary AS
SELECT
  d.id as department_id,
  d.name as department_name,
  COUNT(DISTINCT s.id) as total_students,
  COUNT(a.id) as total_attendance_records,
  ROUND(AVG(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) * 100, 2) as avg_attendance
FROM departments d
LEFT JOIN students s ON s.department_id = d.id
LEFT JOIN attendance a ON a.student_id = s.id
GROUP BY d.id, d.name;

CREATE OR REPLACE VIEW public.student_attendance_overview AS
SELECT
  s.id as student_id,
  s.enrollment_id,
  p.first_name,
  p.last_name,
  d.name as department,
  c.name as class_name,
  COUNT(a.id) as total_classes,
  COUNT(*) FILTER (WHERE a.status = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absent,
  ROUND(COUNT(*) FILTER (WHERE a.status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM students s
JOIN profiles p ON p.user_id = s.user_id
JOIN departments d ON d.id = s.department_id
JOIN classes c ON c.id = s.class_id
LEFT JOIN attendance a ON a.student_id = s.id
GROUP BY s.id, s.enrollment_id, p.first_name, p.last_name, d.name, c.name;

-- Consumers read through PostgREST as authenticated/service_role.
GRANT SELECT ON public.daily_attendance_summary        TO authenticated, anon, service_role;
GRANT SELECT ON public.department_attendance_summary   TO authenticated, anon, service_role;
GRANT SELECT ON public.student_attendance_overview     TO authenticated, anon, service_role;

-- NOTE: student_attendance_overview deliberately exposes no biometric data.
-- students.face_data (the face embedding) is never selected, so the Company
-- portal can read attendance aggregates without ever seeing face vectors.
