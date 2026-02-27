import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Users, CheckCircle, XCircle, Fingerprint, Brain, Clock3 } from 'lucide-react';
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
  const location = useLocation();
  const classContext = (location.state as { className?: string; subject?: string; slot?: string }) || {};
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [mode, setMode] = useState<'MANUAL' | 'SMART'>('MANUAL');
  const [smartMethod, setSmartMethod] = useState<'FACE' | 'FINGERPRINT'>('FACE');

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

  const stats = useMemo(() => {
    const required = 75;
    const totalRecorded = presentCount + absentCount;
    const currentPct = totalRecorded ? (presentCount / totalRecorded) * 100 : 0;
    const classesNeeded = Math.max(0, Math.ceil(((required * totalRecorded) / 100 - presentCount) / ((100 - required) / 100)));
    const safeAbsences = Math.max(0, Math.floor((presentCount - (required * totalRecorded) / 100) / (required / 100)));
    return {
      currentPct: Math.round(currentPct * 10) / 10,
      classesNeeded,
      safeAbsences,
      required,
    };
  }, [absentCount, presentCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance Session</h1>
          <p className="text-slate-400">
            {classContext.subject ? `${classContext.subject} • ${classContext.className || 'Class'} • ${classContext.slot || 'Current slot'}` : 'Mark attendance for your classes'}
          </p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400">Present</p>
            <p className="text-3xl font-bold text-emerald-400">{presentCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400">Absent</p>
            <p className="text-3xl font-bold text-red-400">{absentCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Real-time calculation</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white">{stats.currentPct}%</p>
              <span className="text-xs text-slate-500">vs {stats.required}% required</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Classes needed: {stats.classesNeeded} • Safe misses: {stats.safeAbsences}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={mode === 'MANUAL' ? 'manual' : 'smart'} onValueChange={(v) => setMode(v === 'manual' ? 'MANUAL' : 'SMART')} className="w-full">
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="smart">Smart (Face / Biometric)</TabsTrigger>
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

        <TabsContent value="smart" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-emerald-400" /> Smart Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button variant={smartMethod === 'FACE' ? 'default' : 'secondary'} onClick={() => setSmartMethod('FACE')} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" /> Face Recognition
                  </Button>
                  <Button variant={smartMethod === 'FINGERPRINT' ? 'default' : 'secondary'} onClick={() => setSmartMethod('FINGERPRINT')} className="flex-1">
                    <Fingerprint className="w-4 h-4 mr-2" /> Fingerprint
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-center">
                  {smartMethod === 'FACE' ? (
                    <>
                      <Camera className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                      <p className="text-white font-semibold">Camera ready</p>
                      <p className="text-sm text-slate-400">Start scan to auto-mark present students with confidence scores.</p>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                      <p className="text-white font-semibold">Fingerprint ready</p>
                      <p className="text-sm text-slate-400">Use device biometrics; we will sync in real-time.</p>
                    </>
                  )}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-3">
                    <Clock3 className="w-3 h-3" /> Real-time percentage recalculates after each scan
                  </div>
                  <Button className="mt-4" onClick={() => toast.success('Smart attendance started (simulated)')}>
                    Start Smart Session
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Live Calculation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Current %</span>
                  <span className="font-semibold text-white">{stats.currentPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Classes needed (to reach {stats.required}%)</span>
                  <span className="font-semibold text-emerald-300">{stats.classesNeeded}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Safe absences</span>
                  <span className="font-semibold text-amber-300">{stats.safeAbsences}</span>
                </div>
                <p className="text-xs text-slate-500">Formula: Current% = (Present / Total) × 100; ClassesNeeded = ceil((Required% × Total - Present) / (100 - Required%)); SafeAbsences = floor((Present - Required% × Total) / Required%).</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}