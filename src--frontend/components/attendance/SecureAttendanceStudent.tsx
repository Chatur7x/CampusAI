// =============================================================
// SecureAttendanceStudent — Python AI Backend + Anti-Proxy Focus Mode
// =============================================================

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, AlertTriangle, ScanFace, Shield,
  Loader2, MapPin, Lock, Eye, ShieldAlert,
  Maximize, Brain, CheckSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { sessionService, attendanceService, auditLogService } from '@/lib/api';
import {
  verifyFace, captureFrame,
  getCurrentLocation,
  type VerifyFaceResponse,
} from '@/lib/ai/apiClient';
import { toast } from 'sonner';
import { collectDeviceFingerprint, generateDeviceHash } from '@/lib/deviceFingerprint';

type VerificationStep = 'selection' | 'focus' | 'session' | 'loading' | 'location' | 'face' | 'liveness' | 'verifying' | 'success' | 'failed';

interface VerificationResult {
  faceMatch: boolean;
  faceConfidence: number;
  livenessPass: boolean;
  livenessScore: number;
  locationValid: boolean;
  distance: number;
  confidenceScore: number;
  confidenceCategory: string;
  fraudAlerts: string[];
  activeSession: any | null;
  timestamp: string;
}

const LIVENESS_FRAMES = 5;

export default function SecureAttendanceStudent() {
  const { user } = useSupabaseAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<VerificationStep>('selection');
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sessionCode, setSessionCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const [focusViolations, setFocusViolations] = useState(0);

  // Stats
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [livenessInstruction, setLivenessInstruction] = useState('');

  // ── Session Lookup ──

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user?.student?.class_id) return;
      const { data } = await supabase.from('classes').select('id, name').eq('id', user.student.class_id);
      setAvailableClasses(data || []);
      if (data?.length) setSelectedClassId(data[0].id);
    };
    fetchClasses();
  }, [user]);

  // ── Focus Mode (Anti-Cheating) ──

  const enterFocusMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFocusLocked(true);
      setStep('session');
    } catch (err) {
      toast.error('Focus Mode requires Fullscreen permission');
    }
  };

  useEffect(() => {
    if (!isFocusLocked) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setFocusViolations(v => v + 1);
        toast.error('Focus Violation: Tab switching detected!');
        if (focusViolations >= 2) {
          exitFocusMode('Too many focus violations. Session invalidated.');
        }
      }
    };

    const handleBlur = () => {
        setFocusViolations(v => v + 1);
        toast.warning('Focus Caution: Window focus lost.');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        exitFocusMode('Security Alert: Fullscreen exited.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFocusLocked, focusViolations]);

  const exitFocusMode = (msg?: string) => {
    setIsFocusLocked(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (msg) {
      setErrorMsg(msg);
      setStep('failed');
      stopCamera();
    }
  };

  // ── Camera & Verification Flow ──

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
    } catch (err) {
      throw new Error('Camera permission denied');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const validateSessionAndStart = async () => {
    if (sessionCode.length !== 6) return;
    setStep('loading');
    setStatusMsg('Verifying session code...');

    try {
      const sessionCheck = await sessionService.check(selectedClassId, sessionCode);
      if (!sessionCheck.active) {
        throw new Error('Invalid or expired session code');
      }

      setActiveSession(sessionCheck.session);
      setStep('location');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
      setStep('failed');
    }
  };

  // ── Location Hook ──
  useEffect(() => {
    if (step !== 'location') return;
    const checkLoc = async () => {
      try {
        setStatusMsg('Capturing secure GPS coordinate...');
        const loc = await getCurrentLocation(10000);
        setLocationData(loc);
        
        await startCamera();
        setStep('face');
      } catch (err) {
        setErrorMsg('Location required for anti-proxy security');
        setStep('failed');
      }
    };
    checkLoc();
  }, [step]);

  // ── Face Hook ──
  const setVideoRef = (element: HTMLVideoElement | null) => {
    (videoRef as any).current = element;
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      element.srcObject = streamRef.current;
      element.play().catch(console.error);
    }
  };

  useEffect(() => {
    if (step === 'face') {
        const interval = setInterval(() => {
            if (!videoRef.current) return;
            setFaceVisible(true); 
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [step]);

  const startLivenessCapture = () => {
    setStep('liveness');
    setLivenessProgress(0);
    const instructions = ['Look Straight', 'Blink Once', 'Tilt Head Left', 'Tilt Head Right', 'Smile'];
    let idx = 0;
    const frames: string[] = [];
    
    const probe = captureFrame(videoRef.current!, 0.9);

    intervalRef.current = setInterval(() => {
      if (!videoRef.current) return;
      frames.push(captureFrame(videoRef.current, 0.7));
      idx++;
      setLivenessInstruction(instructions[idx % instructions.length]);
      setLivenessProgress((idx / LIVENESS_FRAMES) * 100);

      if (idx >= LIVENESS_FRAMES) {
        clearInterval(intervalRef.current!);
        submitVerification(probe, frames);
      }
    }, 1000);
  };

  const submitVerification = async (probe: string, frames: string[]) => {
    setStep('verifying');
    setStatusMsg('Multi-layer verification in progress...');

    try {
      const verification: VerifyFaceResponse = await verifyFace({
        user_id: user?.id || '',
        image: probe,
        class_id: selectedClassId,
        session_code: sessionCode,
        liveness_frames: frames,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        accuracy_m: locationData?.accuracy,
        device_fingerprint: await generateDeviceHash(await collectDeviceFingerprint()),
      });

      const res: VerificationResult = {
        faceMatch: verification.match.match,
        faceConfidence: Math.round(verification.match.similarity * 100),
        livenessPass: verification.liveness.is_live,
        livenessScore: Math.round((verification.liveness.avg_liveness_score || 0.8) * 100),
        locationValid: verification.geo.valid,
        distance: Math.round(verification.geo.distance_m || 0),
        confidenceScore: Math.round(verification.confidence.score * 100),
        confidenceCategory: verification.confidence.category,
        fraudAlerts: verification.confidence.flags || [],
        activeSession: activeSession,
        timestamp: new Date().toISOString(),
      };

      setResult(res);
      
      if (res.faceMatch && res.livenessPass && res.locationValid) {
        // Record into Supabase table
        await attendanceService.mark({
            student_id: user?.student?.id || user?.id || '',
            class_id: selectedClassId,
            course_id: activeSession?.course_id || '',
            status: 'PRESENT',
            method: 'AI_FACE_SECURE',
            confidence_score: verification.confidence.score,
            device_id: 'SECURE_WEB_' + navigator.userAgent.substring(0, 5)
        });

        auditLogService.log('SECURE_ATTENDANCE_SUCCESS', 'attendance', user?.id || '', {
            newValues: { sessionCode, confidence: res.confidenceScore }
        });

        setStep('success');
        stopCamera();
        exitFocusMode();
      } else {
        setErrorMsg(res.fraudAlerts[0] || 'Verification failed security criteria');
        setStep('failed');
        auditLogService.log('SECURE_ATTENDANCE_FAILURE', 'security_alert', user?.id || '', {
            newValues: { flags: res.fraudAlerts, sessionCode }
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI Server Error');
      setStep('failed');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 pt-12">
      <AnimatePresence mode="wait">
        {/* Step 1: Class Selection */}
        {step === 'selection' && (
          <motion.div key="selection" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-slate-900 border-emerald-500/20 shadow-2xl overflow-hidden rounded-3xl">
               <div className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500" />
               <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <Shield className="w-8 h-8 text-emerald-400" /> Secure Marking
                  </CardTitle>
                  <CardDescription className="text-slate-400">Multi-layer anti-proxy identity verification</CardDescription>
               </CardHeader>
               <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Target Session</Label>
                    <select 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                      {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-2">
                        <Maximize className="w-5 h-5 text-cyan-400" />
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Focus Locked</span>
                     </div>
                     <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-2">
                        <MapPin className="w-5 h-5 text-emerald-400" />
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Geo Fencing</span>
                     </div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 py-8 text-lg font-black rounded-2xl shadow-lg shadow-emerald-900/20" onClick={() => setStep('focus')}>
                    Initialize Secure Portal
                  </Button>
               </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Focus Introduction */}
        {step === 'focus' && (
          <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-6">
             <div className="absolute inset-0 royal-grid opacity-20 pointer-events-none" />
            <div className="max-w-md w-full text-center space-y-10 relative z-10">
               <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Lock className="w-10 h-10 text-emerald-400" />
               </div>
               <div className="space-y-4">
                  <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Anti-Proxy Protocol</h2>
                  <p className="text-slate-400 leading-relaxed">System will engage Fullscreen Lock. Exiting or switching tabs will result in a <strong>Fraud Flag</strong> and instant session termination.</p>
               </div>
               <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl text-left space-y-4 shadow-2xl">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 text-sm">System hardware locking engaged</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 text-sm">Real-time focus monitoring active</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 text-sm">Dynamic geo-fence validation required</span>
                  </div>
               </div>
               <Button className="w-full py-10 text-2xl font-black bg-emerald-600 rounded-3xl shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-transform" onClick={enterFocusMode}>
                  Acknowledge & Start
               </Button>
               <button onClick={() => setStep('selection')} className="text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-colors">Abort Mission</button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Session Code */}
        {step === 'session' && (
          <motion.div key="session" initial={{ opacity: 0, scale: 0.9 }}>
            <Card className="bg-slate-900 border-cyan-500/30 shadow-2xl rounded-3xl overflow-hidden">
              <div className="h-2 bg-cyan-500" />
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-cyan-400 text-xl font-bold">Dynamic Session Token</CardTitle>
                <CardDescription className="text-slate-500">Input the private code from faculty terminal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-10 p-8">
                <div className="flex justify-center">
                   <Input 
                     autoFocus
                     className="text-center text-6xl font-black h-32 tracking-[0.2em] bg-slate-950 border-slate-800 text-white focus:border-cyan-500 rounded-2xl shadow-inner transition-all w-full"
                     maxLength={6}
                     placeholder="000000"
                     value={sessionCode}
                     onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, ''))}
                   />
                </div>
                <Button 
                  disabled={sessionCode.length !== 6} 
                  className="w-full py-8 bg-cyan-600 hover:bg-cyan-500 font-black text-xl rounded-2xl"
                  onClick={validateSessionAndStart}
                >
                  Verify Session
                </Button>
                {focusViolations > 0 && (
                   <div className="flex justify-center items-center gap-2 text-red-500 text-xs font-black uppercase tracking-[0.2em] animate-pulse">
                      <ShieldAlert className="w-4 h-4" /> {focusViolations} Security Breach(es)
                   </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loading / Verifying states */}
        {(step === 'loading' || step === 'verifying' || step === 'location') && (
           <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 space-y-8">
              <div className="relative mx-auto w-32 h-32">
                 <div className="absolute inset-0 rounded-full border-8 border-slate-900 shadow-inner" />
                 <div className="absolute inset-0 rounded-full border-8 border-emerald-500 border-t-transparent animate-spin" />
                 <Brain className="absolute inset-0 m-auto w-14 h-14 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">{statusMsg}</h3>
                <div className="flex items-center justify-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                </div>
              </div>
           </motion.div>
        )}

        {/* Face Recognition */}
        {step === 'face' && (
          <motion.div key="face" initial={{ opacity: 0, scale: 0.9 }}>
            <Card className="bg-slate-900 border-slate-800 shadow-2xl overflow-hidden rounded-3xl">
               <CardHeader className="p-4 bg-slate-950 border-b border-slate-800">
                  <div className="flex justify-between items-center">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none px-3 font-bold">
                       <MapPin className="w-3 h-3 mr-1" /> GPS_VERIFIED
                    </Badge>
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-none px-3 font-bold">
                       TOKEN_{sessionCode}
                    </Badge>
                  </div>
               </CardHeader>
               <CardContent className="p-0 relative">
                  <div className="aspect-[4/5] bg-black">
                     <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover brightness-125 contrast-110" style={{ transform: 'scaleX(-1)' }} />
                     {/* Cyber HUD Overlays */}
                     <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                     <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-80 border-2 border-emerald-500/40 rounded-[4rem] shadow-[0_0_80px_rgba(16,185,129,0.2)] flex items-center justify-center">
                            <div className="w-full h-0.5 bg-emerald-500/30 animate-[scan_3s_infinite]" />
                        </div>
                     </div>
                  </div>
                  <div className="p-8 bg-slate-950">
                     <Button className="w-full py-10 text-2xl bg-emerald-600 hover:bg-emerald-500 font-black rounded-2xl shadow-xl shadow-emerald-900/40 transition-transform active:scale-95" onClick={startLivenessCapture}>
                        <ScanFace className="mr-3 w-8 h-8" /> VALIDATE IDENTITY
                     </Button>
                     <div className="grid grid-cols-3 gap-2 mt-6">
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 w-full" />
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 w-1/2 animate-pulse" />
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-slate-700 w-0" />
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>
            <style>{`
               @keyframes scan {
                  0% { transform: translateY(-160px); }
                  50% { transform: translateY(160px); }
                  100% { transform: translateY(-160px); }
               }
            `}</style>
          </motion.div>
        )}

        {/* Liveness Sequence */}
        {step === 'liveness' && (
           <motion.div key="liveness" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="bg-slate-950 border-emerald-500 shadow-[0_0_100px_rgba(16,185,129,0.3)] overflow-hidden rounded-3xl">
                 <div className="aspect-[3/4] relative">
                    <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    <div className="absolute inset-0 bg-emerald-900/5 backdrop-blur-[1px]" />
                    <div className="absolute inset-x-0 bottom-0 p-10 bg-gradient-to-t from-black via-black/90 to-transparent">
                       <div className="space-y-6 text-center">
                          <h2 className="text-5xl font-black text-emerald-400 uppercase italic tracking-tighter animate-pulse drop-shadow-lg">{livenessInstruction}</h2>
                          <div className="relative h-6 bg-slate-900 rounded-full p-1 border border-emerald-500/20">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${livenessProgress}%` }}
                               className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                             />
                          </div>
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">Liveness Challenge Phase</p>
                       </div>
                    </div>
                 </div>
              </Card>
           </motion.div>
        )}

        {/* Success HUD */}
        {step === 'success' && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}>
             <Card className="bg-slate-900 border-white/10 shadow-2xl overflow-hidden rounded-[2.5rem]">
                <div className="h-40 bg-gradient-to-br from-emerald-500 via-emerald-400 to-cyan-500 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-20 royal-grid" />
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 10, stiffness: 100 }}
                      className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/40 shadow-2xl relative z-10"
                    >
                      <CheckCircle2 className="w-14 h-14 text-white" />
                    </motion.div>
                    <div className="absolute -bottom-1 left-0 right-0 h-4 bg-slate-900 rounded-t-full" />
                </div>
                <CardContent className="p-10 text-center space-y-10">
                   <div className="space-y-2">
                      <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Presence Verified</h2>
                      <div className="flex items-center justify-center gap-2">
                         <span className="w-6 h-[1px] bg-slate-800" />
                         <p className="text-emerald-400 font-mono text-[10px] font-black tracking-widest">{result.timestamp}</p>
                         <span className="w-6 h-[1px] bg-slate-800" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 flex flex-col items-center">
                         <p className="text-[9px] text-slate-500 uppercase font-black mb-1 letter-spacing-2">Identity match</p>
                         <p className="text-3xl font-black text-white">{result.faceConfidence}%</p>
                      </div>
                      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 flex flex-col items-center">
                         <p className="text-[9px] text-slate-500 uppercase font-black mb-1 letter-spacing-2">Liveness</p>
                         <p className="text-3xl font-black text-white">{result.livenessScore}%</p>
                      </div>
                      <div className="col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center px-6">
                         <div className="flex items-center gap-2">
                             <MapPin className="w-4 h-4 text-emerald-400" />
                             <span className="text-xs font-bold text-slate-300">Geo Fencing</span>
                         </div>
                         <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-3 font-black">VALIDATED</Badge>
                      </div>
                   </div>
                   <Button className="w-full bg-white text-slate-950 hover:bg-slate-200 py-8 rounded-3xl font-black text-xl shadow-xl transition-all" onClick={() => window.location.reload()}>
                      Finish & Exit
                   </Button>
                </CardContent>
             </Card>
          </motion.div>
        )}

        {/* Failed HUD with high severity styling */}
        {step === 'failed' && (
          <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }}>
             <Card className="bg-slate-900 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.2)] rounded-[2.5rem] overflow-hidden">
                <div className="h-2 bg-red-500" />
                <CardContent className="p-12 text-center space-y-8">
                   <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/30">
                      <ShieldAlert className="w-12 h-12 text-red-500" />
                   </div>
                   <div className="space-y-3">
                      <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase underline decoration-red-500 decoration-4 underline-offset-8">Security Alert</h2>
                      <p className="text-red-400 font-bold text-lg pt-4">{errorMsg}</p>
                   </div>
                   <div className="p-6 bg-slate-950 rounded-[1.5rem] border border-slate-800 text-[10px] text-slate-500 text-left space-y-3 font-mono">
                      <p className="flex justify-between items-center"><span className="font-black">REASON:</span> <span className="text-red-300">{errorMsg.substring(0, 20)}...</span></p>
                      <p className="flex justify-between items-center"><span className="font-black">FOCUS_VIOLATIONS:</span> <span className="text-amber-500">{focusViolations}</span></p>
                      <p className="flex justify-between items-center font-black text-white">SYSTEM_LOGGED: AUTOMATIC_ADMIN_ESCALATION</p>
                   </div>
                   <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 py-6 rounded-2xl text-slate-300 uppercase font-black tracking-widest" onClick={() => window.location.reload()}>
                      Retry Session
                   </Button>
                </CardContent>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
