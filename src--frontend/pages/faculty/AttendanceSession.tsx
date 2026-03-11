import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Users, CheckCircle, XCircle, Fingerprint, Brain, Clock3, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { attendanceService, studentService, timetableService, sessionService } from '@/lib/api';
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

  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);

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

  const startSession = async () => {
    if (!selectedEntry) return;
    
    try {
      toast.loading('Capturing location and initializing session...', { id: 'session' });
      
      // Get GPS Location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const res = await sessionService.start({
        faculty_id: user?.faculty?.id || '',
        class_id: selectedEntry.class_id,
        course_id: selectedEntry.course_id,
        timetable_entry_id: selectedEntry.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        radius_meters: 100, // 100m geo-fence
        duration_mins: 15
      });

      if (res.success) {
        setSessionCode(res.session.session_code);
        setActiveSession(res.session);
        setIsSessionActive(true);
        toast.success(`Session started! Code: ${res.session.session_code}`, { id: 'session' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to start anti-proxy session. Check GPS permissions.', { id: 'session' });
    }
  };

  const endSession = () => {
    setIsSessionActive(false);
    setSessionCode(null);
    setActiveSession(null);
    toast.success('Attendance session ended');
  };

  const markAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT' | 'FLAGGED', recordId?: string) => {
    if (!selectedEntry) return;
    try {
      if (recordId) {
          // If we have an existing record (AI marked but needs approval/correction)
          await attendanceService.update(recordId, { status });
      } else {
          // New manual mark
          await attendanceService.mark({
            student_id: studentId,
            class_id: selectedEntry.class_id,
            course_id: selectedEntry.course_id,
            timetable_entry_id: selectedEntry.id,
            status,
            method: mode === 'SMART' ? smartMethod : 'MANUAL',
          });
      }
      toast.success(`Attendance updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update attendance');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'ABSENT':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'FLAGGED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const mergedStudents = useMemo(() => {
    return roster.map((student) => {
      const record = attendance.find((a) => a.student_id === student.id && a.date === today);
      const status = record?.status || 'PENDING';
      return {
        id: student.id,
        recordId: record?.id,
        name: `${student.profile?.first_name ?? ''} ${student.profile?.last_name ?? ''}`.trim() || student.profile?.first_name || 'Student',
        enrollmentId: student.enrollment_id,
        status,
        confidence: record?.confidence_score,
        method: record?.method,
        remarks: record?.remarks,
      } as const;
    });
  }, [attendance, roster, today]);

  const presentCount = mergedStudents.filter(s => s.status === 'PRESENT').length;
  const absentCount = mergedStudents.filter(s => s.status === 'ABSENT').length;
  const flaggedCount = mergedStudents.filter(s => s.status === 'FLAGGED').length;
  const pendingCount = mergedStudents.filter(s => s.status === 'PENDING').length;

  const flaggedStudents = useMemo(() => mergedStudents.filter(s => s.status === 'FLAGGED'), [mergedStudents]);
  const stats = useMemo(() => {
    const required = 75;
    const totalRecorded = presentCount + absentCount + flaggedCount;
    const currentPct = totalRecorded ? (presentCount / totalRecorded) * 100 : 0;
    const classesNeeded = Math.max(0, Math.ceil(((required * totalRecorded) / 100 - presentCount) / ((100 - required) / 100)));
    const safeAbsences = Math.max(0, Math.floor((presentCount - (required * totalRecorded) / 100) / (required / 100)));
    return {
      currentPct: Math.round(currentPct * 10) / 10,
      classesNeeded,
      safeAbsences,
      required,
    };
  }, [absentCount, presentCount, flaggedCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white italic truncate tracking-tighter uppercase">Attendance Session</h1>
          <p className="text-slate-500 text-sm font-medium">
            {selectedEntry
              ? `${selectedEntry.course?.name || 'Subject'} • ${selectedEntry.class?.name || 'Class'}`
              : 'Secure Verification Portal'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isSessionActive ? (
            <Button onClick={startSession} className="bg-emerald-600 hover:bg-emerald-500 py-6 px-8 rounded-2xl shadow-lg shadow-emerald-900/20 font-bold" disabled={isLoadingData || !selectedEntry}>
              <Camera className="w-5 h-5 mr-3" />
              Initialize Portal
            </Button>
          ) : (
            <Button onClick={endSession} variant="destructive" className="py-6 px-8 rounded-2xl shadow-lg shadow-red-900/20 font-bold">
              Finalize & Lock
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isSessionActive && sessionCode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card className="bg-slate-900 border-cyan-500/20 overflow-hidden relative rounded-3xl group">
              <div className="absolute top-0 right-0 p-4">
                <Badge className="bg-cyan-500/10 text-cyan-400 border-none animate-pulse">LIVE GEO-FENCING</Badge>
              </div>
              <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="space-y-2">
                   <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Access Protocol</h3>
                   <p className="text-2xl font-bold text-white tracking-tight">Broadcast Session Token</p>
                </div>
                <div className="flex items-center gap-4">
                  {sessionCode.split('').map((char, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.1, rotate: 2 }}
                      className="w-16 h-20 bg-slate-950 border-2 border-slate-800 rounded-2xl flex items-center justify-center text-5xl font-black text-cyan-400 shadow-2xl"
                    >
                      {char}
                    </motion.div>
                  ))}
                </div>
                <div className="hidden lg:block text-right">
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-2">Security Hash</p>
                   <p className="text-xs font-mono text-slate-400">{activeSession?.id.substring(0, 16)}...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Verified', val: presentCount, color: 'text-emerald-400', icon: CheckCircle },
          { label: 'Flagged', val: flaggedCount, color: 'text-amber-400', icon: ShieldAlert },
          { label: 'Absent', val: absentCount, color: 'text-red-400', icon: XCircle },
          { label: 'Live %', val: `${stats.currentPct}%`, color: 'text-white', icon: Users },
        ].map((s, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-800/50 rounded-2xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.val}</p>
              </div>
              <s.icon className={`w-8 h-8 ${s.color} opacity-20`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto rounded-2xl">
          <TabsTrigger value="live" className="rounded-xl px-6 py-3 font-bold data-[state=active]:bg-cyan-600">Verification Feed</TabsTrigger>
          <TabsTrigger value="flagged" className="rounded-xl px-6 py-3 font-bold data-[state=active]:bg-amber-600">Review Required <Badge className="ml-2 bg-white/20">{flaggedCount}</Badge></TabsTrigger>
          <TabsTrigger value="all" className="rounded-xl px-6 py-3 font-bold">Comprehensive Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="flagged" className="space-y-4 mt-6">
           {flaggedStudents.length === 0 ? (
             <Card className="bg-slate-900/30 border-dashed border-slate-800 py-20 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest">No Security Flags Detected</p>
             </Card>
           ) : (
             <div className="grid grid-cols-1 gap-3">
                {flaggedStudents.map(student => (
                   <Card key={student.id} className="bg-slate-900/80 border-amber-500/20 rounded-2xl overflow-hidden">
                      <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                         <div className="flex items-center gap-4">
                            <Avatar className="w-12 h-12 border-2 border-amber-500/30">
                               <AvatarFallback className="bg-amber-500/10 text-amber-400 font-bold">{student.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                               <p className="font-black text-white">{student.name}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30">{student.remarks || 'SUSPICIOUS_IDENTITY'}</Badge>
                                  <span className="text-[10px] text-slate-500 font-mono">CONF: {(student.confidence || 0 * 100).toFixed(0)}%</span>
                               </div>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl" onClick={() => markAttendance(student.id, 'PRESENT', student.recordId)}>
                               Approve Manually
                            </Button>
                            <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                               Confirm Fraud
                            </Button>
                         </div>
                      </CardContent>
                   </Card>
                ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
           <Card className="bg-slate-900/50 border-slate-800 rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900/80 p-6 border-b border-slate-800">
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-black text-white italic uppercase tracking-wider">Verification Stream</CardTitle>
                    <Badge className="bg-blue-500/10 text-blue-400">REAL-TIME SYNC</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-slate-800">
                    {mergedStudents.filter(s => s.status !== 'PENDING').sort((a,b) => (a.status === 'FLAGGED' ? -1 : 1)).map(student => (
                       <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className={`w-2 h-10 rounded-full ${student.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                             <div>
                                <p className="font-bold text-white text-sm">{student.name}</p>
                                <p className="text-[10px] text-slate-500 tracking-wider">METHOD: {student.method || 'AI_FACE'}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                             <div className="text-right">
                                <p className={`text-xs font-black ${student.status === 'PRESENT' ? 'text-emerald-400' : 'text-amber-400'}`}>{student.status}</p>
                                <p className="text-[10px] font-mono text-slate-600">ACCURACY: {(student.confidence || 0.9 * 100).toFixed(0)}%</p>
                             </div>
                             <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                                <XCircle className="w-4 h-4" />
                             </Button>
                          </div>
                       </div>
                    ))}
                    {mergedStudents.filter(s => s.status !== 'PENDING').length === 0 && (
                       <div className="py-20 text-center text-slate-600 uppercase text-[10px] font-black tracking-[0.4em]">
                          Awaiting scan entries...
                       </div>
                    )}
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card className="bg-slate-900/50 border-slate-800 rounded-3xl overflow-hidden">
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-slate-900/80 border-b border-slate-800">
                        <tr>
                           <th className="p-5 text-[10px] font-black text-slate-500 uppercase">Student</th>
                           <th className="p-5 text-[10px] font-black text-slate-500 uppercase">Status</th>
                           <th className="p-5 text-[10px] font-black text-slate-500 uppercase text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/50">
                        {mergedStudents.map(student => (
                           <tr key={student.id} className="group hover:bg-slate-800/20 transition-colors">
                              <td className="p-5">
                                 <div className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8 rounded-lg">
                                       <AvatarFallback className="bg-slate-800 text-slate-400 text-[10px]">{student.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                       <p className="text-sm font-bold text-white">{student.name}</p>
                                       <p className="text-[10px] text-slate-600">{student.enrollmentId}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-5">
                                 <Badge className={`${getStatusColor(student.status)} border-none text-[9px] px-2 font-black`}>
                                    {student.status}
                                 </Badge>
                              </td>
                              <td className="p-5 text-right">
                                 <div className="flex justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400" onClick={() => markAttendance(student.id, 'PRESENT', student.recordId)}>
                                       <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                                       <XCircle className="h-4 w-4" />
                                    </Button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}