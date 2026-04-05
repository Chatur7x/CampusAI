import { useState, lazy, Suspense, memo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPaletteTrigger } from '@/components/CommandPalette';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  ShieldAlert,
  Link2,
  BarChart3,
  Bell,
  Settings,
  Menu,
  LogOut,
  User,
  Loader2,
  Brain,
  MessageSquare,
  UserPlus,
  ScrollText,
  Eye,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// Lazy load all admin pages for consistency
const AdminOverview = lazy(() => import('@/pages/admin/Overview'));
const DepartmentsPage = lazy(() => import('@/pages/admin/Departments'));
const CoursesPage = lazy(() => import('@/pages/admin/Courses'));
const ClassesPage = lazy(() => import('@/pages/admin/Classes'));
const StudentsPage = lazy(() => import('@/pages/admin/Students'));
const FacultyPage = lazy(() => import('@/pages/admin/Faculty'));
const TimetablePage = lazy(() => import('@/pages/admin/Timetable'));
const SecurityPage = lazy(() => import('@/pages/admin/Security'));
const BlockchainPage = lazy(() => import('@/pages/admin/Blockchain'));
const AnalyticsPage = lazy(() => import('@/pages/admin/Analytics'));
const NoticesPage = lazy(() => import('@/pages/admin/Notices'));
const SettingsPage = lazy(() => import('@/pages/admin/Settings'));
const StudentRegistrationPage = lazy(() => import('@/pages/admin/StudentRegistration'));
const AdminAssignmentsPage = lazy(() => import('@/pages/admin/Assignments'));
const LiveAttendanceAdmin = lazy(() => import('@/components/attendance/LiveAttendanceFaculty'));
const AIDashboard = lazy(() => import('@/components/ai/AIDashboard'));
const ChatPage = lazy(() => import('@/pages/Chat'));
const OrganizationSettingsPage = lazy(() => import('@/pages/admin/OrganizationSettings'));
const OrganizationMembersPage = lazy(() => import('@/pages/admin/OrganizationMembers'));

// Premium Loading Component (Optimized)
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="relative">
      <div className="absolute inset-0 blur-xl opacity-40">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-emerald-400 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
      </div>
      <div className="relative bg-slate-900/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 shadow-2xl shadow-blue-500/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <div className="space-y-1 text-center">
            <p className="text-base font-semibold text-white tracking-wide">Loading...</p>
            <p className="text-xs text-blue-200/60">Optimizing experience</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', color: 'violet' },
  { icon: Building2, label: 'Organization', path: '/admin/organization', color: 'rose' },
  { icon: Users, label: 'Members', path: '/admin/organization/members', color: 'pink' },
  { icon: BookOpen, label: 'Departments', path: '/admin/departments', color: 'blue' },
  { icon: BookOpen, label: 'Courses', path: '/admin/courses', color: 'emerald' },
  { icon: Users, label: 'Classes', path: '/admin/classes', color: 'cyan' },
  { icon: GraduationCap, label: 'Students', path: '/admin/students', color: 'pink' },
  { icon: UserPlus, label: 'Register Student', path: '/admin/register-student', color: 'indigo' },
  { icon: User, label: 'Faculty', path: '/admin/faculty', color: 'purple' },
  { icon: Calendar, label: 'Timetable', path: '/admin/timetable', color: 'amber' },
  { icon: Eye, label: 'Live Attendance', path: '/admin/live-attendance', color: 'emerald' },
  { icon: ShieldAlert, label: 'Security', path: '/admin/security', color: 'red' },
  { icon: Link2, label: 'Blockchain', path: '/admin/blockchain', color: 'orange' },
  { icon: BarChart3, label: 'Analytics', path: '/admin/analytics', color: 'teal' },
  { icon: Brain, label: 'AI Analytics', path: '/admin/ai-analytics', color: 'violet' },
  { icon: MessageSquare, label: 'Messages', path: '/admin/chat', color: 'blue' },
  { icon: Bell, label: 'Notices', path: '/admin/notices', color: 'yellow' },
  { icon: BookOpen, label: 'Assignments', path: '/admin/assignments', color: 'orange' },
  { icon: Settings, label: 'Settings', path: '/admin/settings', color: 'slate' },
];

// Memoized Sidebar Link Component
const SidebarLink = memo(({ item, isActive, onClick }: { item: typeof sidebarItems[0], isActive: boolean, onClick: () => void }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
        isActive
          ? 'bg-gradient-to-r from-blue-600/20 to-emerald-500/20 text-blue-300 shadow-lg shadow-blue-500/10 scale-[1.02]'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:scale-[1.01]'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-gradient-to-b from-blue-500 to-emerald-400 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
      )}
      <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-blue-400' : ''}`} />
      <span className="font-medium tracking-wide">{item.label}</span>
      {isActive && (
        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      )}
    </Link>
  );
});

export default function AdminDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <DashboardLayout role="admin" sidebarItems={sidebarItems}>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/register-student" element={<StudentRegistrationPage />} />
            <Route path="/faculty" element={<FacultyPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/live-attendance" element={<LiveAttendanceAdmin />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/blockchain" element={<BlockchainPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/ai-analytics" element={<AIDashboard role="admin" />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="/assignments" element={<AdminAssignmentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/organization" element={<OrganizationSettingsPage />} />
            <Route path="/organization/members" element={<OrganizationMembersPage />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </DashboardLayout>
  );
}

