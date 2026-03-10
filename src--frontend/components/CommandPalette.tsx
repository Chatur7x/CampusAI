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
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useTheme } from '@/context/ThemeContext';
import { studentService, facultyService, classService, departmentService } from '@/lib/api';

interface CommandItem {
  icon: React.ElementType;
  label: string;
  subLabel?: string;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

interface SearchEntity {
  id: string;
  type: 'Student' | 'Faculty' | 'Class' | 'Department';
  name: string;
  description: string;
  path: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entities, setEntities] = useState<SearchEntity[]>([]);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user, signOut: logout } = useSupabaseAuth();
  const { setTheme } = useTheme();

  // Load global search data when opened (Admin only for now)
  useEffect(() => {
    if (open && user?.role === 'ADMIN' && entities.length === 0) {
      setLoading(true);
      Promise.all([
        studentService.getAll(),
        facultyService.getAll(),
        classService.getAll(),
        departmentService.getAll(),
      ]).then(([students, faculty, classes, depts]) => {
        const searchData: SearchEntity[] = [
          ...students.map((s: any) => ({
            id: s.id,
            type: 'Student' as const,
            name: `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim() || s.enrollment_id || 'Student',
            description: s.enrollment_id || 'Student',
            path: '/admin/students',
          })),
          ...faculty.map((f: any) => ({
            id: f.id,
            type: 'Faculty' as const,
            name: `${f.profile?.first_name || ''} ${f.profile?.last_name || ''}`.trim() || f.employee_id || 'Faculty',
            description: f.employee_id || 'Faculty',
            path: '/admin/faculty',
          })),
          ...classes.map((c: any) => ({
            id: c.id,
            type: 'Class' as const,
            name: `${c.name} - ${c.section}`,
            description: 'Class',
            path: '/admin/classes',
          })),
          ...depts.map((d: any) => ({
            id: d.id,
            type: 'Department' as const,
            name: d.name,
            description: d.code || 'Department',
            path: '/admin/departments',
          })),
        ];
        setEntities(searchData);
        setLoading(false);
      }).catch((e) => {
        console.error('Failed to load global search data', e);
        setLoading(false);
      });
    }
  }, [open, user, entities.length]);

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

  // Filter global search results
  const globalResults = query.length > 1 ? entities.filter((e) => 
    e.name.toLowerCase().includes(query.toLowerCase()) || 
    e.description.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10) : [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a command or search globally..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{loading ? 'Loading search data...' : 'No results found.'}</CommandEmpty>
        
        {globalResults.length > 0 && (
          <CommandGroup heading="Global Search Results">
            {globalResults.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => runCommand(() => navigate(item.path))}
                className="cursor-pointer"
              >
                {item.type === 'Student' ? <GraduationCap className="mr-2 h-4 w-4 text-emerald-400" /> :
                 item.type === 'Faculty' ? <Users className="mr-2 h-4 w-4 text-blue-400" /> :
                 item.type === 'Class' ? <BookOpen className="mr-2 h-4 w-4 text-cyan-400" /> :
                 <Building2 className="mr-2 h-4 w-4 text-violet-400" />}
                <div className="flex flex-col">
                  <span>{item.name}</span>
                  <span className="text-xs text-slate-500">{item.type} • {item.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        
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
