-- ================================================================
-- CAMPUSAI DEFINITIVE SCHEMA FIX v3
-- Run this in Supabase SQL Editor → should fix login permanently
-- ================================================================

-- STEP 1: Drop EVERY custom view (the ones breaking PostgREST)
DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;
DROP VIEW IF EXISTS public.daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.department_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.student_attendance_overview CASCADE;

-- STEP 2: Check which table holds subjects/courses
-- This will tell us if it's "subjects" or "courses"
DO $$
DECLARE
  has_subjects BOOLEAN;
  has_courses BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'subjects'
  ) INTO has_subjects;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'courses'
  ) INTO has_courses;
  
  RAISE NOTICE 'has_subjects table: %, has_courses table: %', has_subjects, has_courses;
END $$;

-- STEP 3: Recreate views ONLY using guaranteed-safe simple columns
-- No JOINs to timetable_entries (which might reference missing tables)

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

CREATE OR REPLACE VIEW public.daily_attendance_summary AS
SELECT
  date,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE status::TEXT = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status::TEXT = 'LATE') as late,
  COUNT(*) FILTER (WHERE status::TEXT = 'EXCUSED') as excused,
  ROUND(COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM public.attendance
GROUP BY date
ORDER BY date DESC;

-- STEP 4: Grant permissions
GRANT SELECT ON public.faculty_with_profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.students_with_profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.daily_attendance_summary TO authenticated, anon, service_role;

-- STEP 5: Force cache reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- STEP 6: Confirm
SELECT 'SCHEMA FIX V3 COMPLETE - login should work NOW!' as result;
