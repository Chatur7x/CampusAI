import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, TrendingUp } from 'lucide-react';

const classes = [
  { id: '1', name: 'CSE-A', subject: 'Data Structures', students: 45, attendance: 92 },
  { id: '2', name: 'CSE-B', subject: 'Algorithms', students: 42, attendance: 88 },
  { id: '3', name: 'CSE-C', subject: 'Database Systems', students: 38, attendance: 85 },
  { id: '4', name: 'IT-A', subject: 'Web Development', students: 35, attendance: 90 },
];

export default function MyClassesPage() {
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}