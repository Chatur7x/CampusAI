import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPaletteTrigger } from '@/components/CommandPalette';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Calculator,
  Bell,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
  User,
  GraduationCap,
  ScanFace,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

// Student Pages — lazy loaded for faster initial bundle
const StudentOverview = lazy(() => import('@/pages/student/Overview'));
const StudentTimetablePage = lazy(() => import('@/pages/student/Timetable'));
const MyAttendancePage = lazy(() => import('@/pages/student/MyAttendance'));
const SecureAttendanceStudent = lazy(() => import('@/components/attendance/SecureAttendanceStudent'));
const AttendanceCalculatorPage = lazy(() => import('@/pages/student/AttendanceCalculator'));
const StudentNoticesPage = lazy(() => import('@/pages/student/Notices'));
const StudentSettingsPage = lazy(() => import('@/pages/student/Settings'));
const FaceRegistration = lazy(() => import('@/components/ai/FaceRegistration'));
const FaceAttendance = lazy(() => import('@/components/ai/FaceAttendance'));
const AIDashboard = lazy(() => import('@/components/ai/AIDashboard'));
const ChatPage = lazy(() => import('@/pages/Chat'));

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="relative group">
      <div className="absolute inset-[-15px] bg-emerald-500/20 blur-[30px] rounded-full animate-pulse" />
      <div className="relative h-14 w-14 rounded-full border-2 border-slate-800" />
      <div className="absolute inset-0 h-14 w-14 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
    </div>
  </div>
);

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/student' },
  { icon: ClipboardList, label: 'Live Attendance', path: '/student/live-attendance' },
  { icon: Calendar, label: 'Timetable', path: '/student/timetable' },
  { icon: ClipboardList, label: 'My Records', path: '/student/attendance' },
  { icon: Calculator, label: 'Calculator', path: '/student/calculator' },
  { icon: ScanFace, label: 'Face Registration', path: '/student/face-register' },
  { icon: ScanFace, label: 'Face Attendance', path: '/student/face-attendance' },
  { icon: Brain, label: 'AI Analytics', path: '/student/ai-analytics' },
  { icon: MessageSquare, label: 'Messages', path: '/student/chat' },
  { icon: Bell, label: 'Notices', path: '/student/notices' },
  { icon: Settings, label: 'Settings', path: '/student/settings' },
];

export default function StudentDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const student = user?.student || null;
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // (AI Dashboard now self-fetches its data)

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <DashboardLayout role="student" sidebarItems={sidebarItems}>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<StudentOverview />} />
            <Route path="/live-attendance" element={<SecureAttendanceStudent />} />
            <Route path="/timetable" element={<StudentTimetablePage />} />
            <Route path="/attendance" element={<MyAttendancePage />} />
            <Route path="/calculator" element={<AttendanceCalculatorPage />} />
            <Route path="/face-register" element={<FaceRegistration />} />
            <Route path="/face-attendance" element={<FaceAttendance />} />
            <Route path="/ai-analytics" element={<AIDashboard role="student" studentId={student?.id || user?.id} studentName={`${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || 'Student'} />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/notices" element={<StudentNoticesPage />} />
            <Route path="/settings" element={<StudentSettingsPage />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </DashboardLayout>
  );
}