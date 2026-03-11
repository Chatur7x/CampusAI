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
    <div className="space-y-6 relative">
      {/* HUD Scanning Line Effect */}
      {isSessionActive && <div className="scanning-line" />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <h1 className="text-fluid-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
            <span className="w-2 h-8 bg-emerald-500 rounded-full animate-pulse" />
            Command Center
          </h1>
          <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
            <span className="text-emerald-500 font-mono">[LIVE_PROTOCOLS_ACTIVE]</span> 
            {selectedEntry
              ? `${selectedEntry.course?.name || 'Subject'} • ${selectedEntry.class?.name || 'Class'}`
              : 'Verifying Identity Systems...'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!isSessionActive ? (
            <Button 
              onClick={startSession} 
              className="bg-emerald-600 hover:bg-emerald-500 py-7 px-10 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              disabled={isLoadingData || !selectedEntry}
            >
              <Camera className="w-5 h-5 mr-3" />
              Initialize Portal
            </Button>
          ) : (
            <Button 
              onClick={endSession} 
              variant="destructive" 
              className="py-7 px-10 rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.3)] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
            >
              Finalize & Lock
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isSessionActive && sessionCode && (
          <motion.div 
            initial={{ height: 0, opacity: 0, scale: 0.95 }} 
            animate={{ height: 'auto', opacity: 1, scale: 1 }} 
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            className="relative z-10"
          >
            <div className="glass-premium hud-border overflow-hidden relative rounded-3xl p-8 mb-8">
              <div className="absolute top-0 right-0 p-4">
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none animate-pulse-emerald flex items-center gap-2 px-4 py-1.5 font-black uppercase tracking-widest">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Live Geo-Fencing
                </Badge>
              </div>
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="space-y-3">
                   <h3 className="text-fluid-xs font-black text-slate-500 uppercase tracking-[0.4em]">Broadcast Session Token</h3>
                   <p className="text-fluid-lg font-bold text-white tracking-tight">Active Authenticator</p>
                </div>
                
                <div className="flex items-center gap-4">
                  {sessionCode.split('').map((char, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.1, y: -5 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="w-14 sm:w-16 md:w-20 h-20 md:h-24 glass-premium border-emerald-500/30 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-black text-white shadow-[0_10px_40px_rgba(16,185,129,0.15)] relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent group-hover:from-emerald-500/20" />
                      {char}
                    </motion.div>
                  ))}
                </div>
                
                <div className="hidden lg:block text-right">
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-2 tracking-[0.3em]">Security SHA-256 Hash</p>
                   <p className="text-[10px] font-mono text-emerald-500/60 bg-emerald-500/5 px-2 py-1 rounded-md">{activeSession?.id.replace(/-/g, '')}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        {[
          { label: 'Verified', val: presentCount, color: 'text-emerald-400', icon: CheckCircle, bg: 'bg-emerald-500/5' },
          { label: 'Flagged', val: flaggedCount, color: 'text-amber-400', icon: ShieldAlert, bg: 'bg-amber-500/5' },
          { label: 'Absent', val: absentCount, color: 'text-red-400', icon: XCircle, bg: 'bg-red-500/5' },
          { label: 'Live %', val: `${stats.currentPct}%`, color: 'text-white', icon: Users, bg: 'bg-white/5' },
        ].map((s, i) => (
          <Card key={i} className={`${s.bg} border-slate-800/50 rounded-2xl overflow-hidden glass-premium group hover:border-emerald-500/30 transition-all duration-300`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                <div className="flex items-baseline gap-1">
                  <p className={`text-fluid-md font-black ${s.color}`}>{s.val}</p>
                  {i < 3 && <span className="text-[10px] text-slate-600 font-mono">/ {roster.length}</span>}
                </div>
              </div>
              <div className={`p-3 rounded-xl ${s.bg} border border-white/5 group-hover:scale-110 transition-transform`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative z-10">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-1.5 h-auto rounded-2xl flex w-fit gap-1">
            <TabsTrigger value="live" className="rounded-xl px-8 py-3.5 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-emerald-600 transition-all">Verification Feed</TabsTrigger>
            <TabsTrigger value="flagged" className="rounded-xl px-8 py-3.5 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-amber-600 transition-all">
              Security Flags <Badge className="ml-2 bg-white/20 border-none px-2">{flaggedCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-xl px-8 py-3.5 font-black uppercase text-[10px] tracking-widest transition-all">Full Roster</TabsTrigger>
          </TabsList>

          <TabsContent value="flagged" className="space-y-4 mt-8">
             {flaggedStudents.length === 0 ? (
               <Card className="bg-slate-900/20 border-dashed border-slate-800 py-24 text-center rounded-3xl">
                  <div className="mx-auto w-16 h-16 bg-emerald-500/5 rounded-full flex items-center justify-center border border-emerald-500/10 mb-6">
                    <CheckCircle className="w-8 h-8 text-emerald-500/30" />
                  </div>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">No Security Anomalies Detected</p>
               </Card>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {flaggedStudents.map(student => (
                     <Card key={student.id} className="glass-premium border-amber-500/30 rounded-3xl overflow-hidden group hover:border-amber-500/50 transition-all">
                        <CardContent className="p-6">
                           <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <Avatar className="w-14 h-14 border-2 border-amber-500/30 rounded-2xl">
                                     <AvatarFallback className="bg-amber-500/10 text-amber-400 font-black text-xl">{student.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                   <p className="font-black text-white text-lg tracking-tight">{student.name}</p>
                                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">ID: {student.enrollmentId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                 <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 px-3 py-1 font-black bg-amber-500/5 mb-2">
                                    {student.remarks || 'PROXY_SUSPECTED'}
                                 </Badge>
                                 <p className="text-[10px] text-slate-500 font-mono">CONFIDENCE: <span className="text-white">{(student.confidence || 0 * 100).toFixed(0)}%</span></p>
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => markAttendance(student.id, 'PRESENT', student.recordId)}>
                                Override & Approve
                              </Button>
                              <Button size="lg" variant="destructive" className="rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                                Confirm Fraud
                              </Button>
                           </div>
                        </CardContent>
                     </Card>
                  ))}
               </div>
             )}
          </TabsContent>

          <TabsContent value="live" className="mt-8">
             <Card className="glass-premium hud-border rounded-3xl overflow-hidden relative">
                <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center px-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-500/5 shimmer" />
                  <CardTitle className="text-fluid-xs font-black text-white italic uppercase tracking-widest relative z-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Live Biometric Stream
                  </CardTitle>
                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocol Sync</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black px-4">ENCRYPTED</Badge>
                  </div>
                </div>
                <CardContent className="p-0">
                   <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {mergedStudents.filter(s => s.status !== 'PENDING').sort((a,b) => (a.status === 'FLAGGED' ? -1 : 1)).map(student => (
                         <div key={student.id} className="p-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                            <div className="flex items-center gap-5">
                               <div className={`w-1.5 h-12 rounded-full ${student.status === 'PRESENT' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'}`} />
                               <div className="space-y-1">
                                  <p className="font-black text-white text-base tracking-tight">{student.name}</p>
                                  <div className="flex items-center gap-3">
                                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">ID: {student.enrollmentId.substring(0,8)}</p>
                                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                                    <p className="text-[10px] text-emerald-500/70 font-mono">METHOD_{student.method || 'AI_V2'}</p>
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-8">
                               <div className="text-right space-y-1">
                                  <p className={`text-xs font-black uppercase tracking-widest ${student.status === 'PRESENT' ? 'text-emerald-400' : 'text-amber-400'}`}>{student.status}</p>
                                  <p className="text-[10px] font-mono text-slate-600">AUTH_LEVEL: <span className="text-white">{(student.confidence || 0.9 * 100).toFixed(0)}%</span></p>
                               </div>
                               <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                                  <XCircle className="w-5 h-5" />
                                </Button>
                            </div>
                         </div>
                      ))}
                      {mergedStudents.filter(s => s.status !== 'PENDING').length === 0 && (
                         <div className="py-24 text-center">
                            <Brain className="w-12 h-12 text-slate-800 mx-auto mb-6 opacity-20" />
                            <p className="text-slate-600 uppercase text-[10px] font-black tracking-[0.5em] animate-pulse">Initializing Intelligent Scan Feed...</p>
                         </div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-8">
            <Card className="glass-premium rounded-3xl overflow-hidden border-white/5">
              <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Profile</th>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Identity Status</th>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Emergency Override</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/[0.03]">
                          {mergedStudents.map(student => (
                             <tr key={student.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="p-6">
                                   <div className="flex items-center gap-4">
                                      <Avatar className="w-10 h-10 rounded-xl border border-white/10 group-hover:border-emerald-500/30 transition-all">
                                         <AvatarFallback className="bg-slate-800 text-slate-400 text-xs font-black">{student.name[0]}</AvatarFallback>
                                      </Avatar>
                                      <div className="space-y-0.5">
                                         <p className="text-base font-black text-white tracking-tight">{student.name}</p>
                                         <p className="text-[10px] text-slate-600 font-mono tracking-widest">{student.enrollmentId}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="p-6 text-center">
                                   <Badge className={`${getStatusColor(student.status)} border-none text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest`}>
                                      {student.status}
                                   </Badge>
                                </td>
                                <td className="p-6 text-right">
                                   <div className="flex justify-end gap-3 opacity-20 group-hover:opacity-100 transition-all">
                                      <Button size="icon" variant="ghost" className="h-10 w-10 text-emerald-500 hover:bg-emerald-500/10 rounded-xl" onClick={() => markAttendance(student.id, 'PRESENT', student.recordId)}>
                                         <CheckCircle className="h-5 w-5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl" onClick={() => markAttendance(student.id, 'ABSENT', student.recordId)}>
                                         <XCircle className="h-5 w-5" />
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
    </div>
  );
}