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
  Users,
  GraduationCap,
  Calendar,
  ClipboardCheck,
  BarChart3,
  Bell,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
  User,
  Brain,
  ClipboardList,
  BookOpen,
  MessageSquare,
  UserPlus,
  Eye,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

// Faculty Pages — lazy loaded for faster initial bundle
const FacultyOverview = lazy(() => import('@/pages/faculty/Overview'));
const MyClassesPage = lazy(() => import('@/pages/faculty/MyClasses'));
const MyStudentsPage = lazy(() => import('@/pages/faculty/MyStudents'));
const FacultyTimetablePage = lazy(() => import('@/pages/faculty/Timetable'));
const AttendanceSessionPage = lazy(() => import('@/pages/faculty/AttendanceSession'));
const LiveAttendanceFaculty = lazy(() => import('@/components/attendance/LiveAttendanceFaculty'));
const FacultyAnalyticsPage = lazy(() => import('@/pages/faculty/Analytics'));
const FacultyNoticesPage = lazy(() => import('@/pages/faculty/Notices'));
const FacultySettingsPage = lazy(() => import('@/pages/faculty/Settings'));
const StudentRegistrationPage = lazy(() => import('@/pages/admin/StudentRegistration'));
const AIDashboard = lazy(() => import('@/components/ai/AIDashboard'));
const FacultyLeaveRequestsPage = lazy(() => import('@/pages/faculty/LeaveRequests'));
const FacultyAssignmentsPage = lazy(() => import('@/pages/faculty/Assignments'));
const FacultyReportsPage = lazy(() => import('@/pages/faculty/Reports'));
const ChatPage = lazy(() => import('@/pages/Chat'));

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="relative">
      <div className="h-12 w-12 rounded-full border-2 border-slate-800" />
      <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-cyan-500 animate-spin" />
    </div>
  </div>
);

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/faculty', color: 'violet' },
  { icon: Eye, label: 'Live Session', path: '/faculty/live-attendance', color: 'emerald' },
  { icon: Users, label: 'My Classes', path: '/faculty/classes', color: 'blue' },
  { icon: GraduationCap, label: 'My Students', path: '/faculty/students', color: 'cyan' },
  { icon: Calendar, label: 'Timetable', path: '/faculty/timetable', color: 'amber' },
  { icon: ClipboardCheck, label: 'Attendance', path: '/faculty/attendance', color: 'pink' },
  { icon: BarChart3, label: 'Analytics', path: '/faculty/analytics', color: 'teal' },
  { icon: BookOpen, label: 'Assignments', path: '/faculty/assignments', color: 'orange' },
  { icon: Bell, label: 'Notices', path: '/faculty/notices', color: 'yellow' },
  { icon: ClipboardList, label: 'Leave Approvals', path: '/faculty/leaves', color: 'indigo' },
  { icon: MessageSquare, label: 'Messages', path: '/faculty/chat', color: 'purple' },
  { icon: UserPlus, label: 'Register Student', path: '/faculty/register-student', color: 'rose' },
  { icon: FileText, label: 'Reports', path: '/faculty/reports', color: 'slate' },
  { icon: Settings, label: 'Settings', path: '/faculty/settings', color: 'gray' },
  { icon: Brain, label: 'AI Analytics', path: '/faculty/ai-analytics', color: 'violet' },
];

export default function FacultyDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const faculty = user?.faculty || null;
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch recent attendance records for faculty's classes (for AI Dashboard)
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
    <DashboardLayout role="faculty" sidebarItems={sidebarItems}>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<FacultyOverview />} />
            <Route path="/live-attendance" element={<LiveAttendanceFaculty />} />
            <Route path="/classes" element={<MyClassesPage />} />
            <Route path="/students" element={<MyStudentsPage />} />
            <Route path="/timetable" element={<FacultyTimetablePage />} />
            <Route path="/attendance" element={<AttendanceSessionPage />} />
            <Route path="/analytics" element={<FacultyAnalyticsPage />} />
            <Route path="/assignments" element={<FacultyAssignmentsPage />} />
            <Route path="/notices" element={<FacultyNoticesPage />} />
            <Route path="/settings" element={<FacultySettingsPage />} />
            <Route path="/register-student" element={<StudentRegistrationPage />} />
            <Route path="/leaves" element={<FacultyLeaveRequestsPage />} />
            <Route path="/reports" element={<FacultyReportsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/ai-analytics" element={<AIDashboard role="faculty" />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </DashboardLayout>
  );
}