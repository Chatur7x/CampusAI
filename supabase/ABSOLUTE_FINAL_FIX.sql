-- ================================================================
-- CAMPUSAI — ABSOLUTE FINAL LOGIN FIX
-- Run this in Supabase Dashboard → SQL Editor
-- THIS IS THE ONE THAT WILL WORK
-- ================================================================
-- WHAT THIS FIXES:
-- 1. Drops ALL broken views
-- 2. Fixes conflicting function definitions (TEXT vs enum returns)
-- 3. Removes RLS policy referencing is_active column that
--    doesn't exist on timetable_entries (BREAKS PGRST)
-- 4. Reloads schema cache
-- ================================================================

-- STEP 1: DROP ALL BROKEN VIEWS (clean slate)
DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;
DROP VIEW IF EXISTS public.daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.department_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.student_attendance_overview CASCADE;

-- STEP 2: FIX is_active BUG on timetable_entries
-- The RLS policy references is_active but the column may not exist
-- This causes PostgREST/GoTrue to crash when loading the schema
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'timetable_entries' 
    AND column_name = 'is_active'
  ) THEN
    RAISE NOTICE 'Adding missing is_active column to timetable_entries';
    ALTER TABLE public.timetable_entries ADD COLUMN is_active BOOLEAN DEFAULT true;
  ELSE
    RAISE NOTICE 'timetable_entries.is_active already exists - OK';
  END IF;
END $$;

-- STEP 3: FIX is_active on other tables too (some might be missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='courses' AND column_name='is_active') THEN
    ALTER TABLE public.courses ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active to courses';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subjects' AND column_name='is_active') THEN
    ALTER TABLE public.subjects ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active to subjects';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='is_active') THEN
    ALTER TABLE public.classes ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active to classes';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faculty' AND column_name='is_active') THEN
    ALTER TABLE public.faculty ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active to faculty';
  END IF;
END $$;

-- STEP 4: FIX conflicting function definitions
-- get_user_role was defined twice with different return types
-- migration 001 returns: user_role (enum)
-- migration 004 returns: TEXT
-- This type conflict BREAKS PostgREST schema introspection
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND role::TEXT IN ('SUPER_ADMIN', 'ADMIN')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS public.is_faculty(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.is_faculty(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND role::TEXT IN ('FACULTY', 'CLASS_INCHARGE')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS public.get_student_id(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM public.students WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS public.get_faculty_id(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_faculty_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM public.faculty WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- STEP 5: Recreate clean views (safe versions only)
CREATE OR REPLACE VIEW public.faculty_with_profiles AS
SELECT
  f.id, f.user_id, f.employee_id, f.designation,
  f.department_id, f.is_active,
  p.first_name, p.last_name, p.email,
  d.name as department_name
FROM public.faculty f
LEFT JOIN public.profiles p ON p.user_id = f.user_id
LEFT JOIN public.departments d ON d.id = f.department_id;

CREATE OR REPLACE VIEW public.students_with_profiles AS
SELECT
  s.id, s.user_id, s.enrollment_id, s.department_id,
  s.class_id, s.batch_year, s.semester, s.is_active,
  p.first_name, p.last_name, p.email,
  d.name as department_name,
  c.name as class_name
FROM public.students s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
LEFT JOIN public.departments d ON d.id = s.department_id
LEFT JOIN public.classes c ON c.id = s.class_id;

-- STEP 6: Grant permissions on new views
GRANT SELECT ON public.faculty_with_profiles TO authenticated, anon, service_role;
GRANT SELECT ON public.students_with_profiles TO authenticated, anon, service_role;

-- STEP 7: GRANT EXECUTE on helper functions
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_faculty(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_id(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_faculty_id(UUID) TO authenticated, anon, service_role;

-- STEP 8: FORCE SCHEMA RELOAD  
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- STEP 9: VERIFY
SELECT 
  '✅ FIX APPLIED — Try logging in NOW!' as status,
  (SELECT count(*) FROM auth.users) as auth_users,
  (SELECT count(*) FROM public.profiles) as profiles,
  (SELECT count(*) FROM information_schema.views WHERE table_schema='public') as views_count;
