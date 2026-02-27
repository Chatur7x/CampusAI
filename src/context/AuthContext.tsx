import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole, Student, Faculty, Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  student: Student | null;
  faculty: Faculty | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; detectedRole?: UserRole; requireMFA?: boolean; userId?: string; message?: string }>;
  verifyMFA: (userId: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo mode - no backend required
const DEMO_MODE = true;

// Mock user data for demo
const createMockUser = (email: string, role: UserRole): User => {
  const name = email.split('@')[0];
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  
  return {
    id: `user-${Date.now()}`,
    email,
    role,
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
    profile: {
      id: `profile-${Date.now()}`,
      userId: `user-${Date.now()}`,
      firstName: capitalizedName,
      lastName: 'User',
      theme: 'dark',
      language: 'en',
    } as Profile,
  };
};

const createMockStudent = (userId: string): Student => ({
  id: `student-${Date.now()}`,
  userId,
  enrollmentId: `STU${Math.floor(Math.random() * 100000)}`,
  departmentId: 'dept-1',
  classId: 'class-1',
  batchYear: 2024,
  semester: 2,
  faceRegistered: false,
});

const createMockFaculty = (userId: string): Faculty => ({
  id: `faculty-${Date.now()}`,
  userId,
  employeeId: `EMP${Math.floor(Math.random() * 100000)}`,
  designation: 'Assistant Professor',
  departmentId: 'dept-1',
  joiningDate: new Date().toISOString(),
  qualifications: ['Ph.D.'],
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('demoUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed.user);
        setStudent(parsed.student || null);
        setFaculty(parsed.faculty || null);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    setIsLoading(false);
  }, []);

  const detectRoleFromEmail = (email: string): UserRole => {
    const lower = email.toLowerCase();
    if (lower.includes('admin')) return 'ADMIN';
    if (lower.includes('super')) return 'SUPER_ADMIN';
    if (lower.includes('faculty') || lower.includes('prof') || lower.includes('teacher')) return 'FACULTY';
    if (lower.includes('incharge') || lower.includes('class')) return 'CLASS_INCHARGE';
    return 'STUDENT';
  };

  const login = async (email: string, _password: string) => {
    try {
      if (DEMO_MODE) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Auto-detect role from email and accept any password in demo mode
        const detectedRole = detectRoleFromEmail(email);
        const mockUser = createMockUser(email, detectedRole);
        let mockStudent: Student | null = null;
        let mockFaculty: Faculty | null = null;
        
        if (detectedRole === 'STUDENT') {
          mockStudent = createMockStudent(mockUser.id);
        } else if (detectedRole === 'FACULTY' || detectedRole === 'CLASS_INCHARGE') {
          mockFaculty = createMockFaculty(mockUser.id);
        }
        
        // Store in localStorage
        localStorage.setItem('demoUser', JSON.stringify({
          user: mockUser,
          student: mockStudent,
          faculty: mockFaculty,
        }));
        localStorage.setItem('accessToken', 'demo-token');
        
        setUser(mockUser);
        setStudent(mockStudent);
        setFaculty(mockFaculty);

        // Keep token in-memory too for immediate guards
        setTimeout(() => {
          setUser((prev) => prev); // trigger state flush
        }, 0);
        
        return { success: true, detectedRole };
      }
      
      // Real API call (not used in demo)
      return { success: false, message: 'Demo mode only' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const verifyMFA = async () => {
    try {
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Accept any OTP in demo mode
        const stored = localStorage.getItem('demoUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed.user);
          setStudent(parsed.student || null);
          setFaculty(parsed.faculty || null);
        }
        
        return { success: true };
      }
      
      return { success: false, message: 'Demo mode only' };
    } catch (error) {
      console.error('MFA verification error:', error);
      return { success: false, message: 'Verification failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('demoUser');
    localStorage.removeItem('accessToken');
    sessionStorage.clear();
    // Clear state so guards redirect
    setUser(null);
    setStudent(null);
    setFaculty(null);
  };

  const refreshToken = async () => {
    const stored = localStorage.getItem('demoUser');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setStudent(parsed.student || null);
        setFaculty(parsed.faculty || null);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        faculty,
        isAuthenticated: !!user,
        isLoading,
        login,
        verifyMFA,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

