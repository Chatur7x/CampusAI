-- ============================================================
-- CAMPUSAI - AUTOMATIC PROFILE CREATION TRIGGER
-- Ensures every auth.user has a matching profile and role record
-- ============================================================

-- Function to handle new user registration from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_role user_role;
    v_dept_id UUID;
    v_class_id UUID;
BEGIN
    -- 1. Extract metadata from auth.users
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'full_name', 'User');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Member');
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'STUDENT'::user_role);

    -- 2. Create Profile
    INSERT INTO public.profiles (
        user_id,
        email,
        role,
        first_name,
        last_name,
        theme,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        v_role,
        v_first_name,
        v_last_name,
        'dark',
        true
    ) ON CONFLICT (user_id) DO NOTHING;

    -- 3. Create Role-Specific Records
    IF v_role = 'STUDENT' THEN
        -- Try to find a default department and class if not provided
        v_dept_id := (SELECT id FROM departments LIMIT 1);
        v_class_id := (SELECT id FROM classes WHERE department_id = v_dept_id LIMIT 1);

        INSERT INTO public.students (
            user_id,
            enrollment_id,
            department_id,
            class_id,
            batch_year,
            semester
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'enrollment_id', 'STU' || floor(extract(epoch from now()))::text),
            COALESCE((NEW.raw_user_meta_data->>'department_id')::uuid, v_dept_id),
            COALESCE((NEW.raw_user_meta_data->>'class_id')::uuid, v_class_id),
            extract(year from now())::int,
            1
        ) ON CONFLICT (user_id) DO NOTHING;

    ELSIF v_role IN ('FACULTY', 'CLASS_INCHARGE') THEN
        v_dept_id := (SELECT id FROM departments LIMIT 1);

        INSERT INTO public.faculty (
            user_id,
            employee_id,
            designation,
            department_id,
            joining_date
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'employee_id', 'EMP' || floor(extract(epoch from now()))::text),
            'Assistant Professor',
            COALESCE((NEW.raw_user_meta_data->>'department_id')::uuid, v_dept_id),
            CURRENT_DATE
        ) ON CONFLICT (user_id) DO NOTHING;

    ELSIF v_role IN ('ADMIN', 'SUPER_ADMIN') THEN
        INSERT INTO public.admins (
            user_id,
            permissions
        ) VALUES (
            NEW.id,
            '{}'::text[]
        ) ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RECONCILE EXISTING USERS
-- ============================================================
-- Run this once to fix any existing "Database Link Missing" issues
-- INSERT INTO public.profiles (user_id, email, role, first_name, last_name)
-- SELECT id, email, 'STUDENT', 'Student', 'Profile' FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.profiles)
-- ON CONFLICT DO NOTHING;
