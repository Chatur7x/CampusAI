-- ============================================================
-- CAMPUSAI - NUCLEAR SCHEMA REPAIR
-- This script fixes "Database error querying schema" by:
--   1. Dropping ALL custom views that might be broken
--   2. Recreating ONLY safe views from known-good table columns
--   3. Granting proper permissions
--   4. Reloading the PostgREST schema cache
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============ STEP 1: DROP ALL CUSTOM VIEWS ============
-- PostgREST fails to load its schema cache if ANY view references
-- a column or table that doesn't exist. We nuke everything first.
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;
DROP VIEW IF EXISTS public.daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.department_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.student_attendance_overview CASCADE;

-- ============ STEP 2: VERIFY BASE TABLES EXIST ============
-- If these queries fail, the base tables are missing
-- (but they shouldn't be since the migration ran)
DO $$
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles';
  IF NOT FOUND THEN RAISE EXCEPTION 'profiles table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faculty';
  IF NOT FOUND THEN RAISE EXCEPTION 'faculty table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students';
  IF NOT FOUND THEN RAISE EXCEPTION 'students table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments';
  IF NOT FOUND THEN RAISE EXCEPTION 'departments table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classes';
  IF NOT FOUND THEN RAISE EXCEPTION 'classes table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_entries';
  IF NOT FOUND THEN RAISE EXCEPTION 'timetable_entries table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects';
  IF NOT FOUND THEN RAISE EXCEPTION 'subjects table is missing!'; END IF;

  PERFORM 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance';
  IF NOT FOUND THEN RAISE EXCEPTION 'attendance table is missing!'; END IF;

  RAISE NOTICE 'All base tables verified OK.';
END $$;

-- ============ STEP 3: RECREATE VIEWS SAFELY ============
-- Each view only references columns we KNOW exist from 001_initial_schema.sql

-- 3a. Daily attendance summary
CREATE OR REPLACE VIEW public.daily_attendance_summary AS
SELECT
  date,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status = 'LATE') as late,
  COUNT(*) FILTER (WHERE status = 'EXCUSED') as excused,
  ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM public.attendance
GROUP BY date
ORDER BY date DESC;

-- 3b. Department attendance summary
CREATE OR REPLACE VIEW public.department_attendance_summary AS
SELECT
  d.id as department_id,
  d.name as department_name,
  COUNT(DISTINCT s.id) as total_students,
  COUNT(a.id) as total_attendance_records,
  ROUND(AVG(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) * 100, 2) as avg_attendance
FROM public.departments d
LEFT JOIN public.students s ON s.department_id = d.id
LEFT JOIN public.attendance a ON a.student_id = s.id
GROUP BY d.id, d.name;

-- 3c. Student attendance overview
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
FROM public.students s
JOIN public.profiles p ON p.user_id = s.user_id
JOIN public.departments d ON d.id = s.department_id
JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.attendance a ON a.student_id = s.id
GROUP BY s.id, s.enrollment_id, p.first_name, p.last_name, d.name, c.name;

-- 3d. Faculty with profiles (used by faculty list APIs)
CREATE OR REPLACE VIEW public.faculty_with_profiles AS
SELECT
  f.id,
  f.user_id,
  f.employee_id,
  f.designation,
  f.department_id,
  f.joining_date,
  f.specialization,
  f.qualifications,
  f.is_active,
  f.created_at,
  f.updated_at,
  p.first_name,
  p.last_name,
  p.avatar_url,
  d.name as department_name,
  d.code as department_code
FROM public.faculty f
LEFT JOIN public.profiles p ON p.user_id = f.user_id
LEFT JOIN public.departments d ON d.id = f.department_id;

-- 3e. Students with profiles (used by student list APIs)
CREATE OR REPLACE VIEW public.students_with_profiles AS
SELECT
  s.id,
  s.user_id,
  s.enrollment_id,
  s.department_id,
  s.class_id,
  s.batch_year,
  s.semester,
  s.face_data,
  s.face_registered,
  s.guardian_name,
  s.guardian_phone,
  s.guardian_email,
  s.is_active,
  s.created_at,
  s.updated_at,
  p.first_name,
  p.last_name,
  p.avatar_url,
  d.name as department_name,
  c.name as class_name,
  c.section as class_section
FROM public.students s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
LEFT JOIN public.departments d ON d.id = s.department_id
LEFT JOIN public.classes c ON c.id = s.class_id;

-- 3f. Timetable with relations (used by timetable APIs)
CREATE OR REPLACE VIEW public.timetable_with_relations AS
SELECT
  te.id,
  te.class_id,
  te.subject_id,
  te.faculty_id,
  te.day_of_week,
  te.start_time,
  te.end_time,
  te.room_number,
  te.is_active,
  te.created_at,
  te.updated_at,
  sub.name as subject_name,
  sub.code as subject_code,
  f.employee_id as faculty_employee_id,
  p.first_name as faculty_first_name,
  p.last_name as faculty_last_name,
  cl.name as class_name,
  cl.section as class_section
FROM public.timetable_entries te
JOIN public.subjects sub ON sub.id = te.subject_id
JOIN public.faculty f ON f.id = te.faculty_id
JOIN public.profiles p ON p.user_id = f.user_id
JOIN public.classes cl ON cl.id = te.class_id;

-- 3g. Timetable alias view
CREATE OR REPLACE VIEW public.timetable AS
SELECT * FROM public.timetable_entries;

-- ============ STEP 4: GRANT PERMISSIONS ============
-- PostgREST requires SELECT grants on views for authenticated users
GRANT SELECT ON public.daily_attendance_summary TO authenticated, anon, service_role;
GRANT SELECT ON public.department_attendance_summary TO authenticated, anon, service_role;
GRANT SELECT ON public.student_attendance_overview TO authenticated, anon, service_role;
GRANT SELECT ON public.faculty_with_profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.students_with_profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.timetable_with_relations TO authenticated, anon, service_role;
GRANT SELECT ON public.timetable TO authenticated, anon, service_role;

-- Also ensure base tables have SELECT for authenticated users
GRANT SELECT ON public.profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.faculty TO authenticated, anon, service_role;
GRANT SELECT ON public.students TO authenticated, anon, service_role;
GRANT SELECT ON public.departments TO authenticated, anon, service_role;
GRANT SELECT ON public.classes TO authenticated, anon, service_role;
GRANT SELECT ON public.courses TO authenticated, anon, service_role;
GRANT SELECT ON public.subjects TO authenticated, anon, service_role;
GRANT SELECT ON public.timetable_entries TO authenticated, anon, service_role;
GRANT SELECT ON public.attendance TO authenticated, anon, service_role;
GRANT SELECT ON public.leave_requests TO authenticated, anon, service_role;
GRANT SELECT ON public.notices TO authenticated, anon, service_role;
GRANT SELECT ON public.notifications TO authenticated, anon, service_role;
GRANT SELECT ON public.grades TO authenticated, anon, service_role;
GRANT SELECT ON public.security_alerts TO authenticated, anon, service_role;
GRANT SELECT ON public.audit_logs TO authenticated, anon, service_role;
GRANT SELECT ON public.system_settings TO authenticated, anon, service_role;

-- Grant INSERT/UPDATE/DELETE on tables that users write to
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.attendance TO authenticated;
GRANT INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT INSERT, UPDATE ON public.notifications TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.security_alerts TO authenticated;

-- ============ STEP 5: RELOAD POSTGREST SCHEMA CACHE ============
NOTIFY pgrst, 'reload schema';

-- ============ STEP 6: VERIFY ============
SELECT 'NUCLEAR REPAIR COMPLETE!' as status;
