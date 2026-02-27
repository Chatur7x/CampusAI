import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Clock,
  Bell,
} from 'lucide-react';
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
      <div>
        <h1 className="text-2xl font-bold text-white">Student Dashboard</h1>
        <p className="text-slate-400">Welcome back! Here's your attendance overview.</p>
      </div>

      {/* Main Attendance Card */}
      <Card className="bg-slate-900/60 border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" stroke="#1e293b" strokeWidth="10" fill="none" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke={attendanceColor}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${attendance.percentage * 3.26} 326`}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-4xl font-bold text-white leading-none">{attendance.percentage}%</span>
                  <span className="text-xs text-slate-400 mt-1">Your Attendance</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Live status</h3>
                <p className="text-slate-400 text-sm">
                  {attendance.present} Present • {attendance.absent} Absent • {attendance.late} Late
                </p>
                <Badge className={`mt-2 ${attendance.percentage >= 75 ? 'bg-emerald-500/20 text-emerald-300' : attendance.percentage >= 60 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                  {attendance.riskLevel} RISK
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 text-right">
              <div>
                <p className="text-sm text-slate-400">Safe Absence Margin</p>
                <p className="text-3xl font-bold text-emerald-400">{attendance.safeAbsenceMargin} days</p>
              </div>
              <p className="text-xs text-slate-500">You can miss {attendance.safeAbsenceMargin} more classes before dropping below 75%.</p>
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