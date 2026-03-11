// =============================================================
// FaceAttendance — Python AI Backend Version
// Session code → location → face verify → liveness → submit
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import {
  verifyFace, checkFraud, validateGeo,
  getCurrentLocation, captureFrame,
  type VerifyFaceResponse,
} from '@/lib/ai/apiClient';

// ── Types ──

type VerificationStep = 'session' | 'loading' | 'location' | 'face' | 'liveness' | 'verifying' | 'success' | 'failed';

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
  timestamp: string;
}

const LIVENESS_FRAMES = 5;

// ── Component ──

export default function FaceAttendance() {
  const { user } = useSupabaseAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<VerificationStep>('session');
  const [sessionCode, setSessionCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Location
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [onCampus, setOnCampus] = useState(false);
  const [campusDistance, setCampusDistance] = useState(0);

  // Face
  const [faceVisible, setFaceVisible] = useState(false);

  // Result
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Liveness capture
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [livenessInstruction, setLivenessInstruction] = useState('');

  // ── Camera ──

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      // We do NOT attach to videoRef here because the `<video>` element
      // is only rendered when step is 'face' or 'liveness'.
      // The stream will be attached via another useEffect when the step changes.
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

  // New Effect: Attach stream when video element becomes available (step changes)
  useEffect(() => {
    if ((step === 'face' || step === 'liveness') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [step]);

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

  // ── Start ──

  const startVerification = async () => {
    if (!sessionCode.trim()) return;
    setStep('loading');
    setStatusMsg('Checking face registration...');

    try {
      // Verify student has registered their face
      const { data: student, error } = await supabase
        .from('students')
        .select('face_data, face_registered')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      if (!student?.face_registered || !student?.face_data) {
        setErrorMsg('Face not registered. Please complete face registration first.');
        setStep('failed');
        return;
      }

      // Move to location check
      setStep('location');
      setStatusMsg('Checking location...');
    } catch (err) {
      setErrorMsg(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('failed');
    }
  };

  // ── Location ──

  useEffect(() => {
    if (step !== 'location') return;
    (async () => {
      try {
        const loc = await getCurrentLocation(15000);
        setLocationData(loc);

        // Validate against campus via Python backend
        const geo = await validateGeo(loc.latitude, loc.longitude, loc.accuracy);
        setOnCampus(geo.valid);
        setCampusDistance(geo.distance_m);

        setStatusMsg(geo.valid
          ? 'Location verified! Starting camera...'
          : `You are ${geo.distance_m.toFixed(0)}m from campus.`
        );
      } catch {
        setStatusMsg('Location unavailable — proceeding with camera...');
      }

      await startCamera();
      startVisibilityCheck();
      setStep('face');
    })();
  }, [step]);

  // ── Face verification + liveness capture ──

  const startFaceVerify = () => {
    if (!videoRef.current) return;
    setStep('liveness');
    setLivenessProgress(0);

    const instructions = ['Keep looking at the camera', 'Blink naturally', 'Turn head slightly', 'Look straight', 'Almost done...'];
    let idx = 0;
    const frames: string[] = [];
    setLivenessInstruction(instructions[0]);

    // Also capture the main verification photo
    const probeImage = captureFrame(videoRef.current, 0.85);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 4) return;
      frames.push(captureFrame(videoRef.current, 0.7));
      idx++;
      setLivenessInstruction(instructions[Math.min(idx, instructions.length - 1)]);
      setLivenessProgress(Math.round((idx / LIVENESS_FRAMES) * 100));
      if (idx >= LIVENESS_FRAMES) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        submitAttendance(probeImage, frames);
      }
    }, 800);
  };

  // ── Submit ──

  const submitAttendance = async (probeImage: string, livenessFrames: string[]) => {
    setStep('verifying');
    setStatusMsg('Verifying face with AI server...');

    try {
      // 1. Verify face (face match + liveness + geo) via Python backend
      const verification: VerifyFaceResponse = await verifyFace({
        user_id: user?.id || '',
        image: probeImage,
        liveness_frames: livenessFrames,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        accuracy_m: locationData?.accuracy,
      });

      const faceMatch = verification.match.match;
      const similarity = verification.match.similarity;
      const livenessScore = verification.liveness.liveness_score ?? verification.liveness.avg_liveness_score ?? 0;
      const livenessPass = verification.liveness.is_live;
      const geoValid = verification.geo.valid;
      const geoDist = verification.geo.distance_m;
      const confScore = verification.confidence.score;
      const confCategory = verification.confidence.category;

      // 2. Fraud check
      const fraudResult = await checkFraud({
        distance_from_campus: geoDist,
        hour_of_day: new Date().getHours(),
        day_of_week: new Date().getDay(),
        face_similarity: similarity,
        liveness_score: livenessScore,
      });

      const verificationResult: VerificationResult = {
        faceMatch,
        faceConfidence: Math.round(similarity * 100),
        livenessPass,
        livenessScore: Math.round(livenessScore * 100),
        locationValid: geoValid,
        distance: Math.round(geoDist),
        confidenceScore: Math.round(confScore * 100),
        confidenceCategory: confCategory,
        fraudAlerts: fraudResult.flags,
        timestamp: new Date().toISOString(),
      };

      setResult(verificationResult);

      // 3. Record attendance in DB
      try {
        await supabase.from('attendance').insert({
          student_id: user?.id,
          session_code: sessionCode,
          status: faceMatch && livenessPass ? 'present' : 'flagged',
          verification_method: 'face_recognition_python',
          face_confidence: Math.round(similarity * 100),
          liveness_score: Math.round(livenessScore * 100),
          confidence_score: Math.round(confScore * 100),
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          fraud_alerts: fraudResult.flags.length > 0 ? JSON.stringify(fraudResult.flags) : null,
          created_at: new Date().toISOString(),
        });
      } catch {
        // DB insert may fail due to RLS — still show result
      }

      stopCamera();
      setStep(faceMatch && livenessPass ? 'success' : 'failed');
      if (!faceMatch) setErrorMsg('Face did not match the registered face.');
      else if (!livenessPass) setErrorMsg('Liveness check failed — suspected spoof.');
    } catch (err) {
      stopCamera();
      setErrorMsg(`Verification error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('failed');
    }
  };

  // ── Render ──

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <AnimatePresence mode="wait">
        {/* Session Code */}
        {step === 'session' && (
          <motion.div key="session" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl"><ScanFace className="h-8 w-8 text-primary" /></div>
                  <div>
                    <CardTitle className="text-xl">Mark Attendance</CardTitle>
                    <CardDescription>Secure AI-verified face attendance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Code</Label>
                  <Input
                    placeholder="Enter session code from faculty"
                    value={sessionCode}
                    onChange={e => setSessionCode(e.target.value.toUpperCase())}
                    className="text-center text-lg tracking-widest uppercase"
                    maxLength={8}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2"><ScanFace className="h-5 w-5 mx-auto mb-1 text-primary" /><span className="text-xs">Face Match</span></div>
                  <div className="bg-muted/50 rounded-lg p-2"><Eye className="h-5 w-5 mx-auto mb-1 text-primary" /><span className="text-xs">Liveness</span></div>
                  <div className="bg-muted/50 rounded-lg p-2"><MapPin className="h-5 w-5 mx-auto mb-1 text-primary" /><span className="text-xs">Location</span></div>
                </div>
                <Button onClick={startVerification} disabled={sessionCode.length < 4} className="w-full" size="lg">
                  <Lock className="mr-2 h-5 w-5" />Start Verification
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center space-y-3">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="font-medium">{statusMsg}</p>
            </CardContent></Card>
          </motion.div>
        )}

        {/* Location */}
        {step === 'location' && (
          <motion.div key="location" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center space-y-3">
              <MapPin className="h-12 w-12 mx-auto text-primary animate-bounce" />
              <p className="font-medium">Verifying Location...</p>
              <p className="text-sm text-muted-foreground">{statusMsg}</p>
            </CardContent></Card>
          </motion.div>
        )}

        {/* Face Verification */}
        {step === 'face' && (
          <motion.div key="face" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Face Verification</CardTitle>
                  <div className="flex gap-2">
                    {locationData && (
                      <Badge variant={onCampus ? 'default' : 'destructive'}>
                        <MapPin className="h-3 w-3 mr-1" />
                        {onCampus ? 'On Campus' : `${campusDistance.toFixed(0)}m away`}
                      </Badge>
                    )}
                    <Badge variant={faceVisible ? 'default' : 'destructive'}>
                      {faceVisible ? 'Ready' : 'No Face'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-48 h-64 border-2 rounded-[50%] ${faceVisible ? 'border-green-500' : 'border-white/50'}`} />
                  </div>
                </div>
                <Button onClick={startFaceVerify} disabled={!faceVisible} className="w-full" size="lg">
                  <ScanFace className="mr-2 h-5 w-5" />Verify My Face
                </Button>
                {statusMsg && <p className="text-sm text-center text-muted-foreground">{statusMsg}</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Liveness */}
        {step === 'liveness' && (
          <motion.div key="liveness" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" />Liveness Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-lg font-semibold text-primary">{livenessInstruction}</p>
                  </div>
                  <Progress value={livenessProgress} className="h-3" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Verifying */}
        {step === 'verifying' && (
          <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center space-y-3">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="font-medium">{statusMsg}</p>
              <p className="text-sm text-muted-foreground">Running ArcFace + Mediapipe + Fraud Detection...</p>
            </CardContent></Card>
          </motion.div>
        )}

        {/* Success */}
        {step === 'success' && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-green-500">
              <CardContent className="py-6 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-green-600">Attendance Marked!</h3>
                  <p className="text-sm text-muted-foreground mt-1">{new Date(result.timestamp).toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <ScanFace className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <span className="text-xs block text-muted-foreground">Face Match</span>
                    <span className="font-bold">{result.faceConfidence}%</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <Eye className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <span className="text-xs block text-muted-foreground">Liveness</span>
                    <span className="font-bold">{result.livenessScore}%</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <span className="text-xs block text-muted-foreground">Location</span>
                    <span className="font-bold">{result.locationValid ? 'On Campus' : `${result.distance}m`}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <Shield className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <span className="text-xs block text-muted-foreground">Confidence</span>
                    <span className="font-bold">{result.confidenceScore}% ({result.confidenceCategory})</span>
                  </div>
                </div>

                {result.fraudAlerts.length > 0 && (
                  <div className="bg-amber-500/10 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Fraud Alerts
                    </p>
                    <ul className="text-xs text-amber-600 dark:text-amber-500 mt-1 space-y-1">
                      {result.fraudAlerts.map((a, i) => <li key={i}>• {a}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Failed */}
        {step === 'failed' && (
          <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-red-500">
              <CardContent className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-red-600">Verification Failed</h3>
                <p className="text-muted-foreground text-sm">{errorMsg || 'Face or liveness check did not pass'}</p>
                <Button onClick={() => { stopCamera(); setStep('session'); }} variant="outline">Try Again</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
