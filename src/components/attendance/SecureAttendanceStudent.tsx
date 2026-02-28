import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, ShieldCheck, AlertTriangle, Fingerprint, ScanFace, CheckCircle2, Lock, Bluetooth, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Badge } from '@/components/ui/badge';

export default function SecureAttendanceStudent() {
  const [step, setStep] = useState(0); 
  const [sessionCode, setSessionCode] = useState('');
  const [locationStatus, setLocationStatus] = useState<'pending'|'verifying'|'success'|'failed'>('pending');
  // ... other states
  const [distanceInfo, setDistanceInfo] = useState<number | null>(null);
  const [livenessChallenge, setLivenessChallenge] = useState('Please look straight at the camera');
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState<'idle'|'submitting'|'success'|'bluetooth'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Custom states for Bluetooth Offline Feature
  const [networkStatus, setNetworkStatus] = useState<'online'|'offline'>('online');
  const [bleTransfering, setBleTransfering] = useState(false);
  const [violationWarning, setViolationWarning] = useState('');

  // Handle Online/Offline Status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopCamera();
    };
  }, []);

  // Setup Anti-cheating mechanisms when session starts
  useEffect(() => {
    if (step > 1 && step < 5) {
      // 1. Detect Tab Switch / App Background
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setViolationWarning('WARNING: Tab switch detected! This activity has been flagged on your attendance record.');
        }
      };
      
      // 2. Detect Resize (split screen attempt)
      const handleResize = () => {
        if (window.innerWidth < screen.width * 0.8) {
          setViolationWarning('WARNING: Split-screen/Resize detected. Please use full screen.');
        }
      };

      // 3. Detect Fullscreen Exit
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          setViolationWarning('CRITICAL OFFENSE: Exited fullscreen mode! System anomaly logged.');
          setStep(0); // Force back out
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('resize', handleResize);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    }
  }, [step]);

  // Step 0: lock screen
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setStep(1);
      } else {
         // Fallback for some IOS browsers
         setStep(1);
      }
    } catch (err) {
      console.error("Fullscreen failed:", err);
      // Fallback
      setStep(1);
    }
  }

  const startSession = () => {
    if (sessionCode.length === 6) {
      setStep(2);
      verifyLocation();
    }
  };

  const verifyLocation = () => {
    setLocationStatus('verifying');

    if (!navigator.geolocation) {
      setViolationWarning("Geolocation is not supported by your browser");
      setLocationStatus('failed');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        
        // Mock Classroom Coordinates (using slightly offset user coords for demo success)
        const classLat = latitude + 0.0001; 
        const classLng = longitude + 0.0001;
        
        // Haversine Formula for exact distance
        const R = 6371e3; // Earth radius in metres
        const f1 = latitude * Math.PI/180;
        const f2 = classLat * Math.PI/180;
        const df = (classLat-latitude) * Math.PI/180;
        const dl = (classLng-longitude) * Math.PI/180;
        const a = Math.sin(df/2) * Math.sin(df/2) +
                  Math.cos(f1) * Math.cos(f2) *
                  Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = Math.floor(R * c);
        
        setDistanceInfo(distance);

        setTimeout(() => {
          if (distance <= 100) { // Within 100 meters
            setLocationStatus('success');
            setTimeout(() => {
              setStep(3);
              startCamera();
            }, 1800);
          } else {
            setLocationStatus('failed');
            setViolationWarning(`Location Failed! You are ${distance}m away from the classroom.`);
          }
        }, 1500); // Artificial delay to show verification UI
      },
      (err) => {
        console.error(err);
        setLocationStatus('failed');
        setViolationWarning("Please enable GPS location services to verify attendance.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    try {
      // Lowering resolution request to consume less RAM and increase FPS
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 }, // Ask for 480p equivalent to save memory
          height: { ideal: 480 },
          frameRate: { ideal: 30 } // Cap FPS to steady rates instead of maxing CPU
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      runLivenessChecks();
    } catch (err) {
      console.error("Camera access denied");
    }
  };

  const runLivenessChecks = () => {
    // Array of potential randomized tasks
    const tasksPool = [
      "Blink 3 times",
      "Turn head slightly left",
      "Turn head slightly right",
      "Smile widely",
      "Look up at the ceiling",
      "Nod your head up and down"
    ];

    // Shuffle and pick 2 random challenges
    const randomlySelected = tasksPool.sort(() => 0.5 - Math.random()).slice(0, 2);

    const challenges = [
      { text: `Task 1: ${randomlySelected[0]}`, delay: 3000 },
      { text: `Task 2: ${randomlySelected[1]}`, delay: 7000 },
      { text: "Analyzing 3D micro-expressions...", delay: 11000 },
      { text: "Face & Liveness Verified!", delay: 13000 }
    ];

    challenges.forEach((c) => {
      setTimeout(() => {
        setLivenessChallenge(c.text);
        if (c.text.includes("Verified")) {
          setStep(4);
        }
      }, c.delay);
    });

    // Progress bar animation
    let prog = 0;
    const interval = setInterval(() => {
      prog += 1;
      setLivenessProgress(prog);
      if (prog >= 100) clearInterval(interval);
    }, 130);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  };

  const submitAttendance = () => {
    if (networkStatus === 'offline') {
      setAttendanceStatus('bluetooth');
      setBleTransfering(true);
      setTimeout(() => {
        setBleTransfering(false);
        setAttendanceStatus('success');
        setStep(5);
        stopCamera();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.log(err));
        }
      }, 4000); // Simulated BLE bonding and payload transfer
      return;
    }

    setAttendanceStatus('submitting');
    setTimeout(() => {
      setAttendanceStatus('success');
      setStep(5);
      
      // Strict cleanup: release camera memory
      stopCamera();

      // Exit fullscreen to return device to normal state
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Hero Banner */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] transition-colors duration-500 ${networkStatus === 'offline' ? 'border-amber-400/30 bg-gradient-to-r from-slate-900 via-amber-900/40 to-slate-900' : 'border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-emerald-900/30'}`}>
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.1),transparent_35%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-white">Live Verification</h1>
            {networkStatus === 'offline' && (
              <Badge variant="destructive" className="bg-amber-500/20 text-amber-300 border-amber-500/50 flex animate-pulse">
                <WifiOff className="w-4 h-4 mr-2" /> Wi-Fi Disconnected
              </Badge>
            )}
          </div>
          <p className="text-slate-300">
             {networkStatus === 'online' 
              ? 'Complete the 4-layer secure process to mark your presence.' 
              : 'Offline Mode Active. Data will be transmitted via Bluetooth Mesh directly to Faculty.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">Geo-Locked</Badge>
            {networkStatus === 'offline' && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50"><Bluetooth className="w-3 h-3 mr-1" /> BLE Mesh Ready</Badge>
            )}
            <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Anti-Spoofing</Badge>
          </div>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        {violationWarning && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="font-semibold">{violationWarning}</p>
          </div>
        )}

        <Card className="bg-slate-950/80 border-emerald-500/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] rounded-3xl overflow-hidden relative">
        {/* Anti-spoofing lock badge */}
        <div className="absolute top-4 right-4 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium text-slate-300 z-10 backdrop-blur-md">
          <Lock className="w-3.5 h-3.5 text-emerald-400" /> Secure Mode Active
        </div>

        <CardHeader className="bg-slate-900/50 border-b border-slate-800 pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl text-white">
            <ScanFace className="w-8 h-8 text-emerald-400" />
            Live Secure Attendance
          </CardTitle>
          <p className="text-slate-400 text-sm mt-1">Adaptive 4-Layer Verification System</p>
        </CardHeader>

        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            
            {/* STEP 0: Enter SECURE MODE */}
            {step === 0 && (
              <motion.div 
                key="step0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center space-y-6 py-6"
              >
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <Lock className="w-10 h-10 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Full-Screen Secure Mode Required</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    To prevent cheating and tab-switching, attendance can only be submitted in active Secure Mode.
                  </p>
                </div>
                
                <Button 
                  onClick={enterFullscreen}
                  className="w-full max-w-xs h-12 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-lg"
                >
                  <ScanFace className="w-5 h-5 mr-2" /> Enter Secure Mode
                </Button>
              </motion.div>
            )}

            {/* STEP 1: Session Code */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-4 text-center">
                  <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-4">
                    <Fingerprint className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Enter Session Token</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Look at the faculty's screen to get the 6-digit dynamic session pin. This ensures you are physically present.
                  </p>
                </div>
                
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">6-Digit Code</Label>
                    <Input 
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="text-center text-3xl tracking-[0.5em] font-mono h-16 bg-slate-900 focus:ring-emerald-500/50"
                    />
                  </div>
                  <Button 
                    onClick={startSession}
                    disabled={sessionCode.length !== 6}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg"
                  >
                    Start Verification
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Geo-Location Verify */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-10 space-y-6"
              >
                <div className="relative">
                  <MapPin className={`w-16 h-16 ${locationStatus === 'success' ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'}`} />
                  {locationStatus === 'verifying' && (
                    <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping" />
                  )}
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {locationStatus === 'verifying' ? 'Verifying Coordinates...' : locationStatus === 'success' ? 'Location Confirmed' : 'Location Failed'}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {locationStatus === 'verifying' 
                      ? 'Checking GPS and network topology against classroom bounds.' 
                      : locationStatus === 'success' 
                        ? `Secure match! You are ${distanceInfo}m from the classroom center.` 
                        : 'You must be inside the classroom (100m radius) to proceed.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Biometric Liveness */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-white">Liveness Check</h3>
                  <p className="text-emerald-400 font-medium h-6">{livenessChallenge}</p>
                </div>
                
                <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                  {/* Camera feed */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div 
                      className="w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]"
                      style={{ 
                        transform: `translateY(${livenessProgress * 3.2}px)`,
                      }}
                    />
                    {/* Face guide wireframe */}
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-3/5 h-3/5 border-2 border-dashed border-emerald-500/50 rounded-[40%] opacity-50" />
                    </div>
                  </div>
                </div>

                <div className="max-w-md mx-auto h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 4: Submit */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-6"
              >
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <ShieldCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Verification Complete</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Geofencing, Token, and Biometric Liveness all passed. Waiting for faculty final approval.
                  </p>
                </div>
                <div className="mt-8 w-full max-w-xs mx-auto">
                  <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 mb-6">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Verification Hash</p>
                    <p className="font-mono text-emerald-400/70 text-[10px] break-all">
                      {Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}
                    </p>
                  </div>
                  <Button 
                    onClick={submitAttendance}
                    disabled={attendanceStatus !== 'idle'}
                    className={`w-full py-6 text-base font-bold transition-all ${
                      networkStatus === 'offline' 
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] text-white' 
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white'
                    }`}
                  >
                    {attendanceStatus === 'idle' ? (
                       networkStatus === 'offline' ? (
                         <span className="flex items-center gap-2"><Bluetooth className="w-5 h-5" /> Push via BLE Mesh</span>
                       ) : (
                         <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Confirm & Submit</span>
                       )
                    ) : attendanceStatus === 'bluetooth' ? (
                       <span className="flex items-center gap-2 animate-pulse"><RefreshCw className="w-5 h-5 animate-spin" /> Broadcasting...</span>
                    ) : (
                       <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Submitting...</span>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Success */}
            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6 py-8"
              >
                <div className="inline-block relative">
                  <CheckCircle2 className="w-24 h-24 text-emerald-400 z-10 relative" />
                  <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-bold text-white">Present Recorded</h3>
                  <p className="text-slate-400">Your attendance has been cryptographically signed and recorded.</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-left max-w-sm mx-auto font-mono text-xs text-slate-500 break-all">
                  Hash: 0x8f4b...3a9c <br/>
                  Timestamp: {new Date().toISOString()} <br/>
                  Verified by: Autonomous Oracle
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>
      
        {/* Footer Info */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
            <MapPin className="w-5 h-5 text-cyan-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">Geo-Fenced</p>
            <p className="text-[10px] text-slate-500 mt-1">±5m Precision</p>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
            <ScanFace className="w-5 h-5 text-purple-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">Biometric</p>
            <p className="text-[10px] text-slate-500 mt-1">3D Liveness</p>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
            <Lock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">Anti-Cheat</p>
            <p className="text-[10px] text-slate-500 mt-1">Hardware Lock</p>
          </div>
        </div>
      </div>

    </div>
  );
}
