-- ============================================================
-- CAMPUSAI - AGGRESSIVE SCHEMA REPAIR
-- This script ensures all views are correctly created and 
-- visible to both authenticated and anonymous users.
-- ============================================================

-- 1. Ensure Search Path
SET search_path TO public;

-- 2. Clean up existing views just in case
DROP VIEW IF EXISTS public.timetable CASCADE;
DROP VIEW IF EXISTS public.timetable_with_relations CASCADE;
DROP VIEW IF EXISTS public.faculty_with_profiles CASCADE;
DROP VIEW IF EXISTS public.students_with_profiles CASCADE;

-- 3. Re-create timetable_entries as the base table (it should exist)
-- If it doesn't exist, this script will fail gracefully but 
-- we need to know.

-- 4. Re-create helper views with explicit schema references
CREATE OR REPLACE VIEW public.faculty_with_profiles AS
SELECT 
  f.*,
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
  s.*,
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

CREATE OR REPLACE VIEW public.timetable_with_relations AS
SELECT 
  te.*,
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

-- 5. Create the 'timetable' alias (the one causing the cache error)
CREATE OR REPLACE VIEW public.timetable AS 
SELECT * FROM public.timetable_entries;

-- 6. Grant PERMISSIONS to EVERYONE (very aggressive)
-- Views need explicit grants even if the table has them
GRANT SELECT ON public.faculty_with_profiles TO public, anon, authenticated, service_role;
GRANT SELECT ON public.students_with_profiles TO public, anon, authenticated, service_role;
GRANT SELECT ON public.timetable_with_relations TO public, anon, authenticated, service_role;
GRANT SELECT ON public.timetable TO public, anon, authenticated, service_role;

-- 7. Ensure Tables have basic select for RLS to work if needed
-- (Though RLS won't allow rows to be seen without policies)
GRANT SELECT ON public.profiles TO public, anon, authenticated, service_role;
GRANT SELECT ON public.timetable_entries TO public, anon, authenticated, service_role;

-- 8. Final Check Output
SELECT 'REPAIR COMPLETE' as status, 
       (SELECT count(*) FROM public.timetable_with_relations) as timetable_rows_visible_to_you;
