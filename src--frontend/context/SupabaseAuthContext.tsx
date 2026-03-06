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
  }
  // No email-based fallback — role must come from metadata or DB
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
  // DB uses snake_case columns (user_id, first_name, etc.) and a single 'profiles' table.
  const fetchUserData = useCallback(async (su: SupabaseUser): Promise<AuthUser | null> => {
    try {
      // 1. Get profile from 'profiles' table (snake_case columns — Supabase migration schema)
      const { data: rawProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', su.id)
        .single();

      // Determine role: DB profile > user metadata > default to STUDENT
      const fallback = userFromSession(su);
      const role: UserRole = (rawProfile?.role?.toUpperCase() as UserRole) || fallback.role;
      const email = rawProfile?.email || su.email || '';

      // Map DB profile to our Profile type
      const profile: Profile | null = rawProfile ? {
        id: rawProfile.id,
        user_id: rawProfile.user_id,
        email: email,
        role: role,
        first_name: rawProfile.first_name || '',
        last_name: rawProfile.last_name || '',
        phone: rawProfile.phone || null,
        avatar_url: rawProfile.avatar_url || null,
        address: rawProfile.address || null,
        city: rawProfile.city || null,
        state: rawProfile.state || null,
        country: rawProfile.country || null,
        postal_code: rawProfile.postal_code || null,
        date_of_birth: rawProfile.date_of_birth || null,
        gender: rawProfile.gender || null,
        theme: rawProfile.theme || 'dark',
        language: rawProfile.language || 'en',
        is_active: rawProfile.is_active ?? true,
        mfa_enabled: false,
        last_login_at: null,
        login_attempts: 0,
        lockout_until: null,
        created_at: rawProfile.created_at || new Date().toISOString(),
        updated_at: rawProfile.updated_at || new Date().toISOString(),
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
          user_id: su.id,
          email: su.email,
          role: fallback.role,
          first_name: firstName,
          last_name: lastName,
          theme: 'dark',
          language: 'en',
        }, { onConflict: 'user_id' });
      }

      let student: Student | null = null;
      let faculty: Faculty | null = null;

      // Fetch role-specific data (snake_case columns — Supabase migration schema)
      if (role === 'STUDENT') {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', su.id)
          .single();
        if (data) {
          student = {
            id: data.id,
            user_id: data.user_id,
            enrollment_id: data.enrollment_id || '',
            department_id: data.department_id || '',
            class_id: data.class_id || '',
            batch_year: data.batch_year || 0,
            semester: data.semester || 1,
            face_data: data.face_data || null,
            face_registered: data.face_registered || false,
            guardian_name: data.guardian_name || null,
            guardian_phone: data.guardian_phone || null,
            guardian_email: data.guardian_email || null,
            is_active: data.is_active ?? true,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
          };
        }
      } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
        const { data } = await supabase
          .from('faculty')
          .select('*')
          .eq('user_id', su.id)
          .single();
        if (data) {
          faculty = {
            id: data.id,
            user_id: data.user_id,
            employee_id: data.employee_id || '',
            designation: data.designation || '',
            department_id: data.department_id || '',
            joining_date: data.joining_date || '',
            specialization: data.specialization || null,
            qualifications: data.qualifications || [],
            is_active: data.is_active ?? true,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
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

    // FAST PATH: Check localStorage synchronously before any network call.
    // If no Supabase session key exists, the user is definitely not logged in.
    // Show the login page INSTANTLY instead of waiting for getSession() network round-trip.
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const hasLocalSession = !!storageKey && !!localStorage.getItem(storageKey);

    if (!hasLocalSession) {
      // No session in storage — show login page immediately (0ms delay)
      setIsLoading(false);
      // Still set up the auth listener below for future sign-ins
    }

    // Safety timeout — only relevant when there IS a local session that needs validation
    const loadingTimeout = hasLocalSession
      ? setTimeout(() => {
          if (mounted && isLoading) {
            console.warn('Auth initialization timed out after 1.5s');
            setIsLoading(false);
          }
        }, 1500)
      : null;

    // Get session (reads localStorage + optionally validates with server)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      if (loadingTimeout) clearTimeout(loadingTimeout);
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
        if (loadingTimeout) clearTimeout(loadingTimeout);
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
      if (loadingTimeout) clearTimeout(loadingTimeout);
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
      if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined) dbUpdates.last_name = updates.last_name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.postal_code !== undefined) dbUpdates.postal_code = updates.postal_code;
      if (updates.date_of_birth !== undefined) dbUpdates.date_of_birth = updates.date_of_birth;
      if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
      if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
      if (updates.language !== undefined) dbUpdates.language = updates.language;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('user_id', user.id);
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
