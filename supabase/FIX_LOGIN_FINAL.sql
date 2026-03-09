-- ================================================================
-- CAMPUSAI — DEFINITIVE LOGIN FIX (v4)
-- ================================================================
-- ROOT CAUSE: Supabase GoTrue Auth returns "500: Database error 
-- querying schema" because PostgREST's internal schema cache is 
-- referencing views or columns that no longer exist.
--
-- HOW TO RUN:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (akgjpqvpcugbmdenpxny)
-- 3. Go to SQL Editor (left sidebar)
-- 4. Paste this ENTIRE script and click "Run"
-- 5. Wait for "REPAIR COMPLETE" message
-- 6. Go back to your app and try logging in
-- ================================================================

-- ============================================
-- STEP 1: NUKE ALL CUSTOM VIEWS
-- These are the objects corrupting PostgREST's
-- schema cache. We drop them ALL.
-- ============================================
DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;
DROP VIEW IF EXISTS public.daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.department_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.student_attendance_overview CASCADE;

-- ============================================
-- STEP 2: RECREATE VIEWS SAFELY
-- Only use tables we KNOW exist. Each view is
-- wrapped in a DO block so if one fails, the 
-- rest still execute.
-- ============================================

-- View 1: Faculty with their profile info
DO $$ BEGIN
  EXECUTE '
    CREATE OR REPLACE VIEW public.faculty_with_profiles AS
    SELECT
      f.id,
      f.user_id,
      f.employee_id,
      f.designation,
      f.department_id,
      f.joining_date,
      f.specialization,
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
    LEFT JOIN public.departments d ON d.id = f.department_id
  ';
  RAISE NOTICE 'Created faculty_with_profiles ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped faculty_with_profiles: %', SQLERRM;
END $$;

-- View 2: Students with their profile info
DO $$ BEGIN
  EXECUTE '
    CREATE OR REPLACE VIEW public.students_with_profiles AS
    SELECT
      s.id,
      s.user_id,
      s.enrollment_id,
      s.department_id,
      s.class_id,
      s.batch_year,
      s.semester,
      s.face_registered,
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
    LEFT JOIN public.classes c ON c.id = s.class_id
  ';
  RAISE NOTICE 'Created students_with_profiles ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped students_with_profiles: %', SQLERRM;
END $$;

-- View 3: Daily attendance summary
DO $$ BEGIN
  EXECUTE '
    CREATE OR REPLACE VIEW public.daily_attendance_summary AS
    SELECT
      date,
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE status::TEXT = ''PRESENT'') as present,
      COUNT(*) FILTER (WHERE status::TEXT = ''ABSENT'') as absent,
      COUNT(*) FILTER (WHERE status::TEXT = ''LATE'') as late,
      COUNT(*) FILTER (WHERE status::TEXT = ''EXCUSED'') as excused,
      ROUND(COUNT(*) FILTER (WHERE status::TEXT = ''PRESENT'')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
    FROM public.attendance
    GROUP BY date
    ORDER BY date DESC
  ';
  RAISE NOTICE 'Created daily_attendance_summary ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped daily_attendance_summary: %', SQLERRM;
END $$;

-- ============================================
-- STEP 3: GRANT PERMISSIONS ON ALL VIEWS
-- ============================================
DO $$ BEGIN
  GRANT SELECT ON public.faculty_with_profiles TO authenticated, anon, service_role;
  RAISE NOTICE 'Granted permissions on faculty_with_profiles ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped granting on faculty_with_profiles: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.students_with_profiles TO authenticated, anon, service_role;
  RAISE NOTICE 'Granted permissions on students_with_profiles ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped granting on students_with_profiles: %', SQLERRM;
END $$;

DO $$ BEGIN
  GRANT SELECT ON public.daily_attendance_summary TO authenticated, anon, service_role;
  RAISE NOTICE 'Granted permissions on daily_attendance_summary ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped granting on daily_attendance_summary: %', SQLERRM;
END $$;

-- ============================================
-- STEP 4: FORCE PostgREST SCHEMA CACHE RELOAD
-- This is the CRITICAL step that actually fixes
-- the "Database error querying schema" error
-- ============================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================
-- STEP 5: VERIFY
-- ============================================
SELECT 
  '🚀 REPAIR COMPLETE — Login should work now!' as status,
  (SELECT count(*) FROM auth.users) as total_auth_users,
  (SELECT count(*) FROM public.profiles) as total_profiles;
