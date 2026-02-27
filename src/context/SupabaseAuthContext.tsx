// =============================================================
// CAMPUSAI - SUPABASE AUTH CONTEXT
// Enterprise authentication with Supabase
// =============================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Student, Faculty, UserRole } from '@/lib/database.types.ts';

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
  // Additional fields based on role
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
// DEMO MODE (for development without Supabase)
// =============================================================

const DEMO_MODE = !import.meta.env.VITE_SUPABASE_URL;

const createDemoUser = (email: string, role: UserRole): AuthUser => {
  const name = email.split('@')[0];
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  const id = `demo-${Date.now()}`;
  
  const profile: Profile = {
    id: `profile-${id}`,
    user_id: id,
    email,
    role,
    first_name: capitalizedName,
    last_name: 'Demo',
    phone: null,
    avatar_url: null,
    address: null,
    city: null,
    state: null,
    country: null,
    postal_code: null,
    date_of_birth: null,
    gender: null,
    theme: 'dark',
    language: 'en',
    is_active: true,
    mfa_enabled: false,
    last_login_at: new Date().toISOString(),
    login_attempts: 0,
    lockout_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let student: Student | null = null;
  let faculty: Faculty | null = null;

  if (role === 'STUDENT') {
    student = {
      id: `student-${id}`,
      user_id: id,
      enrollment_id: `STU${Math.floor(Math.random() * 100000)}`,
      department_id: 'demo-dept',
      class_id: 'demo-class',
      batch_year: 2024,
      semester: 4,
      face_data: null,
      face_registered: false,
      guardian_name: null,
      guardian_phone: null,
      guardian_email: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else if (role === 'FACULTY' || role === 'CLASS_INCHARGE') {
    faculty = {
      id: `faculty-${id}`,
      user_id: id,
      employee_id: `EMP${Math.floor(Math.random() * 100000)}`,
      designation: 'Assistant Professor',
      department_id: 'demo-dept',
      joining_date: new Date().toISOString(),
      specialization: null,
      qualifications: ['M.Tech', 'Ph.D.'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return { id, email, role, profile, student, faculty };
};

// =============================================================
// PROVIDER
// =============================================================

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile and role-specific data
  const fetchUserData = useCallback(async (supabaseUserId: string): Promise<AuthUser | null> => {
    try {
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUserId)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      let student: Student | null = null;
      let faculty: Faculty | null = null;

      // Fetch role-specific data
      if ((profile as any).role === 'STUDENT') {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', supabaseUserId)
          .single();
        student = data;
      } else if ((profile as any).role === 'FACULTY' || (profile as any).role === 'CLASS_INCHARGE') {
        const { data } = await supabase
          .from('faculty')
          .select('*')
          .eq('user_id', supabaseUserId)
          .single();
        faculty = data;
      }

      return {
        id: supabaseUserId,
        email: (profile as any).email,
        role: (profile as any).role,
        profile: profile as Profile,
        student,
        faculty,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (DEMO_MODE) {
      // Check for stored demo user
      const storedUser = localStorage.getItem('campusai_demo_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('campusai_demo_user');
        }
      }
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        const userData = await fetchUserData(session.user.id);
        setUser(userData);
      }
      
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth event:', event);
        setSession(session);
        setSupabaseUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await fetchUserData(session.user.id);
          setUser(userData);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'USER_UPDATED' && session?.user) {
          const userData = await fetchUserData(session.user.id);
          setUser(userData);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Determine role from email
      let role: UserRole = 'STUDENT';
      if (email.includes('admin')) role = 'ADMIN';
      else if (email.includes('faculty') || email.includes('teacher')) role = 'FACULTY';
      
      const demoUser = createDemoUser(email, role);
      setUser(demoUser);
      localStorage.setItem('campusai_demo_user', JSON.stringify(demoUser));
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const userData = await fetchUserData(data.user.id);
        setUser(userData);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [fetchUserData]);

  // Sign in with magic link
  const signInWithMagicLink = useCallback(async (email: string) => {
    if (DEMO_MODE) {
      return signIn(email, 'demo');
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, [signIn]);

  // Sign in with OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (DEMO_MODE) {
      return { success: false, error: 'OAuth not available in demo mode' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign up
  const signUp = useCallback(async (data: SignUpData) => {
    if (DEMO_MODE) {
      const demoUser = createDemoUser(data.email, data.role);
      demoUser.profile!.first_name = data.firstName;
      demoUser.profile!.last_name = data.lastName;
      setUser(demoUser);
      localStorage.setItem('campusai_demo_user', JSON.stringify(demoUser));
      return { success: true };
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
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

      if (authError) {
        return { success: false, error: authError.message };
      }

      // Profile is created via database trigger
      // Additional role-specific data can be created here if needed

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      localStorage.removeItem('campusai_demo_user');
      setUser(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    if (DEMO_MODE) {
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    if (DEMO_MODE) {
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!supabaseUser) return;
    
    const userData = await fetchUserData(supabaseUser.id);
    setUser(userData);
  }, [supabaseUser, fetchUserData]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (DEMO_MODE) {
      const updatedUser = {
        ...user,
        profile: { ...user.profile!, ...updates },
      };
      setUser(updatedUser);
      localStorage.setItem('campusai_demo_user', JSON.stringify(updatedUser));
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('user_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

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
    isAuthenticated: !!user,
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

// Convenience exports
export { AuthContext };
export type { AuthContextType, AuthUser, SignUpData };
