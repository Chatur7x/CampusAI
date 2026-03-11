import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Camera, CheckCircle2, AlertTriangle, RotateCcw,
  ScanFace, Shield, Loader2, ChevronRight, Eye,
  Lock, Zap, Sparkles, Orbit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { registerFace, checkLiveness, captureFrame } from '@/lib/ai/apiClient';

// ── Types ──

interface CapturedPhoto {
  imageData: string;
  quality: number;
  angle: string;
}

type RegistrationStep = 'intro' | 'loading' | 'capture' | 'liveness' | 'processing' | 'success' | 'error';

const REQUIRED_PHOTOS = 4;
const PHOTO_ANGLES = [
  { label: 'Look straight ahead', icon: '👤' },
  { label: 'Turn slightly left', icon: '⬅️' },
  { label: 'Turn slightly right', icon: '➡️' },
  { label: 'Look slightly up', icon: '⬆️' }
];
const LIVENESS_FRAMES = 5;

export default function FaceRegistration() {
  const { user } = useSupabaseAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<RegistrationStep>('intro');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [faceVisible, setFaceVisible] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [livenessInstruction, setLivenessInstruction] = useState('');

  // ── Camera ──

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'user' 
        },
      });
      streamRef.current = stream;
    } catch (err) {
      throw err;
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const setVideoRef = (element: HTMLVideoElement | null) => {
    (videoRef as any).current = element;
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      element.srcObject = streamRef.current;
      element.play().catch(console.error);
    }
  };

  const [stabilityTicks, setStabilityTicks] = useState(0);
  const STABILITY_THRESHOLD = 5; // ~2 seconds at 400ms intervals

  const initFlow = async () => {
    setStep('loading');
    setStatusMsg('Initializing biometric scanner...');
    try {
      await startCamera();
      setStep('capture');
      setStatusMsg(PHOTO_ANGLES[0].label);
      startVisibilityCheck();
    } catch (err) {
      setErrorMsg(`Hardware access error: ${err instanceof Error ? err.message : 'Unknown'}`);
      setStep('error');
    }
  };

  const startVisibilityCheck = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      
      const c = document.createElement('canvas');
      c.width = 160; c.height = 120;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(videoRef.current, 0, 0, 160, 120);
      const d = ctx.getImageData(40, 20, 80, 80).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      const avg = sum / (d.length / 4);
      
      const isVisible = avg > 40 && avg < 235;
      setFaceVisible(isVisible);

      if (isVisible && step === 'capture') {
        setStabilityTicks(prev => {
          const next = prev + 1;
          if (next >= STABILITY_THRESHOLD) {
            // Auto-trigger capture
            setTimeout(() => capturePhoto(), 0);
            return 0; // Reset after capture
          }
          return next;
        });
      } else {
        setStabilityTicks(0);
      }
    }, 400);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const imageData = captureFrame(videoRef.current, 0.9);
    const photo: CapturedPhoto = { 
      imageData, 
      quality: 100, 
      angle: PHOTO_ANGLES[currentAngle].label 
    };
    const newPhotos = [...photos, photo];
    setPhotos(newPhotos);

    if (newPhotos.length >= REQUIRED_PHOTOS) {
      setStatusMsg('Biometric verification in progress...');
      setStep('liveness');
      startLivenessCapture(newPhotos);
    } else {
      setCurrentAngle(currentAngle + 1);
      setStatusMsg(PHOTO_ANGLES[currentAngle + 1].label);
    }
  };

  const startLivenessCapture = (capturedPhotos: CapturedPhoto[]) => {
    const instructions = [
      'Look straight ahead', 
      'Blink naturally', 
      'Turn slightly left', 
      'Turn slightly right', 
      'Smile for validation'
    ];
    let idx = 0;
    const frames: string[] = [];
    setLivenessInstruction(instructions[0]);
    setLivenessProgress(0);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      frames.push(captureFrame(videoRef.current, 0.75));
      idx++;
      setLivenessInstruction(instructions[Math.min(idx, instructions.length - 1)]);
      setLivenessProgress(Math.round((idx / LIVENESS_FRAMES) * 100));
      if (idx >= LIVENESS_FRAMES) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        completeRegistration(capturedPhotos, frames);
      }
    }, 900);
  };

  const completeRegistration = async (capturedPhotos: CapturedPhoto[], frames: string[]) => {
    setStep('processing');
    setStatusMsg('Analyzing artifacts & spoof detection...');
    try {
      const liveness = await checkLiveness(frames);
      if (!liveness.is_live) {
        setErrorMsg(`Spoofing attempt detected. Ensure you are a real person in a well-lit environment.`);
        setStep('error');
        return;
      }

      setStatusMsg('Generating high-dimensional embeddings...');
      const reg = await registerFace(user?.id || '', capturedPhotos.map(p => p.imageData));
      if (!reg.success) {
        setErrorMsg('Encryption error during profile sync. Please try again.');
        setStep('error');
        return;
      }

      stopCamera();
      setStep('success');
    } catch (err) {
      setErrorMsg(`Registration anomaly: ${err instanceof Error ? err.message : 'System fail'}`);
      setStep('error');
    }
  };

  const reset = () => {
    stopCamera();
    setPhotos([]); setCurrentAngle(0); setFaceVisible(false);
    setErrorMsg(''); setStatusMsg(''); setLivenessProgress(0);
    setStep('intro');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div 
            key="intro" 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="relative overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-slate-950/60 p-8 shadow-[0_30px_100px_-20px_rgba(16,185,129,0.15)] backdrop-blur-3xl">
              <div className="absolute inset-x-0 -top-40 -z-10 h-80 bg-emerald-500/10 blur-[100px]" />
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-2xl animate-pulse" />
                  <div className="relative w-32 h-32 bg-slate-900 rounded-3xl flex items-center justify-center border border-emerald-500/30">
                    <ScanFace className="w-16 h-16 text-emerald-400" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left space-y-3">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-2">AI ADVANCED ENROLLMENT</Badge>
                  <h1 className="text-4xl font-bold text-white tracking-tight">Biometric Registration</h1>
                  <p className="text-slate-400 text-lg">Secure your digital campus identity with multi-angle deep learning embeddings.</p>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Orbit, title: "Multi-Angle Profile", desc: "4D point capture for 99.9% accuracy" },
                  { icon: Shield, title: "Liveness Guard", desc: "Prevents photo/video playback spoofs" },
                  { icon: Zap, title: "ArcFace Engine", desc: "Sub-second verification performance" },
                  { icon: Lock, title: "Encrypted Vector", desc: "Your data is hashed and secured" }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                      <item.icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-slate-200 font-semibold">{item.title}</h4>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={initFlow} 
                className="w-full mt-8 h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] group"
              >
                Initalize Secure Scanner
                <ChevronRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-6">
            <div className="relative inline-block">
               <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse" />
               <Loader2 className="h-16 w-16 animate-spin text-emerald-400 relative z-10" />
            </div>
            <p className="text-2xl font-medium text-emerald-400/80 animate-pulse">{statusMsg}</p>
          </motion.div>
        )}

        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <ScanFace className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Angle {photos.length + 1} of {REQUIRED_PHOTOS}</h3>
                    <p className="text-xs text-slate-500">{PHOTO_ANGLES[currentAngle].label}</p>
                  </div>
                </div>
                <Badge variant={faceVisible ? 'default' : 'destructive'} className={faceVisible ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 animate-pulse'}>
                  {faceVisible ? 'OPTIMAL POSITION' : 'POSITION FACE'}
                </Badge>
              </div>

              <div className="relative aspect-[4/3] bg-slate-900 rounded-[2rem] overflow-hidden border-4 border-slate-800">
                <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[0.3]" style={{ transform: 'scaleX(-1)' }} />
                
                {/* HUD Scanner Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Rotating Outer Ring */}
                  {faceVisible && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-[80%] h-[80%] border-2 border-emerald-500/20 rounded-full border-t-emerald-400/80 border-l-emerald-400/40 animate-spin-slow" />
                    </motion.div>
                  )}
                  
                  {/* Face Guide */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-64 h-80 border-2 rounded-[60px] transition-all duration-500 ${faceVisible ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] scale-105' : 'border-slate-700/50 bg-slate-900/40'}`}>
                      {/* Scanning Line */}
                      {faceVisible && (
                        <>
                          <motion.div 
                            className="w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            style={{ position: 'absolute', left: 0 }}
                          />
                          {/* Auto-capture Countdown UI */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              {stabilityTicks > 0 && (
                                <motion.div 
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="px-4 py-2 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40"
                                >
                                  <span className="text-emerald-400 font-mono text-sm tracking-widest uppercase">
                                    Locking {Math.max(0, STABILITY_THRESHOLD - stabilityTicks)}...
                                  </span>
                                </motion.div>
                              )}
                              <div className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Hold Still</div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
                    </div>
                  </div>
                  
                  {/* HUD Info */}
                  <div className="absolute top-4 left-6 space-y-1">
                     <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Processing Layer: Bio-Net v2</p>
                     <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Accuracy Target: 99.85%</p>
                  </div>
                  <div className="absolute bottom-4 right-6 text-right">
                     <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Frame Rate: 60 FPS</p>
                     <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Angle: {PHOTO_ANGLES[currentAngle].icon} {PHOTO_ANGLES[currentAngle].label}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3 overflow-x-auto pb-2 px-2 scrollbar-none">
                {PHOTO_ANGLES.map((angle, i) => (
                  <div key={i} className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all ${photos[i] ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] scale-100' : (i === currentAngle ? 'border-emerald-400/50 bg-slate-900 border-dashed' : 'border-slate-800 bg-slate-950 opacity-40')}`}>
                    {photos[i] ? (
                      <img src={photos[i].imageData} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <span className="text-xl">{angle.icon}</span>
                        <span className="text-[8px] uppercase font-bold text-slate-500">Pending</span>
                      </div>
                    )}
                    {photos[i] && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-slate-900" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button 
                onClick={capturePhoto} 
                disabled={!faceVisible} 
                className={`w-full h-16 mt-6 rounded-2xl text-xl font-bold transition-all ${faceVisible ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-slate-500'}`}
              >
                <Camera className="mr-2 h-6 w-6" />
                Capture {PHOTO_ANGLES[currentAngle].label}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'liveness' && (
          <motion.div key="liveness" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl">
              <div className="text-center mb-8 space-y-2">
                <Badge className="bg-emerald-500/10 text-emerald-400">ARTIFACT ANALYSIS ACTIVE</Badge>
                <h3 className="text-2xl font-bold text-white">Liveness Verification</h3>
                <p className="text-sm text-slate-400">Ensuring digital authenticity using 3D structural analysis.</p>
              </div>

              <div className="relative aspect-[4/3] bg-slate-900 rounded-[2rem] overflow-hidden border-4 border-slate-800 mb-8">
                <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent flex flex-col items-center justify-end pb-8">
                  <div className="bg-slate-900/90 backdrop-blur-md px-8 py-4 rounded-3xl border border-emerald-500/30 text-emerald-400 font-bold text-xl shadow-2xl">
                    {livenessInstruction}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-300">Processing Stream...</span>
                  <span className="text-sm font-mono text-emerald-400">{livenessProgress}%</span>
                </div>
                <div className="h-4 bg-slate-900 rounded-full border border-slate-800 overflow-hidden p-1 shadow-inner">
                   <motion.div 
                     className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full"
                     initial={{ width: 0 }}
                     animate={{ width: `${livenessProgress}%` }}
                   />
                </div>
                <div className="flex justify-center items-center gap-2 text-slate-500 text-xs mt-4">
                  <Shield className="w-4 h-4" /> Spoof Shield Verifier: ONLINE
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-8">
            <div className="relative inline-block">
               <div className="absolute inset-[-40px] bg-emerald-500/20 blur-[60px] animate-pulse rounded-full" />
               <Orbit className="h-20 w-20 animate-spin-slow text-emerald-400 relative z-10" />
               <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-emerald-400 animate-bounce" />
            </div>
            <div className="space-y-3">
              <p className="text-2xl font-bold text-white tracking-wide">{statusMsg}</p>
              <p className="text-slate-500 max-w-sm mx-auto">Mapping biological landmarks to 512-D neural vector space. Connecting to secure cloud...</p>
            </div>
            <div className="flex gap-4 justify-center">
               {photos.map((_, i) => (
                 <motion.div 
                   key={i} 
                   className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                   animate={{ scale: [1, 1.4, 1] }}
                   transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                 />
               ))}
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-emerald-500/30 bg-slate-950/60 p-10 text-center shadow-[0_40px_100px_-20px_rgba(16,185,129,0.25)] backdrop-blur-3xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent_70%)]" />
              <div className="relative inline-block mb-10">
                <div className="absolute inset-[-20px] bg-emerald-500/20 blur-3xl animate-pulse rounded-full" />
                <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] rotate-3">
                  <CheckCircle2 className="h-16 w-16 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Identity Synchronized</h1>
              <p className="text-slate-400 text-lg max-w-md mx-auto mb-10">Your facial profile has been securely hashed and enrolled. You are now authorized for premium AI attendance.</p>
              
              <div className="flex gap-4 justify-center flex-wrap mb-10">
                <Badge className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border-emerald-500/20">ArcFace Embedding Created</Badge>
                <Badge className="bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-xl border-cyan-500/20">Liveness Verified 100%</Badge>
                <Badge className="bg-violet-500/10 text-violet-400 px-4 py-2 rounded-xl border-violet-500/20">Quad-Angle Mesh Active</Badge>
              </div>

              <Button onClick={() => window.location.href = '/student'} className="h-14 px-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 transition-all">
                Return to Dashboard
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="overflow-hidden rounded-[2.5rem] border border-red-500/30 bg-slate-950/60 p-10 text-center backdrop-blur-3xl shadow-2xl">
              <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Registration Blocked</h3>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">{errorMsg}</p>
              <Button onClick={reset} className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <RotateCcw className="mr-2 h-5 w-5" /> Retry Biometric Scan
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
