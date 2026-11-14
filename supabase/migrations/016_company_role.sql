-- =============================================================
-- 016 — COMPANY role + company attendance summary view
--
-- WHY
-- The Company portal (src--frontend/pages/company/*) needs to read an
-- attendance summary for the students/employees it places, but:
--   1. user_role has no COMPANY value, so a company account cannot be
--      distinguished from STUDENT/FACULTY/ADMIN at the database layer.
--   2. The attendance table and students table are locked down by RLS;
--      a company user has no legitimate direct read path.
--   3. Company pages previously queried non-existent columns
--      (profile_id/check_in/check_out on attendance) and fabricated
--      numbers. Both are fixed in the frontend; this migration provides
--      the single read model they consume.
--
-- WHAT
--   1. user_role gains COMPANY (idempotent ADD VALUE IF NOT EXISTS).
--   2. handle_new_user() is re-created with STUDENT-only signup semantics:
--
--      >>> raw_user_meta_data NEVER grants a privileged role <<<
--      raw_user_meta_data is client-controlled. EVERY signup becomes
--      STUDENT. There is deliberately NO FACULTY / CLASS_INCHARGE /
--      ADMIN / SUPER_ADMIN / COMPANY branch in this function — 013
--      introduced this lockdown, 014 accidentally re-trusted the
--      metadata role (v_role := COALESCE(raw_user_meta_data->>'role' …)),
--      and this migration removes that trust again. 014 is NOT modified;
--      this is a CREATE OR REPLACE on top of it.
--
--      Enrollment happens only when the signup explicitly names a valid
--      department_id; otherwise the profile row is created without a
--      students row (013 behaviour, kept intentionally). Enrollment ids
--      use 014's robust clock_timestamp()+md5 generation, not 013's
--      epoch-second value (collision-prone).
--
--      Staff and company accounts are provisioned OUT-OF-BAND, via the
--      service role (Supabase Dashboard SQL editor, or service-role
--      key against the REST/RPC API) — never via public self-signup.
--      Exact snippets (run as service role):
--
--        -- Promote an existing signup to COMPANY (profile-only: no
--        -- students / faculty / admins row — a company is not a person
--        -- on campus):
--        UPDATE public.profiles SET role = 'COMPANY' WHERE user_id = '<user-uuid>';
--
--        -- Promote an existing signup to FACULTY:
--        UPDATE public.profiles SET role = 'FACULTY' WHERE user_id = '<user-uuid>';
--        INSERT INTO public.faculty (user_id, employee_id, designation, department_id, joining_date)
--        VALUES ('<user-uuid>', 'EMP-<n>', 'Assistant Professor', '<department-uuid>', CURRENT_DATE)
--        ON CONFLICT (user_id) DO NOTHING;
--
--        -- Promote an existing signup to CLASS_INCHARGE (same shape):
--        UPDATE public.profiles SET role = 'CLASS_INCHARGE' WHERE user_id = '<user-uuid>';
--        INSERT INTO public.faculty (user_id, employee_id, designation, department_id, joining_date)
--        VALUES ('<user-uuid>', 'EMP-<n>', 'Class Incharge', '<department-uuid>', CURRENT_DATE)
--        ON CONFLICT (user_id) DO NOTHING;
--
--        -- Grant ADMIN (or SUPER_ADMIN):
--        UPDATE public.profiles SET role = 'ADMIN' WHERE user_id = '<user-uuid>';
--        INSERT INTO public.admins (user_id, permissions)
--        VALUES ('<user-uuid>', '{}'::text[])
--        ON CONFLICT (user_id) DO NOTHING;
--
--      No signup metadata path can reach any of these roles. If a
--      privileged account is needed, create the auth user first (normal
--      signup or admin API), then run the UPDATE/INSERT above.
--
--   3. public.company_attendance_summary — a security-definer view
--      (same semantics as the 015 analytics views) exposing ONLY
--      non-biometric attendance data:
--        date, status, method, first_name, last_name, enrollment_id,
--        department, class
--      Deliberately excluded: id, student_id, subject_id, face_data,
--      embeddings, emails, ip_address, device_info, raw location coords,
--      confidence_score, justification, blockchain fields.
--      Non-company callers get ZERO rows (WHERE get_user_role(auth.uid())
--      restricted to COMPANY/ADMIN/SUPER_ADMIN). Membership of the
--      company role therefore grants read access to aggregate attendance
--      identity (name + enrollment id) of students — provision company
--      accounts out-of-band only, never via public self-signup.
--
-- GRANTS
--   GRANT SELECT on the view to authenticated. Nothing else is granted;
--   no underlying table grants change.
--
-- Idempotent: safe to re-run.
-- =============================================================

-- 1. Enum value -------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COMPANY';

-- 2. handle_new_user: every signup is STUDENT; raw_user_meta_data never
--    grants a role -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name  TEXT;
    v_dept_id    UUID;
    v_class_id   UUID;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'full_name', 'User');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Member');

    -- Role is ALWAYS STUDENT at signup. raw_user_meta_data is
    -- client-controlled; a privileged role must NEVER come from it.
    -- Staff / company accounts are provisioned out-of-band (see header).
    INSERT INTO public.profiles (user_id, email, role, first_name, last_name, theme, is_active)
    VALUES (NEW.id, NEW.email, 'STUDENT'::user_role, v_first_name, v_last_name, 'dark', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Enroll only when the signup explicitly names a valid department.
    -- Never auto-assign a random department/class (wrong-tenant risk).
    BEGIN
        v_dept_id := (NEW.raw_user_meta_data->>'department_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_dept_id := NULL;
    END;
    IF v_dept_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.departments WHERE id = v_dept_id) THEN
        BEGIN
            v_class_id := (NEW.raw_user_meta_data->>'class_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_class_id := NULL;
        END;
        INSERT INTO public.students (user_id, enrollment_id, department_id, class_id, batch_year, semester)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'enrollment_id',
                     'STU' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6)),
            v_dept_id,
            v_class_id,
            extract(year from now())::int,
            1
        ) ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Company attendance summary view ----------------------------------
--    security_invoker = off: runs with the view owner's rights (same
--    semantics as the 015 analytics views) so it can bypass RLS on
--    attendance/students/profiles, gated solely by the caller-role
--    filter below. auth.uid() still resolves to the calling user.
CREATE OR REPLACE VIEW public.company_attendance_summary
WITH (security_invoker = off) AS
SELECT
  a.date,
  a.status,
  a.method,
  p.first_name,
  p.last_name,
  s.enrollment_id,
  d.name AS department,
  c.name AS class
FROM attendance a
JOIN students s   ON s.id = a.student_id
JOIN profiles p   ON p.user_id = s.user_id
JOIN departments d ON d.id = s.department_id
LEFT JOIN classes c ON c.id = s.class_id
WHERE get_user_role(auth.uid())::text IN ('COMPANY', 'ADMIN', 'SUPER_ADMIN');

GRANT SELECT ON public.company_attendance_summary TO authenticated;

-- NOTE: no biometric data crosses this view. face_data is never selected.
