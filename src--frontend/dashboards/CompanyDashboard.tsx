import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useOrganization } from '@/lib/organization';
import { useTheme } from '@/themes';
import {
  LayoutDashboard, Building2, Users, UserPlus, Crown,
  BarChart3, Settings, LogOut, Menu, Bell,
  ChevronRight, Calendar, Clock, TrendingUp, Activity, ShieldAlert, Search as SearchIcon
} from 'lucide-react';

const CompanyOverview = lazy(() => import('@/pages/company/Overview'));
const CompanyEmployees = lazy(() => import('@/pages/company/Employees'));
const CompanyTeams = lazy(() => import('@/pages/company/Teams'));
const CompanyDepartments = lazy(() => import('@/pages/company/Departments'));
const CompanyLeaveManagement = lazy(() => import('@/pages/company/LeaveManagement'));
const CompanyAttendance = lazy(() => import('@/pages/company/Attendance'));
const CompanyReports = lazy(() => import('@/pages/company/Reports'));
const CompanySecurity = lazy(() => import('@/pages/company/Security'));
const CompanyAnalytics = lazy(() => import('@/pages/company/Analytics'));
const CompanySettings = lazy(() => import('@/pages/company/Settings'));
const CompanyOnboarding = lazy(() => import('@/pages/company/Onboarding'));
const CompanyLiveTracking = lazy(() => import('@/pages/company/LiveTracking'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="relative">
      <div className="absolute inset-0 blur-xl opacity-40">
        <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full animate-pulse" />
      </div>
      <div className="relative glass-card p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        <p className="text-white/80">Loading...</p>
      </div>
    </div>
  </div>
);

interface SidebarItem {
  icon: any;
  label: string;
  path: string;
  color: string;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/company', color: 'violet', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'SALES', 'SECURITY', 'ANALYST'] },
  { icon: Users, label: 'Employees', path: '/company/employees', color: 'blue', roles: ['ADMIN', 'HR', 'MANAGER'] },
  { icon: UserPlus, label: 'Onboarding', path: '/company/onboarding', color: 'emerald', roles: ['ADMIN', 'HR'] },
  { icon: Building2, label: 'Departments', path: '/company/departments', color: 'purple', roles: ['ADMIN', 'HR', 'MANAGER'] },
  { icon: Crown, label: 'Teams', path: '/company/teams', color: 'amber', roles: ['ADMIN', 'MANAGER'] },
  { icon: Clock, label: 'Attendance', path: '/company/attendance', color: 'cyan', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'SALES'] },
  { icon: Calendar, label: 'Leave Requests', path: '/company/leave', color: 'pink', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { icon: BarChart3, label: 'Reports', path: '/company/reports', color: 'teal', roles: ['ADMIN', 'HR', 'MANAGER', 'SALES', 'ANALYST'] },
  { icon: TrendingUp, label: 'Analytics', path: '/company/analytics', color: 'orange', roles: ['ADMIN', 'HR', 'MANAGER', 'SECURITY', 'ANALYST'] },
  { icon: ShieldAlert, label: 'Security', path: '/company/security', color: 'red', roles: ['ADMIN', 'SECURITY'] },
  { icon: Activity, label: 'Live Tracking', path: '/company/tracking', color: 'emerald', roles: ['ADMIN', 'MANAGER', 'SALES'] },
  { icon: Settings, label: 'Settings', path: '/company/settings', color: 'slate', roles: ['ADMIN'] },
];

const colorMap: Record<string, string> = {
  violet: 'from-violet-500 to-purple-500',
  blue: 'from-blue-500 to-cyan-500',
  emerald: 'from-emerald-500 to-teal-500',
  purple: 'from-purple-500 to-pink-500',
  amber: 'from-amber-500 to-orange-500',
  cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500',
  teal: 'from-teal-500 to-emerald-500',
  orange: 'from-orange-500 to-red-500',
  red: 'from-red-500 to-pink-500',
  slate: 'from-slate-500 to-gray-500',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-gradient-to-r from-violet-500 to-purple-500',
  HR: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  MANAGER: 'bg-gradient-to-r from-amber-500 to-orange-500',
  EMPLOYEE: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  SALES: 'bg-gradient-to-r from-pink-500 to-rose-500',
  SECURITY: 'bg-gradient-to-r from-red-500 to-pink-500',
  ANALYST: 'bg-gradient-to-r from-teal-500 to-cyan-500',
};

export default function CompanyDashboard() {
  const { user, signOut: logout } = useSupabaseAuth();
  const { organization } = useOrganization();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userRole = (organization as any)?.role || 'EMPLOYEE';

  const visibleItems = sidebarItems.filter(item => item.roles.includes(userRole));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`min-h-screen ${theme === 'glassmorphism' ? 'glass-theme' : 'neu-theme'}`}>
      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed left-0 top-0 h-screen z-50 transition-all duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:w-72 ${
          theme === 'glassmorphism' ? 'glass-sidebar' : 'neu-sidebar'
        }`}>
          <div className="p-6">
            {/* Logo & Org */}
            <div className="flex items-center gap-4 mb-8">
              {organization?.logo ? (
                <img src={organization.logo} alt={organization.name} className="w-12 h-12 rounded-xl" />
              ) : (
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap['violet']} flex items-center justify-center`}>
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-white truncate">{organization?.name || 'Company'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleColors[userRole] || roleColors.EMPLOYEE} text-white`}>
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? theme === 'glassmorphism'
                          ? 'glass-nav-item-active'
                          : 'neu-nav-item-active'
                        : theme === 'glassmorphism'
                          ? 'glass-nav-item hover:bg-white/10'
                          : 'neu-nav-item hover:bg-white/80'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                    <span className={`font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 ml-auto text-white/50" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center gap-3 px-4 mb-4">
                <div className="w-10 h-10 rounded-full glass-avatar bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center font-bold text-white">
                  {getInitials(user?.profile?.first_name || 'User')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">
                    {user?.profile?.first_name} {user?.profile?.last_name}
                  </p>
                  <p className="text-xs text-white/50 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen">
          {/* Top Header */}
          <header className={`sticky top-0 z-30 backdrop-blur-xl border-b ${
            theme === 'glassmorphism' 
              ? 'bg-slate-900/50 border-white/10' 
              : 'bg-slate-200 border-slate-300'
          }`}>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                >
                  <Menu className="w-6 h-6 text-white" />
                </button>
                
                {/* Search */}
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <SearchIcon className="w-4 h-4 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search employees, reports..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-white placeholder:text-white/50 w-64"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Bell className="w-5 h-5 text-white/70" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* Theme Toggle */}
                <button 
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Toggle Theme"
                >
                  <div className={`w-5 h-5 rounded-full ${
                    theme === 'glassmorphism' 
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`} />
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<CompanyOverview />} />
                <Route path="/employees" element={<CompanyEmployees />} />
                <Route path="/onboarding" element={<CompanyOnboarding />} />
                <Route path="/departments" element={<CompanyDepartments />} />
                <Route path="/teams" element={<CompanyTeams />} />
                <Route path="/attendance" element={<CompanyAttendance />} />
                <Route path="/leave" element={<CompanyLeaveManagement />} />
                <Route path="/reports" element={<CompanyReports />} />
                <Route path="/analytics" element={<CompanyAnalytics />} />
                <Route path="/security" element={<CompanySecurity />} />
                <Route path="/tracking" element={<CompanyLiveTracking />} />
                <Route path="/settings" element={<CompanySettings />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
