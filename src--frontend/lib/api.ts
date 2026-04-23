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

const AI_BASE_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

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
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  };

  let url = `${SUPABASE_URL}/functions/v1/${name}`;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) params.append(key, String(value));
    }
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge function error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as FunctionResult<T>;
  if (!result.success) {
    throw new Error(result.message ?? 'Edge function returned error');
  }
  
  return result.data as T;
}

// =============================================================
// IN-MEMORY CACHE UTILITY
// =============================================================
const apiCache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const cached = apiCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T, ttlSeconds: number = 60): void {
  apiCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) apiCache.delete(key);
    }
  }
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

  async sendMFAOTP(email: string) {
    // Custom backend call to send OTP
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'DUMMY_PASSWORD_MFA_REQUEST' }), // The backend login sends OTP if user exists
    });
    // Note: This is an architectural hack to reuse the backend's OTP logic.
    // Transition to a dedicated /auth/send-otp endpoint is recommended.
    return response.json();
  },

  async verifyMFA(userId: string, otp: string) {
    const response = await fetch('/api/auth/verify-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'MFA Verification failed');
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

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (pErr && pErr.code !== 'PGRST116') handleError(pErr);

    return profile ? {
      ...profile,
      user_id: profile.user_id || user.id,
      email: profile.email || user.email,
      role: profile.role || 'STUDENT',
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      is_active: profile.is_active ?? true,
    } : null;
  },

  async getById(userId: string): Promise<any | null> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error);

    return profile ? {
      ...profile,
      user_id: profile.user_id,
      email: profile.email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      is_active: profile.is_active ?? true,
    } : null;
  },

  async update(userId: string, updates: Partial<Profile>): Promise<any | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
    if (updates.last_name !== undefined) dbUpdates.last_name = updates.last_name;
    if ((updates as any).first_name !== undefined) dbUpdates.first_name = (updates as any).first_name;
    if ((updates as any).last_name !== undefined) dbUpdates.last_name = (updates as any).last_name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.state !== undefined) dbUpdates.state = updates.state;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.postal_code !== undefined) dbUpdates.postal_code = updates.postal_code;
    if ((updates as any).postal_code !== undefined) dbUpdates.postal_code = (updates as any).postal_code;
    if (updates.date_of_birth !== undefined) dbUpdates.date_of_birth = updates.date_of_birth;
    if ((updates as any).date_of_birth !== undefined) dbUpdates.date_of_birth = (updates as any).date_of_birth;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.language !== undefined) dbUpdates.language = updates.language;

    if (Object.keys(dbUpdates).length === 0) return null;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
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
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', userId);
    return publicUrl;
  },

  async getAll(): Promise<any[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) handleError(error);
    return data || [];
  },
};

// =============================================================
// DEPARTMENT SERVICE
// Actual DB: departments(id, name, code, description, hodId, createdAt)
// NO is_active, NO updated_at
// =============================================================

export const departmentService = {
  async getAll(): Promise<Department[]> {
    const cacheKey = 'departments:all';
    const cached = getCached<Department[]>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('departments')
      .select('*, students(count), faculty:faculty!faculty_department_id_fkey(count)')
      .order('name');
    if (error) handleError(error);
    
    // Map Supabase count response to Prisma-like _count property
    const result = (data || []).map((dept: any) => ({
      ...dept,
      _count: {
        students: dept.students?.[0]?.count || 0,
        faculty: dept.faculty?.[0]?.count || 0
      }
    }));
    
    setCache(cacheKey, result);
    return result;
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
    if (department.hod_id || (department as any).hod_id) insert.hod_id = department.hod_id || (department as any).hod_id;

    const { data, error } = await supabase
      .from('departments')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('departments');
    return data;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.hod_id !== undefined) dbUpdates.hod_id = updates.hod_id;
    if ((updates as any).hod_id !== undefined) dbUpdates.hod_id = (updates as any).hod_id;

    const { data, error } = await supabase
      .from('departments')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('departments');
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('departments');
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
    const cacheKey = `faculty:all:${filters?.departmentId || 'all'}`;
    const cached = getCached<Faculty[]>(cacheKey);
    if (cached) return cached;

    let query = supabase
      .from('faculty_with_profiles')
      .select('*');
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    const { data, error } = await query.order('employee_id');
    if (error) {
      console.warn('faculty_with_profiles view missing, falling back to direct table');
      let fallbackQuery = supabase
        .from('faculty')
        .select(`*, department:departments(*), profile:profiles(*)`);
      if (filters?.departmentId) fallbackQuery = fallbackQuery.eq('department_id', filters.departmentId);
      const { data: fallbackData, error: fError } = await fallbackQuery.order('employee_id');
      if (fError) handleError(fError);
      setCache(cacheKey, fallbackData || []);
      return fallbackData || [];
    }
    setCache(cacheKey, data || []);
    return data || [];
  },

  async getById(id: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty_with_profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      const { data: fallback, error: fError } = await supabase
        .from('faculty')
        .select(`*, department:departments(*), profile:profiles(*)`)
        .eq('id', id)
        .single();
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      return fallback;
    }
    return data;
  },

  async getByUserId(userId: string): Promise<Faculty | null> {
    const { data, error } = await supabase
      .from('faculty_with_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) {
      const { data: fallback, error: fError } = await supabase
        .from('faculty')
        .select(`*, department:departments(*), profile:profiles(*)`)
        .eq('user_id', userId)
        .single();
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      return fallback;
    }
    return data;
  },

  async create(faculty: Partial<Faculty>): Promise<Faculty | null> {
    const insert: Record<string, any> = {};
    insert.user_id = faculty.user_id || (faculty as any).user_id;
    insert.employee_id = faculty.employee_id || (faculty as any).employee_id;
    insert.designation = faculty.designation;
    insert.department_id = faculty.department_id || (faculty as any).department_id;
    insert.joining_date = faculty.joining_date || (faculty as any).joining_date;
    if (faculty.specialization) insert.specialization = faculty.specialization;
    if (faculty.qualifications) insert.qualifications = faculty.qualifications;

    const { data, error } = await supabase
      .from('faculty')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('faculty');
    return data;
  },

  async update(id: string, updates: Partial<Faculty>): Promise<Faculty | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.designation !== undefined) dbUpdates.designation = updates.designation;
    if (updates.department_id !== undefined) dbUpdates.department_id = updates.department_id;
    if ((updates as any).department_id !== undefined) dbUpdates.department_id = (updates as any).department_id;
    if (updates.joining_date !== undefined) dbUpdates.joining_date = updates.joining_date;
    if ((updates as any).joining_date !== undefined) dbUpdates.joining_date = (updates as any).joining_date;
    if (updates.specialization !== undefined) dbUpdates.specialization = updates.specialization;
    if (updates.qualifications !== undefined) dbUpdates.qualifications = updates.qualifications;
    if (updates.employee_id !== undefined) dbUpdates.employee_id = updates.employee_id;
    if ((updates as any).employee_id !== undefined) dbUpdates.employee_id = (updates as any).employee_id;

    const { data, error } = await supabase
      .from('faculty')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('faculty');
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('faculty')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('faculty');
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
    const cacheKey = `students:all:${filters?.classId || 'all'}:${filters?.departmentId || 'all'}`;
    const cached = getCached<Student[]>(cacheKey);
    if (cached) return cached;

    let query = supabase
      .from('students_with_profiles')
      .select('*');
    if (filters?.classId) query = query.eq('class_id', filters.classId);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    const { data, error } = await query.order('enrollment_id');
    if (error) {
      console.warn('students_with_profiles view missing, falling back to direct table');
      let fallbackQuery = supabase
        .from('students')
        .select(`*, department:departments(*), class:classes(*), profile:profiles(*)`);
      if (filters?.classId) fallbackQuery = fallbackQuery.eq('class_id', filters.classId);
      if (filters?.departmentId) fallbackQuery = fallbackQuery.eq('department_id', filters.departmentId);
      const { data: fallbackData, error: fError } = await fallbackQuery.order('enrollment_id');
      if (fError) handleError(fError);
      setCache(cacheKey, fallbackData || []);
      return fallbackData || [];
    }
    setCache(cacheKey, data || []);
    return data || [];
  },

  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students_with_profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      const { data: fallback, error: fError } = await supabase
        .from('students')
        .select(`*, department:departments(*), class:classes(*), profile:profiles(*)`)
        .eq('id', id)
        .single();
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      return fallback;
    }
    return data;
  },

  async getByUserId(userId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students_with_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) {
      const { data: fallback, error: fError } = await supabase
        .from('students')
        .select(`*, department:departments(*), class:classes(*), profile:profiles(*)`)
        .eq('user_id', userId)
        .single();
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      return fallback;
    }
    return data;
  },

  async create(student: Partial<Student>): Promise<Student | null> {
    const insert: Record<string, any> = {};
    insert.user_id = student.user_id || (student as any).user_id;
    insert.enrollment_id = student.enrollment_id || (student as any).enrollment_id;
    insert.department_id = student.department_id || (student as any).department_id;
    insert.class_id = student.class_id || (student as any).class_id;
    insert.batch_year = student.batch_year || (student as any).batch_year;
    insert.semester = student.semester;
    if (student.guardian_name || (student as any).guardian_name) insert.guardian_name = student.guardian_name || (student as any).guardian_name;
    if (student.guardian_phone || (student as any).guardian_phone) insert.guardian_phone = student.guardian_phone || (student as any).guardian_phone;
    if (student.guardian_email || (student as any).guardian_email) insert.guardian_email = student.guardian_email || (student as any).guardian_email;

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
    if (updates.enrollment_id !== undefined) dbUpdates.enrollment_id = updates.enrollment_id;
    if ((updates as any).enrollment_id !== undefined) dbUpdates.enrollment_id = (updates as any).enrollment_id;
    if (updates.department_id !== undefined) dbUpdates.department_id = updates.department_id;
    if ((updates as any).department_id !== undefined) dbUpdates.department_id = (updates as any).department_id;
    if (updates.class_id !== undefined) dbUpdates.class_id = updates.class_id;
    if ((updates as any).class_id !== undefined) dbUpdates.class_id = (updates as any).class_id;
    if (updates.batch_year !== undefined) dbUpdates.batch_year = updates.batch_year;
    if ((updates as any).batch_year !== undefined) dbUpdates.batch_year = (updates as any).batch_year;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester;
    if (updates.guardian_name !== undefined) dbUpdates.guardian_name = updates.guardian_name;
    if ((updates as any).guardian_name !== undefined) dbUpdates.guardian_name = (updates as any).guardian_name;

    const { data, error } = await supabase
      .from('students')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('students');
    return data;
  },

  async registerFace(studentId: string, faceData: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ face_data: faceData, face_registered: true })
      .eq('id', studentId);
    if (error) handleError(error);
    clearApiCache('students');
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('students');
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
    const cacheKey = `classes:all:${filters?.departmentId || 'all'}:${filters?.semester || 'all'}`;
    const cached = getCached<Class[]>(cacheKey);
    if (cached) return cached;

    let query = supabase
      .from('classes')
      .select(`*, department:departments(*)`);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    const { data, error } = await query.order('name');
    if (error) handleError(error);

    // Enrich with incharge info
    if (data && data.length > 0) {
      const inchargeIds = data.map((c: any) => c.incharge_id).filter(Boolean);
      if (inchargeIds.length > 0) {
        const { data: facultyList } = await supabase
          .from('faculty')
          .select('*')
          .in('id', inchargeIds);
        const facultyMap = new Map((facultyList || []).map((f: any) => [f.id, f]));
        const result = data.map((c: any) => ({
          ...c,
          class_incharge: facultyMap.get(c.incharge_id) || null,
          department_id: c.department_id,
          class_incharge_id: c.incharge_id,
        }));
        setCache(cacheKey, result);
        return result;
      }
    }
    setCache(cacheKey, data || []);
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
    insert.department_id = classData.department_id || (classData as any).department_id;
    if (classData.class_incharge_id || (classData as any).incharge_id) {
      insert.incharge_id = classData.class_incharge_id || (classData as any).incharge_id;
    }
    if ((classData as any).start_year !== undefined) insert.start_year = (classData as any).start_year;
    if ((classData as any).end_year !== undefined) insert.end_year = (classData as any).end_year;
    if (classData.semester !== undefined) insert.semester = classData.semester;

    const { data, error } = await supabase
      .from('classes')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('classes');
    return data;
  },

  async update(id: string, updates: Partial<Class>): Promise<Class | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.department_id !== undefined) dbUpdates.department_id = updates.department_id;
    if ((updates as any).department_id !== undefined) dbUpdates.department_id = (updates as any).department_id;
    if (updates.class_incharge_id !== undefined) dbUpdates.incharge_id = updates.class_incharge_id;
    if ((updates as any).incharge_id !== undefined) dbUpdates.incharge_id = (updates as any).incharge_id;
    if ((updates as any).start_year !== undefined) dbUpdates.start_year = (updates as any).start_year;
    if ((updates as any).end_year !== undefined) dbUpdates.end_year = (updates as any).end_year;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester;

    const { data, error } = await supabase
      .from('classes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('classes');
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('classes');
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
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
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
    insert.department_id = course.department_id || (course as any).department_id;

    const { data, error } = await supabase
      .from('courses')
      .insert(insert)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('courses');
    return data;
  },

  async update(id: string, updates: Partial<Course>): Promise<Course | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.code !== undefined) dbUpdates.code = updates.code;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
    if (updates.department_id !== undefined) dbUpdates.department_id = updates.department_id;
    if ((updates as any).department_id !== undefined) dbUpdates.department_id = (updates as any).department_id;

    const { data, error } = await supabase
      .from('courses')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('courses');
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('courses');
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
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (filters?.startDate) query = query.gte('date', filters.startDate);
      if (filters?.endDate) query = query.lte('date', filters.endDate);
      if (filters?.courseId) query = query.eq('subject_id', filters.courseId);
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
        .eq('class_id', classId);
      if (!students?.length) return [];

      let query = supabase
        .from('attendance')
        .select('*')
        .in('student_id', students.map((s: any) => s.id))
        .eq('date', date);
      if (courseId) query = query.eq('subject_id', courseId);
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

    const sessionId = attendance.session_id || attendance.sessionId || null;

    try {
      const result = await callEdgeFunction<Attendance>('attendance', {
        method: 'POST',
        body: {
          studentId,
          status: attendance.status || 'PRESENT',
          subjectId,
          sessionId,
          justification: attendance.justification ?? attendance.remarks ?? null,
          timetableEntryId: attendance.timetable_entry_id || attendance.timetableEntryId || null,
          method: attendance.method || 'MANUAL',
          confidenceScore: attendance.confidence_score || attendance.confidenceScore || null,
          location: attendance.location || null,
          deviceInfo: attendance.device_info || attendance.device_id || null,
        },
      });
      if (result) return result;
    } catch {
      // Fallback to direct insert
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          student_id: studentId,
          subject_id: subjectId,
          session_id: sessionId,
          date: new Date().toISOString().split('T')[0],
          status: attendance.status || 'PRESENT',
          method: attendance.method || 'MANUAL',
          verified_by: attendance.verified_by || attendance.faculty_id || null,
          justification: attendance.justification ?? attendance.remarks ?? null,
          confidence_score: attendance.confidence_score || attendance.confidenceScore || null,
          location: attendance.location || null,
          device_info: attendance.device_info || attendance.device_id || null,
        })
        .select()
        .single();
      if (error) handleError(error);
      return data;
    }
    return null;
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
        .eq('student_id', studentId);
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
// ASSIGNMENT SERVICE
// =============================================================

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  status: 'PENDING' | 'SUBMITTED' | 'LATE' | 'GRADED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  points: number;
  submittedAt?: string;
  grade?: number;
}

export const assignmentService = {
  async getForStudent(studentId: string): Promise<Assignment[]> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('class_id')
        .eq('user_id', studentId)
        .single();
      
      if (!student?.class_id) return [];

      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          *,
          course:courses(name, code),
          submissions:submissions(id, submitted_at, grade, status)
        `)
        .eq('class_id', student.class_id)
        .gte('deadline', new Date().toISOString().split('T')[0])
        .order('deadline', { ascending: true });

      if (error) throw error;

      return (assignments || []).map((a: any) => {
        const submission = a.submissions?.[0];
        let status: Assignment['status'] = 'PENDING';
        if (submission) {
          status = submission.grade !== null && submission.grade !== undefined ? 'GRADED' : 'SUBMITTED';
          if (new Date(a.deadline) < new Date(submission.submitted_at)) {
            status = 'LATE';
          }
        }

        return {
          id: a.id,
          title: a.title,
          subject: `${a.course?.name || 'Unknown'} (${a.course?.code || ''})`,
          deadline: a.deadline,
          status,
          priority: a.priority || 'MEDIUM',
          description: a.description || '',
          points: a.points || 100,
          submittedAt: submission?.submitted_at,
          grade: submission?.grade,
        };
      });
    } catch {
      return [];
    }
  },

  async getAll(filters?: { classId?: string; courseId?: string }): Promise<Assignment[]> {
    let query = supabase
      .from('assignments')
      .select(`
        *,
        course:courses(name, code),
        class:classes(name, section)
      `)
      .order('deadline', { ascending: true });

    if (filters?.classId) query = query.eq('class_id', filters.classId);
    if (filters?.courseId) query = query.eq('course_id', filters.courseId);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      subject: `${a.course?.name || 'Unknown'} (${a.course?.code || ''})`,
      deadline: a.deadline,
      status: a.status || 'PENDING',
      priority: a.priority || 'MEDIUM',
      description: a.description || '',
      points: a.points || 100,
    }));
  },

  async submit(assignmentId: string, studentId: string, submission: { content?: string; attachmentUrl?: string }): Promise<void> {
    const { error } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        content: submission.content,
        attachment_url: submission.attachmentUrl,
        submitted_at: new Date().toISOString(),
        status: new Date() > new Date() ? 'LATE' : 'ON_TIME',
      });

    if (error) handleError(error);
  },
};

// =============================================================
// LEAVE SERVICE
// Actual DB table: leave_requests (NOT "leaves")
// Columns: id, studentId, facultyId, startDate, endDate,
//   reason, status, approvedById, createdAt
// =============================================================

export const leaveService = {
  async getForStudent(_studentId: string): Promise<Leave[]> {
    const response = await fetch(`${BACKEND_URL}/api/leaves/my`, {
      headers: await buildFunctionHeaders(),
    });
    const result = await response.json();
    if (!result.success) handleError({ message: result.message || 'Failed to fetch leave requests' });
    return result.data || [];
  },

  async getPending(filters?: { classId?: string }): Promise<Leave[]> {
    const query = supabase
      .from('leave_requests')
      .select(`*`)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) handleError(error);

    if (filters?.classId && data) {
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', filters.classId);
      const studentIds = new Set((students || []).map((s: any) => s.id));
      return data.filter((l: any) => studentIds.has(l.student_id));
    }
    return data || [];
  },

  async create(leave: Partial<Leave>): Promise<Leave | null> {
    const response = await fetch(`${BACKEND_URL}/api/leaves`, {
      method: 'POST',
      headers: await buildFunctionHeaders(),
      body: JSON.stringify({
        startDate: leave.start_date || (leave as any).startDate,
        endDate: leave.end_date || (leave as any).endDate,
        reason: leave.reason,
        type: leave.type || 'PERSONAL',
        documents: (leave as any).documents || [],
      }),
    });
    const result = await response.json();
    if (!result.success) handleError({ message: result.message || 'Failed to submit leave request' });
    return result.data;
  },

  async approve(leaveId: string, approverId: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'APPROVED' as LeaveStatus,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', leaveId)
      .select()
      .single();
    if (error) handleError(error);
    return data;
  },

  async reject(leaveId: string, approverId: string, reason: string): Promise<Leave | null> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'REJECTED' as LeaveStatus,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
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
        .order('created_at', { ascending: false })
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (unreadOnly) query = query.eq('is_read', false);
    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) handleError(error);
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
    const insert: Record<string, any> = {
      user_id: notification.user_id || (notification as any).user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: false,
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
    const { data, error } = await supabase
      .from('timetable_with_relations')
      .select('*')
      .eq('class_id', classId)
      .order('day_of_week')
      .order('start_time');

    if (error) {
      console.warn('timetable_with_relations view missing, falling back');
      const { data: fallback, error: fError } = await supabase
        .from('timetable_entries')
        .select(`
          *,
          subject:subjects(
            id, 
            name, 
            code,
            course:courses(id, name, code)
          ),
          class:classes(id, name, section)
        `)
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      
      // Map direct query results to match view-style structure
      return (fallback || []).map((row: any) => ({
        ...row,
        course: { 
          id: row.subject?.course?.id || row.course_id, 
          name: row.subject?.name || 'Unknown', 
          code: row.subject?.code || '' 
        },
        class: { 
          id: row.class_id, 
          name: row.class?.name || 'Class', 
          section: row.class?.section || '' 
        }
      })) as any;
    }
    
    // Map view columns back to object structure expected by UI
    return (data || []).map((row: any) => ({
      ...row,
      course: { id: row.course_id, name: row.subject_name, code: row.subject_code },
      class: { id: row.class_id, name: row.class_name, section: row.class_section },
      faculty: { 
        id: row.faculty_id, 
        employee_id: row.faculty_employee_id,
        profile: { first_name: row.faculty_first_name, last_name: row.faculty_last_name }
      }
    })) as any;
  },

  async getForFaculty(facultyId: string): Promise<TimetableEntry[]> {
    const { data, error } = await supabase
      .from('timetable_with_relations')
      .select('*')
      .eq('faculty_id', facultyId)
      .order('day_of_week')
      .order('start_time');

    if (error) {
      const { data: fallback, error: fError } = await supabase
        .from('timetable_entries')
        .select(`
          *,
          subject:subjects(
            id, 
            name, 
            code,
            course:courses(id, name, code)
          ),
          class:classes(id, name, section)
        `)
        .eq('faculty_id', facultyId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      if (fError && fError.code !== 'PGRST116') handleError(fError);
      
       // Map direct query results to match view-style structure
       return (fallback || []).map((row: any) => ({
        ...row,
        course: { 
          id: row.subject?.course?.id || row.course_id, 
          name: row.subject?.name || 'Unknown', 
          code: row.subject?.code || '' 
        },
        class: { 
          id: row.class_id, 
          name: row.class?.name || 'Class', 
          section: row.class?.section || '' 
        }
      })) as any;
    }
    
    return (data || []).map((row: any) => ({
      ...row,
      course: { id: row.course_id, name: row.subject_name, code: row.subject_code },
      class: { id: row.class_id, name: row.class_name, section: row.class_section }
    })) as any;
  },

  async create(entry: Partial<TimetableEntry>): Promise<TimetableEntry | null> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .insert(entry)
      .select()
      .single();
    if (error) handleError(error);
    clearApiCache('timetable');
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
    clearApiCache('timetable');
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetable_entries')
      .update({ is_active: false })
      .eq('id', id);
    if (error) handleError(error);
    clearApiCache('timetable');
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
      if (filters?.classId) query = query.eq('class_id', filters.classId);
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
      const { data, error } = await query.order('attendance_percentage', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async getStudentStats() {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/analytics/student-dashboard`, { headers });
    if (!response.ok) throw new Error('Failed to fetch student analytics');
    const result = await response.json();
    return result.data;
  },

  async getPredictions(studentId: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/analytics/predictions/${studentId}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch predictions');
    const result = await response.json();
    return result.data;
  },

  async getDepartmentAnalytics(departmentId: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/analytics/department/${departmentId}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch department analytics');
    const result = await response.json();
    return result.data;
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
      .order('created_at', { ascending: false })
      .limit(100);
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);
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

// =============================================================
// AUDIT LOG SERVICE
// Logs every significant user action for security monitoring
// =============================================================

export const auditLogService = {
  async log(action: string, entityType: string, entityId: string, opts?: {
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: opts?.oldValues || null,
        new_value: opts?.newValues || null,
      });
    } catch {
      // Audit logging should never break the app — silently fail
      console.warn('Audit log failed:', action, entityType, entityId);
    }
  },

  async getRecent(limit = 50): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) handleError(error);
    return data || [];
  },
};

// =============================================================
// BLOCKCHAIN VERIFICATION SERVICE
// Verify attendance integrity via hash chain
// =============================================================

export const blockchainService = {
  async getChain(studentId?: string, limit = 100): Promise<any[]> {
    let query = supabase
      .from('attendance')
      .select('id, student_id, date, status, method, blockchain_hash, previous_hash, nonce, created_at')
      .not('blockchain_hash', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  async verifyIntegrity(records: any[]): Promise<{ valid: boolean; brokenAt?: number }> {
    // Walk chain backwards — each record's previous_hash should match the next record's blockchain_hash
    const sorted = [...records].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].previous_hash !== sorted[i - 1].blockchain_hash && sorted[i].previous_hash !== 'GENESIS') {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  },
};

// =============================================================
// ATTENDANCE SESSION SERVICE (AI SERVER)
// =============================================================

export const chatService = {
  async getConversations() {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat/conversations`, { headers });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    const result = await response.json();
    return result.data;
  },

  async getMessages(userId: string, page = 1, limit = 50) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(
      `${BACKEND_URL}/api/chat/messages/${userId}?page=${page}&limit=${limit}`,
      { headers }
    );
    if (!response.ok) throw new Error('Failed to fetch messages');
    const result = await response.json();
    return result.data;
  },

  async sendMessage(receiverId: string, content: string, attachments: string[] = []) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ receiverId, content, attachments }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    const result = await response.json();
    return result.data;
  },

  async markAsRead(userId: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat/messages/read/${userId}`, {
      method: 'PUT',
      headers,
    });
    if (!response.ok) throw new Error('Failed to mark messages as read');
    return response.json();
  },

  async deleteMessage(messageId: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) throw new Error('Failed to delete message');
    return response.json();
  },

  async getClassChat(classId: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${BACKEND_URL}/api/chat/class/${classId}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch class chat');
    const result = await response.json();
    return result.data;
  },
};

export const sessionService = {
  async start(params: {
    faculty_id: string;
    class_id: string;
    course_id: string;
    timetable_entry_id?: string;
    latitude: number;
    longitude: number;
    radius_meters?: number;
    duration_mins?: number;
  }) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${AI_BASE_URL}/api/session/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to start session');
    return response.json();
  },

  async check(class_id: string, code?: string) {
    const headers = await buildFunctionHeaders();
    const response = await fetch(`${AI_BASE_URL}/api/session/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ class_id, code }),
    });
    if (!response.ok) throw new Error('Failed to check session');
    return response.json();
  },

  async getActive(class_id: string) {
    const response = await fetch(`${AI_BASE_URL}/api/session/active/${class_id}`);
    if (!response.ok) throw new Error('Failed to get active session');
    return response.json();
  },
};


