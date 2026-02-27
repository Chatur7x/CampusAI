-- ============================================================
-- COMPREHENSIVE SEED DATA WITH DEMO DATA
-- Smart Campus Attendance System - Full Dataset
-- ============================================================

-- =====================================================
-- DEPARTMENTS (6 departments)
-- =====================================================
INSERT INTO departments (id, name, code, description, is_active) 
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Computer Science & Engineering', 'CSE', 'Department of Computer Science & Engineering - AI, ML, Web Development Focus', true),
  ('d1000000-0000-0000-0000-000000000002', 'Electronics & Communication', 'ECE', 'Department of Electronics & Communication Engineering - VLSI, Signal Processing', true),
  ('d1000000-0000-0000-0000-000000000003', 'Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering - CAD, Thermodynamics, Robotics', true),
  ('d1000000-0000-0000-0000-000000000004', 'Civil Engineering', 'CIVIL', 'Department of Civil Engineering - Structures, Surveying, Transportation', true),
  ('d1000000-0000-0000-0000-000000000005', 'Information Technology', 'IT', 'Department of Information Technology - Software Development, Cloud Computing', true),
  ('d1000000-0000-0000-0000-000000000006', 'Electrical Engineering', 'EE', 'Department of Electrical Engineering - Power Systems, Renewable Energy', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COURSES (36 courses - 6 per department)
-- =====================================================
INSERT INTO courses (id, name, code, description, credits, department_id, is_active) VALUES
-- CSE Courses
('c1000000-0000-0000-0000-000000000001', 'Data Structures & Algorithms', 'CS201', 'Fundamental data structures, sorting algorithms, complexity analysis', 4, 'd1000000-0000-0000-0000-000000000001', true),
('c1000000-0000-0000-0000-000000000002', 'Database Management Systems', 'CS202', 'Relational databases, SQL, normalization, query optimization', 4, 'd1000000-0000-0000-0000-000000000001', true),
('c1000000-0000-0000-0000-000000000003', 'Operating Systems', 'CS301', 'Process management, memory allocation, file systems, scheduling', 4, 'd1000000-0000-0000-0000-000000000001', true),
('c1000000-0000-0000-0000-000000000004', 'Computer Networks', 'CS302', 'Network protocols, TCP/IP, Routing, Security fundamentals', 4, 'd1000000-0000-0000-0000-000000000001', true),
('c1000000-0000-0000-0000-000000000005', 'Machine Learning', 'CS401', 'Supervised learning, unsupervised learning, neural networks, deep learning', 4, 'd1000000-0000-0000-0000-000000000001', true),
('c1000000-0000-0000-0000-000000000006', 'Web Technologies', 'CS303', 'HTML, CSS, JavaScript, React, Node.js, REST APIs', 3, 'd1000000-0000-0000-0000-000000000001', true),
-- ECE Courses
('c1000000-0000-0000-0000-000000000007', 'Digital Electronics', 'EC201', 'Boolean algebra, logic gates, combinational circuits, sequential circuits', 4, 'd1000000-0000-0000-0000-000000000002', true),
('c1000000-0000-0000-0000-000000000008', 'Signals & Systems', 'EC202', 'Signal representation, Fourier transform, filtering, modulation', 4, 'd1000000-0000-0000-0000-000000000002', true),
('c1000000-0000-0000-0000-000000000009', 'VLSI Design', 'EC301', 'VLSI architecture, design flow, simulation, testing, layout', 4, 'd1000000-0000-0000-0000-000000000002', true),
('c1000000-0000-0000-0000-000000000010', 'Embedded Systems', 'EC302', 'Microcontrollers, real-time OS, embedded C, hardware interface', 4, 'd1000000-0000-0000-0000-000000000002', true),
('c1000000-0000-0000-0000-000000000011', 'Microwave Engineering', 'EC303', 'Transmission lines, waveguides, antennas, microwave circuits', 3, 'd1000000-0000-0000-0000-000000000002', true),
('c1000000-0000-0000-0000-000000000012', 'Power Electronics', 'EC304', 'Thyristors, converters, inverters, motor drives, power supplies', 3, 'd1000000-0000-0000-0000-000000000002', true),
-- Add more courses for MECH, CIVIL, IT, EE...
('c1000000-0000-0000-0000-000000000013', 'Thermodynamics I', 'ME201', 'First law, second law, entropy, cycles, thermodynamic processes', 4, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000014', 'Mechanics of Materials', 'ME202', 'Stress-strain, torsion, bending, combined loading, failure theories', 4, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000015', 'Fluid Mechanics', 'ME301', 'Fluid properties, flow classification, Bernoulli equation, flow measurement', 4, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000016', 'Machine Design', 'ME302', 'Design process, stress analysis, failure prevention, component design', 4, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000017', 'Robotics & Automation', 'ME401', 'Robot kinematics, dynamics, control, actuators, sensors, programming', 3, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000018', 'CAD & Modeling', 'ME303', 'Solid modeling, surface modeling, assembly, drawing, simulation', 3, 'd1000000-0000-0000-0000-000000000003', true),
('c1000000-0000-0000-0000-000000000019', 'Structural Analysis', 'CE201', 'Determinate structures, indeterminate structures, matrix methods', 4, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000020', 'Concrete Technology', 'CE202', 'Cement, aggregates, concrete design, reinforcement, durability', 4, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000021', 'Surveying', 'CE301', 'Linear measurements, leveling, traversing, triangulation, plotting', 4, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000022', 'Transportation Engineering', 'CE302', 'Traffic flow, road design, pavement, capacity analysis', 4, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000023', 'Geotechnical Engineering', 'CE401', 'Soil properties, compaction, bearing capacity, slope stability', 3, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000024', 'Water Resources', 'CE303', 'Hydrology, irrigation design, water supply, dams, reservoirs', 3, 'd1000000-0000-0000-0000-000000000004', true),
('c1000000-0000-0000-0000-000000000025', 'Software Engineering', 'IT201', 'SDLC, design patterns, testing, version control, agile methodologies', 4, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000026', 'Cloud Computing', 'IT301', 'Cloud services, AWS, Azure, containerization, serverless architecture', 4, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000027', 'Cybersecurity', 'IT302', 'Cryptography, network security, penetration testing, compliance', 4, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000028', 'Big Data Analytics', 'IT303', 'Hadoop, Spark, data warehousing, MapReduce, data mining', 3, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000029', 'Mobile Development', 'IT401', 'Android, iOS, React Native, Flutter, mobile UI/UX', 3, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000030', 'DevOps Engineering', 'IT304', 'CI/CD, Docker, Kubernetes, Infrastructure as Code, monitoring', 3, 'd1000000-0000-0000-0000-000000000005', true),
('c1000000-0000-0000-0000-000000000031', 'Power Systems', 'EE201', 'AC circuits, three-phase systems, power transmission, transformers', 4, 'd1000000-0000-0000-0000-000000000006', true),
('c1000000-0000-0000-0000-000000000032', 'Electrical Machines', 'EE202', 'DC machines, AC motors, generators, induction machines', 4, 'd1000000-0000-0000-0000-000000000006', true),
('c1000000-0000-0000-0000-000000000033', 'Control Systems', 'EE301', 'System analysis, transfer functions, stability, Bode plots', 4, 'd1000000-0000-0000-0000-000000000006', true),
('c1000000-0000-0000-0000-000000000034', 'Power Electronics', 'EE302', 'Power converters, rectifiers, inverters, motor drives', 4, 'd1000000-0000-0000-0000-000000000006', true),
('c1000000-0000-0000-0000-000000000035', 'Renewable Energy', 'EE401', 'Solar, wind, hydro power, energy storage, grid integration', 3, 'd1000000-0000-0000-0000-000000000006', true),
('c1000000-0000-0000-0000-000000000036', 'High Voltage Engineering', 'EE303', 'Insulation, breakdown, surge protection, testing, maintenance', 3, 'd1000000-0000-0000-0000-000000000006', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- CLASSES (12 classes - 2 per department per year)
-- =====================================================
INSERT INTO classes (id, name, section, semester, academic_year, capacity, department_id, is_active) 
VALUES
('cl000000-0000-0000-0000-000000000001', 'CSE First Year A', 'A', 1, '2024-2025', 60, 'd1000000-0000-0000-0000-000000000001', true),
('cl000000-0000-0000-0000-000000000002', 'CSE First Year B', 'B', 1, '2024-2025', 60, 'd1000000-0000-0000-0000-000000000001', true),
('cl000000-0000-0000-0000-000000000003', 'ECE Third Year A', 'A', 5, '2024-2025', 55, 'd1000000-0000-0000-0000-000000000002', true),
('cl000000-0000-0000-0000-000000000004', 'ECE Fourth Year B', 'B', 8, '2024-2025', 50, 'd1000000-0000-0000-0000-000000000002', true),
('cl000000-0000-0000-0000-000000000005', 'MECH Second Year A', 'A', 3, '2024-2025', 55, 'd1000000-0000-0000-0000-000000000003', true),
('cl000000-0000-0000-0000-000000000006', 'MECH Third Year B', 'B', 5, '2024-2025', 52, 'd1000000-0000-0000-0000-000000000003', true),
('cl000000-0000-0000-0000-000000000007', 'CIVIL First Year A', 'A', 1, '2024-2025', 58, 'd1000000-0000-0000-0000-000000000004', true),
('cl000000-0000-0000-0000-000000000008', 'CIVIL Second Year B', 'B', 3, '2024-2025', 56, 'd1000000-0000-0000-0000-000000000004', true),
('cl000000-0000-0000-0000-000000000009', 'IT First Year A', 'A', 1, '2024-2025', 60, 'd1000000-0000-0000-0000-000000000005', true),
('cl000000-0000-0000-0000-000000000010', 'IT Third Year B', 'B', 5, '2024-2025', 54, 'd1000000-0000-0000-0000-000000000005', true),
('cl000000-0000-0000-0000-000000000011', 'EE Second Year A', 'A', 3, '2024-2025', 57, 'd1000000-0000-0000-0000-000000000006', true),
('cl000000-0000-0000-0000-000000000012', 'EE Fourth Year B', 'B', 8, '2024-2025', 51, 'd1000000-0000-0000-0000-000000000006', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- ADMIN USERS (2 admins - need real auth.users IDs)
-- =====================================================
-- Note: Replace these UUIDs with actual Supabase auth.users IDs after users sign up

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
('semester', '2', 'Current semester'),
('working_days_per_week', '5', 'Number of working days'),
('working_days_per_semester', '90', 'Approximate working days per semester'),
('minimum_attendance_for_exam', '75', 'Min attendance % to write exam'),
('attendance_calculator_enabled', 'true', 'Enable predictive attendance calculator'),
('ai_face_recognition_enabled', 'true', 'Enable AI face recognition'),
('manual_attendance_allowed', 'true', 'Allow manual attendance marking'),
('hybrid_attendance_allowed', 'true', 'Allow hybrid attendance (manual + AI)'),
('geolocation_validation', 'false', 'Require geolocation validation for attendance'),
('device_fingerprinting', 'true', 'Enable device fingerprinting'),
('two_factor_authentication', 'optional', 'Require 2FA: required, optional, disabled'),
('password_expiry_days', '90', 'Days before password expires'),
('failed_login_threshold', '5', 'Failed attempts before account lockout'),
('lockout_duration_minutes', '30', 'Minutes account is locked after failed attempts'),
('enable_api_keys', 'true', 'Allow API key generation'),
('max_api_connections', '100', 'Maximum concurrent API connections per user'),
('data_retention_years', '5', 'Years to retain historical data'),
('backup_frequency', 'daily', 'Backup frequency: hourly, daily, weekly'),
('enable_audit_logging', 'true', 'Enable comprehensive audit logging'),
('enable_security_alerts', 'true', 'Enable security alert system'),
('enable_blockchain_for_attendance', 'true', 'Store attendance hashes in blockchain'),
('enable_predictive_analytics', 'true', 'Enable attendance prediction models'),
('enable_real_time_notifications', 'true', 'Enable WebSocket real-time notifications'),
('enable_scheduled_reports', 'true', 'Enable scheduled report generation'),
('timezone', 'Asia/Kolkata', 'System timezone'),
('date_format', 'DD-MM-YYYY', 'Date format for display'),
('theme_primary_color', '#10B981', 'Primary theme color hex'),
('theme_dark_mode', 'true', 'Enable dark mode by default'),
('max_file_upload_mb', '50', 'Maximum file upload size in MB'),
('allowed_file_types', 'pdf,jpg,png,jpeg,doc,docx,xls,xlsx', 'Allowed file types'),
('enable_chat_system', 'true', 'Enable internal chat system'),
('enable_notice_board', 'true', 'Enable notice board'),
('enable_leave_management', 'true', 'Enable leave request system'),
('enable_timetable_system', 'true', 'Enable timetable management'),
('enable_analytics_dashboard', 'true', 'Enable analytics dashboards'),
('enable_report_generation', 'true', 'Enable report generation'),
('email_from_address', 'noreply@campusai.edu', 'Email sender address'),
('email_from_name', 'Campus AI - Smart Attendance', 'Email sender name'),
('test_mode', 'false', 'Enable test/demo mode with fake data'),
('demo_data_students_count', '500', 'Number of demo students to create'),
('demo_data_faculty_count', '50', 'Number of demo faculty to create'),
('demo_data_days_history', '90', 'Days of historical demo attendance data'),
('version', '1.0.0', 'System version'),
('last_backup', NOW()::text, 'Last backup timestamp'),
('total_users', '0', 'Total registered users'),
('total_attendance_records', '0', 'Total attendance records'),
('total_leave_requests', '0', 'Total leave requests'),
('system_health_status', 'healthy', 'System health: healthy, warning, critical'),
('enable_maintenance_mode', 'false', 'Enable maintenance mode')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT 'βœ… Seed data loaded successfully!' as status;
