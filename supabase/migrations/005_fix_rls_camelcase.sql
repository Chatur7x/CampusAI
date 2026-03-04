-- ============================================================
-- FIX: RLS POLICIES FOR CAMELCASE PRISMA SCHEMA
-- All original policies referenced snake_case columns that
-- don't exist. This drops all old policies and recreates
-- them using the actual camelCase column names.
-- Also adds RLS on the `users` table (critical security fix).
-- ============================================================

-- ==================== DROP ALL EXISTING POLICIES ====================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Faculty can view student profiles" ON profiles;

-- sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;

-- departments
DROP POLICY IF EXISTS "Anyone can view departments" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;

-- faculty
DROP POLICY IF EXISTS "Faculty can view own record" ON faculty;
DROP POLICY IF EXISTS "Admins can manage faculty" ON faculty;
DROP POLICY IF EXISTS "Anyone can view active faculty" ON faculty;

-- courses
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Admins can manage courses" ON courses;

-- classes
DROP POLICY IF EXISTS "Anyone can view classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;
DROP POLICY IF EXISTS "Faculty can view assigned classes" ON classes;

-- students
DROP POLICY IF EXISTS "Students can view own record" ON students;
DROP POLICY IF EXISTS "Students can update own record" ON students;
DROP POLICY IF EXISTS "Faculty can view class students" ON students;
DROP POLICY IF EXISTS "Admins can manage students" ON students;

-- subjects
DROP POLICY IF EXISTS "Anyone can view subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

-- timetable_entries
DROP POLICY IF EXISTS "Anyone can view timetable" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable" ON timetable_entries;

-- attendance
DROP POLICY IF EXISTS "Students can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Faculty can view class attendance" ON attendance;
DROP POLICY IF EXISTS "Faculty can manage class attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can manage attendance" ON attendance;

-- leave_requests
DROP POLICY IF EXISTS "Students can view own leaves" ON leave_requests;
DROP POLICY IF EXISTS "Students can create leaves" ON leave_requests;
DROP POLICY IF EXISTS "Students can cancel pending leaves" ON leave_requests;
DROP POLICY IF EXISTS "Faculty can manage class leaves" ON leave_requests;
DROP POLICY IF EXISTS "Admins can manage leaves" ON leave_requests;

-- grades
DROP POLICY IF EXISTS "Students can view own grades" ON grades;
DROP POLICY IF EXISTS "Faculty can manage grades" ON grades;
DROP POLICY IF EXISTS "Admins can manage grades" ON grades;

-- notices
DROP POLICY IF EXISTS "Users can view targeted notices" ON notices;
DROP POLICY IF EXISTS "Admins can manage notices" ON notices;

-- notice_reads
DROP POLICY IF EXISTS "Users can manage notice reads" ON notice_reads;

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;

-- conversation_participants
DROP POLICY IF EXISTS "Users can view own participations" ON conversation_participants;

-- messages
DROP POLICY IF EXISTS "Users can view conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

-- security_alerts
DROP POLICY IF EXISTS "Admins can manage security alerts" ON security_alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON security_alerts;

-- system_settings
DROP POLICY IF EXISTS "Anyone can view public settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can view all settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;

-- admins
DROP POLICY IF EXISTS "Admins can view admin records" ON admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;


-- ==================== ENABLE RLS ON USERS TABLE ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ==================== USERS TABLE POLICIES ====================
-- Users can only read their own row (exclude sensitive fields via app-level select)
CREATE POLICY "users_self_read" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all user rows
CREATE POLICY "users_admin_read" ON users
  FOR SELECT USING (is_admin(auth.uid()));

-- Admins can update users (role changes, active status, etc.)
CREATE POLICY "users_admin_manage" ON users
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== PROFILES (userId column) ====================
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "profiles_faculty_view_students" ON profiles
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s."classId"
      WHERE s."userId" = profiles."userId"
      AND c."inchargeId" = get_faculty_id(auth.uid())
    )
  );


-- ==================== SESSIONS (userId column) ====================
CREATE POLICY "sessions_self_read" ON sessions
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "sessions_self_delete" ON sessions
  FOR DELETE USING (auth.uid() = "userId");


-- ==================== DEPARTMENTS (no is_active column) ====================
CREATE POLICY "departments_anyone_read" ON departments
  FOR SELECT USING (true);

CREATE POLICY "departments_admin_all" ON departments
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== FACULTY (userId, no is_active) ====================
CREATE POLICY "faculty_self_read" ON faculty
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "faculty_anyone_read" ON faculty
  FOR SELECT USING (true);

CREATE POLICY "faculty_admin_all" ON faculty
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== COURSES (departmentId, no is_active) ====================
CREATE POLICY "courses_anyone_read" ON courses
  FOR SELECT USING (true);

CREATE POLICY "courses_admin_all" ON courses
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== CLASSES (departmentId, inchargeId, no is_active) ====================
CREATE POLICY "classes_anyone_read" ON classes
  FOR SELECT USING (true);

CREATE POLICY "classes_faculty_assigned" ON classes
  FOR SELECT USING ("inchargeId" = get_faculty_id(auth.uid()));

CREATE POLICY "classes_admin_all" ON classes
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== STUDENTS (userId, classId) ====================
CREATE POLICY "students_self_read" ON students
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "students_self_update" ON students
  FOR UPDATE USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "students_faculty_class" ON students
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = students."classId"
      AND "inchargeId" = get_faculty_id(auth.uid())
    )
  );

CREATE POLICY "students_admin_all" ON students
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== SUBJECTS (facultyId, no is_active) ====================
CREATE POLICY "subjects_anyone_read" ON subjects
  FOR SELECT USING (true);

CREATE POLICY "subjects_admin_all" ON subjects
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== TIMETABLE_ENTRIES (snake_case, policies are fine) ====================
CREATE POLICY "timetable_anyone_read" ON timetable_entries
  FOR SELECT USING (is_active = true);

CREATE POLICY "timetable_admin_all" ON timetable_entries
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== TIMETABLE (camelCase Prisma table) ====================
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetable_v2_anyone_read" ON timetable
  FOR SELECT USING (true);

CREATE POLICY "timetable_v2_admin_all" ON timetable
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== ATTENDANCE (studentId) ====================
CREATE POLICY "attendance_self_read" ON attendance
  FOR SELECT USING ("studentId" = get_student_id(auth.uid()));

CREATE POLICY "attendance_faculty_class" ON attendance
  FOR SELECT USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s."classId"
      WHERE s.id = attendance."studentId"
      AND c."inchargeId" = get_faculty_id(auth.uid())
    )
  );

CREATE POLICY "attendance_faculty_manage" ON attendance
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s."classId"
      WHERE s.id = attendance."studentId"
      AND c."inchargeId" = get_faculty_id(auth.uid())
    )
  );

CREATE POLICY "attendance_admin_all" ON attendance
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== LEAVE_REQUESTS (studentId, approvedById) ====================
CREATE POLICY "leaves_self_read" ON leave_requests
  FOR SELECT USING ("studentId" = get_student_id(auth.uid()));

CREATE POLICY "leaves_self_create" ON leave_requests
  FOR INSERT WITH CHECK ("studentId" = get_student_id(auth.uid()));

CREATE POLICY "leaves_self_cancel" ON leave_requests
  FOR UPDATE USING (
    "studentId" = get_student_id(auth.uid()) AND
    status::TEXT = 'PENDING'
  );

CREATE POLICY "leaves_faculty_manage" ON leave_requests
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s."classId"
      WHERE s.id = leave_requests."studentId"
      AND c."inchargeId" = get_faculty_id(auth.uid())
    )
  );

CREATE POLICY "leaves_admin_all" ON leave_requests
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== GRADES (studentId, subjectId) ====================
CREATE POLICY "grades_self_read" ON grades
  FOR SELECT USING ("studentId" = get_student_id(auth.uid()));

CREATE POLICY "grades_faculty_manage" ON grades
  FOR ALL USING (
    is_faculty(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM subjects
      WHERE id = grades."subjectId"
      AND "facultyId" = get_faculty_id(auth.uid())
    )
  );

CREATE POLICY "grades_admin_all" ON grades
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== NOTICES (authorId, expiryDate, no target_roles/is_active) ====================
CREATE POLICY "notices_anyone_read" ON notices
  FOR SELECT USING (
    "expiryDate" IS NULL OR "expiryDate" > NOW()
  );

CREATE POLICY "notices_admin_faculty_manage" ON notices
  FOR ALL USING (is_admin(auth.uid()) OR is_faculty(auth.uid()));


-- ==================== NOTICE_READS (snake_case, OK) ====================
CREATE POLICY "notice_reads_self" ON notice_reads
  FOR ALL USING (auth.uid() = user_id);


-- ==================== NOTIFICATIONS (userId) ====================
CREATE POLICY "notifications_self_read" ON notifications
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "notifications_self_update" ON notifications
  FOR UPDATE USING (auth.uid() = "userId");

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);


-- ==================== CONVERSATIONS (snake_case, OK) ====================
CREATE POLICY "conversations_participant" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );


-- ==================== CONVERSATION_PARTICIPANTS (snake_case, OK) ====================
CREATE POLICY "conv_parts_self" ON conversation_participants
  FOR SELECT USING (user_id = auth.uid());


-- ==================== MESSAGES (senderId, receiverId — no conversation_id) ====================
-- Messages use direct sender/receiver model, not conversations
CREATE POLICY "messages_self_read" ON messages
  FOR SELECT USING (
    auth.uid() = "senderId" OR auth.uid() = "receiverId"
  );

CREATE POLICY "messages_self_send" ON messages
  FOR INSERT WITH CHECK (auth.uid() = "senderId");

CREATE POLICY "messages_admin_read" ON messages
  FOR SELECT USING (is_admin(auth.uid()));


-- ==================== AUDIT_LOGS (userId) ====================
CREATE POLICY "audit_admin_read" ON audit_logs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "audit_self_read" ON audit_logs
  FOR SELECT USING (auth.uid() = "userId");


-- ==================== SECURITY_ALERTS (snake_case, OK) ====================
CREATE POLICY "alerts_admin_all" ON security_alerts
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "alerts_self_read" ON security_alerts
  FOR SELECT USING (auth.uid() = user_id);


-- ==================== SYSTEM_SETTINGS (snake_case, OK) ====================
CREATE POLICY "settings_public_read" ON system_settings
  FOR SELECT USING (is_public = true);

CREATE POLICY "settings_admin_read" ON system_settings
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "settings_admin_all" ON system_settings
  FOR ALL USING (is_admin(auth.uid()));


-- ==================== ADMINS (userId) ====================
CREATE POLICY "admins_admin_read" ON admins
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "admins_super_manage" ON admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role::TEXT = 'SUPER_ADMIN'
    )
  );


-- ==================== BLOCKCHAIN_RECORDS ====================
ALTER TABLE blockchain_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blockchain_admin_read" ON blockchain_records
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "blockchain_anyone_insert" ON blockchain_records
  FOR INSERT WITH CHECK (true);


-- ==================== GRADES TABLE RLS ====================
-- (already enabled above via original migration, just confirming)


-- ============================================================
-- GRANT service_role BYPASS for edge functions
-- ============================================================
-- Service role automatically bypasses RLS in Supabase
-- No additional grants needed.
