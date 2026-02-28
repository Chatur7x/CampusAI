import { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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
} from 'lucide-react';
import { toast } from 'sonner';

// Admin Pages
import AdminOverview from '@/pages/admin/Overview';
import DepartmentsPage from '@/pages/admin/Departments';
import CoursesPage from '@/pages/admin/Courses';
import ClassesPage from '@/pages/admin/Classes';
import StudentsPage from '@/pages/admin/Students';
import FacultyPage from '@/pages/admin/Faculty';
import TimetablePage from '@/pages/admin/Timetable';
import SecurityPage from '@/pages/admin/Security';
import BlockchainPage from '@/pages/admin/Blockchain';
import AnalyticsPage from '@/pages/admin/Analytics';
import NoticesPage from '@/pages/admin/Notices';
import SettingsPage from '@/pages/admin/Settings';
import StudentRegistrationPage from '@/pages/admin/StudentRegistration';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Building2, label: 'Departments', path: '/admin/departments' },
  { icon: BookOpen, label: 'Courses', path: '/admin/courses' },
  { icon: Users, label: 'Classes', path: '/admin/classes' },
  { icon: GraduationCap, label: 'Students', path: '/admin/students' },
  { icon: User, label: 'Register Student', path: '/admin/register-student' },
  { icon: User, label: 'Faculty', path: '/admin/faculty' },
  { icon: Calendar, label: 'Timetable', path: '/admin/timetable' },
  { icon: ShieldAlert, label: 'Security', path: '/admin/security' },
  { icon: Link2, label: 'Blockchain', path: '/admin/blockchain' },
  { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  { icon: Bell, label: 'Notices', path: '/admin/notices' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
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
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_50%_75%,rgba(59,130,246,0.12),transparent_32%)]" />
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-68 flex-col bg-slate-900/80 backdrop-blur border-r border-slate-800/70 shadow-xl relative z-10">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/70">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">CampusAI</h1>
              <p className="text-xs text-violet-400">Admin Portal</p>
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
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
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

        {/* User footer */}
        <div className="p-4 border-t border-slate-800/70">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-violet-500/20 text-violet-200">
                {getInitials(user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName ?? ''}` : user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.profile?.firstName || user?.email || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'user@mail.com'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={handleLogout} className="mt-3 w-full" variant="secondary">
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/70">
        <div className="flex items-center justify-between p-4">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">CampusAI</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-slate-900 border-slate-800 p-0">
                <div className="p-6 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-white">CampusAI</h1>
                      <p className="text-xs text-violet-400">Admin Portal</p>
                    </div>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100vh-200px)] py-4">
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
                              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
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
                <div className="p-4 border-t border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-violet-500/20 text-violet-200 text-sm">
                        {getInitials(user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName ?? ''}` : user?.email || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{user?.profile?.firstName || user?.email || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email || 'user@mail.com'}</p>
                    </div>
                  </div>
                  <Button onClick={handleLogout} className="w-full" variant="secondary">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 relative z-10">
        <div className="p-6 lg:p-8">
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
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

