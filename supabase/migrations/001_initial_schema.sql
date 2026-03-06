-- ============================================================
-- CAMPUSAI - SUPABASE DATABASE SCHEMA
-- Enterprise-grade Attendance & Student Information System
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ==================== ENUMS ====================
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FACULTY', 'CLASS_INCHARGE', 'STUDENT');
CREATE TYPE gender AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'ON_LEAVE');
CREATE TYPE attendance_method AS ENUM ('AI_FACE', 'MANUAL', 'QR_CODE', 'BIOMETRIC');
CREATE TYPE leave_type AS ENUM ('SICK', 'PERSONAL', 'FAMILY_EMERGENCY', 'ACADEMIC', 'OTHER');
CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE notification_type AS ENUM ('ATTENDANCE', 'LEAVE', 'NOTICE', 'SECURITY', 'SYSTEM', 'MESSAGE');
CREATE TYPE severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- ==================== USER MANAGEMENT ====================

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'STUDENT',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  date_of_birth DATE,
  gender gender,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  login_attempts INTEGER DEFAULT 0,
  lockout_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions tracking
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  device_info TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ROLE-BASED MODELS ====================

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions TEXT[] DEFAULT '{}',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  hod_id UUID, -- Will be FK to faculty
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  designation TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  joining_date DATE NOT NULL,
  specialization TEXT,
  qualifications TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add HOD FK after faculty table exists
ALTER TABLE departments ADD CONSTRAINT fk_hod FOREIGN KEY (hod_id) REFERENCES faculty(id);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  incharge_id UUID NOT NULL REFERENCES faculty(id),
  room_number TEXT,
  capacity INTEGER NOT NULL DEFAULT 60,
  academic_year TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, section, academic_year)
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id TEXT UNIQUE NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  batch_year INTEGER NOT NULL,
  semester INTEGER NOT NULL DEFAULT 1,
  face_data TEXT, -- Face embedding vector (base64)
  face_registered BOOLEAN DEFAULT false,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  faculty_id UUID REFERENCES faculty(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TIMETABLE ====================

CREATE TABLE timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ATTENDANCE SYSTEM ====================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  timetable_entry_id UUID REFERENCES timetable_entries(id),
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  method attendance_method NOT NULL DEFAULT 'MANUAL',
  confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
  location JSONB, -- {lat, lng, accuracy, address}
  device_info TEXT,
  ip_address INET,
  verified_by UUID REFERENCES faculty(id),
  justification TEXT,
  -- Blockchain integrity
  blockchain_hash TEXT,
  previous_hash TEXT,
  nonce INTEGER,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date, subject_id)
);

-- Create index for fast attendance lookups
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- ==================== LEAVE MANAGEMENT ====================

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  type leave_type NOT NULL,
  status leave_status DEFAULT 'PENDING',
  documents TEXT[] DEFAULT '{}', -- Supabase Storage URLs
  approved_by UUID REFERENCES faculty(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== GRADES ====================

CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  semester INTEGER NOT NULL,
  internal_marks DECIMAL(5,2),
  external_marks DECIMAL(5,2),
  total_marks DECIMAL(5,2),
  grade TEXT,
  grade_points DECIMAL(3,2),
  attendance_percentage DECIMAL(5,2),
  attendance_impact DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, semester)
);

-- ==================== NOTICE BOARD ====================

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority priority DEFAULT 'MEDIUM',
  target_roles user_role[] DEFAULT '{}',
  target_departments UUID[] DEFAULT '{}',
  target_classes UUID[] DEFAULT '{}',
  attachments TEXT[] DEFAULT '{}',
  expiry_date TIMESTAMPTZ,
  published_by UUID NOT NULL REFERENCES auth.users(id),
  read_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notice_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notice_id, user_id)
);

-- ==================== NOTIFICATIONS ====================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL,
  data JSONB,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ==================== MESSAGING ====================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- ==================== AUDIT LOGS ====================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==================== SECURITY ALERTS ====================

CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- face_mismatch, suspicious_login, geo_anomaly
  severity severity NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  data JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_alerts_unresolved ON security_alerts(resolved, created_at DESC);

-- ==================== SYSTEM SETTINGS ====================

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value, description, category) VALUES
('attendance_threshold', '{"warning": 75, "critical": 65}', 'Attendance percentage thresholds', 'attendance'),
('face_confidence_threshold', '{"min": 0.85}', 'Minimum confidence for face recognition', 'security'),
('geolocation_radius', '{"meters": 500}', 'Allowed radius from campus center', 'attendance'),
('session_timeout', '{"minutes": 30}', 'Session timeout duration', 'security'),
('mfa_required_roles', '{"roles": ["SUPER_ADMIN", "ADMIN"]}', 'Roles requiring MFA', 'security'),
('blockchain_enabled', '{"enabled": true}', 'Enable blockchain verification', 'security'),
('notification_channels', '{"email": true, "push": true, "sms": false}', 'Enabled notification channels', 'notifications');

-- ==================== ANALYTICS VIEWS ====================

-- Daily attendance summary
CREATE OR REPLACE VIEW daily_attendance_summary AS
SELECT 
  date,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status = 'LATE') as late,
  COUNT(*) FILTER (WHERE status = 'EXCUSED') as excused,
  ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM attendance
GROUP BY date
ORDER BY date DESC;

-- Department-wise attendance
CREATE OR REPLACE VIEW department_attendance_summary AS
SELECT 
  d.id as department_id,
  d.name as department_name,
  COUNT(DISTINCT s.id) as total_students,
  COUNT(a.id) as total_attendance_records,
  ROUND(AVG(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) * 100, 2) as avg_attendance
FROM departments d
LEFT JOIN students s ON s.department_id = d.id
LEFT JOIN attendance a ON a.student_id = s.id
GROUP BY d.id, d.name;

-- Student attendance overview
CREATE OR REPLACE VIEW student_attendance_overview AS
SELECT 
  s.id as student_id,
  s.enrollment_id,
  p.first_name,
  p.last_name,
  d.name as department,
  c.name as class_name,
  COUNT(a.id) as total_classes,
  COUNT(*) FILTER (WHERE a.status = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absent,
  ROUND(COUNT(*) FILTER (WHERE a.status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM students s
JOIN profiles p ON p.user_id = s.user_id
JOIN departments d ON d.id = s.department_id
JOIN classes c ON c.id = s.class_id
LEFT JOIN attendance a ON a.student_id = s.id
GROUP BY s.id, s.enrollment_id, p.first_name, p.last_name, d.name, c.name;

-- ==================== FUNCTIONS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notices_updated_at BEFORE UPDATE ON notices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate blockchain hash for attendance
CREATE OR REPLACE FUNCTION generate_attendance_hash()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
  data_to_hash TEXT;
BEGIN
  -- Get previous hash
  SELECT blockchain_hash INTO prev_hash 
  FROM attendance 
  WHERE student_id = NEW.student_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  NEW.previous_hash := COALESCE(prev_hash, 'GENESIS');
  
  -- Create hash from attendance data
  data_to_hash := NEW.student_id || NEW.date || NEW.status || NEW.method || 
                  COALESCE(NEW.confidence_score::TEXT, '') || NEW.previous_hash || NOW()::TEXT;
  
  NEW.blockchain_hash := encode(digest(data_to_hash, 'sha256'), 'hex');
  NEW.nonce := floor(random() * 1000000)::INTEGER;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_attendance_blockchain_hash
BEFORE INSERT ON attendance
FOR EACH ROW EXECUTE FUNCTION generate_attendance_hash();

-- Create notification on new attendance
CREATE OR REPLACE FUNCTION notify_attendance_marked()
RETURNS TRIGGER AS $$
DECLARE
  student_user_id UUID;
  student_name TEXT;
BEGIN
  -- Get student info
  SELECT s.user_id, p.first_name || ' ' || p.last_name 
  INTO student_user_id, student_name
  FROM students s
  JOIN profiles p ON p.user_id = s.user_id
  WHERE s.id = NEW.student_id;
  
  -- Create notification
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    student_user_id,
    'Attendance Marked',
    'Your attendance has been marked as ' || NEW.status || ' for today.',
    'ATTENDANCE',
    jsonb_build_object('attendance_id', NEW.id, 'status', NEW.status, 'date', NEW.date)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_attendance_insert
AFTER INSERT ON attendance
FOR EACH ROW EXECUTE FUNCTION notify_attendance_marked();

-- Create notification on leave status change
CREATE OR REPLACE FUNCTION notify_leave_status_change()
RETURNS TRIGGER AS $$
DECLARE
  student_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT user_id INTO student_user_id FROM students WHERE id = NEW.student_id;
    
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      student_user_id,
      'Leave Request ' || NEW.status,
      'Your leave request from ' || NEW.start_date || ' to ' || NEW.end_date || ' has been ' || LOWER(NEW.status::TEXT),
      'LEAVE',
      jsonb_build_object('leave_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_leave_status_change
AFTER UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION notify_leave_status_change();

-- Audit log trigger function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit logging to critical tables
CREATE TRIGGER audit_attendance AFTER INSERT OR UPDATE OR DELETE ON attendance FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_grades AFTER INSERT OR UPDATE OR DELETE ON grades FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_leave_requests AFTER INSERT OR UPDATE OR DELETE ON leave_requests FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ==================== HELPER FUNCTIONS ====================

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is faculty
CREATE OR REPLACE FUNCTION is_faculty(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid 
    AND role IN ('FACULTY', 'CLASS_INCHARGE')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get student ID from user ID
CREATE OR REPLACE FUNCTION get_student_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM students WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get faculty ID from user ID
CREATE OR REPLACE FUNCTION get_faculty_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM faculty WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Calculate attendance percentage for a student
CREATE OR REPLACE FUNCTION calculate_attendance_percentage(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  total_classes INTEGER;
  present_classes INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'PRESENT')
  INTO total_classes, present_classes
  FROM attendance
  WHERE student_id = p_student_id
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date);
  
  IF total_classes = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(present_classes::DECIMAL / total_classes * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get dashboard stats for admin
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_students', (SELECT COUNT(*) FROM students WHERE is_active = true),
    'total_faculty', (SELECT COUNT(*) FROM faculty WHERE is_active = true),
    'total_departments', (SELECT COUNT(*) FROM departments WHERE is_active = true),
    'total_classes', (SELECT COUNT(*) FROM classes WHERE is_active = true),
    'today_attendance', (
      SELECT COALESCE(
        ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
        0
      )
      FROM attendance WHERE date = CURRENT_DATE
    ),
    'pending_leaves', (SELECT COUNT(*) FROM leave_requests WHERE status = 'PENDING'),
    'security_alerts', (SELECT COUNT(*) FROM security_alerts WHERE resolved = false),
    'active_notices', (SELECT COUNT(*) FROM notices WHERE is_active = true AND (expiry_date IS NULL OR expiry_date > NOW()))
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON SCHEMA public IS 'CampusAI - Enterprise Attendance & Student Management System';
