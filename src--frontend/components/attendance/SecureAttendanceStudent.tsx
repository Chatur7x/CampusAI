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
    Maximize, Brain, CheckSquare, Clock3,
    QrCode as QrIcon,
  } from 'lucide-react';
import QRScanner from './QRScanner';
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
  const [showScanner, setShowScanner] = useState(false);

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

  const handleQRScan = (decodedText: string) => {
    // Extract code from URL if needed: https://campusai.edu/attend/123456
    let code = decodedText;
    if (decodedText.includes('/attend/')) {
      code = decodedText.split('/attend/').pop() || '';
    }
    
    if (code.length === 6 && /^\d+$/.test(code)) {
      setSessionCode(code);
      setShowScanner(false);
      // Auto-trigger validation
      setStep('loading');
      setStatusMsg('Verifying scanned code...');
      
      sessionService.check(selectedClassId, code)
        .then(sessionCheck => {
          if (!sessionCheck.active) throw new Error('Invalid or expired session code');
          setActiveSession(sessionCheck.session);
          setStep('location');
        })
        .catch(err => {
          setErrorMsg(err.message || 'Verification failed');
          setStep('failed');
        });
    } else {
      toast.error('Invalid QR Code detected');
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
    <div className="max-w-xl mx-auto p-4 pt-12 relative min-h-screen">
      {/* HUD Scanning Line Effect */}
      {(step === 'face' || step === 'liveness') && <div className="scanning-line" />}

      <AnimatePresence mode="wait">
        {/* Step 1: Class Selection */}
        {step === 'selection' && (
          <motion.div key="selection" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
            <div className="glass-premium hud-border overflow-hidden rounded-[2.5rem] relative">
               <div className="h-2 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 animate-shimmer" />
               <CardHeader className="p-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                      <Shield className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-fluid-md font-black italic tracking-tighter uppercase text-white">Identity Portal</CardTitle>
                      <CardDescription className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em]">Biometric Verification v4.0</CardDescription>
                    </div>
                  </div>
               </CardHeader>
               <CardContent className="space-y-8 p-8 pt-0">
                  <div className="space-y-3">
                    <Label className="text-slate-500 uppercase text-[10px] font-black tracking-[0.3em] ml-1">Classroom Link</Label>
                    <div className="relative group">
                      <select 
                        className="w-full glass-premium border-white/10 rounded-2xl p-5 text-white font-black tracking-tight focus:border-emerald-500 outline-none appearance-none transition-all cursor-pointer group-hover:bg-white/[0.05]"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                      >
                        {availableClasses.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="glass-premium p-5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 group hover:border-cyan-500/30 transition-all">
                        <Maximize className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Focus Locked</span>
                     </div>
                     <div className="glass-premium p-5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 group hover:border-emerald-500/30 transition-all">
                        <MapPin className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Geo Fencing</span>
                     </div>
                  </div>

                  <Button 
                    className="w-full glass-premium bg-emerald-600 hover:bg-emerald-500 py-10 text-fluid-sm font-black rounded-3xl shadow-[0_15px_40px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em]" 
                    onClick={() => setStep('focus')}
                  >
                    Engage Secure Portal
                  </Button>
               </CardContent>
            </div>
          </motion.div>
        )}

        {/* Step 2: Focus Introduction */}
        {step === 'focus' && (
          <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-8">
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
            <div className="max-w-md w-full text-center space-y-12 relative z-10">
               <motion.div 
                 animate={{ scale: [1, 1.1, 1] }} 
                 transition={{ repeat: Infinity, duration: 3 }}
                 className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]"
               >
                  <Lock className="w-12 h-12 text-emerald-400" />
               </motion.div>
               <div className="space-y-4">
                  <h2 className="text-fluid-lg font-black text-white italic tracking-tighter uppercase underline decoration-emerald-500 decoration-8 underline-offset-8">Focus Protocol</h2>
                  <p className="text-slate-400 font-medium leading-relaxed pt-2">System will engage Hardware Lock. Exiting or switching tabs will trigger a <strong className="text-red-400 uppercase">Fraud Alert</strong> and instant termination.</p>
               </div>
               <div className="glass-premium hud-border p-8 rounded-[2rem] text-left space-y-5 shadow-2xl backdrop-blur-3xl">
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 font-bold text-sm tracking-tight">OS-Level Hardware Lock Engaged</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 font-bold text-sm tracking-tight">Real-time Iris & Focus Monitor Active</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 font-bold text-sm tracking-tight">Dynamic Geo-Fence Handshake Required</span>
                  </div>
               </div>
               <Button className="w-full py-12 text-fluid-sm font-black bg-emerald-600 rounded-[2rem] shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-all uppercase tracking-[0.3em]" onClick={enterFocusMode}>
                  Acknowledge & Sync
               </Button>
               <button onClick={() => setStep('selection')} className="text-slate-600 font-black uppercase tracking-[0.4em] text-[10px] hover:text-white transition-colors">Abort System Initialisation</button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Session Code */}
        {step === 'session' && (
          <motion.div key="session" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
            <div className="glass-premium hud-border shadow-2xl rounded-[3rem] overflow-hidden relative p-10">
              <div className="absolute top-0 right-0 p-6 flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                 <div className="w-2 h-2 rounded-full bg-cyan-500/40" />
                 <div className="w-2 h-2 rounded-full bg-cyan-500/20" />
              </div>
              <CardHeader className="text-center pt-8 space-y-2">
                <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em]">Protocol Alpha</p>
                <CardTitle className="text-white text-3xl font-black italic tracking-tighter uppercase">Broadcast Token</CardTitle>
                <CardDescription className="text-slate-500 font-medium">Input the dynamic 6-digit key from command terminal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-12 mt-8">
                <div className="relative group">
                   <Input 
                     autoFocus
                     className="text-center text-6xl md:text-7xl font-black h-36 tracking-[0.2em] glass-premium bg-white/[0.02] border-white/10 text-white focus:border-cyan-500 rounded-3xl shadow-inner transition-all w-full leading-none p-0 flex items-center justify-center"
                     maxLength={6}
                     placeholder="000000"
                     value={sessionCode}
                     onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, ''))}
                   />
                   <div className="absolute inset-0 pointer-events-none border-2 border-white/5 rounded-3xl group-focus-within:border-cyan-500/40 transition-all scale-[1.05] group-focus-within:scale-100 opacity-0 group-focus-within:opacity-100" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    className="py-10 bg-slate-900 hover:bg-slate-800 text-cyan-400 font-black rounded-2xl border border-cyan-500/20 shadow-xl transition-all uppercase tracking-[0.2em]"
                    onClick={() => setShowScanner(true)}
                  >
                    <QrIcon className="mr-2 w-6 h-6" /> Scan QR
                  </Button>
                  <Button 
                    disabled={sessionCode.length !== 6} 
                    className="py-10 bg-cyan-600 hover:bg-cyan-500 font-black rounded-2xl shadow-xl shadow-cyan-900/30 transition-all uppercase tracking-[0.2em]"
                    onClick={validateSessionAndStart}
                  >
                    Manual Confirm
                  </Button>
                </div>

                {showScanner && (
                  <QRScanner 
                    onScanSuccess={handleQRScan} 
                    onClose={() => setShowScanner(false)} 
                  />
                )}
                {focusViolations > 0 && (
                   <div className="flex justify-center items-center gap-2 text-red-500 text-xs font-black uppercase tracking-[0.3em] bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-pulse">
                      <ShieldAlert className="w-5 h-5" /> {focusViolations} Security Breaches Logged
                   </div>
                )}
              </CardContent>
            </div>
          </motion.div>
        )}

        {/* Processing States */}
        {(step === 'loading' || step === 'verifying' || step === 'location') && (
           <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-32 space-y-12 relative z-10">
              <div className="relative mx-auto w-40 h-40 flex items-center justify-center">
                 <div className="absolute inset-0 rounded-full border-[12px] border-white/5" />
                 <div className="absolute inset-0 rounded-full border-[12px] border-emerald-500 border-t-transparent animate-spin" />
                 <div className="absolute inset-0 rounded-full border-[1px] border-emerald-500/20 scale-[1.2] animate-pulse-emerald" />
                 <Brain className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] animate-pulse">Neural Handshake In Progress</p>
                <h3 className="text-4xl font-black text-white tracking-tighter uppercase italic">{statusMsg}</h3>
                <div className="flex items-center justify-center gap-3 pt-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                </div>
              </div>
           </motion.div>
        )}

        {/* Face Recognition */}
        {step === 'face' && (
          <motion.div key="face" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass-premium hud-border shadow-2xl overflow-hidden rounded-[3rem] p-4 relative">
               <CardHeader className="p-4 pt-2 bg-transparent flex flex-row justify-between items-center mb-2">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 font-black text-[9px] tracking-widest uppercase">
                       <MapPin className="w-3 h-3 mr-2" /> GPS_LOCKED
                    </Badge>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-4 py-1.5 font-black text-[9px] tracking-widest uppercase">
                       SESSION_{sessionCode}
                    </Badge>
               </CardHeader>
               
               <div className="aspect-[3/4] bg-slate-950 rounded-[2rem] overflow-hidden relative group">
                  <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-110 group-hover:grayscale-0 transition-all duration-700" style={{ transform: 'scaleX(-1)' }} />
                  
                  {/* HUD Elements */}
                  <div className="absolute inset-0 pointer-events-none">
                     <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-emerald-500 shadow-[-5px_-5px_15px_rgba(16,185,129,0.3)]" />
                     <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-emerald-500 shadow-[5px_-5px_15px_rgba(16,185,129,0.3)]" />
                     <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-emerald-500 shadow-[-5px_5px_15px_rgba(16,185,129,0.3)]" />
                     <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-emerald-500 shadow-[5px_5px_15px_rgba(16,185,129,0.3)]" />
                     
                     <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 border-y border-emerald-500/20 h-96 flex items-center justify-center">
                        <div className="w-full h-[2px] bg-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-[hud-scan_4s_infinite]" />
                     </div>
                  </div>
                  
                  <div className="absolute inset-x-0 bottom-0 p-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent">
                     <Button 
                       className="w-full py-12 text-2xl bg-emerald-600 hover:bg-emerald-500 font-black rounded-[2rem] shadow-[0_20px_40px_rgba(16,185,129,0.4)] active:scale-95 transition-all uppercase tracking-[0.2em]" 
                       onClick={startLivenessCapture}
                     >
                        <ScanFace className="mr-4 w-10 h-10" /> Initialize Scan
                     </Button>
                     <p className="text-center text-slate-500 text-[9px] font-black uppercase tracking-[0.5em] mt-6">Position face within biometric guide</p>
                  </div>
               </div>
            </div>
            <style>{`
               @keyframes hud-scan {
                  0%, 100% { transform: translateY(-160px); opacity: 0.2; }
                  50% { transform: translateY(160px); opacity: 1; }
               }
            `}</style>
          </motion.div>
        )}

        {/* Liveness Immersive UI */}
        {step === 'liveness' && (
           <motion.div key="liveness" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black">
              <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
              <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" style={{ transform: 'scaleX(-1)' }} />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                 <div className="w-80 h-96 border-4 border-emerald-500/20 rounded-[5rem] relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="absolute inset-0 bg-emerald-500/5 backdrop-blur-[2px]" />
                    <motion.div 
                       initial={{ y: -200 }} 
                       animate={{ y: 0 }} 
                       className="text-fluid-lg font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_20px_rgba(16,185,129,0.8)] mb-4"
                    >
                       {livenessInstruction}
                    </motion.div>
                    <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-4 py-1.5 rounded-full border border-emerald-500/30 uppercase tracking-[0.3em]">
                       Auth Phase {Math.floor(livenessProgress/20)}
                    </div>
                 </div>
                 
                 <div className="w-full max-w-sm mt-12 space-y-4">
                    <div className="h-4 glass-premium bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${livenessProgress}%` }}
                         className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" 
                       />
                    </div>
                    <div className="flex justify-between items-center px-2">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Biometric Integrity</span>
                       <span className="text-fluid-xs font-black text-white">{Math.round(livenessProgress)}%</span>
                    </div>
                 </div>
              </div>
              
              <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-3xl px-8 py-3 rounded-full border border-white/10">
                 <Shield className="w-5 h-5 text-emerald-400" />
                 <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Advanced Anti-Spoofing Engaged</span>
              </div>
           </motion.div>
        )}

        {/* Success HUD */}
        {step === 'success' && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}>
             <div className="glass-premium hud-border shadow-[0_0_100px_rgba(16,185,129,0.2)] overflow-hidden rounded-[3rem] p-1 relative">
                <div className="h-48 bg-gradient-to-br from-emerald-500 via-emerald-400 to-cyan-500 relative flex flex-col items-center justify-center rounded-t-[2.8rem] overflow-hidden">
                    <div className="absolute inset-0 cyber-grid opacity-30" />
                    <motion.div 
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 12, stiffness: 120 }}
                      className="w-28 h-28 bg-white/10 backdrop-blur-2xl rounded-[2rem] flex items-center justify-center border-2 border-white/40 shadow-2xl relative z-10"
                    >
                      <CheckCircle2 className="w-16 h-16 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                    </motion.div>
                    <div className="absolute -bottom-1 left-0 right-0 h-8 bg-slate-900 rounded-t-[2.8rem]" />
                </div>
                
                <CardContent className="p-10 pt-4 text-center space-y-12">
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.5em] animate-pulse">Identity Logged Successfully</p>
                      <h2 className="text-fluid-lg font-black text-white uppercase italic tracking-tighter">Presence Verified</h2>
                      <div className="flex justify-center pt-2">
                         <div className="glass-premium border-white/10 px-6 py-2 rounded-full flex items-center gap-3">
                            <Clock3 className="w-4 h-4 text-slate-500" />
                            <p className="text-white font-mono text-xs font-bold leading-none">{new Date().toLocaleTimeString()}</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="glass-premium p-6 rounded-[2rem] border border-white/10 flex flex-col items-center group transition-all">
                         <p className="text-[9px] text-slate-500 uppercase font-black mb-2 tracking-widest group-hover:text-emerald-400">Iris Match</p>
                         <p className="text-fluid-md font-black text-white">{result.faceConfidence}%</p>
                      </div>
                      <div className="glass-premium p-6 rounded-[2rem] border border-white/10 flex flex-col items-center group transition-all">
                         <p className="text-[9px] text-slate-500 uppercase font-black mb-2 tracking-widest group-hover:text-cyan-400">Vital Score</p>
                         <p className="text-fluid-md font-black text-white">{result.livenessScore}%</p>
                      </div>
                      <div className="col-span-2 glass-premium/50 p-5 rounded-[2rem] border border-white/5 flex justify-between items-center px-10">
                         <div className="flex items-center gap-3">
                             <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                             <span className="text-xs font-black text-white uppercase tracking-widest">Geo-Fence</span>
                         </div>
                         <Badge className="bg-emerald-500/20 text-emerald-400 border-none px-5 py-1.5 font-black uppercase text-[9px] tracking-widest">AUTHENTICATED</Badge>
                      </div>
                   </div>
                   
                   <Button 
                     className="w-full glass-premium bg-white text-slate-950 hover:bg-slate-200 py-10 rounded-[2rem] font-black text-xl shadow-[0_15px_40px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.03] uppercase tracking-[0.2em]" 
                     onClick={() => window.location.reload()}
                   >
                      Terminate Link
                   </Button>
                </CardContent>
             </div>
          </motion.div>
        )}

        {/* Failed HUD */}
        {step === 'failed' && (
          <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }}>
             <div className="glass-premium border-red-500 shadow-[0_0_120px_rgba(239,68,68,0.3)] rounded-[3rem] overflow-hidden relative">
                <div className="h-2 bg-red-500 animate-pulse" />
                <CardContent className="p-12 text-center space-y-10">
                   <motion.div 
                     animate={{ rotate: [-5, 5, -5] }} 
                     transition={{ repeat: Infinity, duration: 0.5 }}
                     className="w-28 h-28 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                   >
                      <ShieldAlert className="w-14 h-14 text-red-500" />
                   </motion.div>
                   <div className="space-y-4">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.6em]">Security Protocol Breach</p>
                      <h2 className="text-fluid-lg font-black text-white italic tracking-tighter uppercase leading-none">Access Denied</h2>
                      <p className="text-red-400/80 font-bold text-lg leading-relaxed px-4">{errorMsg}</p>
                   </div>
                   <div className="p-8 glass-premium bg-slate-950/40 rounded-[2rem] border border-white/5 text-[10px] text-slate-500 text-left space-y-4 font-mono">
                      <p className="flex justify-between items-center"><span className="text-slate-400 font-black">LOG_ID:</span> <span className="text-white">#{Math.random().toString(36).substring(7).toUpperCase()}</span></p>
                      <p className="flex justify-between items-center"><span className="text-slate-400 font-black">FOCUS_VIOLATIONS:</span> <span className="text-amber-500 font-black">{focusViolations}</span></p>
                      <div className="w-full h-[1px] bg-white/5" />
                      <p className="text-center font-black text-red-500/60 tracking-widest uppercase">System Escalate to Administrator</p>
                   </div>
                   <Button 
                     variant="outline" 
                     className="w-full glass-premium border-white/10 hover:bg-white/5 py-8 rounded-[2rem] text-white uppercase font-black tracking-[0.4em] transition-all" 
                     onClick={() => window.location.reload()}
                   >
                      Retry Authenticator
                   </Button>
                </CardContent>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
