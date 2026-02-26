import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  enrollmentId: string;
  status: 'PRESENT' | 'ABSENT' | 'PENDING';
  confidence?: number;
}

const mockStudents: Student[] = [
  { id: '1', name: 'John Doe', enrollmentId: 'STU001', status: 'PRESENT', confidence: 0.95 },
  { id: '2', name: 'Jane Smith', enrollmentId: 'STU002', status: 'PENDING' },
  { id: '3', name: 'Bob Johnson', enrollmentId: 'STU003', status: 'ABSENT' },
  { id: '4', name: 'Alice Brown', enrollmentId: 'STU004', status: 'PRESENT', confidence: 0.88 },
  { id: '5', name: 'Charlie Wilson', enrollmentId: 'STU005', status: 'PENDING' },
];

export default function AttendanceSessionPage() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const startSession = () => {
    setIsSessionActive(true);
    toast.success('Attendance session started');
  };

  const endSession = () => {
    setIsSessionActive(false);
    toast.success('Attendance session ended');
  };

  const markAttendance = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, status } : s
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'ABSENT':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-amber-500/20 text-amber-400';
    }
  };

  const presentCount = students.filter(s => s.status === 'PRESENT').length;
  const absentCount = students.filter(s => s.status === 'ABSENT').length;
  const pendingCount = students.filter(s => s.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance Session</h1>
          <p className="text-slate-400">Mark attendance for your classes</p>
        </div>
        <div className="flex items-center gap-2">
          {!isSessionActive ? (
            <Button onClick={startSession} className="bg-cyan-600 hover:bg-cyan-700">
              <Camera className="w-4 h-4 mr-2" />
              Start Session
            </Button>
          ) : (
            <Button onClick={endSession} variant="destructive">
              End Session
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
            <p className="text-sm text-slate-400">Present</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{absentCount}</p>
            <p className="text-sm text-slate-400">Absent</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
            <p className="text-sm text-slate-400">Pending</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="face">Face Recognition</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Student List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
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
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                      {student.confidence && (
                        <span className="text-xs text-slate-500">
                          {(student.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAttendance(student.id, 'PRESENT')}
                          className="text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAttendance(student.id, 'ABSENT')}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="face" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-12 text-center">
              <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Face Recognition Attendance</h3>
              <p className="text-slate-400 mb-4">Use the camera to automatically mark attendance</p>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Camera className="w-4 h-4 mr-2" />
                Open Camera
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}