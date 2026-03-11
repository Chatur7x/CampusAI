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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [subjectStats, setSubjectStats] = useState<
    { name: string; present: number; total: number; pct: number }[]
  >([]);

  // ── Live time for NOW detection ──
  const currentTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

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
            .from("attendance")
            .select("date, status, subject_id")
            .eq("student_id", studentId)
            .gte("date", sixMonthsAgo.toISOString().slice(0, 10))
            .order("date", { ascending: true }),
          // 2. Today's timetable (try timetable_entries with snake_case)
          classId
            ? supabase
                .from("timetable_entries")
                .select("subject_id, start_time, end_time")
                .eq("class_id", classId)
                .eq("day_of_week", todayDay)
            : Promise.resolve({ data: null, error: null }),
          // 3. Recent notices
          supabase
            .from("notices")
            .select("id, title, content, priority, created_at")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        const attData = attResult.data;
        const scheduleRows = (ttResult.data || []).map((r: any) => ({
          subjectId: r.subject_id,
          startTime: r.start_time,
          endTime: r.end_time,
        }));

        // Resolve subject names (depends on timetable result)
        const subjectIds = [
          ...new Set(scheduleRows.map((r: any) => r.subjectId).filter(Boolean)),
        ];
        let subjectMap: Record<string, string> = {};
        if (subjectIds.length) {
          const { data: subs } = await supabase
            .from("courses")
            .select("id, name")
            .in("id", subjectIds);
          subjectMap = Object.fromEntries(
            (subs || []).map((s: any) => [s.id, s.name]),
          );
        }

        const todaySchedule: TodayClass[] = scheduleRows.map((r: any) => ({
          subject: subjectMap[r.subjectId] || "Unknown Subject",
          startTime: r.startTime || "",
          endTime: r.endTime || "",
        }));

        const noticeData = noticeResult.data;

        if (!cancelled) {
          setRecords(attData || []);
          setTodayClasses(todaySchedule);
          setNotices(noticeData || []);

          // ── Per-subject attendance breakdown ──
          const bySubject = new Map<
            string,
            { present: number; total: number }
          >();
          for (const r of attData || []) {
            const sid = (r as any).subject_id || (r as any).subjectId || "unknown";
            if (!bySubject.has(sid))
              bySubject.set(sid, { present: 0, total: 0 });
            const entry = bySubject.get(sid)!;
            entry.total++;
            if (r.status === "PRESENT") entry.present++;
          }
          // Resolve subject names
          const allSubjectIds = [...bySubject.keys()].filter(
            (k) => k !== "unknown",
          );
          let nameMap: Record<string, string> = { ...subjectMap };
          if (allSubjectIds.length > 0) {
            const { data: moreSubs } = await supabase
              .from("courses")
              .select("id, name")
              .in("id", allSubjectIds);
            for (const s of moreSubs || []) nameMap[s.id] = s.name;
          }
          setSubjectStats(
            Array.from(bySubject.entries())
              .map(([sid, val]) => ({
                name: nameMap[sid] || sid,
                present: val.present,
                total: val.total,
                pct:
                  val.total > 0
                    ? Math.round((val.present / val.total) * 100)
                    : 0,
              }))
              .sort((a, b) => a.pct - b.pct),
          );

          // ── In-app toast: class starting in ~10 min ──
          const nowTime = new Date();
          const nowMins = nowTime.getHours() * 60 + nowTime.getMinutes();
          for (const cls of todaySchedule) {
            const [h, m] = cls.startTime.split(":").map(Number);
            const clsMins = h * 60 + m;
            const diff = clsMins - nowMins;
            if (diff > 0 && diff <= 10) {
              toast.info(
                `Class starting soon: ${cls.subject} at ${cls.startTime}`,
                {
                  duration: 8000,
                  icon: "🔔",
                },
              );
            }
          }
        }
      } catch (err) {
        console.error("Overview fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
      }, (payload) => {
        const newNotice = payload.new as NoticeItem;
        setNotices(prev => [newNotice, ...prev.slice(0, 2)]);
        toast.info(`New Notice: ${newNotice.title}`, {
          description: newNotice.content.substring(0, 100) + '...',
          icon: <Bell className="w-4 h-4 text-emerald-400" />,
          duration: 6000,
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Compute attendance stats from real data
  const attendance = useMemo(() => {
    const present = records.filter((r) => r.status === "PRESENT").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const total = records.length;
    const percentage =
      total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    const riskLevel =
      percentage >= 85 ? "LOW" : percentage >= 75 ? "MEDIUM" : "HIGH";
    const safeAbsenceMargin = Math.max(0, Math.floor(total * 0.25) - absent);
    return {
      percentage,
      present,
      absent,
      late,
      total,
      riskLevel,
      safeAbsenceMargin,
    };
  }, [records]);

  // Monthly trend from real records
  const monthlyData = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const byMonth = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, { present: 0, total: 0 });
      const entry = byMonth.get(key)!;
      entry.total++;
      if (r.status === "PRESENT") entry.present++;
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: months[parseInt(key.split("-")[1])],
        attendance:
          val.total > 0 ? Math.round((val.present / val.total) * 100) : 0,
      }));
  }, [records]);

  const attendanceColor =
    attendance.percentage >= 75
      ? "#22c55e"
      : attendance.percentage >= 60
        ? "#f59e0b"
        : "#ef4444";

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
              Neural <span className="text-emerald-400">Terminal</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Personal Academic Integrity Dashboard</p>
          </div>
          <div className="flex gap-4">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-2 font-black text-[10px] tracking-widest uppercase rounded-full">Entity Status: Student</Badge>
            <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-6 py-2 font-black text-[10px] tracking-widest uppercase rounded-full">Secure Sync: Online</Badge>
          </div>
        </div>
      </div>
      
      {/* Attendance Risk Alert */}
      {!loading && attendance.percentage < 75 && (
        <Card className="bg-red-500/10 border-red-500/20 shadow-lg rounded-3xl animate-in fade-in slide-in-from-top-4 duration-1000">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-xl font-bold text-red-200">Attendance Risk Warning</h3>
                <p className="text-red-100/70 text-sm">
                  Your attendance has dropped to <span className="font-bold text-red-300">{attendance.percentage}%</span>. 
                  You are below the mandatory 75% threshold.
                </p>
                <div className="pt-2">
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-red-300 hover:text-red-200 flex items-center gap-1 font-semibold"
                    onClick={() => navigate('/student/calculator')}
                  >
                    Use Calculator to fix <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="group cursor-pointer bg-slate-900/40 border-slate-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all rounded-3xl overflow-hidden shadow-xl"
          onClick={() => navigate('/student/live-attendance')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Mark Attendance</h3>
                  <p className="text-slate-400 text-sm">Scan QR or enter 6-digit code</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="group cursor-pointer bg-slate-900/40 border-slate-800/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all rounded-3xl overflow-hidden shadow-xl"
          onClick={() => navigate('/student/calculator')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Attendance Margin</h3>
                  <p className="text-slate-400 text-sm">Calculate classes for 75% target</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Attendance Card */}
      <Card className="bg-slate-950/70 border border-emerald-500/15 shadow-[0_30px_80px_rgba(0,0,0,0.5)] rounded-3xl">
        <CardContent className="p-7 md:p-9">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40">
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-3xl" />
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 140 140"
                >
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    stroke="#0f172a"
                    strokeWidth="12"
                    fill="none"
                  />
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
                  <span className="text-5xl font-bold text-white leading-none">
                    {attendance.percentage}%
                  </span>
                  <span className="text-xs text-slate-300 mt-1">
                    Overall attendance
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Live status
                </h3>
                <p className="text-slate-300 text-sm">
                  {attendance.present} Present • {attendance.absent} Absent •{" "}
                  {attendance.late} Late
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/25 text-emerald-200 text-xs font-semibold">
                  {attendance.riskLevel} RISK
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 text-right">
              <div className="text-left md:text-right space-y-1">
                <p className="text-sm text-slate-400">Total tracked</p>
                <p className="text-3xl font-bold text-emerald-300">
                  {attendance.total} classes
                </p>
                <p className="text-xs text-slate-400">
                  Updated live by faculty
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/30 transition-all cursor-default group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <CheckCircle className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Present</p>
                <p className="text-xl font-bold text-white">
                  {attendance.present}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 hover:border-red-500/30 transition-all cursor-default group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <AlertCircle className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Absent</p>
                <p className="text-xl font-bold text-white">
                  {attendance.absent}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 hover:border-amber-500/30 transition-all cursor-default group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <Clock className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Late</p>
                <p className="text-xl font-bold text-white">
                  {attendance.late}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 hover:border-violet-500/30 transition-all cursor-default group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                <GraduationCap className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Classes</p>
                <p className="text-xl font-bold text-white">
                  {attendance.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">
              Monthly Attendance Trend
            </CardTitle>
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
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="attendance"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
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
              <p className="text-slate-400 text-sm text-center py-8">
                No classes scheduled today.
              </p>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((cls, i) => {
                  const isNow =
                    cls.startTime <= currentTime && cls.endTime > currentTime;
                  const isDone = cls.endTime <= currentTime;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${isNow ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/50 border-slate-700/50"}`}
                    >
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${isNow ? "bg-emerald-500/20" : "bg-emerald-500/10"}`}
                      >
                        <Clock
                          className={`w-5 h-5 ${isNow ? "text-emerald-300 animate-pulse" : "text-emerald-400"}`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{cls.subject}</p>
                        <p className="text-sm text-slate-400">
                          {cls.startTime} - {cls.endTime}
                        </p>
                      </div>
                      {isNow ? (
                        <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 animate-pulse">
                          NOW
                        </Badge>
                      ) : isDone ? (
                        <Badge
                          variant="outline"
                          className="text-slate-500 border-slate-700"
                        >
                          Done
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-emerald-300 border-emerald-500/30"
                        >
                          Upcoming
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

      {/* Per-Subject Attendance */}
      {!loading && subjectStats.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Per-Subject Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjectStats.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">{s.name}</span>
                    <span
                      className={`text-sm font-semibold ${s.pct >= 75 ? "text-emerald-400" : s.pct >= 60 ? "text-amber-400" : "text-red-400"}`}
                    >
                      {s.pct}% ({s.present}/{s.total})
                    </span>
                  </div>
                  <Progress value={s.pct} className="h-2 bg-slate-800" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <p className="text-slate-400 text-sm text-center py-6">
              No recent notices.
            </p>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div key={notice.id} className="p-3 rounded-lg bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{notice.title}</p>
                    <Badge
                      className={
                        notice.priority === "HIGH"
                          ? "bg-red-500/20 text-red-400"
                          : notice.priority === "MEDIUM"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-500/20 text-slate-400"
                      }
                    >
                      {notice.priority || "LOW"}
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
