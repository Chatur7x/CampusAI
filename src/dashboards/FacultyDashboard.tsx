import { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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
} from 'lucide-react';
import { toast } from 'sonner';

// Faculty Pages
import FacultyOverview from '@/pages/faculty/Overview';
import MyClassesPage from '@/pages/faculty/MyClasses';
import MyStudentsPage from '@/pages/faculty/MyStudents';
import FacultyTimetablePage from '@/pages/faculty/Timetable';
import AttendanceSessionPage from '@/pages/faculty/AttendanceSession';
import LiveAttendanceFaculty from '@/components/attendance/LiveAttendanceFaculty';
import FacultyAnalyticsPage from '@/pages/faculty/Analytics';
import FacultyNoticesPage from '@/pages/faculty/Notices';
import FacultySettingsPage from '@/pages/faculty/Settings';
import StudentRegistrationPage from '@/pages/admin/StudentRegistration';

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
];

export default function FacultyDashboard() {
  const { user, faculty, logout } = useAuth();
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
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_50%_75%,rgba(14,165,233,0.12),transparent_32%)]" />
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-68 flex-col bg-slate-900/80 backdrop-blur border-r border-slate-800/70 shadow-xl relative z-10">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/70">
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
                      ? 'bg-white/10 text-white border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
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
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-sm">
                    {getInitials(user?.profile?.firstName + ' ' + user?.profile?.lastName || 'Faculty User')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">
                    {user?.profile?.firstName} {user?.profile?.lastName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  <p className="text-[11px] text-slate-500">{faculty?.designation}</p>
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
            <SheetContent side="left" className="w-64 bg-slate-900 border-slate-800 p-0">
              <div className="p-6 border-b border-slate-800">
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
          </Routes>
        </div>
      </main>
    </div>
  );
}