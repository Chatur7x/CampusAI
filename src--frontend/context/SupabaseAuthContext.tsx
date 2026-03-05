// =============================================================
// CAMPUSAI - SUPABASE AUTH CONTEXT
// Fast, resilient authentication with Supabase
// =============================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Student, Faculty, UserRole } from '@/lib/database.types';

// =============================================================
// TYPES
// =============================================================

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profile: Profile | null;
  student: Student | null;
  faculty: Faculty | null;
}

interface AuthContextType {
  // State
  user: AuthUser | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ success: boolean; error?: string }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  
  // Profile methods
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
}

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string;
  classId?: string;
  employeeId?: string;
  enrollmentId?: string;
}

// =============================================================
// CONTEXT
// =============================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================
// HELPERS
// =============================================================

/** Build a minimal AuthUser from session metadata — no DB call needed */
function userFromSession(su: SupabaseUser): AuthUser {
  const meta = (su.user_metadata || {}) as Record<string, unknown>;
  let role: UserRole = 'STUDENT';
  if (typeof meta.role === 'string') {
    const r = meta.role.toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN', 'FACULTY', 'CLASS_INCHARGE', 'STUDENT'].includes(r)) {
      role = r as UserRole;
    }
  } else {
    // Detect role from email pattern as fallback
    const email = (su.email || '').toLowerCase();
    const local = email.split('@')[0] || '';
    if (local.startsWith('admin')) role = 'ADMIN';
    else if (/^\d/.test(local)) role = 'STUDENT';
    else if (email.endsWith('.edu.in') || email.endsWith('.edu') || email.endsWith('.ac.in')) role = 'FACULTY';
  }
  return {
    id: su.id,
    email: su.email || '',
    role,
    profile: null,
    student: null,
    faculty: null,
  };
}

// =============================================================
// PROVIDER
// =============================================================

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile and role-specific data (background enrichment)
  // IMPORTANT: The actual DB uses camelCase columns (userId, firstName, etc.)
  // and has a separate 'users' table for email/role and 'profiles' for extra info.
  const fetchUserData = useCallback(async (su: SupabaseUser): Promise<AuthUser | null> => {
    try {
      // 1. Get role + email from the 'users' table (camelCase columns)
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', su.id)
        .single();

      // 2. Get profile details from 'profiles' table (camelCase columns)
      const { data: rawProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('userId', su.id)
        .single();

      // Determine role: DB users table > profile metadata > email detection
      const fallback = userFromSession(su);
      const role: UserRole = dbUser?.role?.toUpperCase() as UserRole || fallback.role;
      const email = dbUser?.email || su.email || '';

      // Map camelCase DB profile to our snake_case Profile type
      const profile: Profile | null = rawProfile ? {
        id: rawProfile.id,
        user_id: rawProfile.userId,
        email: email,
        role: role,
        first_name: rawProfile.firstName || '',
        last_name: rawProfile.lastName || '',
        phone: rawProfile.phone || null,
        avatar_url: rawProfile.avatar || null,
        address: rawProfile.address || null,
        city: rawProfile.city || null,
        state: rawProfile.state || null,
        country: rawProfile.country || null,
        postal_code: rawProfile.postalCode || null,
        date_of_birth: rawProfile.dateOfBirth || null,
        gender: rawProfile.gender || null,
        theme: rawProfile.theme || 'dark',
        language: rawProfile.language || 'en',
        is_active: dbUser?.isActive ?? true,
        mfa_enabled: dbUser?.mfaEnabled ?? false,
        last_login_at: dbUser?.lastLoginAt || null,
        login_attempts: dbUser?.loginAttempts || 0,
        lockout_until: dbUser?.lockoutUntil || null,
        created_at: dbUser?.createdAt || new Date().toISOString(),
        updated_at: dbUser?.updatedAt || new Date().toISOString(),
      } : null;

      // If no profile row exists, try to auto-create one
      if (!rawProfile) {
        const meta = (su.user_metadata || {}) as Record<string, unknown>;
        const firstName = (typeof meta.first_name === 'string' ? meta.first_name : null)
          || (typeof meta.full_name === 'string' ? meta.full_name.split(' ')[0] : null)
          || su.email?.split('@')[0] || 'User';
        const lastName = (typeof meta.last_name === 'string' ? meta.last_name : null)
          || (typeof meta.full_name === 'string' ? meta.full_name.split(' ').slice(1).join(' ') : null)
          || 'User';

        await supabase.from('profiles').upsert({
          userId: su.id,
          firstName,
          lastName,
          theme: 'dark',
          language: 'en',
        }, { onConflict: 'userId' });
      }

      let student: Student | null = null;
      let faculty: Faculty | null = null;

      // Fetch role-specific data (camelCase columns)
      if (role === 'STUDENT') {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('userId', su.id)
          .single();
        if (data) {
          student = {
            id: data.id,
            user_id: data.userId,
            enrollment_id: data.enrollmentId || '',
            department_id: data.departmentId || '',
            class_id: data.classId || '',
            batch_year: data.batchYear || 0,
            semester: data.semester || 1,
            face_data: data.faceData || null,
            face_registered: data.faceRegistered || false,
            guardian_name: data.guardianName || null,
            guardian_phone: data.guardianPhone || null,
            guardian_email: data.guardianEmail || null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
        const { data } = await supabase
          .from('faculty')
          .select('*')
          .eq('userId', su.id)
          .single();
        if (data) {
          faculty = {
            id: data.id,
            user_id: data.userId,
            employee_id: data.employeeId || '',
            designation: data.designation || '',
            department_id: data.departmentId || '',
            joining_date: data.joiningDate || '',
            specialization: data.specialization || null,
            qualifications: data.qualifications || [],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }

      return {
        id: su.id,
        email,
        role,
        profile,
        student,
        faculty,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Return minimal user so auth still works
      return userFromSession(su);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Safety timeout — if getSession() hangs (paused Supabase, slow network),
    // resolve loading after 2 seconds so the login page appears quickly.
    const loadingTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('Auth initialization timed out after 2s — showing login page');
        setIsLoading(false);
      }
    }, 2000);

    // 1. Get initial session (fast — reads from localStorage)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      clearTimeout(loadingTimeout);
      setSession(s);
      setSupabaseUser(s?.user ?? null);

      if (s?.user) {
        // Set minimal user IMMEDIATELY so isAuthenticated = true right away
        setUser(userFromSession(s.user));
        setIsLoading(false);

        // Then enrich from DB in background
        fetchUserData(s.user).then(fullUser => {
          if (mounted && fullUser) setUser(fullUser);
        });
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      // Network failure — stop loading, let the login page show
      if (mounted) {
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;
        console.log('Auth event:', event);
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
          // Set minimal user IMMEDIATELY
          setUser(userFromSession(newSession.user));
          // Enrich in background
          fetchUserData(newSession.user).then(fullUser => {
            if (mounted && fullUser) setUser(fullUser);
          });
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'USER_UPDATED' && newSession?.user) {
          setUser(userFromSession(newSession.user));
          fetchUserData(newSession.user).then(fullUser => {
            if (mounted && fullUser) setUser(fullUser);
          });
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      // onAuthStateChange will handle setting user
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // Network-level failures (Supabase project paused, no internet, etc.)
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION') || msg.includes('TIMEOUT')) {
        return {
          success: false,
          error: 'Cannot reach the server. The Supabase project may be paused — please restore it at supabase.com/dashboard, or check your internet connection.',
        };
      }
      return { success: false, error: msg || 'An unexpected error occurred' };
    }
  }, []);

  // Sign in with magic link
  const signInWithMagicLink = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign in with OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign up
  const signUp = useCallback(async (data: SignUpData) => {
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            role: data.role,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) return { success: false, error: authError.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!supabaseUser) return;
    const userData = await fetchUserData(supabaseUser);
    if (userData) setUser(userData);
  }, [supabaseUser, fetchUserData]);

  // Update profile (map snake_case input to camelCase DB columns)
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      // Map snake_case Profile fields to camelCase DB columns
      const dbUpdates: Record<string, unknown> = {};
      if (updates.first_name !== undefined) dbUpdates.firstName = updates.first_name;
      if (updates.last_name !== undefined) dbUpdates.lastName = updates.last_name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.avatar_url !== undefined) dbUpdates.avatar = updates.avatar_url;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.postal_code !== undefined) dbUpdates.postalCode = updates.postal_code;
      if (updates.date_of_birth !== undefined) dbUpdates.dateOfBirth = updates.date_of_birth;
      if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
      if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
      if (updates.language !== undefined) dbUpdates.language = updates.language;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('userId', user.id);
      if (error) return { success: false, error: error.message };
      await refreshProfile();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [user, refreshProfile]);

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    isAuthenticated: !!session && !!user,
    isLoading,
    signIn,
    signInWithMagicLink,
    signInWithOAuth,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================
// HOOKS
// =============================================================

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

export { AuthContext };
export type { AuthContextType, AuthUser, SignUpData };
