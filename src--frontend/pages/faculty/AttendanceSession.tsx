import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Users, CheckCircle, XCircle, Fingerprint, Brain, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { attendanceService, studentService, timetableService } from '@/lib/api';
import { useRealtimeAttendance } from '@/lib/realtime';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { TimetableEntry, Student } from '@/lib/database.types';

type FacultyTimetableEntry = TimetableEntry & {
  class?: { id?: string; name?: string; section?: string };
  course?: { id?: string; name?: string; code?: string };
};

export default function AttendanceSessionPage() {
  const location = useLocation();
  const classContext = (location.state as { className?: string; subject?: string; slot?: string; classId?: string; courseId?: string }) || {};
  const { user } = useSupabaseAuth();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [mode, setMode] = useState<'MANUAL' | 'SMART'>('MANUAL');
  const [smartMethod, setSmartMethod] = useState<'FACE' | 'FINGERPRINT'>('FACE');
  const [entries, setEntries] = useState<FacultyTimetableEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) || entries[0],
    [entries, selectedEntryId]
  );

  const { attendance, isLoading: attendanceLoading } = useRealtimeAttendance({
    classId: selectedEntry?.class_id,
    date: today,
  });

  const isLoadingData = loading || attendanceLoading;
  
  // Real-time projector toast notifications
  const prevAttendanceLen = useRef(0);
  useEffect(() => {
    if (attendance.length > prevAttendanceLen.current && prevAttendanceLen.current > 0) {
        const diff = attendance.length - prevAttendanceLen.current;
        const newRecords = attendance.slice(0, diff);
        newRecords.forEach(record => {
           if (record.status === 'PRESENT') {
               const student = roster.find(s => s.id === record.student_id);
               if (student) {
                   const name = student.profile?.first_name || 'A student';
                   toast.success(`${name} verified via AI (${Math.round((record.confidence_score || 0) * 100)}% match)`, {
                       duration: 4000,
                       icon: <CheckCircle className="w-5 h-5 text-emerald-400" />
                   });
               }
           }
        });
    }
    prevAttendanceLen.current = attendance.length;
  }, [attendance, roster]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const load = async () => {
      if (!user?.faculty?.id) return;
      try {
        setLoading(true);
        const data = await timetableService.getForFaculty(user.faculty.id);
        setEntries(data);
        if (!selectedEntryId && data.length > 0) {
          setSelectedEntryId(data[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load timetable');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.faculty?.id, selectedEntryId]);

  useEffect(() => {
    if (!entries.length || !classContext.classId) return;
    const match = entries.find(
      (entry) => entry.class_id === classContext.classId && (!classContext.courseId || entry.course_id === classContext.courseId)
    );
    if (match) setSelectedEntryId(match.id);
  }, [classContext.classId, classContext.courseId, entries]);

  useEffect(() => {
    const fetchRoster = async () => {
      if (!selectedEntry?.class_id) return;
      try {
        const data = await studentService.getAll({ classId: selectedEntry.class_id });
        setRoster(data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load students');
      }
    };
    fetchRoster();
  }, [selectedEntry?.class_id]);

  const startSession = () => {
    setIsSessionActive(true);
    toast.success('Attendance session started');
  };

  const endSession = () => {
    setIsSessionActive(false);
    toast.success('Attendance session ended');
  };

  const markAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!selectedEntry) return;
    try {
      await attendanceService.mark({
        student_id: studentId,
        class_id: selectedEntry.class_id,
        course_id: selectedEntry.course_id,
        timetable_entry_id: selectedEntry.id,
        status,
        method: mode === 'SMART' ? smartMethod : 'MANUAL',
      });
      toast.success('Attendance saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update attendance');
    }
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

  const mergedStudents = useMemo(() => {
    return roster.map((student) => {
      const record = attendance.find((a) => a.student_id === student.id && a.date === today);
      const status = record?.status || 'PENDING';
      return {
        id: student.id,
        name: `${student.profile?.first_name ?? ''} ${student.profile?.last_name ?? ''}`.trim() || student.profile?.first_name || 'Student',
        enrollmentId: student.enrollment_id,
        status,
        confidence: record?.confidence_score,
      } as const;
    });
  }, [attendance, roster, today]);

  const presentCount = mergedStudents.filter(s => s.status === 'PRESENT').length;
  const absentCount = mergedStudents.filter(s => s.status === 'ABSENT').length;
  const pendingCount = mergedStudents.filter(s => s.status === 'PENDING').length;

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
            {selectedEntry
              ? `${selectedEntry.course?.name || 'Subject'} • ${selectedEntry.class?.name || 'Class'} • ${classContext.slot || 'Current slot'}`
              : classContext.subject
                ? `${classContext.subject} • ${classContext.className || 'Class'} • ${classContext.slot || 'Current slot'}`
                : 'Mark attendance for your classes'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isSessionActive ? (
            <Button onClick={startSession} className="bg-cyan-600 hover:bg-cyan-700" disabled={isLoadingData || !selectedEntry}>
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

      {!loading && entries.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 text-slate-300">No timetable entries assigned to you yet.</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 items-center">
        <Badge className="bg-slate-800 text-slate-200 border-slate-700">Date: {today}</Badge>
        <Tabs value={selectedEntry?.id || ''} onValueChange={setSelectedEntryId} className="w-full">
          <TabsList className="bg-slate-800/50 overflow-x-auto">
            {entries.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id} className="text-xs md:text-sm">
                {entry.class_id ? `Class ${entry.class_id.slice(0, 4)}` : 'Class'} • {entry.course_id ? entry.course_id.slice(0, 4) : 'Course'}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
                <AnimatePresence>
                  {mergedStudents.map((student) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={student.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors duration-500 ${student.status === 'PRESENT' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-800/0'}`}
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
                  </motion.div>
                ))}
              </AnimatePresence>
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