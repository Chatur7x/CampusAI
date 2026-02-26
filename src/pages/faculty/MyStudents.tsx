import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, TrendingDown, AlertCircle } from 'lucide-react';

const students = [
  { id: '1', name: 'John Doe', enrollmentId: 'STU001', attendance: 95, risk: 'LOW' },
  { id: '2', name: 'Jane Smith', enrollmentId: 'STU002', attendance: 88, risk: 'LOW' },
  { id: '3', name: 'Bob Johnson', enrollmentId: 'STU003', attendance: 72, risk: 'MEDIUM' },
  { id: '4', name: 'Alice Brown', enrollmentId: 'STU004', attendance: 65, risk: 'HIGH' },
  { id: '5', name: 'Charlie Wilson', enrollmentId: 'STU005', attendance: 92, risk: 'LOW' },
];

export default function MyStudentsPage() {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-500/20 text-red-400';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-500/20 text-emerald-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Students</h1>
        <p className="text-slate-400">View and manage your students</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-white">120</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">At Risk</p>
                <p className="text-2xl font-bold text-white">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Critical</p>
                <p className="text-2xl font-bold text-white">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Student List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">{student.name}</p>
                    <p className="text-sm text-slate-400">{student.enrollmentId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <Progress value={student.attendance} className="h-2 bg-slate-800" />
                  </div>
                  <span className="text-sm text-slate-400 w-12">{student.attendance}%</span>
                  <Badge className={getRiskColor(student.risk)}>{student.risk}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}