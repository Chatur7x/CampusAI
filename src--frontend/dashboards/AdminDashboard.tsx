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
    <div className="min-h-screen text-slate-50 flex relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #020617 0%, #0a192f 40%, #064e3b 80%, #022c22 100%)" }}>

      {/* Glassmorphism animations */}
      <style>{`
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      {/* Animated gradient blobs for Royal Blue/Green */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden royal-grid opacity-30" aria-hidden>
        <div className="absolute w-[800px] h-[800px] -top-[20%] -left-[10%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute w-[600px] h-[600px] -bottom-[10%] -right-[5%] rounded-full bg-emerald-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '-4s', animationDuration: '10s' }} />
      </div>

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      
      {/* Desktop Sidebar — frosted glass */}
      <aside className="hidden lg:flex w-68 flex-col relative z-20 border-r glass neo-3d shadow-2xl shadow-blue-900/10">
        {/* Premium Logo */}
        <div className="p-6 border-b border-white/[0.08]">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent">CampusAI</h1>
              <p className="text-xs text-blue-400 font-semibold tracking-wider">ADMIN PORTAL</p>
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
        <div className="p-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 p-3 rounded-xl border mb-3 transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-40" />
              <Avatar className="relative border-2 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-emerald-500/30 text-blue-200 font-semibold">
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
            className="w-full border shadow-lg" 
            variant="secondary"
            style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
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
          <Link to="/admin" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="font-bold bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent">CampusAI</span>
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
              <SheetContent side="left" className="w-72 border-white/[0.12] p-0"
                style={{ background: 'rgba(15, 12, 41, 0.95)', backdropFilter: 'blur(60px) saturate(180%)', WebkitBackdropFilter: 'blur(60px) saturate(180%)' }}>
                <div className="p-6 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-50" />
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-lg font-bold bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent">CampusAI</h1>
                      <p className="text-xs text-blue-400 font-semibold tracking-wider">ADMIN PORTAL</p>
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
                <div className="p-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-xl border transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-40" />
                      <Avatar className="relative w-8 h-8 border-2 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-emerald-500/30 text-blue-200 text-sm font-semibold">
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
                    className="w-full border shadow-lg" 
                    variant="secondary"
                    style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
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
              <Route path="/ai-analytics" element={<AIDashboard role="admin" />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

