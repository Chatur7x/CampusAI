import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Bell,
  Settings,
  Building2,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Search,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface CommandItem {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const getNavigationItems = (): CommandItem[] => {
    const baseItems: CommandItem[] = [];
    
    if (user?.role === 'ADMIN') {
      baseItems.push(
        { icon: LayoutDashboard, label: 'Dashboard', action: () => navigate('/admin'), keywords: ['home', 'overview'] },
        { icon: Building2, label: 'Departments', action: () => navigate('/admin/departments'), keywords: ['dept'] },
        { icon: BookOpen, label: 'Courses', action: () => navigate('/admin/courses'), keywords: ['subjects'] },
        { icon: Users, label: 'Classes', action: () => navigate('/admin/classes'), keywords: ['sections'] },
        { icon: GraduationCap, label: 'Students', action: () => navigate('/admin/students'), keywords: ['learners'] },
        { icon: Users, label: 'Faculty', action: () => navigate('/admin/faculty'), keywords: ['teachers', 'staff'] },
        { icon: Calendar, label: 'Timetable', action: () => navigate('/admin/timetable'), keywords: ['schedule'] },
        { icon: BarChart3, label: 'Analytics', action: () => navigate('/admin/analytics'), keywords: ['reports', 'stats'] },
        { icon: Bell, label: 'Notices', action: () => navigate('/admin/notices'), keywords: ['announcements'] },
        { icon: Settings, label: 'Settings', action: () => navigate('/admin/settings'), keywords: ['config', 'preferences'] },
      );
    } else if (user?.role === 'FACULTY') {
      baseItems.push(
        { icon: LayoutDashboard, label: 'Dashboard', action: () => navigate('/faculty'), keywords: ['home', 'overview'] },
        { icon: Users, label: 'My Classes', action: () => navigate('/faculty/classes'), keywords: ['sections'] },
        { icon: GraduationCap, label: 'My Students', action: () => navigate('/faculty/students'), keywords: ['learners'] },
        { icon: Calendar, label: 'Timetable', action: () => navigate('/faculty/timetable'), keywords: ['schedule'] },
        { icon: ClipboardCheck, label: 'Attendance', action: () => navigate('/faculty/attendance'), keywords: ['presence'] },
        { icon: BarChart3, label: 'Analytics', action: () => navigate('/faculty/analytics'), keywords: ['reports'] },
        { icon: Bell, label: 'Notices', action: () => navigate('/faculty/notices'), keywords: ['announcements'] },
        { icon: Settings, label: 'Settings', action: () => navigate('/faculty/settings'), keywords: ['config'] },
      );
    } else {
      baseItems.push(
        { icon: LayoutDashboard, label: 'Dashboard', action: () => navigate('/student'), keywords: ['home', 'overview'] },
        { icon: Calendar, label: 'Timetable', action: () => navigate('/student/timetable'), keywords: ['schedule'] },
        { icon: ClipboardCheck, label: 'My Attendance', action: () => navigate('/student/attendance'), keywords: ['presence'] },
        { icon: Bell, label: 'Notices', action: () => navigate('/student/notices'), keywords: ['announcements'] },
        { icon: Settings, label: 'Settings', action: () => navigate('/student/settings'), keywords: ['config'] },
      );
    }

    return baseItems;
  };

  const themeItems: CommandItem[] = [
    { 
      icon: Sun, 
      label: 'Light Mode', 
      action: () => setTheme('light'),
      keywords: ['theme', 'bright']
    },
    { 
      icon: Moon, 
      label: 'Dark Mode', 
      action: () => setTheme('dark'),
      keywords: ['theme', 'night']
    },
  ];

  const actionItems: CommandItem[] = [
    {
      icon: LogOut,
      label: 'Sign Out',
      shortcut: '⌘Q',
      action: () => {
        logout();
        navigate('/login');
      },
      keywords: ['logout', 'exit'],
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          {getNavigationItems().map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => runCommand(item.action)}
              className="cursor-pointer"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.shortcut && (
                <span className="ml-auto text-xs text-slate-500">{item.shortcut}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          {themeItems.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => runCommand(item.action)}
              className="cursor-pointer"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => runCommand(item.action)}
              className="cursor-pointer"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.shortcut && (
                <span className="ml-auto text-xs text-slate-500">{item.shortcut}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      onClick={() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-all ${className || ''}`}
    >
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-700/50 border border-slate-600 rounded">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
