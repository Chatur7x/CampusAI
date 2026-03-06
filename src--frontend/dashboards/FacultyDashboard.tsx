import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPaletteTrigger } from '@/components/CommandPalette';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
  { icon: LayoutDashboard, label: 'Dashboard', path: '/faculty' },
  { icon: ClipboardCheck, label: 'Live Session', path: '/faculty/live-attendance' },
  { icon: Users, label: 'My Classes', path: '/faculty/classes' },
  { icon: GraduationCap, label: 'My Students', path: '/faculty/students' },
  { icon: Calendar, label: 'Timetable', path: '/faculty/timetable' },
  { icon: ClipboardCheck, label: 'Attendance', path: '/faculty/attendance' },
  { icon: BarChart3, label: 'Analytics', path: '/faculty/analytics' },
  { icon: Bell, label: 'Notices', path: '/faculty/notices' },
  { icon: Settings, label: 'Settings', path: '/faculty/settings' },
  { icon: User, label: 'Register Student', path: '/faculty/register-student' },
  { icon: Brain, label: 'AI Analytics', path: '/faculty/ai-analytics' },
];

export default function FacultyDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const faculty = user?.faculty || null;
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<{ date: string; status: string; courseId?: string }[]>([]);

  // Fetch recent attendance records for faculty's classes (for AI Dashboard)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('attendance')
          .select('date, status, subjectId')
          .order('date', { ascending: false })
          .limit(200);
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
  }, [faculty]);

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
    <div className="min-h-screen text-slate-50 flex relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #24243e 60%, #0f0c29 100%)" }}>

      {/* Glassmorphism animations */}
      <style>{`
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      {/* Animated gradient blobs — cyan/blue theme */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-40 blur-[120px]"
          style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", top: "-15%", left: "-10%", animation: "blobDrift 20s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-35 blur-[100px]"
          style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa)", bottom: "-10%", right: "-5%", animation: "blobDrift 25s ease-in-out 3s infinite reverse" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-30 blur-[80px]"
          style={{ background: "linear-gradient(135deg, #22d3ee, #67e8f9)", top: "40%", left: "50%", transform: "translate(-50%,-50%)", animation: "blobDrift 18s ease-in-out 1s infinite" }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-25 blur-[90px]"
          style={{ background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", bottom: "20%", left: "15%", animation: "blobDrift 22s ease-in-out 5s infinite reverse" }} />
      </div>

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Desktop Sidebar — frosted glass */}
      <aside className="hidden lg:flex w-68 flex-col relative z-10 border-r"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(60px) saturate(180%)",
          WebkitBackdropFilter: "blur(60px) saturate(180%)",
          borderColor: "rgba(255, 255, 255, 0.12)",
          boxShadow: "0 8px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}>
        {/* Logo */}
        <div className="p-6 border-b border-white/[0.08]">
          <Link to="/faculty" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">CampusAI</h1>
              <p className="text-xs text-cyan-400">Faculty Portal</p>
            </div>
          </Link>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-2">
          <CommandPaletteTrigger className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    isActive
                      ? 'bg-white/[0.1] text-white border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
                      : 'text-white/50 border-transparent hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Profile */}
        <div className="p-4 border-t border-white/[0.08]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-3 hover:bg-white/5">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-sm">
                    {getInitials((user?.profile?.first_name || '') + ' ' + (user?.profile?.last_name || '') || 'Faculty User')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">
                    {user?.profile?.first_name} {user?.profile?.last_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  <p className="text-[11px] text-slate-500">{faculty?.designation}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 backdrop-blur border-white/[0.12]" style={{ background: 'rgba(15,12,41,0.9)', backdropFilter: 'blur(40px)' }}>
              <DropdownMenuLabel className="text-white/40">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem className="text-white hover:bg-white/[0.06] cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white hover:bg-white/[0.06] cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleLogout} className="mt-3 w-full" variant="secondary">
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header — frosted glass */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(60px) saturate(180%)',
          WebkitBackdropFilter: 'blur(60px) saturate(180%)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
        }}>
        <div className="flex items-center justify-between p-4">
          <Link to="/faculty" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">CampusAI</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-white/[0.12] p-0"
              style={{ background: 'rgba(15, 12, 41, 0.95)', backdropFilter: 'blur(60px) saturate(180%)', WebkitBackdropFilter: 'blur(60px) saturate(180%)' }}>
              <div className="p-6 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">CampusAI</h1>
                    <p className="text-xs text-cyan-400">Faculty Portal</p>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-140px)] py-4">
                <nav className="px-3 space-y-1">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'text-white/40 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 relative z-10">
        <div className="p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<FacultyOverview />} />
              <Route path="/live-attendance" element={<LiveAttendanceFaculty />} />
              <Route path="/classes" element={<MyClassesPage />} />
              <Route path="/students" element={<MyStudentsPage />} />
              <Route path="/timetable" element={<FacultyTimetablePage />} />
              <Route path="/attendance" element={<AttendanceSessionPage />} />
              <Route path="/analytics" element={<FacultyAnalyticsPage />} />
              <Route path="/notices" element={<FacultyNoticesPage />} />
              <Route path="/settings" element={<FacultySettingsPage />} />
              <Route path="/register-student" element={<StudentRegistrationPage />} />
              <Route path="/ai-analytics" element={<AIDashboard attendanceRecords={attendanceRecords} role="faculty" />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}