import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, Info, BookOpen, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

interface SubjectStats {
  id: string;
  name: string;
  total: number;
  attended: number;
}

export default function AttendanceCalculatorPage() {
  const { user } = useSupabaseAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requiredPercentage, setRequiredPercentage] = useState(75);
  
  // Weights (ideally fetched from system settings, but we can default)
  const [weights, setWeights] = useState({ CLASS: 1, LAB: 2 });

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { analyticsService, settingsService } = await import('@/lib/api');
        const [dashboardData, settingsData] = await Promise.all([
          analyticsService.getStudentStats(),
          settingsService.getAll()
        ]);
        
        setStats(dashboardData);
        
        // Extract weights from settings
        const classW = settingsData.find((s: any) => s.key === 'ATTENDANCE_WEIGHT_CLASS')?.value;
        const labW = settingsData.find((s: any) => s.key === 'ATTENDANCE_WEIGHT_LAB')?.value;
        if (classW && labW) {
          setWeights({ CLASS: Number(classW), LAB: Number(labW) });
        }
      } catch (err) {
        console.error('Calculator initialization error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const currentStats = stats?.summary || { 
    attendedClasses: 0, totalClasses: 0, 
    attendedLabs: 0, totalLabs: 0, 
    attendancePercentage: 0 
  };

  const [simulated, setSimulated] = useState({
    extraClasses: 0,
    extraLabs: 0
  });

  const getWeightedStats = (addC = 0, addL = 0) => {
    const attC = currentStats.attendedClasses + addC;
    const totC = currentStats.totalClasses + addC;
    const attL = currentStats.attendedLabs + addL;
    const totL = currentStats.totalLabs + addL;
    
    const earned = (attC * weights.CLASS) + (attL * weights.LAB);
    const total = (totC * weights.CLASS) + (totL * weights.LAB);
    
    const percentage = total > 0 ? (earned / total) * 100 : 0;
    
    // Recovery calculation: How many MORE sessions needed to hit target?
    // We assume user attends ALL upcoming sessions.
    // (Earned + x*W) / (Total + x*W) = Target
    // Simple approach: Incremental simulation for mixed recovery
    let recoveryClasses = 0;
    let recoveryLabs = 0;
    
    if (percentage < requiredPercentage) {
      // Find min classes needed (assuming only classes)
      const xC = (requiredPercentage * total / 100 - earned) / (weights.CLASS * (1 - requiredPercentage / 100));
      recoveryClasses = Math.ceil(Math.max(0, xC));
      
      // Find min labs needed (assuming only labs)
      const xL = (requiredPercentage * total / 100 - earned) / (weights.LAB * (1 - requiredPercentage / 100));
      recoveryLabs = Math.ceil(Math.max(0, xL));
    }

    return { percentage, recoveryClasses, recoveryLabs, earned, total };
  };

  const result = getWeightedStats(simulated.extraClasses, simulated.extraLabs);
  const currentPercentage = result.percentage;

  const risk = useMemo(() => {
    if (currentPercentage < requiredPercentage - 10) return { level: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (currentPercentage < requiredPercentage) return { level: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { level: 'SAFE', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  }, [currentPercentage, requiredPercentage]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Attendance Margin Calculator</h2>
          <p className="text-slate-400 mt-1">Plan your leaves or track exactly how many classes you need.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="ml-3 text-slate-400">Loading your attendance data...</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-950/70 border border-slate-800 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Dynamic Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Live Statistics</h4>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] text-slate-400 uppercase">Classes</p>
                   <p className="text-lg font-bold text-white">{currentStats.attendedClasses} / {currentStats.totalClasses}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-slate-400 uppercase">Labs</p>
                   <p className="text-lg font-bold text-white">{currentStats.attendedLabs} / {currentStats.totalLabs}</p>
                 </div>
               </div>
            </div>

            <div className="space-y-4 pt-2">
              <Label className="text-slate-300">Target Threshold (%)</Label>
              <Input
                type="number"
                value={requiredPercentage}
                onChange={(e) => setRequiredPercentage(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
                className="bg-slate-900 border-slate-800 text-white h-12 text-lg font-bold"
              />
            </div>

            <div className="space-y-4 pt-2">
              <Label className="text-slate-300">Simulate Upcoming Attendance</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Classes to Attend</span>
                  <Input
                    type="number"
                    value={simulated.extraClasses}
                    onChange={(e) => setSimulated(p => ({ ...p, extraClasses: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="bg-slate-900 border-slate-800 text-emerald-400 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Labs to Attend</span>
                  <Input
                    type="number"
                    value={simulated.extraLabs}
                    onChange={(e) => setSimulated(p => ({ ...p, extraLabs: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="bg-slate-900 border-slate-800 text-cyan-400 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex justify-between items-center text-xs text-slate-500 uppercase font-black tracking-widest">
                <span>Calculated Weights</span>
                <span className="text-emerald-500">Class: {weights.CLASS}x | Lab: {weights.LAB}x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-slate-800 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] flex flex-col">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Analysis Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="w-full flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-400">Current</span>
                <span className="text-3xl font-bold text-white">{currentPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full relative">
                <Progress 
                  value={currentPercentage} 
                  className="h-3 bg-slate-800 w-full" 
                  indicatorClassName={currentPercentage >= requiredPercentage ? "bg-emerald-500" : "bg-amber-500"} 
                />
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10 hidden sm:block" 
                  style={{ left: `${requiredPercentage}%` }}
                >
                  <span className="absolute -top-6 -translate-x-1/2 text-[10px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">Target {requiredPercentage}%</span>
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-3xl ${risk.bg} border ${risk.border} flex items-start gap-4`}>
              {currentPercentage >= requiredPercentage ? (
                <CheckCircle2 className={`w-6 h-6 mt-0.5 ${risk.color}`} />
              ) : (
                <AlertTriangle className={`w-6 h-6 mt-0.5 ${risk.color}`} />
              )}
              <div className="flex-1">
                <h4 className={`font-black text-sm uppercase tracking-widest ${risk.color}`}>{risk.level} STRATEGY</h4>
                {currentPercentage >= requiredPercentage ? (
                  <div className="space-y-3 mt-2">
                    <p className="text-sm text-slate-300">
                      Weighted integrity confirmed. You have a safety cushion.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                         <p className="text-[10px] text-slate-500 uppercase font-black">Safe Miss (Classes)</p>
                         <p className="text-lg font-bold text-emerald-400">{Math.floor(((result.earned - (requiredPercentage * result.total / 100)) / weights.CLASS)) || 0}</p>
                       </div>
                       <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                         <p className="text-[10px] text-slate-500 uppercase font-black">Safe Miss (Labs)</p>
                         <p className="text-lg font-bold text-cyan-400">{Math.floor(((result.earned - (requiredPercentage * result.total / 100)) / weights.LAB)) || 0}</p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mt-2">
                    <p className="text-sm text-slate-300">
                      Recovery required. Attend sessions to restore integrity.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                         <p className="text-[10px] text-slate-500 uppercase font-black">Target (Classes only)</p>
                         <p className="text-lg font-bold text-amber-400">{result.recoveryClasses}</p>
                       </div>
                       <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                         <p className="text-[10px] text-slate-500 uppercase font-black">Target (Labs only)</p>
                         <p className="text-lg font-bold text-cyan-400">{result.recoveryLabs}</p>
                       </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium italic">* Calculated assuming 100% attendance in future sessions.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 flex gap-3 text-sm text-slate-400">
              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <p>
                {currentPercentage >= requiredPercentage 
                  ? "Skipping more than the specified amount will result in your attendance falling below the required margin."
                  : "The required number is a straight continuation. Missing any upcoming class will increase the overall burden."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}