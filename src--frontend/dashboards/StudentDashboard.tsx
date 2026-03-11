import { useState, lazy, Suspense } from 'react';
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
    <div className="min-h-screen text-slate-50 flex relative overflow-hidden bg-slate-950"
      style={{ background: "var(--background)" }}>

      {/* Glassmorphism animations */}
      <style>{`
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      {/* Animated gradient blobs — emerald/teal theme */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden royal-grid opacity-30" aria-hidden>
        <div className="royal-gradient absolute w-[800px] h-[800px] -top-[20%] -left-[10%] opacity-40 mix-blend-screen" />
        <div className="royal-gradient absolute w-[600px] h-[600px] -bottom-[10%] -right-[5%] opacity-30 mix-blend-screen" style={{ animationDelay: '-4s' }} />
      </div>

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Desktop Sidebar — frosted glass */}
      <aside className="hidden lg:flex w-68 flex-col relative z-20 border-r glass neo-3d border-white/[0.05] bg-slate-950/20">
        {/* Logo */}
        <div className="p-6 border-b border-white/[0.08]">
          <Link to="/student" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">CampusAI</h1>
              <p className="text-xs text-emerald-400">Student Portal</p>
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
                      ? 'bg-white/[0.1] text-white border-emerald-400/40 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
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
                  <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-sm">
                    {getInitials((user?.profile?.first_name || '') + ' ' + (user?.profile?.last_name || '') || 'Student User')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">
                    {user?.profile?.first_name} {user?.profile?.last_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  <p className="text-[11px] text-slate-500">{student?.enrollment_id}</p>
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
          <Link to="/student" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">CampusAI</h1>
                    <p className="text-xs text-emerald-400">Student Portal</p>
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
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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
              <Route path="/" element={<StudentOverview />} />
              <Route path="/live-attendance" element={<SecureAttendanceStudent />} />
              <Route path="/timetable" element={<StudentTimetablePage />} />
              <Route path="/attendance" element={<MyAttendancePage />} />
              <Route path="/calculator" element={<AttendanceCalculatorPage />} />
              <Route path="/face-register" element={<FaceRegistration />} />
              <Route path="/face-attendance" element={<FaceAttendance />} />
              <Route path="/ai-analytics" element={<AIDashboard role="student" studentId={student?.id || user?.id} studentName={`${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || 'Student'} />} />
              <Route path="/notices" element={<StudentNoticesPage />} />
              <Route path="/settings" element={<StudentSettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}