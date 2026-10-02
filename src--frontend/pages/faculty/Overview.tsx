import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Calendar, TrendingUp, Clock, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { timetableService, studentService, attendanceService, leaveService } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import type { TimetableEntry } from '@/lib/database.types';

interface ClassPerformance {
  className: string;
  percentage: number;
}

type FacultyTimetableEntry = TimetableEntry & {
  class?: { id?: string; name?: string; section?: string };
  course?: { id?: string; name?: string; code?: string };
};

export default function FacultyOverview() {
  const { user } = useSupabaseAuth();
  const [stats, setStats] = useState({
    myClasses: 0,
    todaySchedule: 0,
    avgAttendance: 0,
    pendingLeaves: 0,
  });
  const [weeklyData, setWeeklyData] = useState<{ day: string; attendance: number }[]>([]);
  const [classPerformance, setClassPerformance] = useState<ClassPerformance[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<FacultyTimetableEntry[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<{ name: string; enrollmentId: string; className: string; percentage: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<{
    avgStability: number;
    trend: string;
    classRiskScore: number;
    recommendations: string[];
  } | null>(null);

  // ── Live time for NOW detection ──
  const currentTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => todayDate.toISOString().split('T')[0], [todayDate]);
  const todayDow = useMemo(() => todayDate.getDay(), [todayDate]);

  useEffect(() => {
    const load = async () => {
      if (!user?.faculty?.id) return;
      try {
        setLoading(true);

        const timetable = (await timetableService.getForFaculty(user.faculty.id)) as FacultyTimetableEntry[];
        const classIds = Array.from(new Set(timetable.map((t) => t.class_id))).filter(Boolean) as string[];
        const scheduleToday = timetable.filter((t) => t.day_of_week === todayDow);
        setTodaySchedule(scheduleToday);

        let totalAttendancePct = 0;
        let classesWithAttendance = 0;
        let pendingLeaves = 0;
        const perf: ClassPerformance[] = [];

        // Batch: fetch students count, pending leaves, attendance, and weekly summary all in parallel
        const [classDataResults, summaryResult] = await Promise.all([
          Promise.all(
            classIds.map(async (classId) => {
              const [students, todayAttendance] = await Promise.all([
                studentService.getAll({ classId }),
                attendanceService.getForClass(classId, todayIso),
              ]);
              return { classId, students, todayAttendance };
            })
          ),
          attendanceService.getDailySummary(),
        ]);

        // Fetch pending leaves in a single query (instead of per-class)
        const { data: allPendingLeaves } = await supabase
          .from('leave_requests')
          .select('student_id')
          .eq('status', 'PENDING');

        // Get all student IDs for faculty's classes to filter leaves
        const allStudentIds = new Set(
          classDataResults.flatMap((r) => r.students.map((s) => s.id))
        );
        pendingLeaves = (allPendingLeaves || []).filter(
          (l: { student_id: string }) => allStudentIds.has(l.student_id)
        ).length;

        for (const { classId, students, todayAttendance } of classDataResults) {
          const present = todayAttendance.filter((r) => r.status === 'PRESENT').length;
          const total = todayAttendance.length || students.length;
          const percentage = total ? Math.round((present / total) * 100) : 0;
          if (total > 0) {
            totalAttendancePct += percentage;
            classesWithAttendance++;
          }
          const className = timetable.find((t) => t.class_id === classId)?.class?.name || 'Class';
          perf.push({ className, percentage });
        }

        setStats({
          myClasses: classIds.length,
          todaySchedule: scheduleToday.length,
          avgAttendance: classesWithAttendance > 0 ? Math.round(totalAttendancePct / classesWithAttendance) : 0,
          pendingLeaves,
        });
        setClassPerformance(perf);

        // ── At-risk students (<75% attendance) ──
        try {
          const allStudents = classDataResults.flatMap(r => r.students);
          const riskStudents: typeof atRiskStudents = [];
          for (const student of allStudents.slice(0, 50)) {
            try {
              const stats = await attendanceService.getStatistics(student.id);
              if (stats.percentage < 75 && stats.percentage > 0) {
                const className = timetable.find(t => t.class_id === student.class_id)?.class?.name || 'Class';
                riskStudents.push({
                  name: (student as any).first_name || (student as any).profile?.first_name || student.enrollment_id || 'Student',
                  enrollmentId: student.enrollment_id || '',
                  className,
                  percentage: stats.percentage,
                });
              }
            } catch { /* skip */ }
          }
          setAtRiskStudents(riskStudents.sort((a, b) => a.percentage - b.percentage).slice(0, 10));
        } catch { /* at-risk fetch failure is non-critical */ }

        const lastSeven = (summaryResult || []).slice(0, 7).reverse();
        setWeeklyData(
          lastSeven.map((day) => {
            const date = new Date(day.date as string);
            const label = date.toLocaleDateString('en-US', { weekday: 'short' });
            const total =
              (day.total_records as number) ||
              ((day.present as number) || 0) + ((day.absent as number) || 0) + ((day.late as number) || 0) ||
              0;
            const pct = total ? Math.round((((day.present as number) || 0) / total) * 100) : 0;
            return { day: label, attendance: pct };
          })
        );
        // ── Bio-Net v4 AI Class Insights ──
        try {
          const { analyticsService } = await import('@/lib/api');
          const deptId = (user.faculty as any).department_id;
          if (deptId) {
            const predictions = await analyticsService.getDepartmentAnalytics(deptId);
            if (predictions) {
              setAiInsights({
                avgStability: Math.round(predictions.averageAttendance || 0),
                trend: predictions.averageAttendance > 75 ? 'IMPROVING' : 'STABLE',
                classRiskScore: predictions.atRiskStudents?.length * 5 || 0,
                recommendations: [
                  `Monitor ${predictions.atRiskStudents?.length || 0} students below 60%`,
                  `Department average is at ${Math.round(predictions.averageAttendance || 0)}%`,
                  'Schedule periodic reviews for attendance anomalies'
                ]
              });
            }
          }
        } catch (e) {
          console.warn("AI Class Insights unavailable:", e);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [todayDow, todayIso, user?.faculty?.id]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-8 shadow-[0_25px_80px_rgba(0,0,0,0.5)] group">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/10 opacity-50" />
        <div className="absolute top-0 right-0 p-8 flex gap-3">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
           <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none drop-shadow-2xl">
              Faculty <span className="text-emerald-400">Overview</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Your classes at a glance</p>
          </div>
          <div className="flex gap-4">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-2 font-black text-[10px] tracking-widest uppercase rounded-full">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-premium border-white/5 rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white italic tracking-tighter">{loading ? '—' : atRiskStudents.length}</p>
                <p className="text-[10px] text-slate-400 font-bold">At-Risk Students</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center group-hover:border-cyan-500/30 transition-all">
                <Users className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium border-white/5 rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white italic tracking-tighter">{loading ? '—' : stats.todaySchedule}</p>
                <p className="text-[10px] text-slate-400 font-bold">Sessions Scheduled Today</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-violet-500/5 border border-violet-500/10 flex items-center justify-center group-hover:border-violet-500/30 transition-all">
                <Calendar className="w-8 h-8 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium border-white/5 rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white italic tracking-tighter">{loading ? '—' : `${stats.avgAttendance}%`}</p>
                <p className="text-[10px] text-slate-400 font-bold">Average Attendance</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center group-hover:border-emerald-500/30 transition-all">
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium border-amber-500/10 rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white italic tracking-tighter">{loading ? '—' : stats.pendingLeaves}</p>
                <p className="text-[10px] text-slate-400 font-bold">Pending Leave Requests</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center group-hover:border-amber-500/30 transition-all">
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bio-Net v4 AI Insights */}
      {!loading && aiInsights && (
        <Card className="relative overflow-hidden border-cyan-500/20 bg-slate-900/40 rounded-3xl group">
          <div className="absolute top-0 right-0 p-6">
            <div className="flex gap-1">
              {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-cyan-500/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
            </div>
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 rounded-lg bg-cyan-500/20">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              Bio-Net v4 AI Class Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Department Stability</span>
                    <span className="text-sm font-bold text-cyan-300">{aiInsights.avgStability}%</span>
                  </div>
                  <Progress value={aiInsights.avgStability} className="h-1.5 bg-slate-800" />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collective Anomaly Score</span>
                    <span className="text-sm font-bold text-rose-400">{aiInsights.classRiskScore}/100</span>
                  </div>
                  <Progress value={100 - aiInsights.classRiskScore} className="h-1.5 bg-slate-800" />
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Operational Trend</span>
                <span className={`text-2xl font-black italic ${aiInsights.trend === 'IMPROVING' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {aiInsights.trend}
                </span>
                <span className="text-[9px] text-slate-400 mt-2 text-center leading-tight">Vercel Edge-AI Synchronization Active</span>
              </div>

              <div className="space-y-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI Strategies</span>
                 <div className="space-y-1.5">
                   {aiInsights.recommendations.map((rec, i) => (
                     <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300 leading-snug">
                       <CheckCircle className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                       {rec}
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-white">Weekly Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Line type="monotone" dataKey="attendance" stroke="#06b6d4" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-white">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading schedule...</p>
            ) : todaySchedule.length === 0 ? (
              <p className="text-slate-400 text-sm">No classes scheduled for today.</p>
            ) : (
              <div className="space-y-3">
                {todaySchedule.map((slot) => {
                  const st = slot.start_time || '';
                  const et = slot.end_time || '';
                  const isNow = st <= currentTime && et > currentTime;
                  const isDone = et <= currentTime;
                  return (
                    <div key={slot.id} className={`flex items-center gap-4 p-3 rounded-lg ${isNow ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-slate-800/50'}`}>
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isNow ? 'bg-cyan-500/20' : 'bg-slate-700'}`}>
                        <Clock className={`w-5 h-5 ${isNow ? 'text-cyan-300 animate-pulse' : 'text-slate-300'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{slot.course?.name || 'Subject'}</p>
                        <p className="text-sm text-slate-400">{slot.class?.name || 'Class'} • Room {slot.room || '—'}</p>
                      </div>
                      {isNow ? (
                        <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30 animate-pulse">NOW</Badge>
                      ) : isDone ? (
                        <Badge variant="outline" className="text-slate-500 border-slate-700">Done</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-300 border-emerald-500/30">
                          {st} - {et}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Students (<75%) */}
      {!loading && atRiskStudents.length > 0 && (
        <Card className="bg-slate-950/70 border border-red-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              At-Risk Students (below 75% attendance)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRiskStudents.map((s, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.percentage < 50 ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                    <AlertTriangle className={`w-5 h-5 ${s.percentage < 50 ? 'text-red-400' : 'text-amber-400'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.enrollmentId} • {s.className}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${s.percentage < 50 ? 'text-red-400' : 'text-amber-400'}`}>{s.percentage}%</p>
                    <p className="text-xs text-slate-500">Attendance</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <CardHeader>
          <CardTitle className="text-white">Class Performance (today)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading performance...</p>
          ) : classPerformance.length === 0 ? (
            <p className="text-slate-400 text-sm">No classes assigned.</p>
          ) : (
            <div className="space-y-4">
              {classPerformance.map((cls) => (
                <div key={cls.className}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">{cls.className}</span>
                    <span className={`text-sm ${cls.percentage >= 75 ? 'text-emerald-400' : cls.percentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {cls.percentage}%
                    </span>
                  </div>
                  <Progress value={cls.percentage} className="h-2 bg-slate-800" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
