// =============================================================
// CAMPUSAI - SUPABASE API SERVICES
// Enterprise-grade data access layer
// =============================================================

import { supabase } from './supabase';
import type {
  Profile,
  Department,
  Faculty,
  Course,
  Class,
  Student,
  TimetableEntry,
  Attendance,
  Leave,
  Notice,
  Notification,
  SecurityAlert,
  AuditLog,
  UserRole,
  AttendanceStatus,
  LeaveStatus,
} from './database.types.ts';

// =============================================================
// ERROR HANDLING
// =============================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function handleError(error: { message: string; code?: string; status?: number }): never {
  console.error('API Error:', error);
  throw new ApiError(
    error.message || 'An unknown error occurred',
    error.code || 'UNKNOWN_ERROR',
    error.status || 500
  );
}

// =============================================================
// AUTHENTICATION SERVICE
// =============================================================

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) handleError(error);
    return data;
  },

  async signInWithMagicLink(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) handleError(error);
    return data;
  },

  async signInWithOAuth(provider: 'google' | 'github' | 'azure') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) handleError(error);
    return data;
  },

  async signUp(email: string, password: string, userData: Partial<Profile>) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role || 'STUDENT',
        },
      },
    });
    if (authError) handleError(authError);
    return authData;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) handleError(error);
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) handleError(error);
    return user;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) handleError(error);
    return session;
  },

  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) handleError(error);
    return data;
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// PROFILE SERVICE
// =============================================================

export const profileService = {
  async getCurrent(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async getById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async update(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) handleError(uploadError);
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    await profileService.update(userId, { avatar_url: publicUrl });
    return publicUrl;
  },
};

// =============================================================
// DEPARTMENT SERVICE
// =============================================================

export const departmentService = {
  async getAll(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) handleError(error);
    return data || [];
  },

  async getById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(department: Partial<Department>): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .insert(department as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .update({ is_active: false } as any)
      .eq('id', id);
    
    if (error) handleError(error);
  },
};

// =============================================================
// FACULTY SERVICE
// =============================================================

export const facultyService = {
  async getAll(filters?: { departmentId?: string }): Promise<Faculty[]> {
    let query = supabase
      .from('faculty')
      .select(`
        *,
        profile:profiles(*),
        department:departments(*)
      `)
      .eq('is_active', true);

    if (filters?.departmentId) {
      query = query.eq('department_id', filters.departmentId);
    }

    const { data, error } = await query.order('employee_id');
    if (error) handleError(error);
    return data || [];
  },

  async getById(id: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .select(`
        *,
        profile:profiles(*),
        department:departments(*)
      `)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(faculty: Partial<Faculty>): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .insert(faculty as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Faculty>): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// STUDENT SERVICE
// =============================================================

export const studentService = {
  async getAll(filters?: { classId?: string; departmentId?: string }): Promise<Student[]> {
    let query = supabase
      .from('students')
      .select(`
        *,
        profile:profiles(*),
        department:departments(*),
        class:classes(*)
      `)
      .eq('is_active', true);

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters?.departmentId) {
      query = query.eq('department_id', filters.departmentId);
    }

    const { data, error } = await query.order('enrollment_id');
    if (error) handleError(error);
    return data || [];
  },

  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(*),
        department:departments(*),
        class:classes(*)
      `)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(student: Partial<Student>): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .insert(student as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Student>): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async registerFace(studentId: string, faceData: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ face_data: faceData, face_registered: true } as any)
      .eq('id', studentId);
    
    if (error) handleError(error);
  },
};

// =============================================================
// CLASS SERVICE
// =============================================================

export const classService = {
  async getAll(filters?: { departmentId?: string; semester?: number }): Promise<Class[]> {
    let query = supabase
      .from('classes')
      .select(`
        *,
        department:departments(*),
        class_incharge:faculty(*, profile:profiles(*))
      `)
      .eq('is_active', true);

    if (filters?.departmentId) {
      query = query.eq('department_id', filters.departmentId);
    }
    if (filters?.semester) {
      query = query.eq('semester', filters.semester);
    }

    const { data, error } = await query.order('name');
    if (error) handleError(error);
    return data || [];
  },

  async getById(id: string): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        department:departments(*),
        class_incharge:faculty(*, profile:profiles(*))
      `)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(classData: Partial<Class>): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .insert(classData as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Class>): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// COURSE SERVICE
// =============================================================

export const courseService = {
  async getAll(filters?: { departmentId?: string; semester?: number }): Promise<Course[]> {
    let query = supabase
      .from('courses')
      .select('*, department:departments(*)')
      .eq('is_active', true);

    if (filters?.departmentId) {
      query = query.eq('department_id', filters.departmentId);
    }
    if (filters?.semester) {
      query = query.eq('semester', filters.semester);
    }

    const { data, error } = await query.order('code');
    if (error) handleError(error);
    return data || [];
  },

  async getById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select('*, department:departments(*)')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(course: Partial<Course>): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .insert(course as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Course>): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// ATTENDANCE SERVICE
// =============================================================

export const attendanceService = {
  async getForStudent(
    studentId: string,
    filters?: { startDate?: string; endDate?: string; courseId?: string }
  ): Promise<Attendance[]> {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        course:courses(*),
        faculty:faculty(*, profile:profiles(*))
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters?.courseId) {
      query = query.eq('course_id', filters.courseId);
    }

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async getForClass(
    classId: string,
    date: string,
    courseId?: string
  ): Promise<Attendance[]> {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        student:students(*, profile:profiles(*))
      `)
      .eq('class_id', classId)
      .eq('date', date);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('created_at');
    if (error) handleError(error);
    return data || [];
  },

  async mark(attendance: Partial<Attendance>): Promise<Attendance | null> {
    const { data, error } = await supabase
      .from('attendance')
      .insert(attendance as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async markBulk(records: Partial<Attendance>[]): Promise<Attendance[]> {
    const { data, error } = await supabase
      .from('attendance')
      .insert(records as any)
      .select();
    
    if (error) handleError(error);
    return data || [];
  },

  async update(id: string, updates: Partial<Attendance>): Promise<Attendance | null> {
    const { data, error } = await supabase
      .from('attendance')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async getStatistics(studentId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase.rpc('calculate_attendance_percentage', {
      student_uuid: studentId,
    } as any);
    
    if (error) handleError(error);
    return { percentage: data || 0 };
  },
};

// =============================================================
// LEAVE SERVICE
// =============================================================

export const leaveService = {
  async getForStudent(studentId: string): Promise<Leave[]> {
    const { data, error } = await supabase
      .from('leaves')
      .select(`
        *,
        approver:profiles!approved_by(*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) handleError(error);
    return data || [];
  },

  async getPending(filters?: { classId?: string }): Promise<Leave[]> {
    let query = supabase
      .from('leaves')
      .select(`
        *,
        student:students(*, profile:profiles(*), class:classes(*))
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    
    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async create(leave: Partial<Leave>): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leaves')
      .insert(leave as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async approve(
    leaveId: string, 
    approverId: string, 
    comments?: string
  ): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leaves')
      .update({
        status: 'APPROVED' as LeaveStatus,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      } as any)
      .eq('id', leaveId)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async reject(
    leaveId: string,
    approverId: string,
    reason: string
  ): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leaves')
      .update({
        status: 'REJECTED' as LeaveStatus,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      } as any)
      .eq('id', leaveId)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async cancel(leaveId: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leaves')
      .update({ status: 'CANCELLED' as LeaveStatus } as any)
      .eq('id', leaveId)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// NOTICE SERVICE
// =============================================================

export const noticeService = {
  async getAll(filters?: { role?: UserRole }): Promise<Notice[]> {
    const { data, error } = await supabase
      .from('notices')
      .select('*, author:profiles!published_by(*)')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) handleError(error);
    
    if (filters?.role && data) {
      return data.filter((n: any) => 
        n.target_roles.length === 0 || n.target_roles.includes(filters.role!)
      );
    }
    
    return data || [];
  },

  async getById(id: string): Promise<Notice | null> {
    const { data, error } = await supabase
      .from('notices')
      .select('*, author:profiles!published_by(*)')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(notice: Partial<Notice>): Promise<Notice | null> {
    const { data, error } = await supabase
      .from('notices')
      .insert(notice as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Notice>): Promise<Notice | null> {
    const { data, error } = await supabase
      .from('notices')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notices')
      .update({ is_active: false } as any)
      .eq('id', id);
    
    if (error) handleError(error);
  },
};

// =============================================================
// NOTIFICATION SERVICE
// =============================================================

export const notificationService = {
  async getForUser(userId: string, unreadOnly = false): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('id', id);
    
    if (error) handleError(error);
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) handleError(error);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) handleError(error);
    return count || 0;
  },

  async create(notification: Partial<Notification>): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// TIMETABLE SERVICE
// =============================================================

export const timetableService = {
  async getForClass(classId: string): Promise<TimetableEntry[]> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        course:courses(*),
        faculty:faculty(*, profile:profiles(*))
      `)
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time');
    
    if (error) handleError(error);
    return data || [];
  },

  async getForFaculty(facultyId: string): Promise<TimetableEntry[]> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select(`
        *,
        class:classes(*),
        course:courses(*)
      `)
      .eq('faculty_id', facultyId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time');
    
    if (error) handleError(error);
    return data || [];
  },

  async create(entry: Partial<TimetableEntry>): Promise<TimetableEntry | null> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .insert(entry as any)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<TimetableEntry>): Promise<TimetableEntry | null> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetable_entries')
      .update({ is_active: false } as any)
      .eq('id', id);
    
    if (error) handleError(error);
  },
};

// =============================================================
// ANALYTICS SERVICE
// =============================================================

export const analyticsService = {
  async getAdminDashboard() {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) handleError(error);
    return data;
  },

  async getDailyAttendanceSummary(startDate?: string, endDate?: string) {
    let query = supabase
      .from('daily_attendance_summary')
      .select('*')
      .order('date', { ascending: false });
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    
    const { data, error } = await query.limit(30);
    if (error) handleError(error);
    return data || [];
  },

  async getDepartmentSummary() {
    const { data, error } = await supabase
      .from('department_attendance_summary')
      .select('*');
    
    if (error) handleError(error);
    return data || [];
  },

  async getStudentAttendanceOverview(filters?: { classId?: string; departmentId?: string }) {
    let query = supabase
      .from('student_attendance_overview')
      .select('*');
    
    const { data, error } = await query.order('attendance_percentage', { ascending: true });
    if (error) handleError(error);
    return data || [];
  },
};

// =============================================================
// SECURITY SERVICE
// =============================================================

export const securityService = {
  async getAlerts(resolved = false): Promise<SecurityAlert[]> {
    const { data, error } = await supabase
      .from('security_alerts')
      .select('*')
      .eq('resolved', resolved)
      .order('created_at', { ascending: false });
    
    if (error) handleError(error);
    return data || [];
  },

  async resolveAlert(alertId: string, resolverId: string): Promise<void> {
    const { error } = await supabase
      .from('security_alerts')
      .update({
        resolved: true,
        resolved_by: resolverId,
        resolved_at: new Date().toISOString(),
      } as any)
      .eq('id', alertId);
    
    if (error) handleError(error);
  },

  async getAuditLogs(filters?: {
    userId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_logs')
      .select('*, user:profiles!user_id(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },
};
