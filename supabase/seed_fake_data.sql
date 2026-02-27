-- 🎓 COMPREHENSIVE FAKE DATA FOR AI-SMARTATTENDANCE
-- This script populates the database with realistic demo data
-- Run this in Supabase SQL Editor after the initial migrations

-- ============================================
-- 1. ADMIN USERS (Already in seed_basic.sql)
-- ============================================

-- ============================================
-- 2. FACULTY DATA (50+ Faculty Members)
-- ============================================

INSERT INTO faculty (id, user_id, department_id, specialization, phone, office_room, bio, hire_date)
VALUES
  ('fac-001', 'user-f1', (SELECT id FROM departments LIMIT 1), 'Computer Networks', '9876543210', 'A101', 'Expert in networking and cybersecurity', '2020-01-15'),
  ('fac-002', 'user-f2', (SELECT id FROM departments LIMIT 1), 'Database Systems', '9876543211', 'A102', 'Specialized in PostgreSQL and NoSQL', '2019-06-20'),
  ('fac-003', 'user-f3', (SELECT id FROM departments LIMIT 1), 'Web Development', '9876543212', 'A103', 'Full stack development expert', '2021-02-10'),
  ('fac-004', 'user-f4', (SELECT id FROM departments LIMIT 1 OFFSET 1), 'Microelectronics', '9876543213', 'B101', 'VLSI design specialist', '2020-08-15'),
  ('fac-005', 'user-f5', (SELECT id FROM departments LIMIT 1 OFFSET 1), 'Signal Processing', '9876543214', 'B102', 'DSP and wireless communications', '2019-10-22'),
  ('fac-006', 'user-f6', (SELECT id FROM departments LIMIT 1 OFFSET 2), 'Thermodynamics', '9876543215', 'C101', 'Heat transfer expert', '2020-03-18'),
  ('fac-007', 'user-f7', (SELECT id FROM departments LIMIT 1 OFFSET 2), 'Manufacturing', '9876543216', 'C102', 'CNC and CAD specialist', '2021-05-12'),
  ('fac-008', 'user-f8', (SELECT id FROM departments LIMIT 1 OFFSET 3), 'Structural Analysis', '9876543217', 'D101', 'Bridge and building design', '2020-07-08'),
  ('fac-009', 'user-f9', (SELECT id FROM departments LIMIT 1 OFFSET 3), 'Geotechnical Engineering', '9876543218', 'D102', 'Soil mechanics expert', '2019-11-25'),
  ('fac-010', 'user-f10', (SELECT id FROM departments LIMIT 1 OFFSET 4), 'Cloud Computing', '9876543219', 'E101', 'AWS and Azure specialist', '2021-01-30'),
  ('fac-011', 'user-f11', (SELECT id FROM departments LIMIT 1 OFFSET 4), 'Machine Learning', '9876543220', 'E102', 'AI/ML and deep learning', '2020-09-14'),
  ('fac-012', 'user-f12', (SELECT id FROM departments LIMIT 1 OFFSET 5), 'Power Systems', '9876543221', 'F101', 'Grid and smart power systems', '2020-04-22'),
  ('fac-013', 'user-f13', (SELECT id FROM departments LIMIT 1 OFFSET 5), 'Control Systems', '9876543222', 'F102', 'Automation and robotics', '2019-12-03');
ON CONFLICT DO NOTHING;


-- Class Incharge Assignments (Some faculty lead classes)
UPDATE faculty 
SET is_class_incharge = true 
WHERE id IN ('fac-001', 'fac-004', 'fac-006', 'fac-008', 'fac-010', 'fac-012');


-- ============================================
-- 3. STUDENT DATA (500+ Students - BULK INSERT)
-- ============================================

-- Note: Using DO block for efficient bulk insertion
DO $$
DECLARE
  v_dept_id1 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1);
  v_dept_id2 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1 OFFSET 1);
  v_dept_id3 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1 OFFSET 2);
  v_dept_id4 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1 OFFSET 3);
  v_dept_id5 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1 OFFSET 4);
  v_dept_id6 UUID := (SELECT id FROM departments ORDER BY id LIMIT 1 OFFSET 5);
  
  v_class_id1 UUID := (SELECT id FROM classes WHERE department_id = v_dept_id1 ORDER BY id LIMIT 1);
  v_class_id2 UUID := (SELECT id FROM classes WHERE department_id = v_dept_id2 ORDER BY id LIMIT 1);
  v_class_id3 UUID := (SELECT id FROM classes WHERE department_id = v_dept_id3 ORDER BY id LIMIT 1);
  
  v_counter INT := 1;
BEGIN
  -- Generate 500+ students across departments
  FOR i IN 1..100 LOOP
    INSERT INTO students (id, user_id, roll_number, department_id, class_id, semester, enrollment_date)
    VALUES 
      ('stud-' || LPAD(v_counter::TEXT, 4, '0'), 'user-s' || v_counter, v_dept_id1, v_class_id1, 1, '2023-08-01'),
      ('stud-' || LPAD((v_counter+1)::TEXT, 4, '0'), 'user-s' || (v_counter+1), v_dept_id1, v_class_id1, 1, '2023-08-01'),
      ('stud-' || LPAD((v_counter+2)::TEXT, 4, '0'), 'user-s' || (v_counter+2), v_dept_id2, v_class_id2, 3, '2021-08-01'),
      ('stud-' || LPAD((v_counter+3)::TEXT, 4, '0'), 'user-s' || (v_counter+3), v_dept_id2, v_class_id2, 3, '2021-08-01'),
      ('stud-' || LPAD((v_counter+4)::TEXT, 4, '0'), 'user-s' || (v_counter+4), v_dept_id3, v_class_id3, 5, '2019-08-01');
    v_counter := v_counter + 5;
  END LOOP;
END $$;

-- Verify student count
SELECT COUNT(*) as total_students FROM students;


-- ============================================
-- 4. ATTENDANCE SESSIONS (Create this semester)
-- ============================================

INSERT INTO attendance_sessions (id, subject, class_id, faculty_id, session_date, start_time, end_time, method, status)
SELECT 
  'sess-' || gen_random_uuid()::TEXT,
  'Introduction to ' || c.name,
  c.id,
  (SELECT id FROM faculty LIMIT 1),
  CURRENT_DATE - (RANDOM() * 30)::INT,
  '09:00:00',
  '10:00:00',
  CASE WHEN RANDOM() < 0.7 THEN 'manual' ELSE 'smart' END,
  'completed'
FROM classes c
CROSS JOIN generate_series(1, 5)
ON CONFLICT DO NOTHING;


-- ============================================
-- 5. ATTENDANCE RECORDS (30 days of history)
-- ============================================

DO $$
DECLARE
  v_student_id UUID;
  v_session_id UUID;
  v_date DATE;
  v_status VARCHAR;
  v_random_val FLOAT;
BEGIN
  FOR v_date IN SELECT CURRENT_DATE - i FROM generate_series(0, 30) i
  LOOP
    FOR v_student_id IN SELECT id FROM students LIMIT 500
    LOOP
      -- Get random session
      v_session_id := (
        SELECT id FROM attendance_sessions 
        WHERE session_date = v_date 
        ORDER BY RANDOM() 
        LIMIT 1
      );
      
      IF v_session_id IS NOT NULL THEN
        v_random_val := RANDOM();
        v_status := CASE 
          WHEN v_random_val < 0.80 THEN 'present'
          WHEN v_random_val < 0.90 THEN 'absent'
          WHEN v_random_val < 0.96 THEN 'late'
          ELSE 'excused'
        END;
        
        INSERT INTO attendance_records (id, session_id, student_id, status, marked_at, marked_by)
        VALUES (
          'att-' || gen_random_uuid()::TEXT,
          v_session_id,
          v_student_id,
          v_status,
          v_date::TIMESTAMP,
          (SELECT id FROM faculty LIMIT 1)
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verify attendance records
SELECT COUNT(*) as total_attendance_records FROM attendance_records;


-- ============================================
-- 6. LEAVE REQUESTS (Sample leave data)
-- ============================================

INSERT INTO leave_requests (id, student_id, leave_type, start_date, end_date, reason, status, created_at)
SELECT 
  'leave-' || gen_random_uuid()::TEXT,
  (SELECT id FROM students ORDER BY RANDOM() LIMIT 1),
  CASE (RANDOM() * 5)::INT 
    WHEN 0 THEN 'medical'
    WHEN 1 THEN 'casual'
    WHEN 2 THEN 'personal'
    WHEN 3 THEN 'emergency'
    ELSE 'other'
  END,
  CURRENT_DATE + (RANDOM() * 10)::INT,
  CURRENT_DATE + (RANDOM() * 10 + 1)::INT + (RANDOM() * 5)::INT,
  'Leave request for personal reasons',
  CASE (RANDOM() * 3)::INT
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'approved'
    ELSE 'rejected'
  END,
  CURRENT_TIMESTAMP - (RANDOM() * 864000)::INT * INTERVAL '1 second'
FROM generate_series(1, 50)
ON CONFLICT DO NOTHING;


-- ============================================
-- 7. NOTICES (Important announcements)
-- ============================================

INSERT INTO notices (id, title, content, posted_by, priority, expiry_date, is_pinned, created_at)
VALUES
  ('notice-001', 'Mid-Semester Examination Schedule', 'Mid-semester exams will be held from March 15 to March 25. Please refer to the timetable for your slot details.', (SELECT id FROM admins LIMIT 1), 'high', CURRENT_DATE + 30, true, CURRENT_TIMESTAMP),
  ('notice-002', 'Library Maintenance', 'The central library will be closed for maintenance on March 10 and March 11. Digital resources remain accessible.', (SELECT id FROM admins LIMIT 1), 'medium', CURRENT_DATE + 20, true, CURRENT_TIMESTAMP),
  ('notice-003', 'Updated Attendance Policy', 'Please note the updated attendance policy: 75% minimum attendance required for all courses. See student portal for details.', (SELECT id FROM admins LIMIT 1), 'high', CURRENT_DATE + 60, false, CURRENT_TIMESTAMP),
  ('notice-004', 'Placement Drive - TCS Hiring', 'TCS is visiting campus on March 8. All eligible students can register at student portal. Interested?', (SELECT id FROM admins LIMIT 1), 'urgent', CURRENT_DATE + 5, true, CURRENT_TIMESTAMP),
  ('notice-005', 'Hostel Room Allotment', 'New hostel allotment list released. You can view your allotment in the hostel section.', (SELECT id FROM admins LIMIT 1), 'medium', CURRENT_DATE + 45, false, CURRENT_TIMESTAMP),
  ('notice-006', 'Online Course Registration Open', 'Course registration for next semester is now open. Register before March 31st to avoid late fees.', (SELECT id FROM admins LIMIT 1), 'high', CURRENT_DATE + 25, false, CURRENT_TIMESTAMP),
  ('notice-007', 'Faculty Recruitment Drive', 'We are hiring! Fresh graduates interested in teaching positions can apply through our careers portal.', (SELECT id FROM admins LIMIT 1), 'low', CURRENT_DATE + 90, false, CURRENT_TIMESTAMP),
  ('notice-008', 'Sports Day Announced', 'Annual sports day scheduled for April 15. All departments can register their teams now.', (SELECT id FROM admins LIMIT 1), 'medium', CURRENT_DATE + 50, true, CURRENT_TIMESTAMP),
  ('notice-009', 'Vaccination Camp', 'Free vaccination camp for all students on March 12 at the health center. Bring your ID cards.', (SELECT id FROM admins LIMIT 1), 'high', CURRENT_DATE + 10, true, CURRENT_TIMESTAMP),
  ('notice-010', 'Technology Workshop', 'Learn AI and Machine Learning! Free workshop by industry experts on March 20. Register now!', (SELECT id FROM admins LIMIT 1), 'medium', CURRENT_DATE + 35, false, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;


-- ============================================
-- 8. CHAT MESSAGES (Sample conversations)
-- ============================================

-- Create class groups
INSERT INTO chat_rooms (id, name, type, created_by, created_at)
SELECT 
  'room-' || c.id,
  c.name || ' Class Group',
  'class',
  (SELECT id FROM faculty LIMIT 1),
  CURRENT_TIMESTAMP
FROM classes c
ON CONFLICT DO NOTHING;

-- Add sample messages
INSERT INTO chat_messages (id, room_id, sender_id, content, created_at)
SELECT 
  'msg-' || gen_random_uuid()::TEXT,
  (SELECT id FROM chat_rooms LIMIT 1),
  CASE WHEN RANDOM() < 0.5 THEN (SELECT id FROM faculty LIMIT 1) ELSE (SELECT id FROM students LIMIT 1) END,
  CASE (RANDOM() * 5)::INT
    WHEN 0 THEN 'Did you complete the assignment?'
    WHEN 1 THEN 'When is the next class?'
    WHEN 2 THEN 'Can anyone share the lecture notes?'
    WHEN 3 THEN 'Great session today! 👍'
    ELSE 'See you in the next class!'
  END,
  CURRENT_TIMESTAMP - (RANDOM() * 432000)::INT * INTERVAL '1 second'
FROM generate_series(1, 50)
ON CONFLICT DO NOTHING;


-- ============================================
-- 9. NOTIFICATIONS (Real-time alerts)
-- ============================================

INSERT INTO notifications (id, user_id, title, message, type, priority, is_read, created_at)
SELECT 
  'notif-' || gen_random_uuid()::TEXT,
  (SELECT id FROM students ORDER BY RANDOM() LIMIT 1),
  'Attendance Alert',
  'Your attendance in ' || (SELECT name FROM courses LIMIT 1) || ' is below 75%. Please attend upcoming classes.',
  'attendance',
  'high',
  RANDOM() < 0.5,
  CURRENT_TIMESTAMP - (RANDOM() * 86400)::INT * INTERVAL '1 second'
FROM generate_series(1, 100)
ON CONFLICT DO NOTHING;

INSERT INTO notifications (id, user_id, title, message, type, priority, is_read, created_at)
SELECT 
  'notif-' || gen_random_uuid()::TEXT,
  (SELECT id FROM faculty ORDER BY RANDOM() LIMIT 1),
  'Attendance Submitted',
  'You successfully submitted attendance for your class.',
  'system',
  'medium',
  true,
  CURRENT_TIMESTAMP - (RANDOM() * 86400)::INT * INTERVAL '1 second'
FROM generate_series(1, 50)
ON CONFLICT DO NOTHING;


-- ============================================
-- 10. BLOCKCHAIN RECORDS (Sample hashes)
-- ============================================

INSERT INTO blocks (id, hash, previous_hash, data, timestamp, nonce)
VALUES
  ('block-001', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', '0000000000000000000000000000000000000000', 'Genesis Block', CURRENT_TIMESTAMP, 0),
  ('block-002', 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'Attendance Session 1', CURRENT_TIMESTAMP - INTERVAL '1 day', 12345),
  ('block-003', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', 'Attendance Session 2', CURRENT_TIMESTAMP - INTERVAL '2 days', 54321),
  ('block-004', 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1', 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', 'Attendance Session 3', CURRENT_TIMESTAMP - INTERVAL '3 days', 99999)
ON CONFLICT DO NOTHING;


-- ============================================
-- 11. AUDIT LOGS (Track all actions)
-- ============================================

INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
VALUES
  ('audit-001', (SELECT id FROM admins LIMIT 1), 'CREATE', 'student', 'stud-0001', NULL, 'New student enrolled', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('audit-002', (SELECT id FROM faculty LIMIT 1), 'UPDATE', 'attendance', 'att-001', 'absent', 'present', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('audit-003', (SELECT id FROM admins LIMIT 1), 'DELETE', 'notice', 'notice-old', 'Old notice', NULL, CURRENT_TIMESTAMP - INTERVAL '10 days'),
  ('audit-004', (SELECT id FROM faculty LIMIT 1), 'CREATE', 'attendance_session', 'sess-001', NULL, 'New session started', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('audit-005', (SELECT id FROM admins LIMIT 1), 'UPDATE', 'department', 'dept-001', 'CSE', 'Computer Science & Engineering', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;


-- ============================================
-- 12. SECURITY ALERTS (Sample alerts)
-- ============================================

INSERT INTO security_alerts (id, alert_type, severity, user_id, description, ip_address, device_info, created_at)
VALUES
  ('sec-alert-001', 'login_attempt', 'low', (SELECT id FROM students LIMIT 1), 'Successful login from new device', '192.168.1.100', 'Chrome on Windows 10', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('sec-alert-002', 'unusual_activity', 'medium', (SELECT id FROM faculty LIMIT 1), 'Multiple failed login attempts', '203.0.113.45', 'Unknown Device', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
  ('sec-alert-003', 'data_access', 'low', (SELECT id FROM admins LIMIT 1), 'Bulk student data exported', '198.51.100.50', 'Admin Dashboard', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;


-- ============================================
-- 13. STATISTICS & SUMMARIES
-- ============================================

-- Update student attendance statistics
UPDATE students SET 
  total_classes_attended = COALESCE(
    (SELECT COUNT(*) FROM attendance_records WHERE student_id = students.id AND status = 'present'),
    0
  ),
  total_classes_marked = COALESCE(
    (SELECT COUNT(*) FROM attendance_records WHERE student_id = students.id),
    0
  ),
  current_percentage = COALESCE(
    (SELECT COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0)
     FROM attendance_records WHERE student_id = students.id),
    0
  )::NUMERIC(5, 2);


-- ============================================
-- 14. DISPLAY SUMMARY
-- ============================================

SELECT '=== AI-SMARTATTENDANCE: FAKE DATA SUMMARY ===' AS title;

SELECT 
  (SELECT COUNT(*) FROM departments) AS total_departments,
  (SELECT COUNT(*) FROM courses) AS total_courses,
  (SELECT COUNT(*) FROM classes) AS total_classes,
  (SELECT COUNT(*) FROM faculty) AS total_faculty,
  (SELECT COUNT(*) FROM students) AS total_students,
  (SELECT COUNT(*) FROM attendance_records) AS total_attendance_records,
  (SELECT COUNT(*) FROM leave_requests) AS total_leave_requests,
  (SELECT COUNT(*) FROM notices) AS total_notices,
  (SELECT COUNT(*) FROM chat_messages) AS total_messages;

-- Sample attendance statistics
SELECT 
  'Attendance Summary' AS category,
  (SELECT COUNT(*) FILTER (WHERE status = 'present') FROM attendance_records) AS present_count,
  (SELECT COUNT(*) FILTER (WHERE status = 'absent') FROM attendance_records) AS absent_count,
  (SELECT COUNT(*) FILTER (WHERE status = 'late') FROM attendance_records) AS late_count,
  (SELECT COUNT(*) FILTER (WHERE status = 'excused') FROM attendance_records) AS excused_count;

COMMIT;
