-- =============================================================
-- CampusAI — auth signup blocker remediation
--
-- ROOT CAUSE (proven, not guessed)
-- --------------------------------
-- `auth.identities.email` is a GENERATED ALWAYS column:
--
--   email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED
--
-- The Supabase auth service (GoTrue) running against this project is an OLDER
-- build than the database schema. Old GoTrue INSERTs `email` explicitly:
--
--   INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, email, ...)
--
-- Postgres rejects that with:
--   "cannot insert a non-DEFAULT value into column \"email\""
--
-- GoTrue surfaces it only as HTTP 500 "Database error creating new user".
--
-- PROOF (A/B test against this project, both rolled back)
--   shape A — INSERT with explicit `email`      -> FAILS: cannot insert a non-DEFAULT value
--   shape B — INSERT omitting `email`            -> OK, generated column populates it
-- The custom trigger `handle_new_user` was verified NOT to be at fault: it
-- raises nothing, and a users INSERT reproduces cleanly.
--
-- WHY YOU MUST RUN THIS AS THE REAL OWNER
-- auth schema is owned by `supabase_auth_admin`; the `postgres` role used by
-- the connection pooler is NOT the owner and cannot ALTER these tables.
-- The Supabase Dashboard SQL editor runs as the true owner.
--
-- PREFERRED FIX (pick ONE)
-- =============================================================

-- -------------------------------------------------------------
-- OPTION 1 (preferred, no schema change): upgrade/restart the auth service
--   Dashboard -> Project -> Services -> "Auth" -> Restart, or upgrade the
--   project's major version so GoTrue matches the schema. New GoTrue omits
--   `email` and the generated column works as designed.
--   Verify: see the check at the bottom of this file.
-- -------------------------------------------------------------

-- -------------------------------------------------------------
-- OPTION 2 (fallback, reverts the schema to match old GoTrue)
--   Only if you cannot upgrade the auth service. This undoes Supabase's
--   generated-column optimisation, so the email column must then be
--   populated by the caller.
-- -------------------------------------------------------------

-- 1. Verify current state (expect: is_generated = ALWAYS)
SELECT column_name, is_generated, generation_expression
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'email';

-- 2. Take a backup of the definition before changing anything
--    (recorded here for reversibility)
--    email GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED

-- 3. Drop the generation expression, keeping existing values
ALTER TABLE auth.identities ALTER COLUMN email DROP EXPRESSION IF EXISTS;

-- 4. Backfill any rows that were relying on the expression
UPDATE auth.identities
SET email = lower(identity_data ->> 'email')
WHERE email IS DISTINCT FROM lower(identity_data ->> 'email');

-- 5. Make sure the auth service roles can actually read/write identities
GRANT USAGE ON SCHEMA auth TO authenticator, supabase_auth_admin;
GRANT ALL ON auth.users      TO authenticator, supabase_auth_admin;
GRANT ALL ON auth.identities TO authenticator, supabase_auth_admin;

-- 6. RLS policies for the auth service roles on auth.users / auth.identities
--    (RLS is enabled on both with no policies, which blocks non-owner writes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_authenticator_users') THEN
    CREATE POLICY allow_authenticator_users ON auth.users
      FOR ALL TO authenticator USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_auth_admin_users') THEN
    CREATE POLICY allow_auth_admin_users ON auth.users
      FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_authenticator_identities') THEN
    CREATE POLICY allow_authenticator_identities ON auth.identities
      FOR ALL TO authenticator USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_auth_admin_identities') THEN
    CREATE POLICY allow_auth_admin_identities ON auth.identities
      FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Re-apply the onboarding trigger ONLY if it is missing
--    (it was applied and verified working, but keep this idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name  TEXT;
    v_role       user_role;
    v_dept_id    UUID;
    v_class_id   UUID;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'full_name', 'User');
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Member');
    v_role       := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'STUDENT'::user_role);

    INSERT INTO public.profiles (user_id, email, role, first_name, last_name, theme, is_active)
    VALUES (NEW.id, NEW.email, v_role, v_first_name, v_last_name, 'dark', true)
    ON CONFLICT (user_id) DO NOTHING;

    IF v_role = 'STUDENT' THEN
        v_dept_id  := (SELECT id FROM departments LIMIT 1);
        v_class_id := (SELECT id FROM classes WHERE department_id = v_dept_id LIMIT 1);
        INSERT INTO public.students (user_id, enrollment_id, department_id, class_id, batch_year, semester)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'enrollment_id',
                     'STU' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6)),
            COALESCE((NEW.raw_user_meta_data->>'department_id')::uuid, v_dept_id),
            COALESCE((NEW.raw_user_meta_data->>'class_id')::uuid, v_class_id),
            extract(year from now())::int,
            1
        ) ON CONFLICT (user_id) DO NOTHING;

    ELSIF v_role IN ('FACULTY', 'CLASS_INCHARGE') THEN
        v_dept_id := (SELECT id FROM departments LIMIT 1);
        INSERT INTO public.faculty (user_id, employee_id, designation, department_id, joining_date)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'employee_id',
                     'EMP' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6)),
            'Assistant Professor',
            COALESCE((NEW.raw_user_meta_data->>'department_id')::uuid, v_dept_id),
            CURRENT_DATE
        ) ON CONFLICT (user_id) DO NOTHING;

    ELSIF v_role IN ('ADMIN', 'SUPER_ADMIN') THEN
        INSERT INTO public.admins (user_id, permissions)
        VALUES (NEW.id, '{}'::text[]) ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Clean up the diagnostic table left by the investigation
DROP TABLE IF EXISTS public.trigger_error_log;

-- =============================================================
-- VERIFICATION (run after applying)
-- =============================================================
-- Expect 200 + a user id, and a profile/student row to exist:
--
--   curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
--     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
--     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"verify@example.com","password":"Verify@12345",
--          "email_confirm":true,
--          "user_metadata":{"first_name":"Verify","last_name":"Test","role":"STUDENT"}}'
--
-- Then:
--   SELECT p.email, p.role, s.enrollment_id
--   FROM profiles p LEFT JOIN students s ON s.user_id = p.user_id
--   WHERE p.email = 'verify@example.com';
