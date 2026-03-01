import { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

// Student Pages
import StudentOverview from '@/pages/student/Overview';
import StudentTimetablePage from '@/pages/student/Timetable';
import MyAttendancePage from '@/pages/student/MyAttendance';
import SecureAttendanceStudent from '@/components/attendance/SecureAttendanceStudent';
import AttendanceCalculatorPage from '@/pages/student/AttendanceCalculator';
import StudentNoticesPage from '@/pages/student/Notices';
import StudentSettingsPage from '@/pages/student/Settings';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/student' },
  { icon: ClipboardList, label: 'Live Attendance', path: '/student/live-attendance' },
  { icon: Calendar, label: 'Timetable', path: '/student/timetable' },
  { icon: ClipboardList, label: 'My Records', path: '/student/attendance' },
  { icon: Calculator, label: 'Calculator', path: '/student/calculator' },
  { icon: Bell, label: 'Notices', path: '/student/notices' },
  { icon: Settings, label: 'Settings', path: '/student/settings' },
];

export default function StudentDashboard() {
  const { user, student, signOut: logout } = useSupabaseAuth();
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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_50%_75%,rgba(45,212,191,0.12),transparent_32%)]" />
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-68 flex-col bg-slate-900/80 backdrop-blur border-r border-slate-800/70 shadow-xl relative z-10">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/70">
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
        <div className="px-4 py-3 border-b border-slate-800/70 flex items-center gap-2">
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
                      ? 'bg-white/10 text-white border-emerald-400/40 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
                      : 'text-slate-300 border-transparent hover:border-slate-700 hover:bg-white/5 hover:text-white'
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
        <div className="p-4 border-t border-slate-800/70">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-3 hover:bg-white/5">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-sm">
                    {getInitials(user?.profile?.firstName + ' ' + user?.profile?.lastName || 'Student User')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">
                    {user?.profile?.firstName} {user?.profile?.lastName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  <p className="text-[11px] text-slate-500">{student?.enrollmentId}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900/95 backdrop-blur border-slate-800">
              <DropdownMenuLabel className="text-slate-400">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem className="text-white hover:bg-slate-800 cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white hover:bg-slate-800 cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
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

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/70">
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
            <SheetContent side="left" className="w-64 bg-slate-900 border-slate-800 p-0">
              <div className="p-6 border-b border-slate-800">
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
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
          <Routes>
            <Route path="/" element={<StudentOverview />} />
            <Route path="/live-attendance" element={<SecureAttendanceStudent />} />
            <Route path="/timetable" element={<StudentTimetablePage />} />
            <Route path="/attendance" element={<MyAttendancePage />} />
            <Route path="/calculator" element={<AttendanceCalculatorPage />} />
            <Route path="/notices" element={<StudentNoticesPage />} />
            <Route path="/settings" element={<StudentSettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}