import { Request } from 'express';
import { UserRole, AttendanceStatus, AttendanceMethod, LeaveType, LeaveStatus, Priority, NotificationType } from '@prisma/client';

// Auth Types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
    lastName: string;
  role: UserRole;
  departmentId?: string;
  enrollmentId?: string;
  employeeId?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Attendance Types
export interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectId?: string;
  date: Date;
  status: AttendanceStatus;
  method: AttendanceMethod;
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
  priority: Priority;
  targetRoles: UserRole[];
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
  type: LeaveType;
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
export interface TimetableEntry {
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
  type: NotificationType;
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