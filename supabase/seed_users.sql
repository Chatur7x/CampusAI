-- =============================================================
-- CAMPUSAI - SEED: Real Users for Anurag University
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- Step 1: Create auth users
-- ----------------------------------------------------------
-- Student 1: 24eg109a28@anurag.edu.in / 123456
-- Student 2: 24eg109a50@anurag.edu.in / 123456
-- Faculty:   saikrishnait@anurag.edu.in / 123456
-- Admin:     admin@anurag.edu.in / admin123
-- ----------------------------------------------------------

-- Generate deterministic UUIDs for consistency
DO $$
DECLARE
  v_student1_uid UUID;
  v_student2_uid UUID;
  v_faculty_uid  UUID;
  v_admin_uid    UUID;
  v_dept_id      UUID;
  v_course_id    UUID;
  v_class_id     UUID;
  v_faculty_row  UUID;
BEGIN

  -- ========== CLEANUP DEPENDENCIES ==========

  -- 0a. Clear grades for these students
  DELETE FROM grades WHERE student_id IN (
    SELECT id FROM students WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in'))
  );

  -- 0b. Clear leave_requests
  DELETE FROM leave_requests WHERE student_id IN (
    SELECT id FROM students WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in'))
  ) OR approved_by IN (
    SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in')
  );

  -- 0c. Clear attendance
  DELETE FROM attendance WHERE student_id IN (
    SELECT id FROM students WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in'))
  ) OR verified_by IN (
    SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in')
  ) OR subject_id IN (
    SELECT id FROM subjects WHERE faculty_id IN (SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in'))
  );

  -- 0d. Clear timetable_entries
  DELETE FROM timetable_entries WHERE faculty_id IN (
    SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in')
  ) OR subject_id IN (
    SELECT id FROM subjects WHERE faculty_id IN (SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in'))
  ) OR class_id IN (
    SELECT id FROM classes WHERE incharge_id IN (SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in'))
  );

  -- 0e. Clear subjects
  DELETE FROM subjects WHERE faculty_id IN (
    SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in')
  );

  -- 1. Delete the specific students to free up the classes and faculty references
  DELETE FROM students 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in')
  );

  -- 2. Clear the HOD references first
  UPDATE departments 
  SET hod_id = NULL 
  WHERE hod_id IN (SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in'));

  -- 3. Delete classes where this faculty is the incharge
  DELETE FROM classes 
  WHERE incharge_id IN (SELECT id FROM faculty WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in'));

  -- 4. Delete the faculty profile
  DELETE FROM faculty 
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in');

  -- 4.5 Delete admins profile
  DELETE FROM admins
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@anurag.edu.in');

  -- 5. Delete specific user profiles
  DELETE FROM profiles 
  WHERE email IN ('24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in', 'saikrishnait@anurag.edu.in', 'admin@anurag.edu.in');

  -- ========== CLEANUP OLD USERS ==========
  -- Deleting from auth.users cascades downwards to students/faculty/profiles
  DELETE FROM auth.users WHERE email IN (
    '24eg109a28@anurag.edu.in',
    '24eg109a50@anurag.edu.in',
    'saikrishnait@anurag.edu.in',
    'admin@anurag.edu.in'
  );

  -- ========== AUTH USERS ==========

  -- Student 1
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    '24eg109a28@anurag.edu.in',
    crypt('Chatur7', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"STUDENT","first_name":"Chaturvedhi Narsimha","last_name":"Kolluri"}',
    false, ''
  )
  RETURNING id INTO v_student1_uid;

  -- If already exists, fetch the id
  IF v_student1_uid IS NULL THEN
    SELECT id INTO v_student1_uid FROM auth.users WHERE email = '24eg109a28@anurag.edu.in';
  END IF;

  -- Student 2
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    '24eg109a50@anurag.edu.in',
    crypt('Divya7', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"STUDENT","first_name":"Sree Divya","last_name":"Ledalla"}',
    false, ''
  )
  RETURNING id INTO v_student2_uid;

  IF v_student2_uid IS NULL THEN
    SELECT id INTO v_student2_uid FROM auth.users WHERE email = '24eg109a50@anurag.edu.in';
  END IF;

  -- Faculty
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'saikrishnait@anurag.edu.in',
    crypt('SAIKRISHNATHELIVINGLEGEND#28', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"FACULTY","first_name":"Sai Krishna","last_name":"Gudepu"}',
    false, ''
  )
  RETURNING id INTO v_faculty_uid;

  IF v_faculty_uid IS NULL THEN
    SELECT id INTO v_faculty_uid FROM auth.users WHERE email = 'saikrishnait@anurag.edu.in';
  END IF;

  -- Admin
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'admin@anurag.edu.in',
    crypt('admin123', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"ADMIN","first_name":"Admin","last_name":"Anurag"}',
    false, ''
  )
  RETURNING id INTO v_admin_uid;

  IF v_admin_uid IS NULL THEN
    SELECT id INTO v_admin_uid FROM auth.users WHERE email = 'admin@anurag.edu.in';
  END IF;

  -- ========== AUTH IDENTITIES (required for email login) ==========

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_student1_uid, v_student1_uid, 'email',
     jsonb_build_object('sub', v_student1_uid::text, 'email', '24eg109a28@anurag.edu.in'),
     NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_student2_uid, v_student2_uid, 'email',
     jsonb_build_object('sub', v_student2_uid::text, 'email', '24eg109a50@anurag.edu.in'),
     NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_faculty_uid, v_faculty_uid, 'email',
     jsonb_build_object('sub', v_faculty_uid::text, 'email', 'saikrishnait@anurag.edu.in'),
     NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_admin_uid, v_admin_uid, 'email',
     jsonb_build_object('sub', v_admin_uid::text, 'email', 'admin@anurag.edu.in'),
     NOW(), NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ========== DEPARTMENT ==========

  INSERT INTO departments (id, name, code, description, is_active)
  VALUES (gen_random_uuid(), 'Computer Science & Cyber Security', 'CSE-CS', 'Department of Computer Science & Cyber Security', true)
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_dept_id;

  IF v_dept_id IS NULL THEN
    SELECT id INTO v_dept_id FROM departments WHERE code = 'IT';
  END IF;

  -- ========== COURSE ==========

  INSERT INTO courses (id, name, code, credits, semester, department_id, description, is_active)
  VALUES (gen_random_uuid(), 'B.Tech Information Technology', 'BTIT', 180, 4, v_dept_id, 'Bachelor of Technology in IT', true)
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_course_id;

  IF v_course_id IS NULL THEN
    SELECT id INTO v_course_id FROM courses WHERE code = 'BTIT';
  END IF;

  -- ========== FACULTY ROW (needed before class) ==========

  INSERT INTO faculty (id, user_id, employee_id, designation, department_id, joining_date, specialization, is_active)
  VALUES (gen_random_uuid(), v_faculty_uid, 'AU_FAC_IT-007', 'Assistant Professor', v_dept_id, '2022-06-01', 'Cyber Security', true)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_faculty_row;

  IF v_faculty_row IS NULL THEN
    SELECT id INTO v_faculty_row FROM faculty WHERE user_id = v_faculty_uid;
  END IF;

  -- ========== CLASS ==========

  INSERT INTO classes (id, name, section, department_id, course_id, incharge_id, room_number, capacity, academic_year, is_active)
  VALUES (gen_random_uuid(), 'CSE-CS-4th Sem', 'CSE-CS', v_dept_id, v_course_id, v_faculty_row, 'LH-301', 60, '2024-2025', true)
  ON CONFLICT (name, section, academic_year) DO NOTHING
  RETURNING id INTO v_class_id;

  IF v_class_id IS NULL THEN
    SELECT id INTO v_class_id FROM classes WHERE name = 'IT-4th Sem' AND section = 'A' AND academic_year = '2024-2025';
  END IF;

  -- ========== PROFILES ==========

  INSERT INTO profiles (id, user_id, email, role, first_name, last_name, is_active, theme, language)
  VALUES
    (gen_random_uuid(), v_student1_uid, '24eg109a28@anurag.edu.in', 'STUDENT', 'Chaturvedhi Narsimha', 'Kolluri', true, 'dark', 'en'),
    (gen_random_uuid(), v_student2_uid, '24eg109a50@anurag.edu.in', 'STUDENT', 'Sree Divya', 'Ledalla', true, 'dark', 'en'),
    (gen_random_uuid(), v_faculty_uid,  'saikrishnait@anurag.edu.in', 'FACULTY', 'Sai Krishna', 'Gudepu', true, 'dark', 'en'),
    (gen_random_uuid(), v_admin_uid,    'admin@anurag.edu.in', 'ADMIN', 'Admin', 'Anurag', true, 'dark', 'en')
  ON CONFLICT (user_id) DO NOTHING;

  -- ========== STUDENTS ==========

  INSERT INTO students (id, user_id, enrollment_id, department_id, class_id, batch_year, semester, is_active)
  VALUES
    (gen_random_uuid(), v_student1_uid, '24EG109A28', v_dept_id, v_class_id, 2024, 4, true),
    (gen_random_uuid(), v_student2_uid, '24EG109A50', v_dept_id, v_class_id, 2024, 4, true)
  ON CONFLICT (user_id) DO NOTHING;

  -- ========== ADMINS ==========

  INSERT INTO admins (id, user_id, permissions, department)
  VALUES (gen_random_uuid(), v_admin_uid, ARRAY['ALL'], 'IT')
  ON CONFLICT (user_id) DO NOTHING;

  -- ========== UPDATE DEPARTMENT HOD ==========

  UPDATE departments SET hod_id = v_faculty_row WHERE id = v_dept_id AND hod_id IS NULL;

  RAISE NOTICE '✅ Users seeded successfully!';
  RAISE NOTICE 'Student 1: 24eg109a28@anurag.edu.in / Chatur7';
  RAISE NOTICE 'Student 2: 24eg109a50@anurag.edu.in / Divya7';
  RAISE NOTICE 'Faculty:   saikrishnait@anurag.edu.in / SAIKRISHNATHELIVINGLEGEND#28';
  RAISE NOTICE 'Admin:     admin@anurag.edu.in / admin123';

END $$;
