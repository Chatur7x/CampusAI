import { useState } from 'react';
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


const weeklyData = [
  { day: 'Mon', attendance: 92 },
  { day: 'Tue', attendance: 88 },
  { day: 'Wed', attendance: 95 },
  { day: 'Thu', attendance: 90 },
  { day: 'Fri', attendance: 87 },
];

export default function FacultyOverview() {
  const [stats] = useState({
    myClasses: 4,
    todaySchedule: 3,
    totalStudents: 120,
    pendingLeaves: 5,
  });

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
                <p className="text-2xl font-bold text-white">{stats.myClasses}</p>
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
                <p className="text-2xl font-bold text-white">{stats.todaySchedule}</p>
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
                <p className="text-2xl font-bold text-white">{stats.totalStudents}</p>
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
                <p className="text-2xl font-bold text-white">{stats.pendingLeaves}</p>
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
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Data Structures</p>
                  <p className="text-sm text-slate-400">CSE-A • Room 301</p>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-400">9:00 AM</Badge>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Algorithms</p>
                  <p className="text-sm text-slate-400">CSE-B • Room 302</p>
                </div>
                <Badge variant="outline" className="text-slate-400">11:00 AM</Badge>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Database Systems</p>
                  <p className="text-sm text-slate-400">CSE-C • Room 303</p>
                </div>
                <Badge variant="outline" className="text-slate-400">2:00 PM</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <CardHeader>
          <CardTitle className="text-white">Class Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">CSE-A (Data Structures)</span>
                <span className="text-sm text-emerald-400">92%</span>
              </div>
              <Progress value={92} className="h-2 bg-slate-800" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">CSE-B (Algorithms)</span>
                <span className="text-sm text-emerald-400">88%</span>
              </div>
              <Progress value={88} className="h-2 bg-slate-800" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">CSE-C (Database Systems)</span>
                <span className="text-sm text-amber-400">85%</span>
              </div>
              <Progress value={85} className="h-2 bg-slate-800" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">IT-A (Web Development)</span>
                <span className="text-sm text-emerald-400">90%</span>
              </div>
              <Progress value={90} className="h-2 bg-slate-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}