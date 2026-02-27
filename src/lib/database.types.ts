// =============================================================
// CAMPUSAI - SUPABASE DATABASE TYPES
// Auto-generated TypeScript types for Supabase
// =============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================
// ENUMS
// =============================================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FACULTY' | 'CLASS_INCHARGE' | 'STUDENT';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'ON_LEAVE';
export type AttendanceMethod = 'AI_FACE' | 'MANUAL' | 'QR_CODE' | 'BIOMETRIC';
export type LeaveType = 'SICK' | 'PERSONAL' | 'FAMILY_EMERGENCY' | 'ACADEMIC' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NotificationType = 'ATTENDANCE' | 'LEAVE' | 'NOTICE' | 'SECURITY' | 'SYSTEM' | 'MESSAGE';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// =============================================================
// TABLE ROW TYPES
// =============================================================

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  theme: string;
  language: string;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  login_attempts: number;
  lockout_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  hod_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Faculty {
  id: string;
  user_id: string;
  employee_id: string;
  designation: string;
  department_id: string;
  joining_date: string;
  specialization: string | null;
  qualifications: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  department_id: string;
  semester: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  section: string;
  department_id: string;
  semester: number;
  batch_year: number;
  class_incharge_id: string | null;
  room: string | null;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  enrollment_id: string;
  department_id: string;
  class_id: string;
  batch_year: number;
  semester: number;
  face_data: string | null;
  face_registered: boolean;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  course_id: string | null;
  faculty_id: string;
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  check_in_time: string | null;
  check_out_time: string | null;
  location_lat: number | null;
  location_lng: number | null;
  face_similarity_score: number | null;
  device_info: string | null;
  blockchain_hash: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  student_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  documents: string[] | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: Priority;
  target_roles: UserRole[];
  target_departments: string[];
  target_classes: string[];
  attachments: string[] | null;
  is_pinned: boolean;
  is_active: boolean;
  published_by: string;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: Priority;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  course_id: string;
  faculty_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string | null;
  content: string;
  is_read: boolean;
  read_at: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string;
  user_id: string | null;
  ip_address: string | null;
  metadata: Json | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// =============================================================
// INSERT TYPES (Omit auto-generated fields)
// =============================================================

export type ProfileInsert = Partial<Profile> & {
  user_id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
};

export type DepartmentInsert = Partial<Department> & {
  name: string;
  code: string;
};

export type FacultyInsert = Partial<Faculty> & {
  user_id: string;
  employee_id: string;
  designation: string;
  department_id: string;
  joining_date: string;
};

export type CourseInsert = Partial<Course> & {
  code: string;
  name: string;
  credits: number;
  department_id: string;
  semester: number;
};

export type ClassInsert = Partial<Class> & {
  name: string;
  section: string;
  department_id: string;
  semester: number;
  batch_year: number;
};

export type StudentInsert = Partial<Student> & {
  user_id: string;
  enrollment_id: string;
  department_id: string;
  class_id: string;
  batch_year: number;
  semester: number;
};

export type AttendanceInsert = Partial<Attendance> & {
  student_id: string;
  class_id: string;
  faculty_id: string;
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
};

export type LeaveInsert = Partial<Leave> & {
  student_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
};

export type NoticeInsert = Partial<Notice> & {
  title: string;
  content: string;
  type: string;
  priority: Priority;
  published_by: string;
};

export type NotificationInsert = Partial<Notification> & {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: Priority;
};

export type TimetableEntryInsert = Partial<TimetableEntry> & {
  class_id: string;
  course_id: string;
  faculty_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type MessageInsert = Partial<Message> & {
  sender_id: string;
  receiver_id: string;
  content: string;
};

export type AuditLogInsert = Partial<AuditLog> & {
  action: string;
  entity_type: string;
  entity_id: string;
};

export type SecurityAlertInsert = Partial<SecurityAlert> & {
  type: string;
  severity: Severity;
  title: string;
  description: string;
};

// =============================================================
// UPDATE TYPES (All fields optional)
// =============================================================

export type ProfileUpdate = Partial<Profile>;
export type DepartmentUpdate = Partial<Department>;
export type FacultyUpdate = Partial<Faculty>;
export type CourseUpdate = Partial<Course>;
export type ClassUpdate = Partial<Class>;
export type StudentUpdate = Partial<Student>;
export type AttendanceUpdate = Partial<Attendance>;
export type LeaveUpdate = Partial<Leave>;
export type NoticeUpdate = Partial<Notice>;
export type NotificationUpdate = Partial<Notification>;
export type TimetableEntryUpdate = Partial<TimetableEntry>;
export type MessageUpdate = Partial<Message>;
export type AuditLogUpdate = Partial<AuditLog>;
export type SecurityAlertUpdate = Partial<SecurityAlert>;

// =============================================================
// DATABASE INTERFACE FOR SUPABASE CLIENT
// =============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      departments: {
        Row: Department;
        Insert: DepartmentInsert;
        Update: DepartmentUpdate;
      };
      faculty: {
        Row: Faculty;
        Insert: FacultyInsert;
        Update: FacultyUpdate;
      };
      courses: {
        Row: Course;
        Insert: CourseInsert;
        Update: CourseUpdate;
      };
      classes: {
        Row: Class;
        Insert: ClassInsert;
        Update: ClassUpdate;
      };
      students: {
        Row: Student;
        Insert: StudentInsert;
        Update: StudentUpdate;
      };
      attendance: {
        Row: Attendance;
        Insert: AttendanceInsert;
        Update: AttendanceUpdate;
      };
      leaves: {
        Row: Leave;
        Insert: LeaveInsert;
        Update: LeaveUpdate;
      };
      notices: {
        Row: Notice;
        Insert: NoticeInsert;
        Update: NoticeUpdate;
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
      };
      timetable_entries: {
        Row: TimetableEntry;
        Insert: TimetableEntryInsert;
        Update: TimetableEntryUpdate;
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: MessageUpdate;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
      };
      security_alerts: {
        Row: SecurityAlert;
        Insert: SecurityAlertInsert;
        Update: SecurityAlertUpdate;
      };
    };
    Views: {
      daily_attendance_summary: {
        Row: {
          date: string;
          total_students: number;
          present: number;
          absent: number;
          late: number;
          on_leave: number;
          attendance_rate: number;
        };
      };
      department_attendance_summary: {
        Row: {
          department_id: string;
          department_name: string;
          total_students: number;
          avg_attendance_rate: number;
        };
      };
      student_attendance_overview: {
        Row: {
          student_id: string;
          student_name: string;
          enrollment_id: string;
          class_name: string;
          total_days: number;
          present_days: number;
          attendance_percentage: number;
        };
      };
    };
    Functions: {
      calculate_attendance_percentage: {
        Args: { student_uuid: string };
        Returns: number;
      };
      get_admin_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      gender: Gender;
      attendance_status: AttendanceStatus;
      attendance_method: AttendanceMethod;
      leave_type: LeaveType;
      leave_status: LeaveStatus;
      priority: Priority;
      notification_type: NotificationType;
      severity: Severity;
    };
  };
}

// =============================================================
// HELPER TYPE ALIASES
// =============================================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// =============================================================
// COMPOSITE TYPES (With Relations)
// =============================================================

export interface StudentWithProfile extends Student {
  profile?: Profile;
  department?: Department;
  class?: Class;
}

export interface FacultyWithProfile extends Faculty {
  profile?: Profile;
  department?: Department;
}

export interface AttendanceWithDetails extends Attendance {
  student?: StudentWithProfile;
  class?: Class;
  course?: Course;
  faculty?: FacultyWithProfile;
}

export interface LeaveWithDetails extends Leave {
  student?: StudentWithProfile;
  approver?: Profile;
}

export interface NoticeWithAuthor extends Notice {
  author?: Profile;
}

export interface TimetableEntryWithDetails extends TimetableEntry {
  class?: Class;
  course?: Course;
  faculty?: FacultyWithProfile;
}
