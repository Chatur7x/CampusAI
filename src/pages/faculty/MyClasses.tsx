import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, TrendingUp, ListChecks } from 'lucide-react';

const roster = {
  '1': ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown'],
  '2': ['Ravi Kumar', 'Aditi Singh', 'Meena Patel'],
  '3': ['Carlos Diaz', 'Fatima Noor', 'Chen Wei'],
  '4': ['Rohan Roy', 'Sneha Iyer', 'Arjun Menon'],
};

const classes = [
  { id: '1', name: 'CSE-A', subject: 'Data Structures', students: 45, attendance: 92 },
  { id: '2', name: 'CSE-B', subject: 'Algorithms', students: 42, attendance: 88 },
  { id: '3', name: 'CSE-C', subject: 'Database Systems', students: 38, attendance: 85 },
  { id: '4', name: 'IT-A', subject: 'Web Development', students: 35, attendance: 90 },
];

export default function MyClassesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  const openAttendance = (cls: typeof classes[number]) => {
    navigate('/faculty/attendance', {
      state: {
        className: cls.name,
        subject: cls.subject,
        slot: 'From My Classes',
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Classes</h1>
        <p className="text-slate-400">Classes assigned to you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {classes.map((cls) => (
          <Card key={cls.id} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className="bg-cyan-500/20 text-cyan-400 mb-2">{cls.name}</Badge>
                  <h3 className="text-lg font-semibold text-white">{cls.subject}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-4 h-4" />
                  <span>{cls.students} Students</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>{cls.attendance}% Attendance</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openAttendance(cls)}>
                    Mark Attendance
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === cls.id ? null : cls.id)}>
                    <ListChecks className="w-4 h-4 mr-1" />
                    {expanded === cls.id ? 'Hide Roster' : 'View Roster'}
                  </Button>
                </div>
              </div>
              {expanded === cls.id && (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-800/40 p-4 text-sm text-slate-200">
                  <p className="font-semibold mb-2">Enrolled students</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300">
                    {((roster as Record<string, string[]>)[cls.id] || []).map((name: string) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}