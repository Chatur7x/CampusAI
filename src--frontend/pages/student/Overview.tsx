import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, AlertCircle, CheckCircle, Clock, Bell } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';


const monthlyData = [
  { month: 'Jan', attendance: 85 },
  { month: 'Feb', attendance: 88 },
  { month: 'Mar', attendance: 92 },
  { month: 'Apr', attendance: 90 },
  { month: 'May', attendance: 87 },
  { month: 'Jun', attendance: 89 },
];

export default function StudentOverview() {
  const [attendance] = useState({
    percentage: 87.5,
    present: 42,
    absent: 4,
    late: 2,
    total: 48,
    riskLevel: 'LOW',
    safeAbsenceMargin: 3,
  });

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
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Data Structures</p>
                  <p className="text-sm text-slate-400">9:00 AM - 10:30 AM</p>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400">Present</Badge>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Algorithms</p>
                  <p className="text-sm text-slate-400">11:00 AM - 12:30 PM</p>
                </div>
                <Badge variant="outline" className="text-slate-400">Upcoming</Badge>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Database Systems</p>
                  <p className="text-sm text-slate-400">2:00 PM - 3:30 PM</p>
                </div>
                <Badge variant="outline" className="text-slate-400">Upcoming</Badge>
              </div>
            </div>
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
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/30">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">Mid-term Examination Schedule</p>
                <Badge className="bg-red-500/20 text-red-400">HIGH</Badge>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Mid-term exams will commence from March 15th. Check your schedule.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">Library Hours Extended</p>
                <Badge className="bg-amber-500/20 text-amber-400">MEDIUM</Badge>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Library will now be open until 10 PM on weekdays.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}