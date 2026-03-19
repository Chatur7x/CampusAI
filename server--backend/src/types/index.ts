import { Request } from 'express';
import { user_role, attendance_status, attendance_method, leave_type, leave_status, priority, notification_type } from '@prisma/client';

// Auth Types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: user_role;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  role?: user_role;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: user_role;
  departmentId?: string;
  enrollmentId?: string;
  employeeId?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: user_role;
  iat?: number;
  exp?: number;
}

// Attendance Types
export interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectId?: string;
  date: Date;
  status: attendance_status;
  method: attendance_method;
  confidenceScore?: number;
  location?: GeoLocation;
  blockchainHash?: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface AIFaceVerification {
  studentId: string;
  faceData: string;
  confidence: number;
  livenessScore: number;
  isMatch: boolean;
}

// Notice Types
export interface NoticeCreate {
  title: string;
  content: string;
  priority: priority;
  targetRoles: user_role[];
  targetDepartments?: string[];
  targetClasses?: string[];
  attachments?: string[];
  expiryDate?: Date;
}

// Leave Types
export interface LeaveRequestCreate {
  studentId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  type: leave_type;
  documents?: string[];
}

// Analytics Types
export interface AttendanceAnalytics {
  studentId: string;
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
}

export interface DepartmentAnalytics {
  departmentId: string;
  departmentName: string;
  totalStudents: number;
  averageAttendance: number;
  topPerformers: string[];
  atRiskStudents: string[];
  weeklyTrend: number[];
}

// Timetable Types
export interface TimetableEntryType {
  id: string;
  classId: string;
  subjectId: string;
  facultyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
}

// Bulk Operations
export interface BulkUploadResult {
  success: number;
  failed: number;
  errors: {
    row: number;
    message: string;
  }[];
}

// Notification Types
export interface NotificationCreate {
  userId: string;
  title: string;
  message: string;
  type: notification_type;
  data?: Record<string, any>;
}

// Blockchain Types
export interface Block {
  index: number;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;
}

// Audit Log Types
export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Export Types
export interface ExportOptions {
  format: 'CSV' | 'PDF' | 'EXCEL';
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
}

// Chat Types
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachments?: string[];
  isRead: boolean;
  createdAt: Date;
}

// Theme Types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  layout: 'compact' | 'comfortable';
  language: string;
  sidebarCollapsed: boolean;
}
