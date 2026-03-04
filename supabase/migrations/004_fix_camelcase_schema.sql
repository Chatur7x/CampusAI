-- ============================================================
-- FIX: Adapt RPC functions and views to actual Prisma camelCase schema
-- The DB was created by Prisma with camelCase columns, but
-- the original migration SQL assumed snake_case columns.
-- ============================================================

-- ==================== DROP OLD FUNCTIONS ====================
DROP FUNCTION IF EXISTS get_user_role(UUID);
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS is_faculty(UUID);
DROP FUNCTION IF EXISTS get_student_id(UUID);
DROP FUNCTION IF EXISTS get_faculty_id(UUID);
DROP FUNCTION IF EXISTS calculate_attendance_percentage(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();

-- Drop old views so we can recreate them
DROP VIEW IF EXISTS daily_attendance_summary;
DROP VIEW IF EXISTS department_attendance_summary;
DROP VIEW IF EXISTS student_attendance_overview;

-- ==================== RECREATE HELPER FUNCTIONS ====================

-- get_user_role: role is in "users" table, not "profiles" 
-- Return TEXT now (the column may be TEXT from Prisma, not user_role enum)
CREATE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role::TEXT FROM users WHERE id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- is_admin: check "users" table
CREATE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_uuid 
    AND role::TEXT IN ('SUPER_ADMIN', 'ADMIN')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- is_faculty: check "users" table
CREATE FUNCTION is_faculty(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_uuid 
    AND role::TEXT IN ('FACULTY', 'CLASS_INCHARGE')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- get_student_id: students."userId" is camelCase
CREATE FUNCTION get_student_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM students WHERE "userId" = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- get_faculty_id: faculty."userId" is camelCase
CREATE FUNCTION get_faculty_id(user_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM faculty WHERE "userId" = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ==================== FIX ATTENDANCE PERCENTAGE FUNCTION ====================

CREATE FUNCTION calculate_attendance_percentage(
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
    COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT')
  INTO total_classes, present_classes
  FROM attendance
  WHERE "studentId" = p_student_id
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date);
  
  IF total_classes = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(present_classes::DECIMAL / total_classes * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== FIX ADMIN DASHBOARD STATS ====================

CREATE FUNCTION get_admin_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalStudents', (SELECT COUNT(*) FROM students),
    'totalFaculty', (SELECT COUNT(*) FROM faculty),
    'totalDepartments', (SELECT COUNT(*) FROM departments),
    'totalClasses', (SELECT COUNT(*) FROM classes),
    'todayAttendance', (
      SELECT COALESCE(
        ROUND(COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
        0
      )
      FROM attendance WHERE date = CURRENT_DATE
    ),
    'pendingLeaves', (SELECT COUNT(*) FROM leave_requests WHERE status::TEXT = 'PENDING'),
    'recentAlerts', (SELECT COUNT(*) FROM security_alerts WHERE resolved = false),
    'activeNotices', (SELECT COUNT(*) FROM notices WHERE ("expiryDate" IS NULL OR "expiryDate" > NOW()))
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== RECREATE ANALYTICS VIEWS ====================

-- Daily attendance summary (attendance columns: date, status are simple names - OK)
CREATE VIEW daily_attendance_summary AS
SELECT 
  date,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE status::TEXT = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status::TEXT = 'LATE') as late,
  COUNT(*) FILTER (WHERE status::TEXT = 'EXCUSED') as excused,
  ROUND(COUNT(*) FILTER (WHERE status::TEXT = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
FROM attendance
GROUP BY date
ORDER BY date DESC;

-- Department-wise attendance (fix camelCase FKs)
CREATE VIEW department_attendance_summary AS
SELECT 
  d.id as "departmentId",
  d.name as "departmentName",
  COUNT(DISTINCT s.id) as "studentCount",
  COUNT(a.id) as "totalAttendanceRecords",
  ROUND(AVG(CASE WHEN a.status::TEXT = 'PRESENT' THEN 1 ELSE 0 END) * 100, 2) as "attendancePercentage"
FROM departments d
LEFT JOIN students s ON s."departmentId" = d.id
LEFT JOIN attendance a ON a."studentId" = s.id
GROUP BY d.id, d.name;

-- Student attendance overview (fix camelCase columns)
CREATE VIEW student_attendance_overview AS
SELECT 
  s.id as "studentId",
  s."enrollmentId",
  p."firstName",
  p."lastName",
  d.name as department,
  c.name as "className",
  COUNT(a.id) as "totalClasses",
  COUNT(*) FILTER (WHERE a.status::TEXT = 'PRESENT') as present,
  COUNT(*) FILTER (WHERE a.status::TEXT = 'ABSENT') as absent,
  ROUND(COUNT(*) FILTER (WHERE a.status::TEXT = 'PRESENT')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as "attendancePercentage"
FROM students s
JOIN profiles p ON p."userId" = s."userId"
JOIN departments d ON d.id = s."departmentId"
JOIN classes c ON c.id = s."classId"
LEFT JOIN attendance a ON a."studentId" = s.id
GROUP BY s.id, s."enrollmentId", p."firstName", p."lastName", d.name, c.name;
