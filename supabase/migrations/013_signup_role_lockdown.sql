-- =============================================================
-- 013_signup_role_lockdown.sql — close self-granted roles
-- handle_new_user() trusted raw_user_meta_data->>'role', so anyone
-- signing up with role='SUPER_ADMIN' got an admins row. From here on,
-- EVERY signup is a STUDENT with no auto-enrollment; staff are
-- promoted out-of-band (dashboard / service key). Existing rows
-- untouched. Idempotent.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_dept_id UUID;
    v_class_id UUID;
BEGIN
    v_first_name := COALESCE(
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'full_name', 'User');
    v_last_name := COALESCE(
        NEW.raw_user_meta_data->>'last_name', 'Member');

    -- Role is ALWAYS student at signup. Never trust client metadata.
    INSERT INTO public.profiles (
        user_id, email, role, first_name, last_name, theme, is_active
    ) VALUES (
        NEW.id, NEW.email, 'STUDENT'::user_role,
        v_first_name, v_last_name, 'dark', true
    ) ON CONFLICT (user_id) DO NOTHING;

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
        INSERT INTO public.students (
            user_id, enrollment_id, department_id, class_id, batch_year, semester
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'enrollment_id',
                     'STU' || floor(extract(epoch from now()))::text),
            v_dept_id, v_class_id,
            extract(year from now())::int, 1
        ) ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
