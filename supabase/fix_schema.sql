-- ============================================================
-- CAMPUSAI - SCHEMA FIXES & SYNCHRONIZATION (REVISED)
-- ============================================================

-- 1. Missing Tables
CREATE TABLE IF NOT EXISTS public.blockchain_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_index INTEGER UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  data TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Repair is_active defaults (prevents hidden data due to RLS)
ALTER TABLE departments ALTER COLUMN is_active SET DEFAULT true;
UPDATE departments SET is_active = true WHERE is_active IS NULL;

ALTER TABLE faculty ALTER COLUMN is_active SET DEFAULT true;
UPDATE faculty SET is_active = true WHERE is_active IS NULL;

ALTER TABLE students ALTER COLUMN is_active SET DEFAULT true;
UPDATE students SET is_active = true WHERE is_active IS NULL;

ALTER TABLE classes ALTER COLUMN is_active SET DEFAULT true;
UPDATE classes SET is_active = true WHERE is_active IS NULL;

ALTER TABLE courses ALTER COLUMN is_active SET DEFAULT true;
UPDATE courses SET is_active = true WHERE is_active IS NULL;

-- 3. Robust Views for Frontend Data Access
-- These views join profiles automatically using user_id equality

-- Faculty with profiles
CREATE OR REPLACE VIEW public.faculty_with_profiles AS
SELECT 
  f.*,
  p.first_name,
  p.last_name,
  p.avatar_url,
  d.name as department_name,
  d.code as department_code
FROM faculty f
LEFT JOIN profiles p ON p.user_id = f.user_id
LEFT JOIN departments d ON d.id = f.department_id;

-- Students with profiles and classes
CREATE OR REPLACE VIEW public.students_with_profiles AS
SELECT 
  s.*,
  p.first_name,
  p.last_name,
  p.avatar_url,
  d.name as department_name,
  c.name as class_name,
  c.section as class_section
FROM students s
LEFT JOIN profiles p ON p.user_id = s.user_id
LEFT JOIN departments d ON d.id = s.department_id
LEFT JOIN classes c ON c.id = s.class_id;

-- Timetable with full relations
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
FROM timetable_entries te
JOIN subjects sub ON sub.id = te.subject_id
JOIN faculty f ON f.id = te.faculty_id
JOIN profiles p ON p.user_id = f.user_id
JOIN classes cl ON cl.id = te.class_id;

-- 4. Backwards compatibility alias
CREATE OR REPLACE VIEW public.timetable AS SELECT * FROM public.timetable_entries;

-- 5. RLS & Permissions for Views
-- Note: Views in Supabase/PostgreSQL usually inherit permissions or need explicit ones
GRANT SELECT ON public.faculty_with_profiles TO authenticated, service_role;
GRANT SELECT ON public.students_with_profiles TO authenticated, service_role;
GRANT SELECT ON public.timetable_with_relations TO authenticated, service_role;
GRANT SELECT ON public.timetable TO authenticated, service_role;
GRANT SELECT ON public.blockchain_hashes TO authenticated, service_role;

-- Ensure anyone can read basic data if active
ALTER TABLE blockchain_hashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Blockchain" ON blockchain_hashes FOR SELECT USING (true);
