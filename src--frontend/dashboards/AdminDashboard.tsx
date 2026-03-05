import { useState, useEffect, lazy, Suspense, memo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPaletteTrigger } from '@/components/CommandPalette';

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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
const AIDashboard = lazy(() => import('@/components/ai/AIDashboard'));

// Premium Loading Component (Optimized)
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="relative">
      <div className="absolute inset-0 blur-xl opacity-30">
        <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full animate-pulse" />
      </div>
      <div className="relative bg-slate-900/60 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
          <div className="space-y-1 text-center">
            <p className="text-base font-semibold text-white">Loading...</p>
            <p className="text-xs text-slate-400">Please wait</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', color: 'violet' },
  { icon: Building2, label: 'Departments', path: '/admin/departments', color: 'blue' },
  { icon: BookOpen, label: 'Courses', path: '/admin/courses', color: 'emerald' },
  { icon: Users, label: 'Classes', path: '/admin/classes', color: 'cyan' },
  { icon: GraduationCap, label: 'Students', path: '/admin/students', color: 'pink' },
  { icon: User, label: 'Register Student', path: '/admin/register-student', color: 'indigo' },
  { icon: User, label: 'Faculty', path: '/admin/faculty', color: 'purple' },
  { icon: Calendar, label: 'Timetable', path: '/admin/timetable', color: 'amber' },
  { icon: ShieldAlert, label: 'Security', path: '/admin/security', color: 'red' },
  { icon: Link2, label: 'Blockchain', path: '/admin/blockchain', color: 'orange' },
  { icon: BarChart3, label: 'Analytics', path: '/admin/analytics', color: 'teal' },
  { icon: Brain, label: 'AI Analytics', path: '/admin/ai-analytics', color: 'violet' },
  { icon: Bell, label: 'Notices', path: '/admin/notices', color: 'yellow' },
  { icon: Settings, label: 'Settings', path: '/admin/settings', color: 'slate' },
];

// Memoized Sidebar Link Component
const SidebarLink = memo(({ item, isActive, onClick }: { item: typeof sidebarItems[0], isActive: boolean, onClick: () => void }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-300 shadow-lg shadow-violet-500/10 scale-[1.02]'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:scale-[1.01]'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-violet-500 to-purple-500 rounded-r-full" />
      )}
      <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-violet-400' : ''}`} />
      <span className="font-medium">{item.label}</span>
      {isActive && (
        <div className="ml-auto w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
      )}
    </Link>
  );
});

export default function AdminDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<{ date: string; status: string; courseId?: string }[]>([]);

  // Fetch attendance records for AI Dashboard (admin sees all)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('attendance')
          .select('date, status, subjectId')
          .order('date', { ascending: false })
          .limit(500);
        if (data) {
          setAttendanceRecords(
            data.map((r: any) => ({
              date: r.date || '',
              status: (r.status || 'absent').toLowerCase(),
              courseId: r.subjectId || undefined,
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to fetch attendance for AI dashboard:', err);
      }
    })();
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex relative overflow-hidden">
      {/* Optimized Background Effects */}
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_35%)]" />
      </div>
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-68 flex-col bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/70 shadow-2xl relative z-10">
        {/* Premium Logo */}
        <div className="p-6 border-b border-slate-800/70 bg-gradient-to-br from-slate-900/50 to-slate-900/30">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">CampusAI</h1>
              <p className="text-xs text-violet-400 font-medium">Admin Portal</p>
            </div>
          </Link>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-800/70 flex items-center gap-2 bg-slate-900/30">
          <CommandPaletteTrigger className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {sidebarItems.map((item) => (
              <SidebarLink 
                key={item.path} 
                item={item} 
                isActive={location.pathname === item.path}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Premium User footer */}
        <div className="p-4 border-t border-slate-800/70 bg-gradient-to-br from-slate-900/50 to-slate-900/30">
          <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 rounded-full blur-md opacity-40" />
              <Avatar className="relative border-2 border-violet-500/30">
                <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-violet-200 font-semibold">
                  {getInitials(user?.profile?.first_name ? `${user.profile.first_name} ${user.profile.last_name ?? ''}` : user?.email || 'U')}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.profile?.first_name || user?.email || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="hover:bg-red-500/10 hover:text-red-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            onClick={handleLogout} 
            className="w-full bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border border-slate-600/50 shadow-lg" 
            variant="secondary"
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/70 shadow-2xl">
        <div className="flex items-center justify-between p-4">
          <Link to="/admin" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-purple-600 to-violet-700 flex items-center justify-center shadow-lg">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">CampusAI</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-slate-900/98 backdrop-blur-xl border-slate-800 p-0">
                <div className="p-6 border-b border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-900/30">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-500 rounded-xl blur-lg opacity-50" />
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-violet-700 flex items-center justify-center shadow-lg">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-lg font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">CampusAI</h1>
                      <p className="text-xs text-violet-400 font-medium">Admin Portal</p>
                    </div>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100vh-220px)] py-4">
                  <nav className="px-3 space-y-1">
                    {sidebarItems.map((item) => (
                      <SidebarLink 
                        key={item.path} 
                        item={item} 
                        isActive={location.pathname === item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                      />
                    ))}
                  </nav>
                </ScrollArea>
                <div className="p-4 border-t border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-900/30">
                  <div className="flex items-center gap-3 mb-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-500 rounded-full blur-md opacity-40" />
                      <Avatar className="relative w-8 h-8 border-2 border-violet-500/30">
                        <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-violet-200 text-sm font-semibold">
                          {getInitials(user?.profile?.first_name ? `${user.profile.first_name} ${user.profile.last_name ?? ''}` : user?.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{user?.profile?.first_name || user?.email || 'User'}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleLogout} 
                    className="w-full bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border border-slate-600/50" 
                    variant="secondary"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content with Suspense */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 relative z-10">
        <div className="p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<AdminOverview />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/register-student" element={<StudentRegistrationPage />} />
              <Route path="/faculty" element={<FacultyPage />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/blockchain" element={<BlockchainPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/ai-analytics" element={<AIDashboard attendanceRecords={attendanceRecords} role="admin" />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

