import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
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
    totalStudents: 0,
    pendingLeaves: 0,
  });
  const [weeklyData, setWeeklyData] = useState<{ day: string; attendance: number }[]>([]);
  const [classPerformance, setClassPerformance] = useState<ClassPerformance[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<FacultyTimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

        let totalStudents = 0;
        let pendingLeaves = 0;
        const perf: ClassPerformance[] = [];

        await Promise.all(
          classIds.map(async (classId) => {
            const [students, todayAttendance, pending] = await Promise.all([
              studentService.getAll({ classId }),
              attendanceService.getForClass(classId, todayIso),
              leaveService.getPending({ classId }),
            ]);
            totalStudents += students.length;
            pendingLeaves += pending?.length || 0;

            const present = todayAttendance.filter((r) => r.status === 'PRESENT').length;
            const total = todayAttendance.length || students.length;
            const percentage = total ? Math.round((present / total) * 100) : 0;
            const className = timetable.find((t) => t.class_id === classId)?.class?.name || 'Class';
            perf.push({ className, percentage });
          })
        );

        setStats({
          myClasses: classIds.length,
          todaySchedule: scheduleToday.length,
          totalStudents,
          pendingLeaves,
        });
        setClassPerformance(perf);

        const summary = await attendanceService.getDailySummary();
        const lastSeven = (summary || []).slice(0, 7).reverse();
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [todayDow, todayIso, user?.faculty?.id]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-cyan-900/30 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.1),transparent_35%)]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-3xl font-semibold text-white">Faculty Portal</h1>
            <p className="text-slate-300">Live classes, attendance, and alerts.</p>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">Smart routing</Badge>
          <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-500/30">Realtime sync</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">My Classes</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : stats.myClasses}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Today's Schedule</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : stats.todaySchedule}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : stats.totalStudents}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-amber-400/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Pending Leaves</p>
                <p className="text-2xl font-bold text-white">{loading ? '—' : stats.pendingLeaves}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                {todaySchedule.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                    <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{slot.course?.name || 'Subject'}</p>
                      <p className="text-sm text-slate-400">{slot.class?.name || 'Class'} • Room {slot.room || '—'}</p>
                    </div>
                    <Badge variant="outline" className="text-slate-300">
                      {slot.start_time} - {slot.end_time}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
