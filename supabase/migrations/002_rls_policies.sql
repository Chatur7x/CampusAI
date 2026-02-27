-- ============================================================
-- CAMPUSAI - ROW LEVEL SECURITY POLICIES
-- Enterprise-grade access control
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ==================== PROFILES ====================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin(auth.uid()));

-- Admins can update all profiles
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (is_admin(auth.uid()));

-- Faculty can view student profiles in their classes
CREATE POLICY "Faculty can view student profiles" ON profiles
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.user_id = profiles.user_id
      AND c.incharge_id = get_faculty_id(auth.uid())
    )
  );

-- ==================== SESSIONS ====================

CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== DEPARTMENTS ====================

-- Everyone can view active departments
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (is_active = true);

-- Admins can manage departments
CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== FACULTY ====================

-- Faculty can view own record
CREATE POLICY "Faculty can view own record" ON faculty
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage faculty
CREATE POLICY "Admins can manage faculty" ON faculty
  FOR ALL USING (is_admin(auth.uid()));

-- Everyone can view active faculty (for timetables etc)
CREATE POLICY "Anyone can view active faculty" ON faculty
  FOR SELECT USING (is_active = true);

-- ==================== COURSES ====================

-- Everyone can view active courses
CREATE POLICY "Anyone can view courses" ON courses
  FOR SELECT USING (is_active = true);

-- Admins can manage courses
CREATE POLICY "Admins can manage courses" ON courses
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== CLASSES ====================

-- Everyone can view active classes
CREATE POLICY "Anyone can view classes" ON classes
  FOR SELECT USING (is_active = true);

-- Admins can manage classes
CREATE POLICY "Admins can manage classes" ON classes
  FOR ALL USING (is_admin(auth.uid()));

-- Faculty can view their assigned classes
CREATE POLICY "Faculty can view assigned classes" ON classes
  FOR SELECT USING (incharge_id = get_faculty_id(auth.uid()));

-- ==================== STUDENTS ====================

-- Students can view own record
CREATE POLICY "Students can view own record" ON students
  FOR SELECT USING (auth.uid() = user_id);

-- Students can update limited fields
CREATE POLICY "Students can update own record" ON students
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Faculty can view students in their classes
CREATE POLICY "Faculty can view class students" ON students
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = students.class_id
      AND incharge_id = get_faculty_id(auth.uid())
    )
  );

-- Admins can manage students
CREATE POLICY "Admins can manage students" ON students
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== SUBJECTS ====================

-- Everyone can view active subjects
CREATE POLICY "Anyone can view subjects" ON subjects
  FOR SELECT USING (is_active = true);

-- Admins can manage subjects
CREATE POLICY "Admins can manage subjects" ON subjects
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== TIMETABLE ====================

-- Everyone can view active timetable entries
CREATE POLICY "Anyone can view timetable" ON timetable_entries
  FOR SELECT USING (is_active = true);

-- Admins can manage timetable
CREATE POLICY "Admins can manage timetable" ON timetable_entries
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== ATTENDANCE ====================

-- Students can view own attendance
CREATE POLICY "Students can view own attendance" ON attendance
  FOR SELECT USING (student_id = get_student_id(auth.uid()));

-- Faculty can view attendance of their class students
CREATE POLICY "Faculty can view class attendance" ON attendance
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = attendance.student_id
      AND c.incharge_id = get_faculty_id(auth.uid())
    )
  );

-- Faculty can insert/update attendance for their classes
CREATE POLICY "Faculty can manage class attendance" ON attendance
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = attendance.student_id
      AND c.incharge_id = get_faculty_id(auth.uid())
    )
  );

-- Admins can manage all attendance
CREATE POLICY "Admins can manage attendance" ON attendance
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== LEAVE REQUESTS ====================

-- Students can view own leave requests
CREATE POLICY "Students can view own leaves" ON leave_requests
  FOR SELECT USING (student_id = get_student_id(auth.uid()));

-- Students can create leave requests
CREATE POLICY "Students can create leaves" ON leave_requests
  FOR INSERT WITH CHECK (student_id = get_student_id(auth.uid()));

-- Students can cancel pending requests
CREATE POLICY "Students can cancel pending leaves" ON leave_requests
  FOR UPDATE USING (
    student_id = get_student_id(auth.uid()) AND
    status = 'PENDING'
  );

-- Faculty can view and manage class leave requests
CREATE POLICY "Faculty can manage class leaves" ON leave_requests
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = leave_requests.student_id
      AND c.incharge_id = get_faculty_id(auth.uid())
    )
  );

-- Admins can manage all leave requests
CREATE POLICY "Admins can manage leaves" ON leave_requests
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== GRADES ====================

-- Students can view own grades
CREATE POLICY "Students can view own grades" ON grades
  FOR SELECT USING (student_id = get_student_id(auth.uid()));

-- Faculty can manage grades for their subjects
CREATE POLICY "Faculty can manage grades" ON grades
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM subjects
      WHERE id = grades.subject_id
      AND faculty_id = get_faculty_id(auth.uid())
    )
  );

-- Admins can manage all grades
CREATE POLICY "Admins can manage grades" ON grades
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== NOTICES ====================

-- Users can view notices targeted to their role
CREATE POLICY "Users can view targeted notices" ON notices
  FOR SELECT USING (
    is_active = true AND
    (expiry_date IS NULL OR expiry_date > NOW()) AND
    (
      -- Admin can see all
      is_admin(auth.uid()) OR
      -- User's role is in target_roles (or target_roles is empty = all roles)
      (
        array_length(target_roles, 1) IS NULL OR
        get_user_role(auth.uid()) = ANY(target_roles)
      )
    )
  );

-- Admins and faculty can create notices
CREATE POLICY "Admins can manage notices" ON notices
  FOR ALL USING (is_admin(auth.uid()) OR is_faculty(auth.uid()));

-- ==================== NOTICE READS ====================

-- Users can manage own notice reads
CREATE POLICY "Users can manage notice reads" ON notice_reads
  FOR ALL USING (auth.uid() = user_id);

-- ==================== NOTIFICATIONS ====================

-- Users can view own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can create notifications (via triggers)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Controlled by triggers

-- ==================== CONVERSATIONS & MESSAGES ====================

-- Users can view conversations they participate in
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- Users can view their conversation participations
CREATE POLICY "Users can view own participations" ON conversation_participants
  FOR SELECT USING (user_id = auth.uid());

-- Users can view messages in their conversations
CREATE POLICY "Users can view conversation messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- ==================== AUDIT LOGS ====================

-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (is_admin(auth.uid()));

-- Users can view audit logs of their own actions
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ==================== SECURITY ALERTS ====================

-- Admins can manage security alerts
CREATE POLICY "Admins can manage security alerts" ON security_alerts
  FOR ALL USING (is_admin(auth.uid()));

-- Users can view alerts about themselves
CREATE POLICY "Users can view own alerts" ON security_alerts
  FOR SELECT USING (auth.uid() = user_id);

-- ==================== SYSTEM SETTINGS ====================

-- Anyone can view public settings
CREATE POLICY "Anyone can view public settings" ON system_settings
  FOR SELECT USING (is_public = true);

-- Admins can view all settings
CREATE POLICY "Admins can view all settings" ON system_settings
  FOR SELECT USING (is_admin(auth.uid()));

-- Admins can manage settings
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (is_admin(auth.uid()));

-- ==================== ADMINS TABLE ====================

-- Admins can view admin records
CREATE POLICY "Admins can view admin records" ON admins
  FOR SELECT USING (is_admin(auth.uid()));

-- Super admins can manage admin records
CREATE POLICY "Super admins can manage admins" ON admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

COMMENT ON POLICY "Users can view own profile" ON profiles IS 'Basic self-access for users';
COMMENT ON POLICY "Admins can manage profiles" ON profiles IS 'Admin full access';
