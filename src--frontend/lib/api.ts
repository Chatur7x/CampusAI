/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================
// CAMPUSAI - SUPABASE API SERVICES
// Enterprise-grade data access layer — Matches actual Prisma camelCase DB
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
  LeaveStatus,
} from './database.types';

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

type FunctionResult<T> = { success?: boolean; data?: T; message?: string };

async function buildFunctionHeaders(extra: Record<string, string> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function callEdgeFunction<T>(
  name: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: any;
  } = {}
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });

  const functionPath = search.toString() ? `${name}?${search.toString()}` : name;
  const { data, error } = await supabase.functions.invoke<FunctionResult<T>>(functionPath, {
    method: options.method || 'POST',
    body: options.method === 'GET' ? undefined : (options.body as any),
    headers: await buildFunctionHeaders(),
  });

  if (error) handleError(error);
  if (!data?.success) handleError({ message: data?.message || 'Function call failed', code: 'FUNCTION_ERROR' });

  return (data.data ?? null) as T;
}

// =============================================================
// AUTHENTICATION SERVICE
// =============================================================

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) handleError(error);
    return data;
  },

  async signInWithMagicLink(email: string) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) handleError(error);
    return data;
  },

  async signInWithOAuth(provider: 'google' | 'github' | 'azure') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// PROFILE SERVICE
// Actual DB: profiles(id, userId, firstName, lastName, phone,
//   avatar, address, city, state, country, postalCode,
//   dateOfBirth, gender, theme, language)
// Role/email are in the separate "users" table.
// =============================================================

export const profileService = {
  async getCurrent(): Promise<any | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get profile
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', user.id)
      .single();
    if (pErr && pErr.code !== 'PGRST116') handleError(pErr);

    // Get role from users table
    const { data: userRow } = await supabase
      .from('users')
      .select('email, role, isActive')
      .eq('id', user.id)
      .single();

    return {
      ...profile,
      user_id: profile?.userId || user.id,
      email: userRow?.email || user.email,
      role: userRow?.role || 'STUDENT',
      first_name: profile?.firstName,
      last_name: profile?.lastName,
      avatar_url: profile?.avatar,
      is_active: userRow?.isActive ?? true,
    };
  },

  async getById(userId: string): Promise<any | null> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', userId)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);

    const { data: userRow } = await supabase
      .from('users')
      .select('email, role, isActive')
      .eq('id', userId)
      .single();

    return profile ? {
      ...profile,
      user_id: profile.userId,
      email: userRow?.email,
      role: userRow?.role,
      first_name: profile.firstName,
      last_name: profile.lastName,
      avatar_url: profile.avatar,
      is_active: userRow?.isActive ?? true,
    } : null;
  },

  async update(userId: string, updates: Partial<Profile>): Promise<any | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.first_name !== undefined) dbUpdates.firstName = updates.first_name;
    if (updates.last_name !== undefined) dbUpdates.lastName = updates.last_name;
    if ((updates as any).firstName !== undefined) dbUpdates.firstName = (updates as any).firstName;
    if ((updates as any).lastName !== undefined) dbUpdates.lastName = (updates as any).lastName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.avatar_url !== undefined) dbUpdates.avatar = updates.avatar_url;
    if ((updates as any).avatar !== undefined) dbUpdates.avatar = (updates as any).avatar;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.state !== undefined) dbUpdates.state = updates.state;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.postal_code !== undefined) dbUpdates.postalCode = updates.postal_code;
    if ((updates as any).postalCode !== undefined) dbUpdates.postalCode = (updates as any).postalCode;
    if (updates.date_of_birth !== undefined) dbUpdates.dateOfBirth = updates.date_of_birth;
    if ((updates as any).dateOfBirth !== undefined) dbUpdates.dateOfBirth = (updates as any).dateOfBirth;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.language !== undefined) dbUpdates.language = updates.language;

    if (Object.keys(dbUpdates).length === 0) return null;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('userId', userId)
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
    await supabase.from('profiles').update({ avatar: publicUrl }).eq('userId', userId);
    return publicUrl;
  },
};

// =============================================================
// DEPARTMENT SERVICE
// Actual DB: departments(id, name, code, description, hodId, createdAt)
// NO is_active, NO updated_at
// =============================================================

export const departmentService = {
  async getAll(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
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
    const insert: Record<string, any> = {};
    if (department.name) insert.name = department.name;
    if (department.code) insert.code = department.code;
    if (department.description !== undefined) insert.description = department.description;
    if (department.hod_id || (department as any).hodId) insert.hodId = department.hod_id || (department as any).hodId;

    const { data, error } = await supabase
      .from('departments')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.hod_id !== undefined) dbUpdates.hodId = updates.hod_id;
    if ((updates as any).hodId !== undefined) dbUpdates.hodId = (updates as any).hodId;

    const { data, error } = await supabase
      .from('departments')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
  },
};

// =============================================================
// FACULTY SERVICE
// Actual DB: faculty(id, userId, employeeId, designation,
//   departmentId, joiningDate, specialization, qualifications)
// NO is_active
// =============================================================

export const facultyService = {
  async getAll(filters?: { departmentId?: string }): Promise<Faculty[]> {
    let query = supabase
      .from('faculty')
      .select(`*, department:departments(*)`);
    if (filters?.departmentId) query = query.eq('departmentId', filters.departmentId);
    const { data, error } = await query.order('employeeId');
    if (error) handleError(error);

    // Enrich with profile data
    if (data && data.length > 0) {
      const userIds = data.map((f: any) => f.userId).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('userId', userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.userId, p]));
        return data.map((f: any) => ({
          ...f,
          profile: profileMap.get(f.userId) || null,
          user_id: f.userId,
          employee_id: f.employeeId,
          department_id: f.departmentId,
          joining_date: f.joiningDate,
        }));
      }
    }
    return data || [];
  },

  async getById(id: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .select(`*, department:departments(*)`)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    if (!data) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', data.userId)
      .single();

    return { ...data, profile, user_id: data.userId, employee_id: data.employeeId, department_id: data.departmentId };
  },

  async getByUserId(userId: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty')
      .select(`*, department:departments(*)`)
      .eq('userId', userId)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    if (!data) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', userId)
      .single();

    return { ...data, profile, user_id: data.userId, employee_id: data.employeeId, department_id: data.departmentId };
  },

  async create(faculty: Partial<Faculty>): Promise<Faculty | null> {
    const insert: Record<string, any> = {};
    insert.userId = faculty.user_id || (faculty as any).userId;
    insert.employeeId = faculty.employee_id || (faculty as any).employeeId;
    insert.designation = faculty.designation;
    insert.departmentId = faculty.department_id || (faculty as any).departmentId;
    insert.joiningDate = faculty.joining_date || (faculty as any).joiningDate;
    if (faculty.specialization) insert.specialization = faculty.specialization;
    if (faculty.qualifications) insert.qualifications = faculty.qualifications;

    const { data, error } = await supabase
      .from('faculty')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Faculty>): Promise<Faculty | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.designation !== undefined) dbUpdates.designation = updates.designation;
    if (updates.department_id !== undefined) dbUpdates.departmentId = updates.department_id;
    if ((updates as any).departmentId !== undefined) dbUpdates.departmentId = (updates as any).departmentId;
    if (updates.joining_date !== undefined) dbUpdates.joiningDate = updates.joining_date;
    if ((updates as any).joiningDate !== undefined) dbUpdates.joiningDate = (updates as any).joiningDate;
    if (updates.specialization !== undefined) dbUpdates.specialization = updates.specialization;
    if (updates.qualifications !== undefined) dbUpdates.qualifications = updates.qualifications;
    if (updates.employee_id !== undefined) dbUpdates.employeeId = updates.employee_id;
    if ((updates as any).employeeId !== undefined) dbUpdates.employeeId = (updates as any).employeeId;

    const { data, error } = await supabase
      .from('faculty')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('faculty')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
  },
};

// =============================================================
// STUDENT SERVICE
// Actual DB: students(id, userId, enrollmentId, departmentId,
//   classId, batchYear, semester, faceData, faceRegistered,
//   guardianName, guardianPhone, guardianEmail)
// NO is_active
// =============================================================

export const studentService = {
  async getAll(filters?: { classId?: string; departmentId?: string }): Promise<Student[]> {
    let query = supabase
      .from('students')
      .select(`*, department:departments(*), class:classes(*)`);
    if (filters?.classId) query = query.eq('classId', filters.classId);
    if (filters?.departmentId) query = query.eq('departmentId', filters.departmentId);
    const { data, error } = await query.order('enrollmentId');
    if (error) handleError(error);

    // Enrich with profile data
    if (data && data.length > 0) {
      const userIds = data.map((s: any) => s.userId).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('userId', userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.userId, p]));
        return data.map((s: any) => ({
          ...s,
          profile: profileMap.get(s.userId) || null,
          user_id: s.userId,
          enrollment_id: s.enrollmentId,
          department_id: s.departmentId,
          class_id: s.classId,
          batch_year: s.batchYear,
          face_data: s.faceData,
          face_registered: s.faceRegistered,
          guardian_name: s.guardianName,
          guardian_phone: s.guardianPhone,
          guardian_email: s.guardianEmail,
        }));
      }
    }
    return data || [];
  },

  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`*, department:departments(*), class:classes(*)`)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    if (!data) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', data.userId)
      .single();

    return {
      ...data,
      profile,
      user_id: data.userId,
      enrollment_id: data.enrollmentId,
      department_id: data.departmentId,
      class_id: data.classId,
    };
  },

  async getByUserId(userId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`*, department:departments(*), class:classes(*)`)
      .eq('userId', userId)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    if (!data) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('userId', userId)
      .single();

    return {
      ...data,
      profile,
      user_id: data.userId,
      enrollment_id: data.enrollmentId,
      department_id: data.departmentId,
      class_id: data.classId,
    };
  },

  async create(student: Partial<Student>): Promise<Student | null> {
    const insert: Record<string, any> = {};
    insert.userId = student.user_id || (student as any).userId;
    insert.enrollmentId = student.enrollment_id || (student as any).enrollmentId;
    insert.departmentId = student.department_id || (student as any).departmentId;
    insert.classId = student.class_id || (student as any).classId;
    insert.batchYear = student.batch_year || (student as any).batchYear;
    insert.semester = student.semester;
    if (student.guardian_name || (student as any).guardianName) insert.guardianName = student.guardian_name || (student as any).guardianName;
    if (student.guardian_phone || (student as any).guardianPhone) insert.guardianPhone = student.guardian_phone || (student as any).guardianPhone;
    if (student.guardian_email || (student as any).guardianEmail) insert.guardianEmail = student.guardian_email || (student as any).guardianEmail;

    const { data, error } = await supabase
      .from('students')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Student>): Promise<Student | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.enrollment_id !== undefined) dbUpdates.enrollmentId = updates.enrollment_id;
    if ((updates as any).enrollmentId !== undefined) dbUpdates.enrollmentId = (updates as any).enrollmentId;
    if (updates.department_id !== undefined) dbUpdates.departmentId = updates.department_id;
    if ((updates as any).departmentId !== undefined) dbUpdates.departmentId = (updates as any).departmentId;
    if (updates.class_id !== undefined) dbUpdates.classId = updates.class_id;
    if ((updates as any).classId !== undefined) dbUpdates.classId = (updates as any).classId;
    if (updates.batch_year !== undefined) dbUpdates.batchYear = updates.batch_year;
    if ((updates as any).batchYear !== undefined) dbUpdates.batchYear = (updates as any).batchYear;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester;
    if (updates.guardian_name !== undefined) dbUpdates.guardianName = updates.guardian_name;
    if ((updates as any).guardianName !== undefined) dbUpdates.guardianName = (updates as any).guardianName;

    const { data, error } = await supabase
      .from('students')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async registerFace(studentId: string, faceData: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ faceData, faceRegistered: true })
      .eq('id', studentId);
    if (error) handleError(error);
  },
};

// =============================================================
// CLASS SERVICE
// Actual DB: classes(id, name, departmentId, inchargeId,
//   startYear, endYear, semester)
// NO is_active
// =============================================================

export const classService = {
  async getAll(filters?: { departmentId?: string; semester?: number }): Promise<Class[]> {
    let query = supabase
      .from('classes')
      .select(`*, department:departments(*)`);
    if (filters?.departmentId) query = query.eq('departmentId', filters.departmentId);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    const { data, error } = await query.order('name');
    if (error) handleError(error);

    // Enrich with incharge info
    if (data && data.length > 0) {
      const inchargeIds = data.map((c: any) => c.inchargeId).filter(Boolean);
      if (inchargeIds.length > 0) {
        const { data: facultyList } = await supabase
          .from('faculty')
          .select('*')
          .in('id', inchargeIds);
        const facultyMap = new Map((facultyList || []).map((f: any) => [f.id, f]));
        return data.map((c: any) => ({
          ...c,
          class_incharge: facultyMap.get(c.inchargeId) || null,
          department_id: c.departmentId,
          class_incharge_id: c.inchargeId,
        }));
      }
    }
    return data || [];
  },

  async getById(id: string): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .select(`*, department:departments(*)`)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async create(classData: Partial<Class>): Promise<Class | null> {
    const insert: Record<string, any> = {};
    if (classData.name) insert.name = classData.name;
    insert.departmentId = classData.department_id || (classData as any).departmentId;
    if (classData.class_incharge_id || (classData as any).inchargeId) {
      insert.inchargeId = classData.class_incharge_id || (classData as any).inchargeId;
    }
    if ((classData as any).startYear !== undefined) insert.startYear = (classData as any).startYear;
    if ((classData as any).endYear !== undefined) insert.endYear = (classData as any).endYear;
    if (classData.semester !== undefined) insert.semester = classData.semester;

    const { data, error } = await supabase
      .from('classes')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Class>): Promise<Class | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.department_id !== undefined) dbUpdates.departmentId = updates.department_id;
    if ((updates as any).departmentId !== undefined) dbUpdates.departmentId = (updates as any).departmentId;
    if (updates.class_incharge_id !== undefined) dbUpdates.inchargeId = updates.class_incharge_id;
    if ((updates as any).inchargeId !== undefined) dbUpdates.inchargeId = (updates as any).inchargeId;
    if ((updates as any).startYear !== undefined) dbUpdates.startYear = (updates as any).startYear;
    if ((updates as any).endYear !== undefined) dbUpdates.endYear = (updates as any).endYear;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester;

    const { data, error } = await supabase
      .from('classes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
  },
};

// =============================================================
// COURSE SERVICE
// Actual DB: courses(id, name, code, description, credits, departmentId)
// NO is_active, NO semester
// =============================================================

export const courseService = {
  async getAll(filters?: { departmentId?: string; semester?: number }): Promise<Course[]> {
    let query = supabase
      .from('courses')
      .select('*, department:departments(*)');
    if (filters?.departmentId) query = query.eq('departmentId', filters.departmentId);
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
    const insert: Record<string, any> = {};
    if (course.name) insert.name = course.name;
    if (course.code) insert.code = course.code;
    if (course.description !== undefined) insert.description = course.description;
    if (course.credits !== undefined) insert.credits = course.credits;
    insert.departmentId = course.department_id || (course as any).departmentId;

    const { data, error } = await supabase
      .from('courses')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<Course>): Promise<Course | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
    if (updates.department_id !== undefined) dbUpdates.departmentId = updates.department_id;
    if ((updates as any).departmentId !== undefined) dbUpdates.departmentId = (updates as any).departmentId;

    const { data, error } = await supabase
      .from('courses')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
  },
};

// =============================================================
// ATTENDANCE SERVICE
// Actual DB: attendance(id, studentId, subjectId, date, status,
//   markedBy, remarks)
// =============================================================

export const attendanceService = {
  async getForStudent(
    studentId: string,
    filters?: { startDate?: string; endDate?: string; courseId?: string }
  ): Promise<Attendance[]> {
    try {
      const result = await callEdgeFunction<{ attendance: Attendance[]; stats?: unknown }>('attendance', {
        method: 'GET',
        query: {
          studentId,
          startDate: filters?.startDate,
          endDate: filters?.endDate,
          subjectId: filters?.courseId,
        },
      });
      return result?.attendance || [];
    } catch {
      // Fallback to direct query if edge function not available
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('studentId', studentId)
        .order('date', { ascending: false });
      if (filters?.startDate) query = query.gte('date', filters.startDate);
      if (filters?.endDate) query = query.lte('date', filters.endDate);
      if (filters?.courseId) query = query.eq('subjectId', filters.courseId);
      const { data, error } = await query;
      if (error) handleError(error);
      return data || [];
    }
  },

  async getForClass(classId: string, date: string, courseId?: string): Promise<Attendance[]> {
    try {
      const result = await callEdgeFunction<{ attendance: Attendance[] }>('attendance', {
        method: 'GET',
        query: {
          classId,
          startDate: date,
          endDate: date,
          subjectId: courseId,
        },
      });
      return result?.attendance || [];
    } catch {
      // Fallback to direct query
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('classId', classId);
      if (!students?.length) return [];

      let query = supabase
        .from('attendance')
        .select('*')
        .in('studentId', students.map((s: any) => s.id))
        .eq('date', date);
      if (courseId) query = query.eq('subjectId', courseId);
      const { data, error } = await query;
      if (error) handleError(error);
      return data || [];
    }
  },

  async mark(attendance: Partial<Attendance> & Record<string, any>): Promise<Attendance | null> {
    const studentId = attendance.student_id || attendance.studentId;
    if (!studentId) handleError({ message: 'student_id is required', code: 'VALIDATION_ERROR', status: 400 });

    const subjectId =
      attendance.course_id ||
      attendance.courseId ||
      attendance.subject_id ||
      attendance.subjectId ||
      null;

    try {
      const result = await callEdgeFunction<Attendance>('attendance', {
        method: 'POST',
        body: {
          studentId,
          status: attendance.status || 'PRESENT',
          subjectId,
          justification: attendance.justification ?? attendance.remarks ?? null,
          timetableEntryId: attendance.timetable_entry_id || attendance.timetableEntryId || null,
        },
      });
      return result || null;
    } catch {
      // Fallback to direct insert
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          studentId,
          subjectId,
          date: new Date().toISOString().split('T')[0],
          status: attendance.status || 'PRESENT',
          remarks: attendance.justification ?? attendance.remarks ?? null,
        })
        .select()
        .single();
      if (error) handleError(error);
      return data;
    }
  },

  async markBulk(records: (Partial<Attendance> & Record<string, any>)[]): Promise<Attendance[]> {
    const results = await Promise.all(records.map((record) => attendanceService.mark(record)));
    return results.filter(Boolean) as Attendance[];
  },

  async update(id: string, updates: Partial<Attendance> & Record<string, any>): Promise<Attendance | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.remarks || updates.justification) dbUpdates.remarks = updates.remarks || updates.justification;

    const { data, error } = await supabase
      .from('attendance')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async getStatistics(studentId: string) {
    try {
      const { data, error } = await supabase.rpc('calculate_attendance_percentage', {
        p_student_id: studentId,
      });
      if (error) throw error;
      return { percentage: data || 0 };
    } catch {
      // Fallback: calculate manually
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('studentId', studentId);
      if (!data?.length) return { percentage: 0 };
      const present = data.filter((a: any) => a.status === 'PRESENT').length;
      return { percentage: Math.round((present / data.length) * 100 * 100) / 100 };
    }
  },

  async getDailySummary(startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('daily_attendance_summary')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      const { data, error } = await query.limit(30);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },
};

// =============================================================
// LEAVE SERVICE
// Actual DB table: leave_requests (NOT "leaves")
// Columns: id, studentId, facultyId, startDate, endDate,
//   reason, status, approvedById, createdAt
// =============================================================

export const leaveService = {
  async getForStudent(studentId: string): Promise<Leave[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`*`)
      .eq('studentId', studentId)
      .order('createdAt', { ascending: false });
    if (error) handleError(error);
    return data || [];
  },

  async getPending(filters?: { classId?: string }): Promise<Leave[]> {
    const query = supabase
      .from('leave_requests')
      .select(`*`)
      .eq('status', 'PENDING')
      .order('createdAt', { ascending: false });
    const { data, error } = await query;
    if (error) handleError(error);

    if (filters?.classId && data) {
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('classId', filters.classId);
      const studentIds = new Set((students || []).map((s: any) => s.id));
      return data.filter((l: any) => studentIds.has(l.studentId));
    }
    return data || [];
  },

  async create(leave: Partial<Leave>): Promise<Leave | null> {
    const insert: Record<string, any> = {
      studentId: leave.student_id || (leave as any).studentId,
      startDate: leave.start_date || (leave as any).startDate,
      endDate: leave.end_date || (leave as any).endDate,
      reason: leave.reason,
      status: 'PENDING',
    };

    const { data, error } = await supabase
      .from('leave_requests')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async approve(leaveId: string, approverId: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'APPROVED' as LeaveStatus,
        approvedById: approverId,
      })
      .eq('id', leaveId)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async reject(leaveId: string, approverId: string, _reason: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'REJECTED' as LeaveStatus,
        approvedById: approverId,
      })
      .eq('id', leaveId)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async cancel(leaveId: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'CANCELLED' as LeaveStatus })
      .eq('id', leaveId)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// NOTICE SERVICE
// Actual DB: notices(id, title, content, authorId, isPublic,
//   departmentId, classId, expiryDate, createdAt)
// =============================================================

export const noticeService = {
  async getAll(filters?: { role?: UserRole }): Promise<Notice[]> {
    try {
      const result = await callEdgeFunction<{ notices: Notice[]; pagination?: unknown }>('notices', {
        method: 'GET',
        query: { page: 1, limit: 50 },
      });

      if (filters?.role && result?.notices) {
        return result.notices.filter((notice) => {
          const roles = (notice as any).target_roles as string[] | undefined;
          return !roles || roles.length === 0 || roles.includes(filters.role!);
        });
      }

      return result?.notices || [];
    } catch {
      // Fallback to direct query
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50);
      if (error) handleError(error);
      return data || [];
    }
  },

  async getById(id: string): Promise<Notice | null> {
    try {
      const result = await callEdgeFunction<Notice>('notices', {
        method: 'GET',
        query: { id },
      });
      return result || null;
    } catch {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('id', id)
        .single();
      if (error && error.code !== 'PGRST116') handleError(error);
      return data;
    }
  },

  async create(notice: Partial<Notice>): Promise<Notice | null> {
    try {
      const payload = await callEdgeFunction<Notice>('notices', {
        method: 'POST',
        body: {
          title: notice.title,
          content: notice.content,
          priority: notice.priority || 'MEDIUM',
          targetRoles: (notice as any).targetRoles || notice.target_roles || [],
          targetDepartments: (notice as any).targetDepartments || notice.target_departments || [],
          targetClasses: (notice as any).targetClasses || notice.target_classes || [],
          attachments: (notice as any).attachments || [],
          expiryDate: (notice as any).expiryDate || notice.expires_at || notice.expiry_date || null,
          isPinned: (notice as any).isPinned ?? notice.is_pinned ?? false,
        },
      });
      return payload || null;
    } catch {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('notices')
        .insert({
          title: notice.title,
          content: notice.content,
          authorId: user?.id,
          isPublic: true,
        })
        .select()
        .single();
      if (error) handleError(error);
      return data;
    }
  },

  async update(id: string, updates: Partial<Notice>): Promise<Notice | null> {
    try {
      const payload = await callEdgeFunction<Notice>('notices', {
        method: 'PUT',
        query: { id },
        body: {
          ...updates,
          targetRoles: (updates as any).targetRoles || updates.target_roles,
          targetDepartments: (updates as any).targetDepartments || updates.target_departments,
          targetClasses: (updates as any).targetClasses || updates.target_classes,
          expiryDate: (updates as any).expiryDate || (updates as any).expires_at || updates.expiry_date,
        },
      });
      return payload || null;
    } catch {
      const dbUpdates: Record<string, any> = {};
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.content) dbUpdates.content = updates.content;
      const { data, error } = await supabase
        .from('notices')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) handleError(error);
      return data;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await callEdgeFunction('notices', {
        method: 'DELETE',
        query: { id },
      });
    } catch {
      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) handleError(error);
    }
  },
};

// =============================================================
// NOTIFICATION SERVICE
// Actual DB: notifications(id, userId, type, title, message,
//   status, link, createdAt)
// NO is_read, NO read_at, NO expires_at — uses 'status' column
// =============================================================

export const notificationService = {
  async getForUser(userId: string, unreadOnly = false): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(50);
    if (unreadOnly) query = query.neq('status', 'read');
    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', id);
    if (error) handleError(error);
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('userId', userId)
      .neq('status', 'read');
    if (error) handleError(error);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .neq('status', 'read');
    if (error) handleError(error);
    return count || 0;
  },

  async create(notification: Partial<Notification>): Promise<Notification | null> {
    const insert: Record<string, any> = {
      userId: notification.user_id || (notification as any).userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      status: 'unread',
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },
};

// =============================================================
// TIMETABLE SERVICE
// DB has both: timetable_entries (snake_case, from migration)
// and timetable (camelCase, from Prisma)
// =============================================================

export const timetableService = {
  async getForClass(classId: string): Promise<TimetableEntry[]> {
    // Try timetable_entries first (snake_case migration table)
    const { data: snakeData, error: snakeErr } = await supabase
      .from('timetable_entries')
      .select(`*`)
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time');

    if (!snakeErr && snakeData?.length) return snakeData;

    // Fallback to camelCase timetable table
    const { data, error } = await supabase
      .from('timetable')
      .select(`*`)
      .eq('classId', classId)
      .order('dayOfWeek')
      .order('startTime');
    if (error) handleError(error);
    return data || [];
  },

  async getForFaculty(facultyId: string): Promise<TimetableEntry[]> {
    const { data: snakeData, error: snakeErr } = await supabase
      .from('timetable_entries')
      .select(`*`)
      .eq('faculty_id', facultyId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time');

    if (!snakeErr && snakeData?.length) return snakeData;

    const { data, error } = await supabase
      .from('timetable')
      .select(`*`)
      .eq('facultyId', facultyId)
      .order('dayOfWeek')
      .order('startTime');
    if (error) handleError(error);
    return data || [];
  },

  async create(entry: Partial<TimetableEntry>): Promise<TimetableEntry | null> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .insert(entry)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async update(id: string, updates: Partial<TimetableEntry>): Promise<TimetableEntry | null> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetable_entries')
      .update({ is_active: false })
      .eq('id', id);
    if (error) handleError(error);
  },
};

// =============================================================
// ANALYTICS SERVICE
// =============================================================

export const analyticsService = {
  async getAdminDashboard() {
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('RPC get_admin_dashboard_stats failed, using fallback', e);
      // Fallback: count tables directly
      const [students, faculty, departments, classes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('faculty').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
      ]);
      return {
        totalStudents: students.count || 0,
        totalFaculty: faculty.count || 0,
        totalDepartments: departments.count || 0,
        totalClasses: classes.count || 0,
        todayAttendance: 0,
        pendingLeaves: 0,
        recentAlerts: 0,
        activeNotices: 0,
      };
    }
  },

  async getDailyAttendanceSummary(startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('daily_attendance_summary')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      const { data, error } = await query.limit(30);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async getDepartmentSummary() {
    try {
      const { data, error } = await supabase
        .from('department_attendance_summary')
        .select('*');
      if (error) throw error;
      return data || [];
    } catch {
      // Fallback: just return departments
      const { data } = await supabase.from('departments').select('*');
      return (data || []).map((d: any) => ({
        departmentId: d.id,
        departmentName: d.name,
        studentCount: 0,
        attendancePercentage: 0,
      }));
    }
  },

  async getStudentAttendanceOverview(filters?: { classId?: string; departmentId?: string }) {
    try {
      let query = supabase
        .from('student_attendance_overview')
        .select('*');
      if (filters?.classId) query = query.eq('classId', filters.classId);
      if (filters?.departmentId) query = query.eq('departmentId', filters.departmentId);
      const { data, error } = await query.order('attendancePercentage', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },
};

// =============================================================
// SECURITY SERVICE
// Actual DB: security_alerts (snake_case — from migration)
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
      })
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
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(100);
    if (filters?.userId) query = query.eq('userId', filters.userId);
    if (filters?.startDate) query = query.gte('createdAt', filters.startDate);
    if (filters?.endDate) query = query.lte('createdAt', filters.endDate);
    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },
};

// =============================================================
// SYSTEM SETTINGS SERVICE
// Actual DB: system_settings (snake_case — from migration)
// =============================================================

export const settingsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('key');
    if (error) handleError(error);
    return data || [];
  },

  async get(key: string) {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);
    return data;
  },

  async set(key: string, value: string, description?: string) {
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ key, value, description, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },
};
