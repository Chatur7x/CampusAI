-- =============================================================
-- CAMPUSAI - BASIC SEED DATA (No Auth Dependencies)
-- =============================================================
-- Run this in Supabase SQL Editor
-- This creates sample departments, courses, and system settings
-- User data will be created automatically when users sign up
-- =============================================================

-- =====================================================
-- DEPARTMENTS
-- =====================================================

INSERT INTO departments (id, name, code, description, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Computer Science and Engineering', 'CSE', 'Department of Computer Science and Engineering focusing on software development, algorithms, and AI', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'Electronics and Communication', 'ECE', 'Department of Electronics and Communication Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440004', 'Civil Engineering', 'CIVIL', 'Department of Civil Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440005', 'Information Technology', 'IT', 'Department of Information Technology', true),
  ('550e8400-e29b-41d4-a716-446655440006', 'Electrical Engineering', 'EE', 'Department of Electrical Engineering', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COURSES
-- =====================================================

INSERT INTO courses (id, name, code, description, credits, department_id, is_active) VALUES
  -- CSE Courses
  ('cr000000-0000-0000-0000-000000000001', 'Data Structures and Algorithms', 'CS201', 'Fundamental data structures and algorithm design techniques', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000002', 'Database Management Systems', 'CS202', 'Relational databases, SQL, and database design', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000003', 'Operating Systems', 'CS301', 'OS concepts, process management, memory management', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000004', 'Computer Networks', 'CS302', 'Network protocols, architecture, and security', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000005', 'Machine Learning', 'CS401', 'ML algorithms, neural networks, and deep learning', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000006', 'Web Technologies', 'CS303', 'Frontend, backend development, and web frameworks', 3, '550e8400-e29b-41d4-a716-446655440001', true),
  -- ECE Courses  
  ('cr000000-0000-0000-0000-000000000007', 'Digital Electronics', 'EC201', 'Digital logic design and circuits', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  ('cr000000-0000-0000-0000-000000000008', 'Signals and Systems', 'EC202', 'Signal processing fundamentals', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  ('cr000000-0000-0000-0000-000000000009', 'VLSI Design', 'EC301', 'VLSI architecture and design methodologies', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  -- IT Courses
  ('cr000000-0000-0000-0000-000000000010', 'Software Engineering', 'IT201', 'SDLC, agile methodologies, and project management', 4, '550e8400-e29b-41d4-a716-446655440005', true),
  ('cr000000-0000-0000-0000-000000000011', 'Cloud Computing', 'IT301', 'Cloud platforms, services, and deployment', 4, '550e8400-e29b-41d4-a716-446655440005', true),
  ('cr000000-0000-0000-0000-000000000012', 'Cybersecurity', 'IT302', 'Security principles, cryptography, and ethical hacking', 4, '550e8400-e29b-41d4-a716-446655440005', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

INSERT INTO system_settings (key, value, description) VALUES
  ('attendance_threshold', '75', 'Minimum attendance percentage required'),
  ('late_threshold_minutes', '15', 'Minutes after class start to mark as late'),
  ('face_recognition_confidence', '0.85', 'Minimum confidence for face recognition'),
  ('session_timeout_minutes', '60', 'Session timeout in minutes'),
  ('max_leave_days_per_semester', '15', 'Maximum leave days allowed per semester'),
  ('notification_email_enabled', 'true', 'Enable email notifications'),
  ('notification_sms_enabled', 'false', 'Enable SMS notifications'),
  ('blockchain_verification_enabled', 'true', 'Enable blockchain attendance verification'),
  ('academic_year', '2024-2025', 'Current academic year'),
  ('semester', '2', 'Current semester')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'βœ… Seed data inserted successfully!' as status,
       (SELECT COUNT(*) FROM departments) as departments,
       (SELECT COUNT(*) FROM courses) as courses;
