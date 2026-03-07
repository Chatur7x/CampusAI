// =============================================================
// FaceRegistration — Python AI Backend Version
// Multi-angle photo capture → server-side face embedding + liveness
// =============================================================
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Camera, CheckCircle2, AlertTriangle, RotateCcw,
  ScanFace, Shield, Loader2, ChevronRight, Eye,
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

const REQUIRED_PHOTOS = 3;
const PHOTO_ANGLES = ['Look straight ahead', 'Turn slightly left', 'Turn slightly right'];
const LIVENESS_FRAMES = 5;

// ── Component ──

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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => () => stopCamera(), []);

  // Simple face-visibility heuristic (brightness in center region)
  const startVisibilityCheck = () => {
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
      setFaceVisible(avg > 40 && avg < 230);
    }, 500);
  };

  // ── Flow ──

  const initFlow = async () => {
    setStep('loading');
    setStatusMsg('Starting camera...');
    try {
      await startCamera();
      setStep('capture');
      setStatusMsg(PHOTO_ANGLES[0]);
      startVisibilityCheck();
    } catch (err) {
      setErrorMsg(`Camera error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('error');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const imageData = captureFrame(videoRef.current, 0.85);
    const quality = Math.min(100, Math.round(imageData.length / 5000));
    const photo: CapturedPhoto = { imageData, quality, angle: PHOTO_ANGLES[currentAngle] };
    const newPhotos = [...photos, photo];
    setPhotos(newPhotos);

    if (newPhotos.length >= REQUIRED_PHOTOS) {
      setStatusMsg('Photos captured! Starting liveness verification...');
      setStep('liveness');
      startLivenessCapture(newPhotos);
    } else {
      setCurrentAngle(currentAngle + 1);
      setStatusMsg(PHOTO_ANGLES[currentAngle + 1]);
    }
  };

  // ── Liveness ──

  const startLivenessCapture = (capturedPhotos: CapturedPhoto[]) => {
    const instructions = ['Keep looking at the camera', 'Blink naturally', 'Turn head slightly left', 'Turn head slightly right', 'Look straight ahead'];
    let idx = 0;
    const frames: string[] = [];
    setLivenessInstruction(instructions[0]);
    setLivenessProgress(0);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      frames.push(captureFrame(videoRef.current, 0.7));
      idx++;
      setLivenessInstruction(instructions[Math.min(idx, instructions.length - 1)]);
      setLivenessProgress(Math.round((idx / LIVENESS_FRAMES) * 100));
      if (idx >= LIVENESS_FRAMES) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        completeRegistration(capturedPhotos, frames);
      }
    }, 800);
  };

  // ── Complete ──

  const completeRegistration = async (capturedPhotos: CapturedPhoto[], frames: string[]) => {
    setStep('processing');
    setStatusMsg('Verifying liveness...');
    try {
      const liveness = await checkLiveness(frames);
      if (!liveness.is_live) {
        const s = ((liveness.liveness_score || liveness.avg_liveness_score || 0) * 100).toFixed(0);
        setErrorMsg(`Liveness check failed (score: ${s}%). Please try again.`);
        setStep('error');
        return;
      }

      setStatusMsg('Computing face embedding on server...');
      const reg = await registerFace(user?.id || '', capturedPhotos.map(p => p.imageData));
      if (!reg.success) {
        setErrorMsg('Face registration failed. Ensure good lighting and try again.');
        setStep('error');
        return;
      }

      stopCamera();
      setStep('success');
    } catch (err) {
      setErrorMsg(`Registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('error');
    }
  };

  const reset = () => {
    stopCamera();
    setPhotos([]); setCurrentAngle(0); setFaceVisible(false);
    setErrorMsg(''); setStatusMsg(''); setLivenessProgress(0);
    setStep('intro');
  };

  // ── Render ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl"><ScanFace className="h-8 w-8 text-primary" /></div>
                  <div>
                    <CardTitle className="text-xl">Face Registration</CardTitle>
                    <CardDescription>Secure biometric enrollment for attendance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2"><Shield className="h-4 w-4 text-green-500" />How it works</h4>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-6 list-decimal">
                    <li>We'll capture <strong>3 photos</strong> from different angles</li>
                    <li>A <strong>server-side liveness check</strong> verifies you're real</li>
                    <li>Your face embedding is computed using <strong>DeepFace ArcFace</strong></li>
                    <li>Future attendance uses AI face matching — fast &amp; secure</li>
                  </ol>
                </div>
                <div className="bg-violet-500/10 rounded-lg p-3 flex gap-2">
                  <Eye className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-violet-700 dark:text-violet-400">Powered by Python AI — DeepFace (ArcFace), Mediapipe, OpenCV</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">Ensure good lighting, remove glasses if possible, and keep your face centered.</p>
                </div>
                <Button onClick={initFlow} className="w-full" size="lg"><Camera className="mr-2 h-5 w-5" />Start Face Registration<ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card><CardContent className="py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-lg font-medium">{statusMsg}</p>
            </CardContent></Card>
          </motion.div>
        )}

        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Photo {photos.length + 1} of {REQUIRED_PHOTOS}</CardTitle>
                  <Badge variant={faceVisible ? 'default' : 'destructive'}>{faceVisible ? 'Ready' : 'Position Face'}</Badge>
                </div>
                <Progress value={(photos.length / REQUIRED_PHOTOS) * 100} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-48 h-64 border-2 rounded-[50%] transition-colors ${faceVisible ? 'border-green-500' : 'border-white/50'}`} />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-3">
                    <p className="text-white text-center text-sm font-medium">{PHOTO_ANGLES[currentAngle]}</p>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-green-500">
                        <img src={p.imageData} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5">{p.angle}</div>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={capturePhoto} disabled={!faceVisible} className="w-full" size="lg"><Camera className="mr-2 h-5 w-5" />Capture Photo</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'liveness' && (
          <motion.div key="liveness" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" />Liveness Verification</CardTitle>
                  <Badge>Capturing...</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <p className="text-lg font-semibold text-primary">{livenessInstruction}</p>
                  </div>
                  <Progress value={livenessProgress} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center">Capturing liveness frames for server analysis...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-lg font-medium">{statusMsg}</p>
              <p className="text-sm text-muted-foreground">Processing with DeepFace ArcFace + Mediapipe...</p>
              <div className="flex gap-2 justify-center">{photos.map((_, i) => <div key={i} className="w-3 h-3 rounded-full bg-green-500" />)}</div>
            </CardContent></Card>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-green-500">
              <CardContent className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="h-10 w-10 text-green-500" /></div>
                <h3 className="text-xl font-bold">Face Registered!</h3>
                <p className="text-muted-foreground">Your face has been securely enrolled using ArcFace AI. You can now use face recognition for attendance.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Badge variant="outline" className="text-green-600">{photos.length} Photos</Badge>
                  <Badge variant="outline" className="text-green-600">Liveness Verified</Badge>
                  <Badge variant="outline" className="text-green-600">ArcFace Embedding</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-red-500">
              <CardContent className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="h-10 w-10 text-red-500" /></div>
                <h3 className="text-xl font-bold text-red-600">Registration Failed</h3>
                <p className="text-muted-foreground">{errorMsg}</p>
                <Button onClick={reset} variant="outline"><RotateCcw className="mr-2 h-4 w-4" />Try Again</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
