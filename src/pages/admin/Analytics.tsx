import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, Calendar } from 'lucide-react';
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
} from 'recharts';

const trendData = [
  { month: 'Jan', attendance: 85 },
  { month: 'Feb', attendance: 88 },
  { month: 'Mar', attendance: 82 },
  { month: 'Apr', attendance: 90 },
  { month: 'May', attendance: 87 },
  { month: 'Jun', attendance: 92 },
];

const departmentData = [
  { name: 'CSE', attendance: 92 },
  { name: 'ECE', attendance: 88 },
  { name: 'MECH', attendance: 85 },
  { name: 'CIVIL', attendance: 87 },
  { name: 'IT', attendance: 90 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <p className="text-slate-400">Comprehensive attendance analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Attendance</p>
                <p className="text-2xl font-bold text-white">87.5%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active Students</p>
                <p className="text-2xl font-bold text-white">2,847</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Classes Today</p>
                <p className="text-2xl font-bold text-white">48</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Data Points</p>
                <p className="text-2xl font-bold text-white">12.5K</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
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
                  <Line type="monotone" dataKey="attendance" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Department-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="attendance" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}