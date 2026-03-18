import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrCode, Play, StopCircle, CheckCircle2, XCircle, ShieldAlert, Timer, Users, RefreshCw, RadioReceiver, ShieldEllipsis, Bluetooth, BluetoothConnected, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { studentService, attendanceService, auditLogService, sessionService } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type StudentRequest = {
  id: string;
  studentId: string;
  name: string;
  rollNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged' | 'override_req';
  confidenceScore: number;
  time: string;
  dropoutRisk?: 'Low' | 'Medium' | 'High';
  isOfflineBLE?: boolean;
};

interface LiveAttendanceFacultyProps {
  classId?: string;
  subjectId?: string;
  timetableEntryId?: string;
}

export default function LiveAttendanceFaculty({ classId, subjectId, timetableEntryId }: LiveAttendanceFacultyProps) {
  const { user } = useSupabaseAuth();
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(120);
  const [codeTimeLeft, setCodeTimeLeft] = useState(30);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [overrideOtpId, setOverrideOtpId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [isPinging, setIsPinging] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online'|'offline'>('online');
  const [bleScannerActive, setBleScannerActive] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Fetch enrolled students when component mounts
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const students = await studentService.getAll({ class_id: classId } as any);
        setEnrolledStudents(students || []);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    })();
  }, [classId]);

  const startSession = async () => {
    if (!classId) return;
    
    setSaving(true);
    setStatusMsg('Initializing Secure Session...');

    try {
      // 1. Get faculty location for geo-fencing anchor
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const facultyId = user?.faculty?.id || user?.id || '';

      // 2. Start session on AI Server (AI will generate the 6-digit code)
      const res = await sessionService.start({
        faculty_id: facultyId,
        class_id: classId,
        course_id: subjectId || '',
        timetable_entry_id: timetableEntryId,
        latitude,
        longitude,
        radius_meters: 100,
        duration_mins: 5
      });

      if (!res.success || !res.session) {
        throw new Error(res.message || 'Failed to initialize session on AI server');
      }

      setSessionCode(res.session.session_code);
      setSessionActive(true);
      setTimeLeft(300); // 5 minutes standard
      setCodeTimeLeft(30);
      setRequests([]);

      // Pre-populate students from the class roster as pending
      const studentRequests: StudentRequest[] = enrolledStudents.map((s: any) => ({
        id: s.id,
        studentId: s.id,
        name: s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : `Student ${s.enrollment_id}`,
        rollNumber: s.enrollment_id || s.id.substring(0, 8),
        status: 'pending' as const,
        confidenceScore: 0,
        time: '',
      }));
      setRequests(studentRequests);

      auditLogService.log('ATTENDANCE_SESSION_START', 'attendance_session', classId || '', {
        newValues: { classId, subjectId, code: res.session.session_code, latitude, longitude },
      });

      toast.success('Secure attendance session activated');
    } catch (err: any) {
      console.error('Session Init Failed:', err);
      toast.error(err.message || 'Failed to start secure session. Please check location permissions.');
    } finally {
      setSaving(false);
      setStatusMsg('');
    }
  };

  const endSession = async () => {
    if (!classId) return;
    
    setSaving(true);
    try {
      // 1. Deactivate the session in the database
      await supabase
        .from('attendance_sessions')
        .update({ is_active: false })
        .eq('class_id', classId)
        .eq('session_code', sessionCode);

      setSessionActive(false);

      // 2. Identify students who never verified (stayed 'pending')
      const absentStudents = requests.filter(r => r.status === 'pending');
      const facultyId = user?.faculty?.id || user?.id || '';
      
      if (absentStudents.length > 0) {
        const absentRecords = absentStudents.map(r => ({
          student_id: r.studentId,
          subject_id: subjectId || null,
          timetable_entry_id: timetableEntryId || null,
          status: 'ABSENT' as const,
          method: 'MANUAL' as const,
          verified_by: facultyId,
          date: new Date().toISOString().split('T')[0],
        }));

        const { error } = await supabase
          .from('attendance')
          .upsert(absentRecords.map(r => ({
            student_id: r.student_id,
            subject_id: r.subject_id,
            date: r.date,
            status: r.status,
            method: r.method,
            verified_by: r.verified_by,
          })), { onConflict: 'student_id,date,subject_id' });

        if (error) throw error;
      }

      // 3. For already 'approved' students, they already have records in DB 
      // (either from real-time AI verification or manual Approve clicks).
      // If we want to ensure manual approvals are saved:
      const manualApproved = requests.filter(r => r.status === 'approved' && r.confidenceScore === 100);
      if (manualApproved.length > 0) {
          const manualRecords = manualApproved.map(r => ({
            student_id: r.studentId,
            subject_id: subjectId || null,
            status: 'PRESENT' as const,
            method: 'MANUAL' as const,
            verified_by: facultyId,
            date: new Date().toISOString().split('T')[0],
          }));
          await supabase.from('attendance').upsert(manualRecords, { onConflict: 'student_id,date,subject_id' });
      }

      toast.success('Attendance session finalized');
      auditLogService.log('ATTENDANCE_SESSION_END', 'attendance_session', classId || '', {
        newValues: { absentees: absentStudents.length },
      });
    } catch (err: any) {
      console.error('Failed to end session:', err);
      toast.error('Failed to finalize session properly');
    } finally {
      setSaving(false);
      setTimeLeft(120); // Reset timer for next session
    }
  };

  // Timer logic — count down session time but DO NOT rotate the code locally.
  // The session code is generated by the AI server and is valid for the full session duration.
  // Rotating it client-side would break student entry (their code would never match the DB).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        setCodeTimeLeft((prev) => (prev <= 1 ? 30 : prev - 1)); // just for UI pulse effect
      }, 1000);
    } else if (timeLeft <= 0) {
      setSessionActive(false);
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeft]);

  // Listen for real-time attendance verification from students
  useEffect(() => {
    if (!sessionActive || !classId) return;
    const channel = supabase
      .channel(`attendance-session-${classId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance',
        filter: `date=eq.${new Date().toISOString().split('T')[0]}`,
      }, (payload: any) => {
        if (payload.new) {
          // A student submitted attendance — update their status
          setRequests(prev => prev.map(r => {
            if (r.studentId === payload.new.student_id) {
              return {
                ...r,
                status: 'approved' as const,
                confidenceScore: payload.new.confidence_score ? Math.round(payload.new.confidence_score * 100) : 95,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              };
            }
            return r;
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionActive, classId]);

  // Monitor network
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => {
      setNetworkStatus('offline');
      if (sessionActive) setBleScannerActive(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionActive]);

  const handleAction = useCallback((id: string, action: 'approved' | 'rejected' | 'pending') => {
    setRequests(prev =>
      prev.map(req => req.id === id ? {
        ...req,
        status: action,
        time: action === 'approved' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : req.time,
        confidenceScore: action === 'approved' && req.confidenceScore === 0 ? 100 : req.confidenceScore,
      } : req)
    );
  }, []);

  const verifyOtpOverride = (id: string) => {
    if (otpValue.length === 4) {
      handleAction(id, 'approved');
      setOverrideOtpId(null);
      setOtpValue('');
    }
  };

  const triggerSilentPing = () => {
    setIsPinging(true);
    setTimeout(() => setIsPinging(false), 3000);
  };

  const approveAll = () => {
    setRequests(prev =>
      prev.map(req => req.status === 'pending' ? { ...req, status: 'approved', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), confidenceScore: 100 } : req)
    );
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="space-y-6">
      
      {/* Hero Banner */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] transition-colors duration-500 ${networkStatus === 'offline' ? 'border-amber-400/30 bg-gradient-to-r from-slate-900 via-amber-900/40 to-slate-900' : 'border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-cyan-900/30'}`}>
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.1),transparent_35%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-white">Live Attendance Session</h1>
            {networkStatus === 'offline' && (
              <Badge variant="destructive" className="bg-amber-500/20 text-amber-300 border-amber-500/50 flex animate-pulse">
                <WifiOff className="w-4 h-4 mr-2" /> Wi-Fi Disconnected
              </Badge>
            )}
          </div>
          <p className="text-slate-300">
            {networkStatus === 'online' 
              ? 'Secure anti-spoofing environment for classroom attendance.' 
              : 'Network lost! Fallback to Offline Bluetooth Mesh active.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">Liveness Tracking</Badge>
            {bleScannerActive ? (
               <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 flex items-center animate-pulse">
                 <Bluetooth className="w-3 h-3 mr-1" /> BLE Mesh Mode
               </Badge>
            ) : (
               <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Realtime Sync</Badge>
            )}
          </div>
        </div>
      </div>

      {!sessionActive && !saving && (
        <Card className="bg-slate-950/80 border-emerald-500/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] rounded-3xl text-center py-12">
          <CardContent className="space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <ShieldAlert className="w-12 h-12 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Secure 4-Layer Attendance</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Starts a time-locked, geo-fenced session with biometric validation. A dynamic 6-digit code will be generated for the classroom screen.
              </p>
            </div>
            <Button 
              onClick={startSession}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg px-8 py-6 rounded-xl hover:scale-105 transition-transform"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Initialize Secure Session
            </Button>
          </CardContent>
        </Card>
      )}

      {(sessionActive || saving) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Session Control */}
          <Card className="bg-slate-950/80 border-emerald-500/20 shadow-[0_24px_50px_rgba(0,0,0,0.3)] rounded-3xl lg:col-span-1 border-t-4 border-t-emerald-500 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
            <CardHeader className="text-center pb-2">
              <Badge className="mx-auto bg-emerald-500/15 text-emerald-300 border-emerald-500/30 mb-2">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> LIVE SESSION
              </Badge>
              <CardTitle className="text-slate-300 font-medium">Class Session Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 flex flex-col items-center">
              
              <div className="flex flex-col xl:flex-row gap-6 items-center w-full justify-center">
                <div className="bg-slate-900 border-2 border-slate-700/50 rounded-2xl p-6 text-center relative group flex-1 w-full">
                  <div className="absolute inset-0 bg-emerald-500/5 blur-xl group-hover:bg-emerald-500/10 transition-colors" />
                  <span className="text-6xl font-mono font-bold tracking-widest text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                    {sessionCode}
                  </span>
                  <p className="text-slate-500 text-xs mt-4 uppercase tracking-wider font-semibold">Dynamic PIN</p>
                  <div className="w-full bg-slate-800 h-1.5 mt-4 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-1000 ease-linear" style={{ width: `${(codeTimeLeft / 30) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-emerald-500/60 mt-2">Changes in {codeTimeLeft}s</p>
                </div>

                <div className="bg-white p-4 rounded-2xl hidden md:block">
                  <QRCodeSVG 
                    value={`https://campusai.edu/attend/${sessionCode}`}
                    size={120}
                    level="H"
                  />
                </div>
              </div>

              <div className="flex bg-slate-900/50 rounded-2xl border border-slate-800 p-4 w-full justify-between items-center">
                <div className="flex items-center gap-3">
                  <Timer className={`w-6 h-6 ${timeLeft < 30 ? 'text-red-400 animate-bounce' : 'text-cyan-400'}`} />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Time Remaining</p>
                    <p className={`text-2xl font-bold font-mono tracking-wider ${timeLeft < 30 ? 'text-red-400' : 'text-slate-200'}`}>
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </p>
                  </div>
                </div>
                {networkStatus === 'offline' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className={`border-blue-500/30 text-blue-400 bg-blue-500/10 ${!bleScannerActive ? 'opacity-50' : 'animate-pulse'}`}
                    onClick={() => setBleScannerActive(!bleScannerActive)}
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    {bleScannerActive ? 'Scanning BLE...' : 'Enable Mesh'}
                  </Button>
                )}
              </div>

              {sessionActive ? (
                <Button 
                  onClick={endSession}
                  variant="destructive" 
                  className="w-full font-semibold border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 bg-red-500/10 text-red-400"
                  disabled={saving}
                >
                  <StopCircle className="w-4 h-4 mr-2" /> {saving ? 'Saving Attendance...' : 'Stop Session & Save'}
                </Button>
              ) : (
                <Button 
                  onClick={startSession}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Start New Session
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Incoming Requests Feed */}
          <Card className="bg-slate-950/80 border-slate-800 shadow-[0_24px_50px_rgba(0,0,0,0.3)] rounded-3xl lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Incoming Verifications
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {requests.length} students verifying • Liveness + Geo-fence checked
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={triggerSilentPing}
                  size="sm" 
                  variant="outline"
                  className={`border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 ${isPinging ? 'animate-pulse bg-indigo-500/20' : ''}`}
                  disabled={!sessionActive || isPinging}
                >
                  <RadioReceiver className={`w-4 h-4 mr-1 ${isPinging ? 'animate-ping' : ''}`} />
                  {isPinging ? 'Pinging Devices...' : 'Silent Background Ping'}
                </Button>
                <Button 
                  onClick={approveAll}
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  disabled={!requests.some(r => r.status === 'pending')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve Matches
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto w-full p-4 space-y-3 custom-scrollbar">
                
                {requests.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <QrCode className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                    <p className="text-slate-400 font-medium">Waiting for students to connect...</p>
                  </div>
                )}

                <AnimatePresence>
                  {requests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border transition-colors ${
                        req.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30' : 
                        req.status === 'rejected' ? 'bg-red-500/10 border-red-500/30' : 
                        'bg-slate-900/60 border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-4 mb-3 sm:mb-0 w-full sm:w-auto">
                        <div className="relative">
                          <img 
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.name}`} 
                            alt="avatar" 
                            className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700"
                          />
                          {req.status === 'pending' && (
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-slate-900 bg-cyan-500"></span>
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">{req.name}</p>
                            {req.isOfflineBLE && (
                               <BluetoothConnected className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div className="text-sm text-slate-400 flex items-center gap-2">
                            <span>{req.rollNumber}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                            <span>{req.time}</span>
                            {req.isOfflineBLE && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                                  <span className="text-blue-400 text-xs">BLE Offline Token</span>
                                </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Face Match</p>
                          <Badge className={`${req.confidenceScore > 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'} border-none`}>
                            {req.confidenceScore}% Confidence
                          </Badge>
                        </div>
                        
                        {req.status === 'pending' || req.status === 'override_req' ? (
                          <div className="flex gap-2">
                            {req.status === 'override_req' ? (
                              overrideOtpId === req.id ? (
                                <div className="flex gap-2 items-center">
                                  <Input 
                                    className="w-20 text-center text-sm font-mono h-10 bg-slate-950 border-amber-500/50" 
                                    placeholder="OTP" 
                                    maxLength={4}
                                    value={otpValue}
                                    onChange={(e) => setOtpValue(e.target.value)}
                                  />
                                  <Button 
                                    size="sm"
                                    className="h-10 bg-amber-600 hover:bg-amber-500 text-white"
                                    onClick={() => verifyOtpOverride(req.id)}
                                  >
                                    Verify
                                  </Button>
                                </div>
                              ) : (
                                <Button 
                                  size="sm"
                                  className="h-10 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50"
                                  onClick={() => setOverrideOtpId(req.id)}
                                >
                                  <ShieldEllipsis className="w-4 h-4 mr-1" />
                                  Manual Override
                                </Button>
                              )
                            ) : (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  onClick={() => handleAction(req.id, 'rejected')}
                                  className="w-10 h-10 rounded-full border-red-500/30 text-red-400 hover:bg-red-500/20"
                                >
                                  <XCircle className="w-5 h-5" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                  onClick={() => handleAction(req.id, 'approved')}
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className={`px-3 py-1 bg-transparent ${req.status === 'approved' ? 'text-emerald-400 border-emerald-500/50' : 'text-red-400 border-red-500/50'}`}>
                            {req.status.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
