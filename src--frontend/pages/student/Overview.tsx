import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Clock,
  Bell,
  Loader2,
  BookOpen,
  ArrowRight,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { analyticsService } from "@/lib/api";

interface AttendanceRecord {
  date: string;
  status: string;
  subjectId?: string;
}

interface TodayClass {
  subject: string;
  startTime: string;
  endTime: string;
  attended?: boolean;
}

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
}

export default function StudentOverview() {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // ── Live time for NOW detection ──
  const currentTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getStudentStats();
        if (!cancelled) {
          setStats(data);
          
          data.timetable?.forEach((cls: any) => {
            const [h, m] = cls.startTime.split(":").map(Number);
            const now = new Date();
            const clsMins = h * 60 + m;
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const diff = clsMins - nowMins;
            if (diff > 0 && diff <= 10) {
              toast.info(`Class starting soon: ${cls.subject} at ${cls.startTime}`, {
                duration: 8000,
                icon: "🔔",
              });
            }
          });
        }
      } catch (err) {
        console.error("Overview fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);
  
  // ── Supabase Realtime Listener ──
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('public:notices')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notices' 
      }, () => {
        // Just refresh stats to get latest notices
        (async () => {
          const data = await analyticsService.getStudentStats();
          setStats(data);
        })();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const monthlyData: any[] = [];

  const attendance = stats?.summary || { attendancePercentage: 0, totalClasses: 0, attendedClasses: 0, attendedLabs: 0, totalLabs: 0, riskLevel: 'LOW', status: 'SYNCING' };
  const attendanceColor = attendance.attendancePercentage >= 75 ? "#10b981" : attendance.attendancePercentage >= 60 ? "#f59e0b" : "#ef4444";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-slate-400 font-medium animate-pulse text-sm tracking-widest uppercase">Loading your data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header Section (Cleaned up S1) */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-8 shadow-2xl group">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/10 opacity-50" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              Academic <span className="text-emerald-400">Overview</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Your attendance at a glance</p>
          </div>
          <div className="flex gap-4">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 font-bold text-[10px] tracking-widest uppercase rounded-full">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Badge>
          </div>
        </div>
      </div>

      {/* Attendance Alert */}
      {attendance.attendancePercentage < 75 && (
        <Card className="bg-red-500/10 border-red-500/20 shadow-lg rounded-3xl overflow-hidden border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-2xl">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-200">Attendance Risk Detected</h3>
                <p className="text-sm text-red-100/60">Current: {attendance.attendancePercentage}% (Required: 75%). Use the smart calculator to plan recovery.</p>
              </div>
              <Button onClick={() => navigate('/student/calculator')} variant="ghost" className="text-red-400 hover:text-red-300 gap-2 font-bold">
                FIX NOW <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Attendance Card */}
        <Card className="lg:col-span-2 bg-slate-950/70 border-white/5 shadow-2xl rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <CardContent className="p-10 relative">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="62" stroke="#0f172a" strokeWidth="14" fill="none" />
                  <circle 
                    cx="70" cy="70" r="62" 
                    stroke={attendanceColor} 
                    strokeWidth="14" 
                    fill="none" 
                    strokeDasharray={`${attendance.attendancePercentage * 3.9} 390`}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-white italic">{attendance.attendancePercentage}%</span>
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Consistency</span>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">Attendance Health</h2>
                  <p className="text-slate-400 font-medium capitalize">Weighted average across all sessions</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Standard Classes</p>
                    <p className="text-xl font-bold text-emerald-400">{attendance.attendedClasses} / {attendance.totalClasses}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Laboratory Labs</p>
                    <p className="text-xl font-bold text-cyan-400">{attendance.attendedLabs} / {attendance.totalLabs}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Badge className={`${attendance.riskLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'} border-none px-4 py-1.5 font-black text-[10px] tracking-widest uppercase`}>
                    Attendance Risk: {attendance.riskLevel}
                  </Badge>
                  <Badge className="bg-slate-800/50 text-slate-400 border-none px-4 py-1.5 font-black text-[10px] tracking-widest uppercase">
                    Status: {attendance.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights (S7 Optimization) */}
        <div className="space-y-6">
          <Card className="bg-slate-900/40 border-white/5 rounded-3xl overflow-hidden hover:border-emerald-500/20 transition-all cursor-pointer group" onClick={() => navigate('/student/calculator')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-white text-lg">Smart Calculator</h3>
              <p className="text-sm text-slate-400">Plan your recovery path to 75% target.</p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase font-black tracking-widest">Deficit</span>
                  <span className="text-sm font-bold text-red-400">-{Math.round(stats?.calculator?.currentDeficit * 10) / 10 || 0} sessions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-white/5 rounded-3xl overflow-hidden hover:border-cyan-500/20 transition-all cursor-pointer group" onClick={() => navigate('/student/attendance')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-white text-lg">Detailed Records</h3>
              <p className="text-sm text-slate-400">Blockchain-verified historical audit.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dynamic Timetable (S2) */}
        <Card className="bg-slate-950/50 border-white/5 rounded-[2rem] shadow-xl overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-3 text-lg font-black uppercase italic tracking-tighter">
                <Clock className="w-5 h-5 text-emerald-400" />
                Today's Timeline
              </CardTitle>
              <Badge variant="outline" className="border-white/10 text-slate-400 font-black">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            {!stats?.timetable || stats.timetable.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                   <Clock className="w-8 h-8 text-slate-700" />
                </div>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No Classes Scheduled Today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.timetable.map((cls: any, i: number) => {
                  const isNow = cls.startTime <= currentTime && cls.endTime > currentTime;
                  const isDone = cls.endTime <= currentTime;
                  return (
                    <div key={i} className={`group flex items-center gap-6 p-4 rounded-2xl border transition-all ${isNow ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}>
                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${isNow ? 'bg-emerald-500 text-slate-900' : 'bg-slate-900 text-slate-400 group-hover:text-emerald-400 transition-colors'}`}>
                        <span className="text-xs font-black leading-none">{cls.startTime.split(':')[0]}</span>
                        <div className="w-4 h-[1px] bg-current opacity-30 my-0.5" />
                        <span className="text-[10px] font-bold leading-none">{cls.startTime.split(':')[1]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-white uppercase text-sm tracking-tight">{cls.subject}</h4>
                          <Badge className="bg-white/5 text-[9px] text-slate-500 border-none px-2 h-4">{cls.type}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{cls.room || 'TBA'}</p>
                      </div>
                      {isNow ? (
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter animate-pulse">Live Now</span>
                           <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                      ) : isDone && (
                        <CheckCircle className="w-4 h-4 text-slate-700" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notices Section */}
        <Card className="bg-slate-950/50 border-white/5 rounded-[2rem] shadow-xl overflow-hidden">
          <CardHeader className="p-8 pb-4 text-white">
            <CardTitle className="flex items-center gap-3 text-lg font-black uppercase italic tracking-tighter">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            {!stats?.notices || stats.notices.length === 0 ? (
              <p className="text-slate-600 text-sm font-medium py-12 text-center uppercase tracking-widest text-[10px]">No notices yet</p>
            ) : (
              <div className="space-y-4">
                {stats.notices.map((notice: any) => (
                  <div key={notice.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-black text-white text-sm tracking-tight uppercase group-hover:text-cyan-400 transition-colors">{notice.title}</h4>
                      <Badge className={`${notice.priority === 'HIGH' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'} border-none text-[9px] px-2`}>{notice.priority}</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(notice.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" className="w-full mt-6 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest" onClick={() => navigate('/student/notices')}>
              View All Notices
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Per-Subject Detailed breakdown (S4) */}
      <Card className="bg-slate-950/50 border-white/5 rounded-[2rem] shadow-xl overflow-hidden">
        <CardHeader className="p-10 pb-4">
          <CardTitle className="text-white flex items-center gap-3 text-lg font-black uppercase italic tracking-tighter">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Subject Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats?.subjectBreakdown?.map((s: any, i: number) => (
              <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-black text-white text-sm uppercase tracking-tighter mb-1 line-clamp-1">{s.name}</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{s.attended} / {s.total} Sessions</p>
                  </div>
                  <span className={`text-xl font-black italic ${s.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>{s.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${s.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${s.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
