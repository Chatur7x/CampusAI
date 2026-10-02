import { useState, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { Menu, LogOut, ChevronDown, User, Settings, GraduationCap, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { AuroraBackground, PageTransition, springs } from '@/components/motion';

/**
 * Common layout for the portal dashboards.
 * Encapsulates the animated backgrounds, sidebar, topbar, mobile drawer, and user profile logic.
 */

// Per-portal accent configuration
const THEMES = {
  admin: {
    auroraHue: 'indigo' as const,
    accentText: 'text-indigo-300',
    pillClass:
      'bg-gradient-to-r from-indigo-500/25 via-violet-500/20 to-cyan-500/15 text-white border border-indigo-400/30 shadow-[0_0_24px_-6px_rgba(99,102,241,0.55)]',
    logoIcon: 'bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500',
    logoShadow: 'bg-indigo-500',
    subtitleClass: 'text-indigo-300 font-semibold tracking-wider uppercase',
    title: 'Admin Portal',
    baseRoute: '/admin',
  },
  faculty: {
    auroraHue: 'cyan' as const,
    accentText: 'text-cyan-300',
    pillClass:
      'bg-gradient-to-r from-cyan-500/25 via-sky-500/20 to-blue-500/15 text-white border border-cyan-400/30 shadow-[0_0_24px_-6px_rgba(34,211,238,0.5)]',
    logoIcon: 'bg-gradient-to-br from-cyan-400 to-blue-600',
    logoShadow: 'bg-cyan-500',
    subtitleClass: 'text-cyan-300 font-semibold tracking-wider uppercase',
    title: 'Faculty Portal',
    baseRoute: '/faculty',
  },
  student: {
    auroraHue: 'emerald' as const,
    accentText: 'text-emerald-300',
    pillClass:
      'bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-cyan-500/15 text-white border border-emerald-400/30 shadow-[0_0_24px_-6px_rgba(16,185,129,0.5)]',
    logoIcon: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500',
    logoShadow: 'bg-emerald-500',
    subtitleClass: 'text-emerald-300 font-semibold tracking-wider uppercase',
    title: 'Student Portal',
    baseRoute: '/student',
  }
};

export type DashboardRole = 'admin' | 'faculty' | 'student';

export interface SidebarItem {
  icon: any;
  label: string;
  path: string;
}

interface DashboardLayoutProps {
  role: DashboardRole;
  sidebarItems: SidebarItem[];
  children: React.ReactNode;
}

// Memoized Sidebar Link Component — spring pill that slides between items
const SidebarLink = memo(({ item, isActive, roleConfig, layoutId, onClick }: { item: SidebarItem, isActive: boolean, roleConfig: any, layoutId?: string, onClick: () => void }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-300 ${
        isActive ? roleConfig.pillClass : 'text-slate-400 hover:text-white'
      }`}
    >
      {isActive && layoutId && (
        <motion.span
          layoutId={layoutId}
          transition={springs.snappy}
          className="absolute inset-0 rounded-xl -z-10"
        />
      )}
      <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-active:scale-95 ${isActive ? roleConfig.accentText : ''}`} />
      <span className="font-medium tracking-wide">{item.label}</span>
      {isActive && (
        <span className={`ml-auto w-1.5 h-1.5 rounded-full ${roleConfig.accentText.replace('text-', 'bg-')}/80 animate-pulse`} />
      )}
    </Link>
  );
});

export default function DashboardLayout({ role, sidebarItems, children }: DashboardLayoutProps) {
  const { user, signOut: logout } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const config = THEMES[role];

  // Specific role data
  const faculty = user?.faculty || null;
  const student = user?.student || null;

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  // ── Portal-wide Realtime Notifications (S7) ──
  useEffect(() => {
    if (!user || role !== 'student') return;

    const channel = supabase
      .channel('global:notices')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notices'
      }, (payload: any) => {
        const newNotice = payload.new;
        toast.info(`New Notice: ${newNotice.title}`, {
          description: newNotice.content?.substring(0, 100) + '...',
          icon: <Bell className="w-4 h-4 text-emerald-400" />,
          duration: 10000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const displayName = user?.profile?.first_name ? `${user.profile.first_name} ${user.profile.last_name ?? ''}` : user?.email || 'User';

  const navList = (layoutId?: string) => (
    <nav className="px-3 space-y-1">
      {sidebarItems.map((item) => (
        <SidebarLink
          key={item.path}
          item={item}
          isActive={location.pathname === item.path}
          roleConfig={config}
          layoutId={location.pathname === item.path ? layoutId : undefined}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex relative">

      {/* Unified aurora ambience */}
      <AuroraBackground hue={config.auroraHue} gridOpacity={role === 'admin' ? 0.08 : 0.05} />

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.02] z-[1]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Desktop Sidebar — frosted glass */}
      <aside className="hidden lg:flex w-[272px] flex-col relative z-20 border-r border-white/[0.06] bg-slate-950/40 backdrop-blur-2xl">
        {/* Logo */}
        <div className="p-6 border-b border-white/[0.06]">
          <Link to={config.baseRoute} className="flex items-center gap-3 group [perspective:600px]">
            <div className="relative">
              <div className={`absolute inset-0 ${config.logoShadow} rounded-xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-300`} />
              <div className={`relative w-10 h-10 rounded-xl ${config.logoIcon} flex items-center justify-center shadow-lg transition-transform duration-300 [transform-style:preserve-3d] group-hover:[transform:rotateY(18deg)_rotateX(-8deg)_scale(1.08)]`}>
                {role === 'admin' ? <LayoutDashboard className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">CampusAI</h1>
              <p className={`text-xs ${config.subtitleClass}`}>
                {config.title}
              </p>
            </div>
          </Link>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <CommandPaletteTrigger className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          {navList(`nav-${role}`)}
        </ScrollArea>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-3 hover:bg-white/5 mb-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={`text-sm ${config.accentText} bg-white/[0.06]`}>
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{role === 'faculty' ? faculty?.designation : role === 'student' ? student?.enrollment_id : 'Administrator'}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 border-white/10 bg-slate-950/90 backdrop-blur-2xl">
              <DropdownMenuLabel className="text-white/40">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem className="text-white hover:bg-white/[0.06] cursor-pointer">
                <User className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white hover:bg-white/[0.06] cursor-pointer">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-red-500/10 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleLogout}
            className="w-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
            variant="secondary"
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08] bg-slate-950/60 backdrop-blur-2xl">
        <div className="flex items-center justify-between p-4">
          <Link to={config.baseRoute} className="flex items-center gap-2 group">
            <div className="relative">
              <div className={`absolute inset-0 ${config.logoShadow} rounded-lg blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300`} />
              <div className={`relative w-8 h-8 rounded-lg ${config.logoIcon} flex items-center justify-center shadow-lg`}>
                {role === 'admin' ? <LayoutDashboard className="w-4 h-4 text-white" /> : <GraduationCap className="w-4 h-4 text-white" />}
              </div>
            </div>
            <span className="font-bold text-white tracking-tight">CampusAI</span>
            <span className={`hidden sm:inline text-[10px] uppercase tracking-widest ${config.accentText}`}>{config.title}</span>
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
              <SheetContent side="left" className="w-72 border-white/[0.1] p-0 bg-slate-950/95 backdrop-blur-2xl">
                <div className="p-6 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`absolute inset-0 ${config.logoShadow} rounded-xl blur-lg opacity-50`} />
                      <div className={`relative w-10 h-10 rounded-xl ${config.logoIcon} flex items-center justify-center shadow-lg`}>
                        {role === 'admin' ? <LayoutDashboard className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
                      </div>
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-white">CampusAI</h1>
                      <p className={`text-xs ${config.subtitleClass}`}>{config.title}</p>
                    </div>
                  </div>
                </div>
                <ScrollArea className="h-[calc(100vh-220px)] py-4">
                  {navList()}
                </ScrollArea>
                <div className="p-4 border-t border-white/[0.06]">
                  <Button
                    onClick={handleLogout}
                    className="w-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
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

      {/* Main Content Area — every routed page gets a smooth transition */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 relative z-10 w-full overflow-x-hidden [perspective:1200px]">
        <div className="p-4 sm:p-6 lg:p-8 w-full">
          <PageTransition routeKey={location.pathname}>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
