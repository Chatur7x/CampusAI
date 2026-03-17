import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Send, 
  Scan, 
  Loader2, 
  Shield, 
  Activity, 
  Lock,
  Zap
} from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { analyticsService, leaveService } from '@/lib/api';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function MyAttendancePage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getStudentStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        console.error('Attendance fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const attendance = stats?.summary || { attendancePercentage: 0 };
  const history = stats?.history || [];
  const subjectBreakdown = stats?.subjectBreakdown || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'ABSENT': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'LATE': return <Clock className="w-4 h-4 text-amber-400" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ABSENT': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'LATE': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-slate-400 font-medium animate-pulse text-sm tracking-widest uppercase text-center">Decrypting Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-700">
      {/* Header (Premium) */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-10 shadow-2xl group text-center md:text-left">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/10 opacity-50" />
        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
             <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="#0f172a" strokeWidth="8" fill="none" />
                  <circle 
                    cx="50" cy="50" r="45" 
                    stroke="#10b981" 
                    strokeWidth="8" 
                    fill="none" 
                    strokeDasharray={`${attendance.attendancePercentage * 2.82} 282`}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-2xl font-black text-white italic">{attendance.attendancePercentage}%</span>
                </div>
             </div>
             <div className="space-y-1">
                <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
                  Neural <span className="text-emerald-400">Archives</span>
                </h1>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Historical Integrity Ledger</p>
             </div>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
             <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-6 py-2 rounded-full font-black text-[9px] tracking-widest uppercase">Encryption: AES-256</Badge>
             <Button 
               onClick={() => navigate('/student/live-attendance')}
               className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest border-none rounded-full shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all flex items-center gap-2 px-8"
             >
               <Scan className="w-4 h-4" /> Engage Portal
             </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Records List */}
        <Card className="xl:col-span-2 bg-slate-950/50 border-white/5 rounded-[3rem] shadow-2xl overflow-hidden">
          <CardHeader className="p-8 pb-4">
             <CardTitle className="text-white flex items-center gap-3 text-lg font-black uppercase italic tracking-tighter">
                <Activity className="w-5 h-5 text-emerald-400" />
                Recent Transmission Logs
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-8">
             <div className="h-64 w-full bg-slate-900/40 rounded-3xl border border-white/5 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...history].reverse()}>
                    <defs>
                      <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={(r: any) => r.status === 'PRESENT' ? 100 : 0} 
                      name="Status"
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorAtt)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
             </div>

             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <p className="text-center py-20 text-slate-500 uppercase font-black tracking-widest text-xs">No records detected in this interval</p>
                ) : (
                  history.map((record: any, idx: number) => (
                    <div key={idx} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all gap-4">
                       <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center border ${getStatusColor(record.status)}`}>
                             {getStatusIcon(record.status)}
                          </div>
                          <div>
                             <h4 className="font-bold text-white text-sm uppercase tracking-tight">{record.subject || 'Session'}</h4>
                             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(record.date).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          {record.blockchainHash && (
                             <div className="flex items-center gap-2 text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-400/5 px-3 py-1 rounded-lg border border-cyan-400/10">
                                <Shield className="w-3 h-3" /> Hash Verified
                             </div>
                          )}
                          <Badge className={`${getStatusColor(record.status)} border-none px-4 py-1 font-black text-[9px] tracking-widest`}>
                             {record.status}
                          </Badge>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </CardContent>
        </Card>

        {/* Sidebar Controls */}
        <div className="space-y-8">
           <Card className="bg-slate-950/50 border-white/5 rounded-[3rem] shadow-2xl overflow-hidden p-6 gap-6 flex flex-col">
              <div className="p-4 rounded-3xl border border-white/5 bg-slate-900/50">
                 <Calendar
                   mode="single"
                   selected={date}
                   onSelect={setDate}
                   className="w-full text-white"
                 />
              </div>

              <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                 <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-black text-xs uppercase tracking-widest text-indigo-300">AI stability Index</h4>
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-indigo-400/60">
                       <span>Stability</span>
                       <span>{attendance.stabilityIndex || 0}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${attendance.stabilityIndex || 0}%` }} />
                    </div>
                 </div>
                 <p className="text-[9px] text-slate-500 italic leading-relaxed">
                    Higher stability indicates consistent attendance patterns and predictable academic outcomes.
                 </p>
              </div>
           </Card>

           <Card className="bg-slate-950/80 border border-emerald-500/20 rounded-[3rem] shadow-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Send className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-black italic tracking-tighter uppercase">Absence Protocol</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scheduled Date</Label>
                  <Input
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="bg-slate-900 border-white/5 text-white h-12 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operational Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="bg-slate-900 border-white/5 text-white resize-none rounded-2xl p-4"
                    placeholder="Briefly explain the absence..."
                  />
                </div>
                <Button
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95"
                  disabled={sending || !plannedDate || !reason.trim()}
                  onClick={async () => {
                    setSending(true);
                    try {
                      await leaveService.create({
                        student_id: user?.student?.id,
                        start_date: plannedDate,
                        end_date: plannedDate,
                        reason: reason.trim(),
                        status: 'PENDING',
                      } as any);
                      toast.success('Transmission Successful: Leave Request Filed');
                      setPlannedDate('');
                      setReason('');
                    } catch (err) {
                      toast.error('Sync Error: Failed to notify command');
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initiate Request"}
                </Button>
              </div>
           </Card>
        </div>
      </div>

      {/* Sub-Subject Breakdown (S4) */}
      <Card className="bg-slate-950/50 border-white/5 rounded-[3rem] shadow-2xl overflow-hidden">
        <CardHeader className="p-10 pb-4">
           <CardTitle className="text-white flex items-center gap-3 text-lg font-black uppercase italic tracking-tighter">
              <Lock className="w-5 h-5 text-indigo-400" />
              Per-Subject Forensic Breakdown
           </CardTitle>
        </CardHeader>
        <CardContent className="p-10 pt-0">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjectBreakdown.map((s: any, i: number) => (
                <div key={i} className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all">
                   <div className="flex justify-between items-start mb-6 gap-2">
                      <div className="min-w-0">
                         <h4 className="font-black text-white text-md uppercase tracking-tighter mb-1 truncate">{s.name}</h4>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.attended} Units Attended</p>
                      </div>
                      <span className={`text-2xl font-black italic flex-shrink-0 ${s.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>{s.percentage}%</span>
                   </div>
                   <div className="space-y-3">
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${s.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${s.percentage}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                         <span>Threshold 75%</span>
                         <span>{s.total} Sessions Total</span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}