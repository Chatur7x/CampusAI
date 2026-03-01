import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrCode, Play, StopCircle, CheckCircle2, XCircle, ShieldAlert, Timer, Users, RefreshCw, RadioReceiver, ShieldEllipsis, Bluetooth, BluetoothConnected, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { QRCodeSVG } from 'qrcode.react';

type StudentRequest = {
  id: string;
  name: string;
  rollNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged' | 'override_req';
  confidenceScore: number;
  time: string;
  dropoutRisk?: 'Low' | 'Medium' | 'High';
  isOfflineBLE?: boolean;
};

export default function LiveAttendanceFaculty() {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [codeTimeLeft, setCodeTimeLeft] = useState(30); // Dynamic code rotation
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [overrideOtpId, setOverrideOtpId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [isPinging, setIsPinging] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online'|'offline'>('online');
  const [bleScannerActive, setBleScannerActive] = useState(false);

  // Generate session logic
  const startSession = () => {
    // Generate a random 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSessionCode(code);
    setSessionActive(true);
    setTimeLeft(120);
    setCodeTimeLeft(30);
    setRequests([]);
    
    // Simulate incoming requests
    simulateIncomingStudents();
  };

  const endSession = () => {
    setSessionActive(false);
  };

  // Timer logic
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        
        // Rotate code logic
        setCodeTimeLeft((prev) => {
          if (prev <= 1) {
            setSessionCode(Math.floor(100000 + Math.random() * 900000).toString());
            return 30; // reset
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft <= 0) {
      setSessionActive(false);
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeft]);

  // Generates offline sync when triggered
  const simulateBleDiscovery = () => {
    if(!bleScannerActive) return;
    const mockBleStudent = {
        id: `ble-${Math.random()}`,
        name: 'James Walker',
        rollNumber: 'CS-08',
        status: 'pending' as const,
        confidenceScore: 92,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isOfflineBLE: true
    };
    
    setTimeout(() => {
      setRequests(prev => [mockBleStudent, ...prev]);
    }, 2000);
  };

  useEffect(() => {
    if (bleScannerActive) {
      simulateBleDiscovery();
      const interval = setInterval(simulateBleDiscovery, 8000);
      return () => clearInterval(interval);
    }
    // simulateBleDiscovery is defined in component scope and is stable for this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bleScannerActive]);

  // Monitor network connection 
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => {
      setNetworkStatus('offline');
      if(sessionActive) {
        setBleScannerActive(true); // Auto fallback to BLE when internet dies
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mock internet dropping for testing the feature
    // setTimeout(() => handleOffline(), 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionActive]);

  const simulateIncomingStudents = () => {
    const mockStudents = [
      { id: '1', name: 'Alex Thompson', roll: 'CS-01', risk: 'Low' },
      { id: '2', name: 'Sarah Chen', roll: 'CS-02', risk: 'Low' },
      { id: '3', name: 'Mike Johnson', roll: 'CS-03', risk: 'High' },
      { id: '4', name: 'Emily Davis', roll: 'CS-04', risk: 'Medium' },
      { id: '5', name: 'David Wilson', roll: 'CS-05', risk: 'Low' },
    ];

    mockStudents.forEach((student, index) => {
      setTimeout(() => {
        setRequests(prev => [...prev, {
          id: student.id,
          name: student.name,
          rollNumber: student.roll,
          status: student.risk === 'High' ? 'override_req' : 'pending',
          confidenceScore: student.risk === 'High' ? 45 : Math.floor(85 + Math.random() * 14), // 85-99
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dropoutRisk: student.risk as 'Low' | 'Medium' | 'High'
        }]);
      }, 2000 + (index * 1500) + (Math.random() * 1000));
    });
  };

  const handleAction = (id: string, action: 'approved' | 'rejected' | 'pending') => {
    setRequests(prev => 
      prev.map(req => req.id === id ? { ...req, status: action } : req)
    );
  };

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
      prev.map(req => req.status === 'pending' && req.confidenceScore > 90 ? { ...req, status: 'approved' } : req)
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

      {!sessionActive && timeLeft === 120 && (
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

      {(sessionActive || timeLeft < 120) && (
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
                >
                  <StopCircle className="w-4 h-4 mr-2" /> Stop Session Now
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
