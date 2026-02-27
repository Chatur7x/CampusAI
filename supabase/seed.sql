-- =============================================================
-- CAMPUSAI - DEVELOPMENT SEED DATA
-- =============================================================
-- Run with: npx supabase db reset
-- This creates sample data for development and testing
-- =============================================================

-- =====================================================
-- CLEAN EXISTING DATA (if any)
-- =====================================================

TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE leave_requests CASCADE;
TRUNCATE TABLE timetable_entries CASCADE;
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE faculty CASCADE;
TRUNCATE TABLE classes CASCADE;
TRUNCATE TABLE courses CASCADE;
TRUNCATE TABLE departments CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- =====================================================
-- DEPARTMENTS
-- =====================================================

INSERT INTO departments (id, name, code, description, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Computer Science and Engineering', 'CSE', 'Department of Computer Science and Engineering focusing on software development, algorithms, and AI', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'Electronics and Communication', 'ECE', 'Department of Electronics and Communication Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440004', 'Civil Engineering', 'CIVIL', 'Department of Civil Engineering', true),
  ('550e8400-e29b-41d4-a716-446655440005', 'Information Technology', 'IT', 'Department of Information Technology', true),
  ('550e8400-e29b-41d4-a716-446655440006', 'Electrical Engineering', 'EE', 'Department of Electrical Engineering', true);

-- =====================================================
-- ADMIN USER PROFILE
-- =====================================================

INSERT INTO profiles (user_id, first_name, last_name, email, phone, role, avatar_url, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'System', 'Administrator', 'admin@campusai.edu', '+1234567890', 'SUPER_ADMIN', NULL, true),
  ('a0000000-0000-0000-0000-000000000002', 'Admin', 'User', 'admin2@campusai.edu', '+1234567891', 'ADMIN', NULL, true);

-- =====================================================
-- FACULTY PROFILES
-- =====================================================

INSERT INTO profiles (user_id, first_name, last_name, email, phone, role, is_active) VALUES
  -- CSE Faculty
  ('f0000000-0000-0000-0000-000000000001', 'Dr. Rajesh', 'Kumar', 'rajesh.kumar@campusai.edu', '+1234567001', 'FACULTY', true),
  ('f0000000-0000-0000-0000-000000000002', 'Dr. Priya', 'Sharma', 'priya.sharma@campusai.edu', '+1234567002', 'CLASS_INCHARGE', true),
  ('f0000000-0000-0000-0000-000000000003', 'Prof. Amit', 'Singh', 'amit.singh@campusai.edu', '+1234567003', 'FACULTY', true),
  ('f0000000-0000-0000-0000-000000000004', 'Dr. Sneha', 'Patel', 'sneha.patel@campusai.edu', '+1234567004', 'FACULTY', true),
  -- ECE Faculty
  ('f0000000-0000-0000-0000-000000000005', 'Dr. Vikram', 'Reddy', 'vikram.reddy@campusai.edu', '+1234567005', 'FACULTY', true),
  ('f0000000-0000-0000-0000-000000000006', 'Prof. Anita', 'Desai', 'anita.desai@campusai.edu', '+1234567006', 'CLASS_INCHARGE', true),
  -- IT Faculty
  ('f0000000-0000-0000-0000-000000000007', 'Dr. Suresh', 'Menon', 'suresh.menon@campusai.edu', '+1234567007', 'FACULTY', true),
  ('f0000000-0000-0000-0000-000000000008', 'Prof. Kavita', 'Nair', 'kavita.nair@campusai.edu', '+1234567008', 'CLASS_INCHARGE', true);

-- =====================================================
-- FACULTY RECORDS
-- =====================================================

INSERT INTO faculty (id, employee_id, designation, qualification, experience_years, specialization, date_of_joining, department_id, is_active) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'FAC-CSE-001', 'Professor', 'Ph.D. Computer Science, MIT', 15, 'Machine Learning, AI', '2010-07-01', '550e8400-e29b-41d4-a716-446655440001', true),
  ('f0000000-0000-0000-0000-000000000002', 'FAC-CSE-002', 'Associate Professor', 'Ph.D. Data Science, Stanford', 10, 'Data Mining, Big Data', '2014-08-15', '550e8400-e29b-41d4-a716-446655440001', true),
  ('f0000000-0000-0000-0000-000000000003', 'FAC-CSE-003', 'Assistant Professor', 'M.Tech Computer Science', 5, 'Web Technologies, Cloud Computing', '2019-01-10', '550e8400-e29b-41d4-a716-446655440001', true),
  ('f0000000-0000-0000-0000-000000000004', 'FAC-CSE-004', 'Assistant Professor', 'Ph.D. Cybersecurity, IIT Delhi', 6, 'Cryptography, Network Security', '2018-06-20', '550e8400-e29b-41d4-a716-446655440001', true),
  ('f0000000-0000-0000-0000-000000000005', 'FAC-ECE-001', 'Professor', 'Ph.D. VLSI Design, IISc', 18, 'VLSI, Embedded Systems', '2006-09-01', '550e8400-e29b-41d4-a716-446655440002', true),
  ('f0000000-0000-0000-0000-000000000006', 'FAC-ECE-002', 'Associate Professor', 'Ph.D. Signal Processing', 12, 'Digital Signal Processing', '2012-07-15', '550e8400-e29b-41d4-a716-446655440002', true),
  ('f0000000-0000-0000-0000-000000000007', 'FAC-IT-001', 'Professor', 'Ph.D. Information Systems', 14, 'Database Systems, ERP', '2010-12-01', '550e8400-e29b-41d4-a716-446655440005', true),
  ('f0000000-0000-0000-0000-000000000008', 'FAC-IT-002', 'Associate Professor', 'M.S. Software Engineering, CMU', 9, 'Software Architecture, DevOps', '2015-03-20', '550e8400-e29b-41d4-a716-446655440005', true);

-- =====================================================
-- CLASSES
-- =====================================================

INSERT INTO classes (id, name, section, semester, academic_year, capacity, department_id, class_incharge_id, is_active) VALUES
  -- CSE Classes
  ('c0000000-0000-0000-0000-000000000001', 'CSE First Year', 'A', 1, '2024-2025', 60, '550e8400-e29b-41d4-a716-446655440001', 'f0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000002', 'CSE First Year', 'B', 1, '2024-2025', 60, '550e8400-e29b-41d4-a716-446655440001', 'f0000000-0000-0000-0000-000000000003', true),
  ('c0000000-0000-0000-0000-000000000003', 'CSE Second Year', 'A', 3, '2024-2025', 55, '550e8400-e29b-41d4-a716-446655440001', 'f0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000004', 'CSE Third Year', 'A', 5, '2024-2025', 50, '550e8400-e29b-41d4-a716-446655440001', 'f0000000-0000-0000-0000-000000000004', true),
  -- ECE Classes
  ('c0000000-0000-0000-0000-000000000005', 'ECE First Year', 'A', 1, '2024-2025', 60, '550e8400-e29b-41d4-a716-446655440002', 'f0000000-0000-0000-0000-000000000006', true),
  ('c0000000-0000-0000-0000-000000000006', 'ECE Second Year', 'A', 3, '2024-2025', 55, '550e8400-e29b-41d4-a716-446655440002', 'f0000000-0000-0000-0000-000000000005', true),
  -- IT Classes
  ('c0000000-0000-0000-0000-000000000007', 'IT First Year', 'A', 1, '2024-2025', 60, '550e8400-e29b-41d4-a716-446655440005', 'f0000000-0000-0000-0000-000000000008', true),
  ('c0000000-0000-0000-0000-000000000008', 'IT Second Year', 'A', 3, '2024-2025', 55, '550e8400-e29b-41d4-a716-446655440005', 'f0000000-0000-0000-0000-000000000007', true);

-- =====================================================
-- COURSES
-- =====================================================

INSERT INTO courses (id, name, code, description, credits, department_id, is_active) VALUES
  -- CSE Courses
  ('cr000000-0000-0000-0000-000000000001', 'Data Structures and Algorithms', 'CS201', 'Fundamental data structures and algorithm design techniques', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000002', 'Database Management Systems', 'CS202', 'Relational databases, SQL, and database design', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000003', 'Operating Systems', 'CS301', 'OS concepts, process management, memory management', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000004', 'Computer Networks', 'CS302', 'Network architecture, protocols, and security', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000005', 'Machine Learning', 'CS401', 'ML algorithms, neural networks, and applications', 4, '550e8400-e29b-41d4-a716-446655440001', true),
  ('cr000000-0000-0000-0000-000000000006', 'Web Development', 'CS203', 'Frontend, backend, and full-stack web development', 3, '550e8400-e29b-41d4-a716-446655440001', true),
  -- ECE Courses
  ('cr000000-0000-0000-0000-000000000007', 'Digital Electronics', 'EC201', 'Digital logic design and circuits', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  ('cr000000-0000-0000-0000-000000000008', 'Analog Communication', 'EC202', 'Modulation techniques and communication systems', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  ('cr000000-0000-0000-0000-000000000009', 'VLSI Design', 'EC301', 'VLSI technology and chip design', 4, '550e8400-e29b-41d4-a716-446655440002', true),
  -- IT Courses
  ('cr000000-0000-0000-0000-000000000010', 'Software Engineering', 'IT201', 'Software development lifecycle and methodologies', 4, '550e8400-e29b-41d4-a716-446655440005', true),
  ('cr000000-0000-0000-0000-000000000011', 'Cloud Computing', 'IT301', 'Cloud platforms, services, and deployment', 4, '550e8400-e29b-41d4-a716-446655440005', true),
  ('cr000000-0000-0000-0000-000000000012', 'Cybersecurity', 'IT302', 'Security principles, threats, and countermeasures', 4, '550e8400-e29b-41d4-a716-446655440005', true);

-- =====================================================
-- STUDENT PROFILES (Sample - 20 students per class)
-- =====================================================

-- CSE First Year A Students
INSERT INTO profiles (user_id, first_name, last_name, email, phone, role, is_active) VALUES
  ('s0000000-0000-0000-0001-000000000001', 'Aarav', 'Gupta', 'aarav.gupta@campusai.edu', '+91001', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000002', 'Ishaan', 'Verma', 'ishaan.verma@campusai.edu', '+91002', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000003', 'Aanya', 'Sharma', 'aanya.sharma@campusai.edu', '+91003', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000004', 'Vihaan', 'Patel', 'vihaan.patel@campusai.edu', '+91004', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000005', 'Diya', 'Singh', 'diya.singh@campusai.edu', '+91005', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000006', 'Arjun', 'Kumar', 'arjun.kumar@campusai.edu', '+91006', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000007', 'Ananya', 'Reddy', 'ananya.reddy@campusai.edu', '+91007', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000008', 'Reyansh', 'Nair', 'reyansh.nair@campusai.edu', '+91008', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000009', 'Saanvi', 'Iyer', 'saanvi.iyer@campusai.edu', '+91009', 'STUDENT', true),
  ('s0000000-0000-0000-0001-000000000010', 'Kabir', 'Menon', 'kabir.menon@campusai.edu', '+91010', 'STUDENT', true);

-- CSE Second Year A Students  
INSERT INTO profiles (user_id, first_name, last_name, email, phone, role, is_active) VALUES
  ('s0000000-0000-0000-0002-000000000001', 'Aditi', 'Rao', 'aditi.rao@campusai.edu', '+91011', 'STUDENT', true),
  ('s0000000-0000-0000-0002-000000000002', 'Vivaan', 'Chauhan', 'vivaan.chauhan@campusai.edu', '+91012', 'STUDENT', true),
  ('s0000000-0000-0000-0002-000000000003', 'Myra', 'Joshi', 'myra.joshi@campusai.edu', '+91013', 'STUDENT', true),
  ('s0000000-0000-0000-0002-000000000004', 'Aditya', 'Desai', 'aditya.desai@campusai.edu', '+91014', 'STUDENT', true),
  ('s0000000-0000-0000-0002-000000000005', 'Kiara', 'Mehta', 'kiara.mehta@campusai.edu', '+91015', 'STUDENT', true);

-- IT First Year A Students
INSERT INTO profiles (user_id, first_name, last_name, email, phone, role, is_active) VALUES
  ('s0000000-0000-0000-0003-000000000001', 'Rohan', 'Pillai', 'rohan.pillai@campusai.edu', '+91021', 'STUDENT', true),
  ('s0000000-0000-0000-0003-000000000002', 'Shreya', 'Banerjee', 'shreya.banerjee@campusai.edu', '+91022', 'STUDENT', true),
  ('s0000000-0000-0000-0003-000000000003', 'Dhruv', 'Saxena', 'dhruv.saxena@campusai.edu', '+91023', 'STUDENT', true),
  ('s0000000-0000-0000-0003-000000000004', 'Tara', 'Sinha', 'tara.sinha@campusai.edu', '+91024', 'STUDENT', true),
  ('s0000000-0000-0000-0003-000000000005', 'Krish', 'Kapoor', 'krish.kapoor@campusai.edu', '+91025', 'STUDENT', true);

-- =====================================================
-- STUDENT RECORDS
-- =====================================================

INSERT INTO students (id, enrollment_id, roll_number, date_of_birth, blood_group, address, admission_date, guardian_name, guardian_phone, guardian_email, class_id, department_id, is_active) VALUES
  -- CSE First Year A
  ('s0000000-0000-0000-0001-000000000001', 'CSE2024001', 'CSE-1A-001', '2005-03-15', 'O+', '123 Main St, Bangalore', '2024-07-01', 'Rakesh Gupta', '+919876543001', 'rakesh.gupta@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000002', 'CSE2024002', 'CSE-1A-002', '2005-06-20', 'A+', '456 Park Ave, Bangalore', '2024-07-01', 'Sunil Verma', '+919876543002', 'sunil.verma@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000003', 'CSE2024003', 'CSE-1A-003', '2005-01-10', 'B+', '789 Lake Rd, Bangalore', '2024-07-01', 'Pradeep Sharma', '+919876543003', 'pradeep.sharma@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000004', 'CSE2024004', 'CSE-1A-004', '2005-09-25', 'AB+', '321 Hill St, Bangalore', '2024-07-01', 'Mahesh Patel', '+919876543004', 'mahesh.patel@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000005', 'CSE2024005', 'CSE-1A-005', '2005-12-05', 'O-', '654 River Rd, Bangalore', '2024-07-01', 'Anil Singh', '+919876543005', 'anil.singh@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000006', 'CSE2024006', 'CSE-1A-006', '2005-04-18', 'A-', '987 Oak Lane, Bangalore', '2024-07-01', 'Vijay Kumar', '+919876543006', 'vijay.kumar@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000007', 'CSE2024007', 'CSE-1A-007', '2005-07-22', 'B-', '246 Pine St, Bangalore', '2024-07-01', 'Ramesh Reddy', '+919876543007', 'ramesh.reddy@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000008', 'CSE2024008', 'CSE-1A-008', '2005-02-14', 'O+', '135 Maple Ave, Bangalore', '2024-07-01', 'Suresh Nair', '+919876543008', 'suresh.nair@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000009', 'CSE2024009', 'CSE-1A-009', '2005-11-30', 'A+', '864 Cedar Blvd, Bangalore', '2024-07-01', 'Ganesh Iyer', '+919876543009', 'ganesh.iyer@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0001-000000000010', 'CSE2024010', 'CSE-1A-010', '2005-08-08', 'B+', '579 Elm St, Bangalore', '2024-07-01', 'Krishna Menon', '+919876543010', 'krishna.menon@email.com', 'c0000000-0000-0000-0000-000000000001', '550e8400-e29b-41d4-a716-446655440001', true),
  -- CSE Second Year A
  ('s0000000-0000-0000-0002-000000000001', 'CSE2023001', 'CSE-2A-001', '2004-05-12', 'A+', '111 First St, Bangalore', '2023-07-01', 'Naresh Rao', '+919876543011', 'naresh.rao@email.com', 'c0000000-0000-0000-0000-000000000003', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0002-000000000002', 'CSE2023002', 'CSE-2A-002', '2004-10-28', 'O+', '222 Second Ave, Bangalore', '2023-07-01', 'Ravi Chauhan', '+919876543012', 'ravi.chauhan@email.com', 'c0000000-0000-0000-0000-000000000003', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0002-000000000003', 'CSE2023003', 'CSE-2A-003', '2004-03-07', 'B-', '333 Third Rd, Bangalore', '2023-07-01', 'Mohan Joshi', '+919876543013', 'mohan.joshi@email.com', 'c0000000-0000-0000-0000-000000000003', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0002-000000000004', 'CSE2023004', 'CSE-2A-004', '2004-07-19', 'AB-', '444 Fourth Lane, Bangalore', '2023-07-01', 'Harish Desai', '+919876543014', 'harish.desai@email.com', 'c0000000-0000-0000-0000-000000000003', '550e8400-e29b-41d4-a716-446655440001', true),
  ('s0000000-0000-0000-0002-000000000005', 'CSE2023005', 'CSE-2A-005', '2004-12-01', 'A-', '555 Fifth Blvd, Bangalore', '2023-07-01', 'Dinesh Mehta', '+919876543015', 'dinesh.mehta@email.com', 'c0000000-0000-0000-0000-000000000003', '550e8400-e29b-41d4-a716-446655440001', true),
  -- IT First Year A
  ('s0000000-0000-0000-0003-000000000001', 'IT2024001', 'IT-1A-001', '2005-04-25', 'O+', '101 Tech Park, Chennai', '2024-07-01', 'Murali Pillai', '+919876543021', 'murali.pillai@email.com', 'c0000000-0000-0000-0000-000000000007', '550e8400-e29b-41d4-a716-446655440005', true),
  ('s0000000-0000-0000-0003-000000000002', 'IT2024002', 'IT-1A-002', '2005-08-14', 'A+', '202 IT Hub, Chennai', '2024-07-01', 'Soumya Banerjee', '+919876543022', 'soumya.banerjee@email.com', 'c0000000-0000-0000-0000-000000000007', '550e8400-e29b-41d4-a716-446655440005', true),
  ('s0000000-0000-0000-0003-000000000003', 'IT2024003', 'IT-1A-003', '2005-01-30', 'B+', '303 Data Center, Chennai', '2024-07-01', 'Prakash Saxena', '+919876543023', 'prakash.saxena@email.com', 'c0000000-0000-0000-0000-000000000007', '550e8400-e29b-41d4-a716-446655440005', true),
  ('s0000000-0000-0000-0003-000000000004', 'IT2024004', 'IT-1A-004', '2005-06-11', 'AB+', '404 Cloud Ave, Chennai', '2024-07-01', 'Rajiv Sinha', '+919876543024', 'rajiv.sinha@email.com', 'c0000000-0000-0000-0000-000000000007', '550e8400-e29b-41d4-a716-446655440005', true),
  ('s0000000-0000-0000-0003-000000000005', 'IT2024005', 'IT-1A-005', '2005-09-22', 'O-', '505 Server St, Chennai', '2024-07-01', 'Ashok Kapoor', '+919876543025', 'ashok.kapoor@email.com', 'c0000000-0000-0000-0000-000000000007', '550e8400-e29b-41d4-a716-446655440005', true);

-- =====================================================
-- TIMETABLE ENTRIES
-- =====================================================

INSERT INTO timetable_entries (class_id, course_id, faculty_id, day_of_week, start_time, end_time, room) VALUES
  -- CSE First Year A - Monday
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'MONDAY', '09:00', '10:00', 'CSE-101'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'MONDAY', '10:00', '11:00', 'CSE-102'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'MONDAY', '11:30', '12:30', 'CSE-103'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000004', 'MONDAY', '14:00', '15:00', 'CSE-LAB-1'),
  -- CSE First Year A - Tuesday
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'TUESDAY', '09:00', '10:00', 'CSE-104'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'TUESDAY', '10:00', '11:00', 'CSE-101'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'TUESDAY', '11:30', '12:30', 'CSE-102'),
  -- CSE First Year A - Wednesday
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'WEDNESDAY', '09:00', '10:00', 'CSE-103'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'WEDNESDAY', '10:00', '11:00', 'CSE-104'),
  ('c0000000-0000-0000-0000-000000000001', 'cr000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'WEDNESDAY', '14:00', '16:00', 'CSE-LAB-1'),
  -- CSE Second Year A
  ('c0000000-0000-0000-0000-000000000003', 'cr000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'MONDAY', '09:00', '10:00', 'CSE-201'),
  ('c0000000-0000-0000-0000-000000000003', 'cr000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'MONDAY', '11:30', '12:30', 'CSE-202'),
  ('c0000000-0000-0000-0000-000000000003', 'cr000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'TUESDAY', '09:00', '10:00', 'CSE-203'),
  -- IT First Year A
  ('c0000000-0000-0000-0000-000000000007', 'cr000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000007', 'MONDAY', '09:00', '10:00', 'IT-101'),
  ('c0000000-0000-0000-0000-000000000007', 'cr000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000008', 'MONDAY', '10:00', '11:00', 'IT-102'),
  ('c0000000-0000-0000-0000-000000000007', 'cr000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000007', 'TUESDAY', '09:00', '10:00', 'IT-103');

-- =====================================================
-- SAMPLE ATTENDANCE RECORDS (Last 30 days)
-- =====================================================

DO $$
DECLARE
  student_rec RECORD;
  date_val DATE;
  attendance_status attendance_status;
  random_val FLOAT;
BEGIN
  FOR student_rec IN SELECT id FROM students WHERE class_id IN (
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000007'
  ) LOOP
    FOR date_val IN SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day')::DATE LOOP
      -- Skip weekends
      IF EXTRACT(DOW FROM date_val) NOT IN (0, 6) THEN
        random_val := random();
        
        -- Simulate realistic attendance: 85% present, 8% absent, 5% late, 2% on leave
        IF random_val < 0.85 THEN
          attendance_status := 'PRESENT';
        ELSIF random_val < 0.93 THEN
          attendance_status := 'ABSENT';
        ELSIF random_val < 0.98 THEN
          attendance_status := 'LATE';
        ELSE
          attendance_status := 'ON_LEAVE';
        END IF;

        INSERT INTO attendance (student_id, class_id, course_id, faculty_id, date, status, marked_at, verification_method)
        VALUES (
          student_rec.id,
          (SELECT class_id FROM students WHERE id = student_rec.id),
          (SELECT id FROM courses ORDER BY random() LIMIT 1),
          (SELECT id FROM faculty ORDER BY random() LIMIT 1),
          date_val,
          attendance_status,
          date_val + TIME '09:15:00',
          CASE WHEN random() < 0.7 THEN 'FACE_RECOGNITION' ELSE 'MANUAL' END
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- SAMPLE LEAVE REQUESTS
-- =====================================================

INSERT INTO leave_requests (student_id, type, start_date, end_date, reason, status, documents, approved_by, approved_at) VALUES
  ('s0000000-0000-0000-0001-000000000001', 'SICK', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '8 days', 'Fever and flu', 'APPROVED', '{"medical_certificate.pdf"}', 'f0000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '9 days'),
  ('s0000000-0000-0000-0001-000000000002', 'PERSONAL', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '4 days', 'Family function', 'APPROVED', NULL, 'f0000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '5 days'),
  ('s0000000-0000-0000-0001-000000000003', 'ACADEMIC', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'Attending inter-college competition', 'PENDING', '{"invitation_letter.pdf"}', NULL, NULL),
  ('s0000000-0000-0000-0002-000000000001', 'SICK', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '12 days', 'Surgery recovery', 'APPROVED', '{"hospital_discharge.pdf"}', 'f0000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '14 days'),
  ('s0000000-0000-0000-0003-000000000001', 'FAMILY_EMERGENCY', CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', 'Out of station for family emergency', 'PENDING', NULL, NULL, NULL);

-- =====================================================
-- SAMPLE NOTICES
-- =====================================================

INSERT INTO notices (title, content, type, priority, target_roles, target_departments, published_by, is_published, published_at, attachments) VALUES
  ('Mid-Semester Examination Schedule', 'The mid-semester examinations will be held from 15th to 22nd of this month. Please check the detailed timetable on the notice board.', 'ACADEMIC', 'HIGH', '["STUDENT", "FACULTY"]', NULL, 'a0000000-0000-0000-0000-000000000001', true, CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
  ('Annual Sports Day Registration', 'Registrations are now open for the Annual Sports Day events. Interested students can register through the sports portal.', 'EVENT', 'MEDIUM', '["STUDENT"]', NULL, 'a0000000-0000-0000-0000-000000000001', true, CURRENT_TIMESTAMP - INTERVAL '5 days', '["sports_events_list.pdf"]'),
  ('Faculty Development Program', 'A week-long FDP on AI/ML will be conducted starting next month. All faculty members are encouraged to participate.', 'ACADEMIC', 'MEDIUM', '["FACULTY", "CLASS_INCHARGE"]', NULL, 'a0000000-0000-0000-0000-000000000001', true, CURRENT_TIMESTAMP - INTERVAL '7 days', NULL),
  ('Campus Maintenance Notice', 'The campus will undergo maintenance on Sunday. Water and electricity may be unavailable from 6 AM to 2 PM.', 'GENERAL', 'HIGH', '["STUDENT", "FACULTY", "ADMIN"]', NULL, 'a0000000-0000-0000-0000-000000000002', true, CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
  ('New Library Timings', 'From next week, the library will remain open until 10 PM on weekdays and 6 PM on weekends.', 'GENERAL', 'LOW', '["STUDENT", "FACULTY"]', NULL, 'a0000000-0000-0000-0000-000000000002', true, CURRENT_TIMESTAMP - INTERVAL '10 days', NULL),
  ('CSE Department Meeting', 'All CSE faculty members are requested to attend the department meeting on Friday at 3 PM.', 'ADMINISTRATIVE', 'MEDIUM', '["FACULTY"]', '["550e8400-e29b-41d4-a716-446655440001"]', 'a0000000-0000-0000-0000-000000000001', true, CURRENT_TIMESTAMP - INTERVAL '3 days', NULL);

-- =====================================================
-- SAMPLE NOTIFICATIONS  
-- =====================================================

INSERT INTO notifications (user_id, type, title, message, priority, action_url, is_read) VALUES
  ('s0000000-0000-0000-0001-000000000001', 'ATTENDANCE_ALERT', 'Attendance Reminder', 'Your attendance in Data Structures is 78%. Keep it above 75%.', 'MEDIUM', '/student/attendance', false),
  ('s0000000-0000-0000-0001-000000000002', 'LEAVE_STATUS', 'Leave Approved', 'Your leave request for family function has been approved.', 'LOW', '/student/leaves', true),
  ('s0000000-0000-0000-0001-000000000003', 'LEAVE_STATUS', 'Leave Pending', 'Your leave request is pending approval from class incharge.', 'HIGH', '/student/leaves', false),
  ('f0000000-0000-0000-0000-000000000002', 'LEAVE_REQUEST', 'New Leave Request', 'Student Aanya Sharma has submitted a leave request for academic purposes.', 'HIGH', '/faculty/leaves', false),
  ('f0000000-0000-0000-0000-000000000001', 'SYSTEM', 'System Update', 'The attendance system has been updated with new features. Check the changelog.', 'LOW', '/changelog', false),
  ('a0000000-0000-0000-0000-000000000001', 'SECURITY', 'Security Alert', 'Multiple failed login attempts detected from IP 192.168.1.100.', 'CRITICAL', '/admin/security', false);

-- =====================================================
-- AUDIT LOG ENTRIES
-- =====================================================

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'CREATE', 'department', '550e8400-e29b-41d4-a716-446655440001', NULL, '{"name":"Computer Science and Engineering","code":"CSE"}', '192.168.1.1', 'Mozilla/5.0'),
  ('a0000000-0000-0000-0000-000000000001', 'CREATE', 'faculty', 'f0000000-0000-0000-0000-000000000001', NULL, '{"employee_id":"FAC-CSE-001","designation":"Professor"}', '192.168.1.1', 'Mozilla/5.0'),
  ('f0000000-0000-0000-0000-000000000002', 'UPDATE', 'leave', '1', '{"status":"PENDING"}', '{"status":"APPROVED"}', '192.168.1.2', 'Mozilla/5.0'),
  ('f0000000-0000-0000-0000-000000000001', 'CREATE', 'attendance', '100', NULL, '{"student_id":"s0000000-0000-0000-0001-000000000001","status":"PRESENT"}', '192.168.1.3', 'Mozilla/5.0');

-- =====================================================
-- SECURITY ALERTS
-- =====================================================

INSERT INTO security_alerts (alert_type, severity, description, user_id, ip_address, user_agent, payload, is_resolved) VALUES
  ('FAILED_LOGIN', 'MEDIUM', 'Multiple failed login attempts', NULL, '192.168.1.100', 'Mozilla/5.0', '{"attempts":5,"username":"unknown@test.com"}', false),
  ('SUSPICIOUS_ACTIVITY', 'HIGH', 'Unusual access pattern detected', 's0000000-0000-0000-0001-000000000005', '10.0.0.50', 'Python/3.9', '{"endpoint":"/api/attendance","requests_per_minute":100}', false),
  ('GEO_ANOMALY', 'LOW', 'Attendance marked from unusual location', 's0000000-0000-0000-0001-000000000007', '203.0.113.45', 'Mozilla/5.0', '{"latitude":28.6139,"longitude":77.2090,"expected_location":"Bangalore"}', true);

-- Show completion message
SELECT 'Seed data loaded successfully! ' || 
       (SELECT COUNT(*) FROM departments) || ' departments, ' ||
       (SELECT COUNT(*) FROM faculty) || ' faculty, ' ||
       (SELECT COUNT(*) FROM students) || ' students, ' ||
       (SELECT COUNT(*) FROM attendance) || ' attendance records created.' AS status;
