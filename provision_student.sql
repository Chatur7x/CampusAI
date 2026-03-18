-- ==============================================================
-- provision_student.sql  — run in Supabase SQL Editor
-- Provisions student: 24eg109a28@anurag.edu.in
-- ==============================================================

-- Step 1: Fetch department and class IDs (just for reference)
SELECT id, name, code FROM departments WHERE code = 'CSE-CS' LIMIT 1;
SELECT id, name, section FROM classes WHERE name = 'CYBER SECURITY' LIMIT 1;

-- ---------------------------------------------------------------
-- OPTION A: If the student's AUTH user already exists, use this:
-- Replace '1717c4d3-ca65-47cc-81bf-9e1e189ab3ef' with the actual
-- UUID from auth.users for 24eg109a28@anurag.edu.in
-- ---------------------------------------------------------------

DO $$
DECLARE
  v_user_id    UUID;
  v_dept_id    UUID;
  v_class_id   UUID;
  v_email      TEXT := '24eg109a28@anurag.edu.in';
  v_first_name TEXT := 'Kolluri Chaturvedhi';
  v_last_name  TEXT := 'Narsimha';
  v_enrollment TEXT := '24EG109A28';
BEGIN
  -- Get department
  SELECT id INTO v_dept_id FROM departments WHERE code = 'CSE-CS' LIMIT 1;
  IF v_dept_id IS NULL THEN
    INSERT INTO departments (name, code, description)
    VALUES ('CSE-CYBER SECURITY', 'CSE-CS', 'Cyber Security Engineering')
    RETURNING id INTO v_dept_id;
    RAISE NOTICE 'Created department: %', v_dept_id;
  ELSE
    RAISE NOTICE 'Using existing department: %', v_dept_id;
  END IF;

  -- Get class
  SELECT id INTO v_class_id FROM classes WHERE name = 'CYBER SECURITY' LIMIT 1;
  IF v_class_id IS NULL THEN
    -- Create a minimal class (incharge_id can be NULL if none exists)
    BEGIN
      INSERT INTO classes (name, section, department_id, capacity, academic_year)
      VALUES ('CYBER SECURITY', 'A', v_dept_id, 60, '2024-2025')
      RETURNING id INTO v_class_id;
      RAISE NOTICE 'Created class: %', v_class_id;
    EXCEPTION WHEN OTHERS THEN
      -- Try camelCase column names (Prisma schema)
      INSERT INTO classes (name, section, "departmentId", capacity, "academicYear")
      VALUES ('CYBER SECURITY', 'A', v_dept_id, 60, '2024-2025')
      RETURNING id INTO v_class_id;
      RAISE NOTICE 'Created class (camel): %', v_class_id;
    END;
  ELSE
    RAISE NOTICE 'Using existing class: %', v_class_id;
  END IF;

  -- Check auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'AUTH USER DOES NOT EXIST — Please create it via Supabase Dashboard > Auth > Users > Invite user, or use the Auth REST API.';
    RAISE NOTICE 'Email: %, Password: Student@123456', v_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Auth user found: %', v_user_id;

  -- Upsert profile
  BEGIN
    INSERT INTO profiles (user_id, email, first_name, last_name, role, theme, language)
    VALUES (v_user_id, v_email, v_first_name, v_last_name, 'STUDENT', 'dark', 'en')
    ON CONFLICT (user_id) DO UPDATE
      SET first_name = EXCLUDED.first_name,
          last_name  = EXCLUDED.last_name,
          email      = EXCLUDED.email,
          role       = 'STUDENT',
          updated_at = NOW();
    RAISE NOTICE 'Profile upserted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Profile upsert error: %', SQLERRM;
  END;

  -- Upsert student record — try snake_case columns first
  BEGIN
    INSERT INTO students (user_id, enrollment_id, department_id, class_id, batch_year, face_registered)
    VALUES (v_user_id, v_enrollment, v_dept_id, v_class_id, 2024, false)
    ON CONFLICT (user_id) DO UPDATE
      SET enrollment_id = EXCLUDED.enrollment_id,
          department_id = EXCLUDED.department_id,
          class_id      = EXCLUDED.class_id,
          updated_at    = NOW();
    RAISE NOTICE 'Student record upserted (snake_case)';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'snake_case failed: %. Trying camelCase...', SQLERRM;
    BEGIN
      INSERT INTO students ("userId", "enrollmentId", "departmentId", "classId", "batchYear", "faceRegistered")
      VALUES (v_user_id, v_enrollment, v_dept_id, v_class_id, 2024, false)
      ON CONFLICT ("userId") DO UPDATE
        SET "enrollmentId" = EXCLUDED."enrollmentId",
            "departmentId" = EXCLUDED."departmentId",
            "classId"      = EXCLUDED."classId",
            "updatedAt"    = NOW();
      RAISE NOTICE 'Student record upserted (camelCase)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'camelCase also failed: %', SQLERRM;
    END;
  END;

  RAISE NOTICE '✅ DONE — Student % provisioned successfully', v_email;
END $$;
