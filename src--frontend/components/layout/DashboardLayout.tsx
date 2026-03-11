import { useState, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

/**
 * Common layout for the portal dashboards.
 * Encapsulates the animated backgrounds, sidebar, topbar, mobile drawer, and user profile logic.
 */

// Theme configuration depending on the portal
const THEMES = {
  admin: {
    bgGradient: "linear-gradient(135deg, #020617 0%, #0a192f 40%, #064e3b 80%, #022c22 100%)",
    blobs: (
      <>
        <div className="absolute w-[800px] h-[800px] -top-[20%] -left-[10%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute w-[600px] h-[600px] -bottom-[10%] -right-[5%] rounded-full bg-emerald-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '-4s', animationDuration: '10s' }} />
      </>
    ),
    activeGradient: 'from-blue-600/20 to-emerald-500/20 text-blue-300 shadow-blue-500/10',
    activeIndicator: 'from-blue-500 to-emerald-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]',
    activeIcon: 'text-blue-400',
    activePulse: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    logoGradients: 'bg-gradient-to-br from-blue-500 via-emerald-500 to-teal-500 text-transparent bg-clip-text',
    logoIcon: 'bg-gradient-to-br from-blue-500 via-emerald-500 to-teal-500',
    title: 'ADMIN PORTAL',
    baseRoute: '/admin',
  },
  faculty: {
    bgGradient: "linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #24243e 60%, #0f0c29 100%)",
    blobs: (
      <>
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-40 blur-[120px]" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", top: "-15%", left: "-10%", animation: "blobDrift 20s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-35 blur-[100px]" style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa)", bottom: "-10%", right: "-5%", animation: "blobDrift 25s ease-in-out 3s infinite reverse" }} />
      </>
    ),
    activeGradient: 'bg-white/[0.1] text-white border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]',
    activeIndicator: 'hidden', 
    activeIcon: 'text-cyan-400',
    activePulse: 'hidden',
    logoGradients: 'text-white',
    logoIcon: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    title: 'Faculty Portal',
    baseRoute: '/faculty',
  },
  student: {
    bgGradient: "var(--background)",
    blobs: (
      <>
        <div className="royal-gradient absolute w-[800px] h-[800px] -top-[20%] -left-[10%] opacity-40 mix-blend-screen" />
        <div className="royal-gradient absolute w-[600px] h-[600px] -bottom-[10%] -right-[5%] opacity-30 mix-blend-screen" style={{ animationDelay: '-4s' }} />
      </>
    ),
    activeGradient: 'bg-white/[0.1] text-white border-emerald-400/40 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]',
    activeIndicator: 'hidden',
    activeIcon: 'text-emerald-400',
    activePulse: 'hidden',
    logoGradients: 'text-white',
    logoIcon: 'bg-gradient-to-br from-emerald-500 to-teal-600',
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

// Memoized Sidebar Link Component
const SidebarLink = memo(({ item, isActive, roleConfig, onClick }: { item: SidebarItem, isActive: boolean, roleConfig: any, onClick: () => void }) => {
  const Icon = item.icon;
  const isPremium = roleConfig.activeIndicator !== 'hidden';
  
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 ${isPremium ? 'rounded-xl' : 'rounded-lg border border-transparent'} text-sm font-medium transition-all duration-300 ease-in-out ${
        isActive
          ? (isPremium ? `bg-gradient-to-r ${roleConfig.activeGradient} scale-[1.02]` : roleConfig.activeGradient)
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:scale-[1.01]'
      }`}
    >
      {isActive && isPremium && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-gradient-to-b ${roleConfig.activeIndicator} rounded-r-full`} />
      )}
      <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? roleConfig.activeIcon : ''}`} />
      <span className="font-medium tracking-wide">{item.label}</span>
      {isActive && isPremium && (
        <div className={`ml-auto w-2 h-2 rounded-full ${roleConfig.activePulse} animate-pulse`} />
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

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };
  
  const displayName = user?.profile?.first_name ? `${user.profile.first_name} ${user.profile.last_name ?? ''}` : user?.email || 'User';

  return (
    <div className={`min-h-screen text-slate-50 flex relative overflow-hidden ${role === 'student' ? 'bg-slate-950' : ''}`}
      style={{ background: config.bgGradient }}>

      {/* Glassmorphism animations */}
      <style>{`
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      {/* Animated gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden cyber-grid opacity-20" aria-hidden>
        {config.blobs}
      </div>

      {/* Global HUD Scanning Line */}
      <div className="scanning-line opacity-50" />

      {/* Frosted noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.02]" aria-hidden
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      
      {/* Desktop Sidebar — frosted glass */}
      <aside className="hidden lg:flex w-68 flex-col relative z-20 border-r glass neo-3d border-white/[0.05] bg-slate-950/20 shadow-2xl">
        {/* Logo */}
        <div className="p-6 border-b border-white/[0.08]">
          <Link to={config.baseRoute} className="flex items-center gap-3 group">
            <div className="relative">
              {role === 'admin' && <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />}
              <div className={`relative w-10 h-10 rounded-xl ${config.logoIcon} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {role === 'admin' ? <LayoutDashboard className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
              </div>
            </div>
            <div>
              <h1 className={`text-lg font-bold ${role === 'admin' ? 'bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent' : 'text-white'}`}>
                CampusAI
              </h1>
              <p className={`text-xs ${role === 'admin' ? 'text-blue-400 font-semibold tracking-wider uppercase' : (role === 'faculty' ? 'text-cyan-400' : 'text-emerald-400')}`}>
                {config.title}
              </p>
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
                roleConfig={config}
                onClick={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-white/[0.08]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               {role === 'admin' ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border mb-3 transition-colors hover:bg-white/[0.02] cursor-pointer" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-40" />
                    <Avatar className="relative border-2 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-emerald-500/30 text-blue-200 font-semibold">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              ) : (
                <Button variant="ghost" className="w-full justify-start gap-3 px-3 hover:bg-white/5 mb-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className={`text-sm ${role === 'faculty' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email || 'user@mail.com'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{role === 'faculty' ? faculty?.designation : student?.enrollment_id}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 backdrop-blur border-white/[0.12]" style={{ background: 'rgba(15,12,41,0.9)', backdropFilter: 'blur(40px)' }}>
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
            className={`w-full ${role === 'admin' ? 'border shadow-lg' : ''}`} 
            variant="secondary"
            style={role === 'admin' ? { background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' } : undefined}
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(60px) saturate(180%)',
          WebkitBackdropFilter: 'blur(60px) saturate(180%)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
        }}>
        <div className="flex items-center justify-between p-4">
          <Link to={config.baseRoute} className="flex items-center gap-2 group">
             <div className="relative">
              {role === 'admin' && <div className="absolute inset-0 bg-blue-500 rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300" />}
              <div className={`relative w-8 h-8 rounded-lg ${config.logoIcon} flex items-center justify-center shadow-lg`}>
                {role === 'admin' ? <LayoutDashboard className="w-4 h-4 text-white" /> : <GraduationCap className="w-4 h-4 text-white" />}
              </div>
            </div>
            <span className={`font-bold ${role === 'admin' ? 'bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent' : 'text-white'}`}>CampusAI</span>
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
                      {role === 'admin' && <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-50" />}
                      <div className={`relative w-10 h-10 rounded-xl ${config.logoIcon} flex items-center justify-center shadow-lg`}>
                        {role === 'admin' ? <LayoutDashboard className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
                      </div>
                    </div>
                    <div>
                      <h1 className={`text-lg font-bold ${role === 'admin' ? 'bg-gradient-to-r from-blue-200 via-white to-emerald-200 bg-clip-text text-transparent' : 'text-white'}`}>CampusAI</h1>
                      <p className={`text-xs ${role === 'admin' ? 'text-blue-400 font-semibold tracking-wider uppercase' : (role === 'faculty' ? 'text-cyan-400' : 'text-emerald-400')}`}>{config.title}</p>
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
                        roleConfig={config}
                        onClick={() => setIsMobileMenuOpen(false)}
                      />
                    ))}
                  </nav>
                </ScrollArea>
                <div className="p-4 border-t border-white/[0.08]">
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

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 relative z-10 w-full overflow-x-hidden">
        <div className="p-6 lg:p-8 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
