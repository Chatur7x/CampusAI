import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, Loader2, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { useScrollCinematic } from '@/components/motion/useScrollCinematic';
import { TextEffect } from '@/components/motion/TextEffect';
import { SpotlightCard } from '@/components/motion/SpotlightCard';

interface DailyStat { date: string; present: number; absent: number; total: number; pct: number }
interface SubjectStat { subject: string; attendance: number }

export default function FacultyAnalyticsPage() {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7' | '14' | '30'>('14');
  const [dailyData, setDailyData] = useState<DailyStat[]>([]);
  const [subjectData, setSubjectData] = useState<SubjectStat[]>([]);
  const [stats, setStats] = useState({ avgAttendance: 0, totalStudents: 0, totalClasses: 0 });
  const scopeRef = useRef<HTMLDivElement | null>(null);
  // Refresh trigger positions once charts mount after load / range change.
  useScrollCinematic(scopeRef, [loading]);

  useEffect(() => {
    if (!user) return;
    const facultyId = (user as any).faculty?.id || user.id;
    const since = new Date();
    since.setDate(since.getDate() - Number(range));
    const sinceStr = since.toISOString().slice(0, 10);

    (async () => {
      setLoading(true);
      try {
        // 1. Get the classes this faculty teaches
        const { data: timetableEntries } = await supabase
          .from('timetable_entries')
          .select('class_id, subject_id')
          .eq('faculty_id', facultyId);

        const facultyClassIds = [...new Set((timetableEntries || []).map((t: any) => t.class_id).filter(Boolean))];
        const facultySubjectIds = [...new Set((timetableEntries || []).map((t: any) => t.subject_id).filter(Boolean))];

        // 2. Fetch attendance records scoped to faculty's subjects
        let rows: any[] = [];
        if (facultySubjectIds.length > 0) {
          const { data: records } = await supabase
            .from('attendance')
            .select('date, status, subject_id')
            .in('subject_id', facultySubjectIds)
            .gte('date', sinceStr)
            .order('date', { ascending: true });
          rows = (records || []).map((r: any) => ({
            date: r.date,
            status: r.status,
            subjectId: r.subject_id || null,
          }));
        } else {
          // Fallback: if no timetable entries, fetch all (backward compat)
          const { data: records } = await supabase
            .from('attendance')
            .select('date, status, subject_id')
            .gte('date', sinceStr)
            .order('date', { ascending: true });
          rows = (records || []).map((r: any) => ({
            date: r.date,
            status: r.status,
            subjectId: r.subject_id || null,
          }));
        }

        // 2. Daily aggregation
        const byDay = new Map<string, { present: number; absent: number; total: number }>();
        for (const r of rows) {
          const d = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
          if (!byDay.has(d)) byDay.set(d, { present: 0, absent: 0, total: 0 });
          const entry = byDay.get(d)!;
          entry.total++;
          if (r.status === 'PRESENT') entry.present++;
          else entry.absent++;
        }
        const daily: DailyStat[] = Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date: date.slice(5), // MM-DD
            present: v.present,
            absent: v.absent,
            total: v.total,
            pct: v.total ? Math.round((v.present / v.total) * 100) : 0,
          }));
        setDailyData(daily);

        // 3. Subject-wise aggregation
        const bySub = new Map<string, { present: number; total: number }>();
        for (const r of rows) {
          const sid = r.subjectId || 'Unknown';
          if (!bySub.has(sid)) bySub.set(sid, { present: 0, total: 0 });
          const entry = bySub.get(sid)!;
          entry.total++;
          if (r.status === 'PRESENT') entry.present++;
        }

        // Resolve subject names
        const subIds = [...bySub.keys()].filter(k => k !== 'Unknown');
        const subNames: Record<string, string> = {};
        if (subIds.length > 0) {
          const { data: courses } = await supabase.from('courses').select('id, name').in('id', subIds);
          if (courses) courses.forEach((c: any) => { subNames[c.id] = c.name; });
        }

        const subjects: SubjectStat[] = Array.from(bySub.entries()).map(([id, v]) => ({
          subject: subNames[id] || id.slice(0, 12),
          attendance: v.total ? Math.round((v.present / v.total) * 100) : 0,
        }));
        setSubjectData(subjects);

        // 4. Summary stats
        const totalPresent = rows.filter(r => r.status === 'PRESENT').length;
        const avgPct = rows.length ? Math.round((totalPresent / rows.length) * 100 * 10) / 10 : 0;
        const uniqueDates = new Set(rows.map(r => r.date));

        // Count students in faculty's classes
        let studentCount = 0;
        if (facultyClassIds.length > 0) {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .in('class_id', facultyClassIds);
          studentCount = count || 0;
        } else {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true });
          studentCount = count || 0;
        }

        setStats({
          avgAttendance: avgPct,
          totalStudents: studentCount || 0,
          totalClasses: uniqueDates.size,
        });
      } catch (err) {
        console.error('Faculty analytics fetch failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div ref={scopeRef} className="space-y-6">
      <div className="cinematic-parallax flex items-center justify-between">
        <div>
          <TextEffect text="Analytics" className="text-2xl font-bold text-white" />
          <p className="text-slate-400">View your class performance analytics</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as '7' | '14' | '30')}>
          <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-white">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpotlightCard className="h-full rounded-xl" spotlightColor="rgba(34,211,238,0.12)">
        <Card className="cinematic-reveal bg-slate-900/50 border-slate-800 h-full">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Attendance</p>
                <p className="text-2xl font-bold text-white">{stats.avgAttendance}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </SpotlightCard>

        <SpotlightCard className="h-full rounded-xl" spotlightColor="rgba(139,92,246,0.12)">
        <Card className="cinematic-reveal bg-slate-900/50 border-slate-800 h-full">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-white">{stats.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </SpotlightCard>

        <SpotlightCard className="h-full rounded-xl" spotlightColor="rgba(16,185,129,0.12)">
        <Card className="cinematic-reveal bg-slate-900/50 border-slate-800 h-full">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Class Days ({range}d)</p>
                <p className="text-2xl font-bold text-white">{stats.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </SpotlightCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="cinematic-reveal bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Daily Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {dailyData.length === 0 ? (
                <p className="text-slate-500 text-center pt-20">No attendance data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="pct" stroke="#06b6d4" strokeWidth={2} name="Attendance %" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="cinematic-reveal bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Subject-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {subjectData.length === 0 ? (
                <p className="text-slate-500 text-center pt-20">No subject data available</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" domain={[0, 100]} />
                    <YAxis dataKey="subject" type="category" stroke="#94a3b8" width={120} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="attendance" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Attendance %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}