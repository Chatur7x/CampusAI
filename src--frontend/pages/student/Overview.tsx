import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, AlertCircle, CheckCircle, Clock, Bell, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const studentId = user.student?.id || user.id;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const classId = (user.student as any)?.class_id;
        const todayDay = new Date().getDay(); // 0-6

        // Run independent queries in parallel
        const [attResult, ttResult, noticeResult] = await Promise.all([
          // 1. Attendance records (last 6 months)
          supabase
            .from('attendance')
            .select('date, status, subject_id')
            .eq('student_id', studentId)
            .gte('date', sixMonthsAgo.toISOString().slice(0, 10))
            .order('date', { ascending: true }),
          // 2. Today's timetable (try timetable_entries with snake_case)
          classId
            ? supabase
                .from('timetable_entries')
                .select('subject_id, start_time, end_time')
                .eq('class_id', classId)
                .eq('day_of_week', todayDay)
            : Promise.resolve({ data: null, error: null }),
          // 3. Recent notices
          supabase
            .from('notices')
            .select('id, title, content, priority, created_at')
            .order('created_at', { ascending: false })
            .limit(3),
        ]);

        const attData = attResult.data;
        const scheduleRows = (ttResult.data || []).map((r: any) => ({
          subjectId: r.subject_id,
          startTime: r.start_time,
          endTime: r.end_time,
        }));

        // Resolve subject names (depends on timetable result)
        const subjectIds = [...new Set(scheduleRows.map((r: any) => r.subjectId).filter(Boolean))];
        let subjectMap: Record<string, string> = {};
        if (subjectIds.length) {
          const { data: subs } = await supabase
            .from('courses')
            .select('id, name')
            .in('id', subjectIds);
          subjectMap = Object.fromEntries((subs || []).map((s: any) => [s.id, s.name]));
        }

        const todaySchedule: TodayClass[] = scheduleRows.map((r: any) => ({
          subject: subjectMap[r.subjectId] || 'Unknown Subject',
          startTime: r.startTime || '',
          endTime: r.endTime || '',
        }));

        const noticeData = noticeResult.data;

        if (!cancelled) {
          setRecords(attData || []);
          setTodayClasses(todaySchedule);
          setNotices(noticeData || []);
        }
      } catch (err) {
        console.error('Overview fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Compute attendance stats from real data
  const attendance = useMemo(() => {
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const total = records.length;
    const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    const riskLevel = percentage >= 85 ? 'LOW' : percentage >= 75 ? 'MEDIUM' : 'HIGH';
    const safeAbsenceMargin = Math.max(0, Math.floor(total * 0.25) - absent);
    return { percentage, present, absent, late, total, riskLevel, safeAbsenceMargin };
  }, [records]);

  // Monthly trend from real records
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, { present: 0, total: 0 });
      const entry = byMonth.get(key)!;
      entry.total++;
      if (r.status === 'PRESENT') entry.present++;
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: months[parseInt(key.split('-')[1])],
        attendance: val.total > 0 ? Math.round((val.present / val.total) * 100) : 0,
      }));
  }, [records]);

  const attendanceColor = attendance.percentage >= 75 ? '#22c55e' : attendance.percentage >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-emerald-900/30 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.1),transparent_35%)]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-white">Student Portal</h1>
          <p className="text-slate-300">Live attendance, schedule, and notices.</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">Live tracking</Badge>
            <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Adaptive routing</Badge>
          </div>
        </div>
      </div>

      {/* Main Attendance Card */}
      <Card className="bg-slate-950/70 border border-emerald-500/15 shadow-[0_30px_80px_rgba(0,0,0,0.5)] rounded-3xl">
        <CardContent className="p-7 md:p-9">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40">
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-3xl" />
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="58" stroke="#0f172a" strokeWidth="12" fill="none" />
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    stroke={attendanceColor}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${attendance.percentage * 3.65} 365`}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_16px_rgba(34,197,94,0.45)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-5xl font-bold text-white leading-none">{attendance.percentage}%</span>
                  <span className="text-xs text-slate-300 mt-1">Overall attendance</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Live status</h3>
                <p className="text-slate-300 text-sm">
                  {attendance.present} Present • {attendance.absent} Absent • {attendance.late} Late
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/25 text-emerald-200 text-xs font-semibold">
                  {attendance.riskLevel} RISK
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 text-right">
              <div className="text-left md:text-right space-y-1">
                <p className="text-sm text-slate-400">Total tracked</p>
                <p className="text-3xl font-bold text-emerald-300">{attendance.total} classes</p>
                <p className="text-xs text-slate-400">Updated live by faculty</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Present</p>
                <p className="text-xl font-bold text-white">{attendance.present}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Absent</p>
                <p className="text-xl font-bold text-white">{attendance.absent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Late</p>
                <p className="text-xl font-bold text-white">{attendance.late}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Classes</p>
                <p className="text-xl font-bold text-white">{attendance.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Monthly Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Today's Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : todayClasses.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No classes scheduled today.</p>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((cls, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{cls.subject}</p>
                      <p className="text-sm text-slate-400">{cls.startTime} - {cls.endTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Notices */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            Recent Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : notices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No recent notices.</p>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div key={notice.id} className="p-3 rounded-lg bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{notice.title}</p>
                    <Badge className={
                      notice.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      notice.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }>
                      {notice.priority || 'LOW'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                    {notice.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}