import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, AlertCircle, Send, Scan, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { leaveService } from '@/lib/api';
import { toast } from 'sonner';

interface AttRecord {
  date: string;
  status: string;
  subject: string;
  subjectId?: string;
}

interface SubjectStat {
  subject: string;
  total: number;
  present: number;
  percentage: number;
}

export default function MyAttendancePage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AttRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    const studentId = user.student?.id || user.id;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Fetch all attendance records for this student
        const { data: attData } = await supabase
          .from('attendance')
          .select('date, status, subject_id')
          .eq('student_id', studentId)
          .order('date', { ascending: false })
          .limit(100);

        const rows = attData || [];

        // Resolve subject names from courses table
        const subjectIds = [...new Set(rows.map((r: any) => r.subject_id).filter(Boolean))];
        let subjectMap: Record<string, string> = {};
        if (subjectIds.length) {
          const { data: subs } = await supabase
            .from('courses')
            .select('id, name')
            .in('id', subjectIds);
          subjectMap = Object.fromEntries((subs || []).map((s: any) => [s.id, s.name]));
        }

        const history: AttRecord[] = rows.map((r: any) => ({
          date: r.date,
          status: r.status || 'PRESENT',
          subject: subjectMap[r.subject_id] || 'Unknown Subject',
          subjectId: r.subject_id,
        }));

        if (!cancelled) setAttendanceHistory(history);
      } catch (err) {
        console.error('Attendance fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Compute subject stats from real data
  const subjectStats = useMemo<SubjectStat[]>(() => {
    const map = new Map<string, { subject: string; total: number; present: number }>();
    for (const r of attendanceHistory) {
      if (!map.has(r.subject)) map.set(r.subject, { subject: r.subject, total: 0, present: 0 });
      const entry = map.get(r.subject)!;
      entry.total++;
      if (r.status === 'PRESENT') entry.present++;
    }
    return Array.from(map.values()).map(s => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));
  }, [attendanceHistory]);

  const summary = useMemo(() => {
    const present = attendanceHistory.filter((r) => r.status === 'PRESENT').length;
    const total = attendanceHistory.length;
    const percentage = total ? Math.round((present / total) * 100) : 0;
    return { present, total, percentage };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'ABSENT':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'LATE':
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'ABSENT':
        return 'bg-red-500/20 text-red-400';
      case 'LATE':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-cyan-900/30 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.1),transparent_35%)]" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300 text-2xl font-bold">
            {summary.percentage}%
          </div>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl font-semibold text-white">My Attendance</h1>
            <p className="text-slate-300">Detailed records with calendar and class notices.</p>
          </div>
          <div className="flex gap-4 items-center">
            <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">Live synced</Badge>
            <Button 
              onClick={() => navigate('/student/live-attendance')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-none rounded-xl ml-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105 flex items-center gap-2"
            >
              <Scan className="w-4 h-4" /> Take Live Attendance
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-950/70 border border-emerald-500/15 lg:col-span-2 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <CardHeader>
            <CardTitle className="text-white">Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : attendanceHistory.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">No attendance records yet.</p>
            ) : (
            <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
              {attendanceHistory.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(record.status)}
                    <div>
                      <p className="font-medium text-white">{record.subject}</p>
                      <p className="text-sm text-slate-400">{record.date}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(record.status)}>{record.status}</Badge>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <CardHeader>
            <CardTitle className="text-white">Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-inner">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="w-full rounded-lg"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <Card className="bg-slate-950/70 border border-slate-800 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-white">Subject-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjectStats.map((stat) => (
                <div
                  key={stat.subject}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-white">{stat.subject}</p>
                    <span className={`text-lg font-bold ${
                      stat.percentage >= 75 ? 'text-emerald-300' : 'text-amber-300'
                    }`}>
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        stat.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    {stat.present} / {stat.total} classes attended
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/80 border border-emerald-500/20 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-300" /> Notify Class Incharge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Date of absence</Label>
              <Input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="bg-slate-900 border-slate-800 text-white resize-none"
                placeholder="Let your class incharge know why you will be absent."
              />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 text-slate-950 font-semibold"
              disabled={sending || !plannedDate || !reason.trim()}
              onClick={async () => {
                if (!user || !plannedDate || !reason.trim()) return;
                setSending(true);
                try {
                  const studentId = user.student?.id || user.id;
                  await leaveService.create({
                    studentId,
                    startDate: plannedDate,
                    endDate: plannedDate,
                    reason: reason.trim(),
                    status: 'PENDING',
                  } as any);
                  toast.success('Absence notification sent to your class incharge.');
                  setPlannedDate('');
                  setReason('');
                } catch (err) {
                  toast.error('Failed to send notification. Please try again.');
                  console.error(err);
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send information
            </Button>
            <p className="text-xs text-slate-400">This sends a note to your class incharge. Approvals are handled by faculty.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}