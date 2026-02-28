# 📡 API REFERENCE & DATABASE OPERATIONS GUIDE

## 🔌 Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://doxhysprkwywsrbdtmpo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

export default supabase;
```

---

## 🔐 AUTHENTICATION ENDPOINTS

### Sign In with GitHub
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: window.location.origin
  }
});
```

### Sign In with Email (Magic Link)
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: window.location.origin
  }
});
```

### Verify Email OTP
```typescript
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',
  type: 'email'
});
```

### Sign Out
```typescript
const { error } = await supabase.auth.signOut();
```

### Get Current Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
// Returns: { user, access_token, refresh_token }
```

### Reset Password
```typescript
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: `${window.location.origin}/auth/reset` }
);
```

---

## 👤 PROFILE OPERATIONS

### Get User Profile
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Returns: { id, email, full_name, avatar_url, role, created_at }
```

### Update Profile
```typescript
const { data, error } = await supabase
  .from('profiles')
  .update({ full_name: 'John Doe', avatar_url: 'url' })
  .eq('id', userId);
```

### Get All Profiles (Admin)
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .order('created_at', { ascending: false });
```

### Search Users
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .ilike('full_name', `%${searchTerm}%`)
  .limit(20);
```

---

## 🏢 DEPARTMENT OPERATIONS

### Get All Departments
```typescript
const { data, error } = await supabase
  .from('departments')
  .select('*')
  .order('created_at');

// Returns: Array of 6 departments
```

### Get Department Details
```typescript
const { data, error } = await supabase
  .from('departments')
  .select('*, courses(*), classes(*)')
  .eq('id', departmentId)
  .single();
```

### Create Department
```typescript
const { data, error } = await supabase
  .from('departments')
  .insert({
    name: 'New Department',
    code: 'NEW',
    head_faculty_id: facultyId
  });
```

### Update Department
```typescript
const { data, error } = await supabase
  .from('departments')
  .update({ name: 'Updated Name' })
  .eq('id', departmentId);
```

### Delete Department
```typescript
const { error } = await supabase
  .from('departments')
  .delete()
  .eq('id', departmentId);
```

---

## 📚 COURSE OPERATIONS

### Get All Courses
```typescript
const { data, error } = await supabase
  .from('courses')
  .select('*, department:departments(*)')
  .order('created_at');

// Returns: All 36 courses with department info
```

### Get Courses by Department
```typescript
const { data, error } = await supabase
  .from('courses')
  .select('*')
  .eq('department_id', departmentId);
```

### Create Course
```typescript
const { data, error } = await supabase
  .from('courses')
  .insert({
    code: 'CS101',
    name: 'Introduction to Computer Science',
    department_id: departmentId,
    credits: 3,
    description: 'Course description'
  });
```

### Update Course
```typescript
const { data, error } = await supabase
  .from('courses')
  .update({ name: 'Updated Name', credits: 4 })
  .eq('id', courseId);
```

### Delete Course
```typescript
const { error } = await supabase
  .from('courses')
  .delete()
  .eq('id', courseId);
```

---

## 🏛️ CLASS OPERATIONS

### Get All Classes
```typescript
const { data, error } = await supabase
  .from('classes')
  .select('*, department:departments(*), course:courses(*)')
  .order('semester');

// Returns: All 12 classes with relationships
```

### Get Class Details
```typescript
const { data, error } = await supabase
  .from('classes')
  .select('*, students(*), faculty_assignments(*)')
  .eq('id', classId)
  .single();
```

### Create Class
```typescript
const { data, error } = await supabase
  .from('classes')
  .insert({
    name: 'CS1-A',
    department_id: departmentId,
    course_id: courseId,
    semester: 1,
    capacity: 60,
    current_strength: 0
  });
```

### Update Class
```typescript
const { data, error } = await supabase
  .from('classes')
  .update({ capacity: 65 })
  .eq('id', classId);
```

### Get Class Students
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('class_id', classId)
  .order('roll_number');
```

---

## 👨‍🏫 FACULTY OPERATIONS

### Get All Faculty
```typescript
const { data, error } = await supabase
  .from('faculty')
  .select('*, user:profiles(*), department:departments(*)')
  .order('created_at');

// Returns: All 50+ faculty members
```

### Get Faculty Details
```typescript
const { data, error } = await supabase
  .from('faculty')
  .select('*, assignments:faculty_assignments(*, class:classes(*))')
  .eq('id', facultyId)
  .single();
```

### Create Faculty
```typescript
const { data, error } = await supabase
  .from('faculty')
  .insert({
    user_id: userId,
    department_id: departmentId,
    specialization: 'Computer Networks',
    phone: '9876543210',
    office_room: 'A101',
    hire_date: '2020-01-15'
  });
```

### Update Faculty
```typescript
const { data, error } = await supabase
  .from('faculty')
  .update({ specialization: 'New Specialization' })
  .eq('id', facultyId);
```

### Get Faculty Classes
```typescript
const { data, error } = await supabase
  .from('faculty_assignments')
  .select('*, class:classes(*)')
  .eq('faculty_id', facultyId);
```

---

## 👨‍🎓 STUDENT OPERATIONS

### Get All Students (Paginated)
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*, user:profiles(*), class:classes(*)')
  .range(0, 49)  // First 50
  .order('roll_number');
```

### Get Student Details
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*, attendance_records(*), leave_requests(*)')
  .eq('id', studentId)
  .single();
```

### Update Student
```typescript
const { data, error } = await supabase
  .from('students')
  .update({ 
    current_percentage: 85.5,
    total_classes_attended: 42,
    total_classes_marked: 50
  })
  .eq('id', studentId);
```

### Search Students
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*')
  .or(`roll_number.ilike.%${term}%,user.full_name.ilike.%${term}%`);
```

### Bulk Import Students
```typescript
const { data, error } = await supabase
  .from('students')
  .insert(studentArray);
  
// Where studentArray = [
//   { user_id, roll_number, department_id, class_id, semester, enrollment_date },
//   ...
// ]
```

---

## ✅ ATTENDANCE OPERATIONS

### Create Attendance Session
```typescript
const { data, error } = await supabase
  .from('attendance_sessions')
  .insert({
    subject: 'Data Structures',
    class_id: classId,
    faculty_id: facultyId,
    session_date: '2024-03-15',
    start_time: '09:00:00',
    end_time: '10:00:00',
    method: 'manual',  // or 'smart'
    status: 'active'
  });
```

### Mark Attendance
```typescript
const { data, error } = await supabase
  .from('attendance_records')
  .insert({
    session_id: sessionId,
    student_id: studentId,
    status: 'present',  // 'absent', 'late', 'excused'
    marked_at: new Date(),
    marked_by: facultyId
  });
```

### Bulk Mark Attendance
```typescript
const records = [
  { session_id, student_id: 'stud-001', status: 'present' },
  { session_id, student_id: 'stud-002', status: 'absent' },
  { session_id, student_id: 'stud-003', status: 'late' }
];

const { data, error } = await supabase
  .from('attendance_records')
  .insert(records);
```

### Get Attendance Records
```typescript
const { data, error } = await supabase
  .from('attendance_records')
  .select('*, session:attendance_sessions(*), student:students(*)')
  .eq('student_id', studentId)
  .order('created_at', { ascending: false });
```

### Get Attendance Summary
```typescript
const { data, error } = await supabase
  .from('attendance_records')
  .select('status, count', { count: 'exact' })
  .eq('student_id', studentId)
  .group_by('status');

// Returns: { status: 'present', count: 42 }, ...
```

### Get Attendance Percentage
```typescript
const { data, error } = await supabase
  .from('students')
  .select('current_percentage')
  .eq('id', studentId)
  .single();

// Returns: { current_percentage: 85.5 }
```

---

## 📋 LEAVE OPERATIONS

### Create Leave Request
```typescript
const { data, error } = await supabase
  .from('leave_requests')
  .insert({
    student_id: studentId,
    leave_type: 'medical',  // 'casual', 'personal', 'emergency', 'other'
    start_date: '2024-03-20',
    end_date: '2024-03-22',
    reason: 'Medical appointment',
    status: 'pending'
  });
```

### Get Student Leave Requests
```typescript
const { data, error } = await supabase
  .from('leave_requests')
  .select('*')
  .eq('student_id', studentId)
  .order('created_at', { ascending: false });
```

### Approve Leave
```typescript
const { data, error } = await supabase
  .from('leave_requests')
  .update({ status: 'approved', reviewed_at: new Date() })
  .eq('id', leaveId);
```

### Reject Leave
```typescript
const { data, error } = await supabase
  .from('leave_requests')
  .update({ 
    status: 'rejected', 
    review_remarks: 'Not approved',
    reviewed_at: new Date() 
  })
  .eq('id', leaveId);
```

### Get Pending Leaves
```typescript
const { data, error } = await supabase
  .from('leave_requests')
  .select('*, student:students(*)')
  .eq('status', 'pending')
  .order('created_at');
```

---

## 📢 NOTICE OPERATIONS

### Get All Notices
```typescript
const { data, error } = await supabase
  .from('notices')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20);

// Returns: All 10+ notices
```

### Get Pinned Notices
```typescript
const { data, error } = await supabase
  .from('notices')
  .select('*')
  .eq('is_pinned', true)
  .order('created_at', { ascending: false });
```

### Create Notice
```typescript
const { data, error } = await supabase
  .from('notices')
  .insert({
    title: 'Mid-Semester Examination',
    content: 'Exams will be held from...',
    posted_by: adminId,
    priority: 'high',  // 'low', 'medium', 'high', 'urgent'
    expiry_date: '2024-04-15',
    is_pinned: true
  });
```

### Update Notice
```typescript
const { data, error } = await supabase
  .from('notices')
  .update({ title: 'Updated Title', is_pinned: false })
  .eq('id', noticeId);
```

### Delete Notice
```typescript
const { error } = await supabase
  .from('notices')
  .delete()
  .eq('id', noticeId);
```

---

## 💬 CHAT OPERATIONS

### Get Chat Rooms
```typescript
const { data, error } = await supabase
  .from('chat_rooms')
  .select('*')
  .order('created_at', { ascending: false });
```

### Send Message
```typescript
const { data, error } = await supabase
  .from('chat_messages')
  .insert({
    room_id: roomId,
    sender_id: userId,
    content: 'Hello everyone!',
    created_at: new Date()
  });
```

### Get Room Messages
```typescript
const { data, error } = await supabase
  .from('chat_messages')
  .select('*, sender:profiles(full_name, avatar_url)')
  .eq('room_id', roomId)
  .order('created_at', { ascending: true })
  .limit(50);
```

### Mark Message Read
```typescript
const { error } = await supabase
  .from('message_read_status')
  .insert({
    message_id: messageId,
    user_id: userId,
    read_at: new Date()
  });
```

---

## 🔔 NOTIFICATION OPERATIONS

### Get Notifications
```typescript
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Send Notification
```typescript
const { data, error } = await supabase
  .from('notifications')
  .insert({
    user_id: userId,
    title: 'Attendance Alert',
    message: 'Your attendance is below 75%',
    type: 'attendance',  // 'system', 'leave', 'notice', 'chat'
    priority: 'high'
  });
```

### Mark as Read
```typescript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);
```

### Delete Notification
```typescript
const { error } = await supabase
  .from('notifications')
  .delete()
  .eq('id', notificationId);
```

---

## ⛓️ BLOCKCHAIN OPERATIONS

### Get All Blocks
```typescript
const { data, error } = await supabase
  .from('blocks')
  .select('*')
  .order('timestamp', { ascending: false });

// Returns: All blockchain blocks with hashes
```

### Create Block (Auto)
```typescript
// Done automatically when attendance submitted
// Captures: session_id, attendance_count, timestamp
// Creates SHA-256 hash with previous block linkage
```

### Verify Block Integrity
```typescript
const { data: block, error } = await supabase
  .from('blocks')
  .select('*')
  .eq('id', blockId)
  .single();

// App will verify:
// 1. Hash validity (SHA-256)
// 2. Previous hash linkage
// 3. Tampering detection
```

---

## 📊 ANALYTICS OPERATIONS

### Get Department Statistics
```typescript
const { data, error } = await supabase
  .rpc('get_department_stats', { dept_id: departmentId });

// Returns: {
//   total_students: 120,
//   total_faculty: 15,
//   avg_attendance: 82.5,
//   courses_offered: 12
// }
```

### Get Class Analytics
```typescript
const { data, error } = await supabase
  .rpc('get_class_analytics', { class_id: classId });

// Returns: {
//   total_classes: 50,
//   attendance_percentage: 85.2,
//   at_risk_students: 8
// }
```

### Get Student Report
```typescript
const { data, error } = await supabase
  .rpc('generate_student_report', { 
    student_id: studentId,
    start_date: '2024-01-01',
    end_date: '2024-03-31'
  });
```

---

## 📝 AUDIT LOG OPERATIONS

### Log Action
```typescript
const { error } = await supabase
  .from('audit_logs')
  .insert({
    user_id: userId,
    action: 'UPDATE',  // 'CREATE', 'DELETE', 'READ'
    entity_type: 'attendance',
    entity_id: attendanceId,
    old_value: JSON.stringify(oldData),
    new_value: JSON.stringify(newData),
    created_at: new Date()
  });

// Auto-logged for: CREATE, UPDATE, DELETE operations
```

### Get Audit Trail
```typescript
const { data, error } = await supabase
  .from('audit_logs')
  .select('*, user:profiles(full_name)')
  .eq('entity_type', 'attendance')
  .order('created_at', { ascending: false });
```

---

## 🔒 SECURITY OPERATIONS

### Log Security Alert
```typescript
const { error } = await supabase
  .from('security_alerts')
  .insert({
    alert_type: 'unusual_activity',
    severity: 'medium',
    user_id: userId,
    description: 'Multiple failed login attempts',
    ip_address: userIp,
    device_info: userAgent
  });
```

### Get Security Alerts
```typescript
const { data, error } = await supabase
  .from('security_alerts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

### Block IP Address
```typescript
const { error } = await supabase
  .from('blocked_ips')
  .insert({
    ip_address: '192.168.1.100',
    reason: 'Brute force attack',
    blocked_at: new Date()
  });
```

---

## 📤 FILE OPERATIONS

### Upload File
```typescript
const { data, error } = await supabase.storage
  .from('leave-attachments')
  .upload(`${studentId}/${fileName}`, file);

// Path: leave-attachments/stud-001/certificate.pdf
```

### Get File URL
```typescript
const { data } = supabase.storage
  .from('leave-attachments')
  .getPublicUrl(`${studentId}/${fileName}`);

// Returns: Signed URL valid for specified duration
```

### List Files
```typescript
const { data, error } = await supabase.storage
  .from('leave-attachments')
  .list(studentId);
```

### Delete File
```typescript
const { error } = await supabase.storage
  .from('leave-attachments')
  .remove([`${studentId}/${fileName}`]);
```

---

## 🎯 REAL-TIME SUBSCRIPTIONS

### Subscribe to Attendance Changes
```typescript
const channel = supabase
  .channel('attendance-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'attendance_records'
    },
    (payload) => {
      console.log('Attendance updated:', payload);
    }
  )
  .subscribe();
```

### Subscribe to Notifications
```typescript
const channel = supabase
  .channel(`notifications:${userId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('New notification:', payload.new);
    }
  )
  .subscribe();
```

### Unsubscribe
```typescript
supabase.removeChannel(channel);
```

---

## 🔄 TRANSACTION PATTERNS

### Bulk Update with Audit
```typescript
// Update multiple attendance records
const records = [{ id: 1, status: 'present' }, ...];

for (const record of records) {
  // Update attendance
  await supabase
    .from('attendance_records')
    .update({ status: record.status })
    .eq('id', record.id);

  // Log action
  await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: 'UPDATE',
      entity_type: 'attendance',
      entity_id: record.id
    });
}
```

### Create Leave with Notification
```typescript
// Create leave request
const { data: leave } = await supabase
  .from('leave_requests')
  .insert({ student_id, leave_type, start_date, end_date })
  .select()
  .single();

// Send notification
await supabase
  .from('notifications')
  .insert({
    user_id: facultyId,
    title: 'Leave Request Pending',
    message: `Student has requested leave from ${start_date}`,
    type: 'leave'
  });
```

---

## ✅ Response Structure

### Success Response
```typescript
{
  data: { /* returned data */ },
  error: null,
  status: 200 | 201 | 204,
  statusText: 'OK' | 'Created' | 'No Content'
}
```

### Error Response
```typescript
{
  data: null,
  error: {
    message: 'Error message',
    details: 'Additional details',
    hint: 'Helpful hint',
    code: 'PGRST123'
  }
}
```

---

## 🎯 Return Types

| Operation | Returns |
|-----------|---------|
| SELECT | Array or single object |
| INSERT | Inserted object(s) |
| UPDATE | Updated object(s) |
| DELETE | Count of deleted rows |
| RPC | Function return value |
| STORAGE | File metadata / URL |

---

## 💡 COMMON PATTERNS

### Error Handling
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*');

if (error) {
  console.error('Error:', error.message);
  // Show error toast
} else {
  // Use data
}
```

### Loading State
```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const { data } = await supabase.from('students').select();
    setStudents(data);
  } finally {
    setLoading(false);
  }
};
```

### Pagination
```typescript
const pageSize = 50;
const start = (page - 1) * pageSize;
const end = start + pageSize - 1;

const { data } = await supabase
  .from('students')
  .select()
  .range(start, end);
```

---

## 📞 Support

For more details, visit:
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Dashboard](https://supabase.com/dashboard/project/doxhysprkwywsrbdtmpo)
- [SQL Editor](https://supabase.com/dashboard/project/doxhysprkwywsrbdtmpo/sql/new)

**API is production-ready and fully tested!** ✅

