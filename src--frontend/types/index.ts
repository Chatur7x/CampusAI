// =============================================================
// CAMPUSAI - APPLICATION TYPES (camelCase)
// These types match the actual Prisma-generated DB columns.
// For Supabase query types, see lib/database.types.ts
//
// CONVENTION:
//   - DB columns → camelCase (Prisma): userId, firstName, classId
//   - These types → camelCase (same as DB)
//   - database.types.ts → snake_case (original migration, kept for compat)
//   - api.ts service layer handles the mapping transparently
// =============================================================

// ==================== USER TYPES ====================
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FACULTY' | 'CLASS_INCHARGE' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  profile?: Profile;
}

export interface Profile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  theme: string;
  language: string;
}

export interface UserWithProfile extends User {
  profile?: Profile;
}

// ==================== STUDENT TYPES ====================
export interface Student {
  id: string;
  userId: string;
  enrollmentId: string;
  departmentId: string;
  classId: string;
  batchYear: number;
  semester: number;
  faceData?: string;
  faceRegistered: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  department?: Department;
  class?: Class;
  user?: UserWithProfile;
}

// ==================== FACULTY TYPES ====================
export interface Faculty {
  id: string;
  userId: string;
  employeeId: string;
  designation: string;
  departmentId: string;
  joiningDate: string;
  specialization?: string;
  qualifications: string[];
  department?: Department;
  user?: UserWithProfile;
}

// ==================== ACADEMIC TYPES ====================
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  hodId?: string;
  createdAt: string;
  _count?: {
    students: number;
    faculty: number;
  };
}

export interface Course {
  id: string;
  name: string;
  code: string;
  credits: number;
  semester: number;
  departmentId: string;
  description?: string;
  department?: Department;
  _count?: {
    subjects: number;
    classes: number;
  };
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  courseId: string;
  facultyId?: string;
  course?: Course;
  faculty?: Faculty;
}

export interface Class {
  id: string;
  name: string;
  section: string;
  departmentId: string;
  courseId: string;
  inchargeId: string;
  roomNumber?: string;
  capacity: number;
  academicYear: string;
  department?: Department;
  course?: Course;
  incharge?: Faculty;
  _count?: {
    students: number;
  };
}

// ==================== ATTENDANCE TYPES ====================
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'ON_LEAVE' | 'FLAGGED';
export type AttendanceMethod = 'AI_FACE' | 'MANUAL' | 'QR_CODE' | 'BIOMETRIC' | 'FACE' | 'FINGERPRINT' | 'AI_FACE_SECURE';

export interface Attendance {
  id: string;
  studentId: string;
  subjectId?: string;
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  confidenceScore?: number;
  location?: GeoLocation;
  deviceInfo?: string;
  ipAddress?: string;
  verifiedBy?: string;
  justification?: string;
  blockchainHash?: string;
  previousHash?: string;
  createdAt: string;
  updatedAt: string;
  student?: Student;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

// ==================== TIMETABLE TYPES ====================
export interface TimetableEntry {
  id: string;
  classId: string;
  subjectId: string;
  facultyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  class?: Class;
  subject?: Subject;
  faculty?: Faculty;
}

// ==================== LEAVE TYPES ====================
export type LeaveType = 'SICK' | 'PERSONAL' | 'FAMILY_EMERGENCY' | 'ACADEMIC' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: LeaveType;
  status: LeaveStatus;
  documents: string[];
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
  student?: Student;
  approver?: Faculty;
}

// ==================== NOTICE TYPES ====================
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notice {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  targetRoles: UserRole[];
  targetDepartments: string[];
  targetClasses: string[];
  attachments: string[];
  expiryDate?: string;
  publishedBy: string;
  readCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
}

// ==================== NOTIFICATION TYPES ====================
export type NotificationType = 'ATTENDANCE' | 'LEAVE' | 'NOTICE' | 'SECURITY' | 'SYSTEM' | 'MESSAGE';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

// ==================== ANALYTICS TYPES ====================
export interface AttendanceAnalytics {
  overallPercentage: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalClasses: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  predictions: {
    predictedPercentage: number;
    classesNeeded: number;
    safeAbsenceMargin: number;
  };
  monthlyBreakdown: Record<string, { present: number; absent: number; total: number }>;
}

export interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalDepartments: number;
  todayAttendance: number;
  recentAlerts: number;
  pendingLeaves: number;
}

// ==================== BLOCKCHAIN TYPES ====================
export interface Block {
  index: number;
  timestamp: number;
  data: Record<string, unknown>;
  previousHash: string;
  hash: string;
  nonce: number;
}

export interface BlockchainStatus {
  status: 'VALID' | 'TAMPERED';
  totalBlocks: number;
  verifiedRecords: number;
  tamperedBlocks: number;
  chain: Block[];
  recentRecords: Attendance[];
}

// ==================== CHAT TYPES ====================
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachments: string[];
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  sender?: UserWithProfile;
}

export interface Conversation {
  user: UserWithProfile;
  lastMessage?: Message;
  unreadCount: number;
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== THEME TYPES ====================
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  layout: 'compact' | 'comfortable';
  language: string;
  sidebarCollapsed: boolean;
}