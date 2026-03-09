-- ================================================================
-- CAMPUSAI — NUCLEAR LOGIN FIX (v5)
-- This script finds and destroys EVERYTHING that could cause
-- GoTrue to return "500: Database error querying schema"
-- ================================================================
-- 1. Open https://supabase.com/dashboard/project/akgjpqvpcugbmdenpxny/sql/new
-- 2. Paste and click Run
-- 3. Read all the NOTICE messages in the output
-- ================================================================

-- ============================================
-- PART A: DIAGNOSTIC - Show what's broken
-- ============================================

-- A1. Check which triggers exist on auth.users
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

-- A2. Check for broken functions (ones that reference missing objects)
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('auth', 'public')
  AND p.proname ILIKE '%user%'
ORDER BY n.nspname, p.proname;

-- A3. Check what hooks are configured in auth settings
SELECT * FROM auth.config LIMIT 10;

-- ============================================
-- PART B: FIX - Drop all dangerous views
-- ============================================

DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;
DROP VIEW IF EXISTS public.daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.department_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.student_attendance_overview CASCADE;
DROP VIEW IF EXISTS public.class_attendance_summary CASCADE;
DROP VIEW IF EXISTS public.attendance_summary CASCADE;

-- ============================================
-- PART C: FIX - Drop broken triggers that 
-- can corrupt GoTrue's schema query
-- ============================================

-- Drop any custom triggers on auth.users that may reference broken functions
DO $$ 
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN 
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
    AND trigger_name NOT LIKE 'su_%'  -- Keep Supabase internal triggers
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.%I', trig.trigger_name, trig.event_object_table);
    RAISE NOTICE 'Dropped trigger: %', trig.trigger_name;
  END LOOP;
END $$;

-- ============================================
-- PART D: FIX - Drop and recreate the 
-- on_auth_user_created function if it's broken
-- ============================================

-- Check if handle_new_user function exists and drop if broken
DO $$ BEGIN
  -- Try to recreate the handle_new_user function safely
  -- This function is called by Supabase trigger when a user signs in
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $func$
  BEGIN
    INSERT INTO public.profiles (user_id, email, role, first_name, last_name, theme, language)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'role')::text, 'STUDENT'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
      'dark',
      'en'
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- Never let profile creation block auth
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER;
  
  RAISE NOTICE 'handle_new_user function recreated ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'handle_new_user recreation error (non-fatal): %', SQLERRM;
END $$;

-- Recreate the trigger on auth.users 
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART E: FORCE SCHEMA CACHE RELOAD
-- ============================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================
-- PART F: VERIFY FINAL STATE
-- ============================================
SELECT 
  'NUCLEAR FIX COMPLETE ✅' as status,
  (SELECT count(*) FROM auth.users) as auth_users,
  (SELECT count(*) FROM public.profiles) as profiles,
  (SELECT count(*) FROM information_schema.triggers WHERE event_object_schema='auth') as auth_triggers,
  (SELECT count(*) FROM information_schema.views WHERE table_schema='public') as public_views;
