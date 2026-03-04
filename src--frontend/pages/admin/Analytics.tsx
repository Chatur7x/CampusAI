import { useEffect, useMemo, useState } from 'react';
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
import { analyticsService } from '@/lib/api';
import { toast } from 'sonner';

type TrendPoint = { date: string; attendance_percentage: number };
type DepartmentPoint = { department_name: string; average_attendance: number };
type AdminDashboardSummary = {
  average_attendance_percentage?: number;
  total_students?: number;
  classes_today?: number;
  leaves_pending?: number;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null);
  const [daily, setDaily] = useState<TrendPoint[]>([]);
  const [department, setDepartment] = useState<DepartmentPoint[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [dash, dailySummary, deptSummary] = await Promise.all([
          analyticsService.getAdminDashboard(),
          analyticsService.getDailyAttendanceSummary(),
          analyticsService.getDepartmentSummary(),
        ]);
        setDashboard(dash ?? {});
        setDaily((dailySummary ?? []).map((d: { date: string; average_attendance?: number }) => ({
          date: d.date,
          attendance_percentage: Number(d.average_attendance ?? 0),
        })));
        setDepartment((deptSummary ?? []).map((d: { department_name?: string; department_code?: string; average_attendance?: number }) => ({
          department_name: d.department_name ?? d.department_code ?? 'Dept',
          average_attendance: Number(d.average_attendance ?? 0),
        })));
      } catch (err) {
        console.error(err);
        setError('Failed to load analytics');
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = useMemo(() => ([
    {
      label: 'Avg Attendance',
      value: dashboard?.average_attendance_percentage ? `${dashboard.average_attendance_percentage.toFixed(1)}%` : '--',
      icon: TrendingUp,
      bg: 'bg-violet-500/10',
      color: 'text-violet-400',
    },
    {
      label: 'Active Students',
      value: dashboard?.total_students ?? '--',
      icon: Users,
      bg: 'bg-emerald-500/10',
      color: 'text-emerald-400',
    },
    {
      label: 'Classes Today',
      value: dashboard?.classes_today ?? '--',
      icon: Calendar,
      bg: 'bg-amber-500/10',
      color: 'text-amber-400',
    },
    {
      label: 'Leaves Pending',
      value: dashboard?.leaves_pending ?? '--',
      icon: BarChart3,
      bg: 'bg-cyan-500/10',
      color: 'text-cyan-400',
    },
  ]), [dashboard]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <p className="text-slate-400">Comprehensive attendance analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p className="text-2xl font-bold text-white">{loading ? '…' : card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="attendance_percentage" stroke="#8b5cf6" strokeWidth={2} />
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
                <BarChart data={department}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="department_name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="average_attendance" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
    </div>
  );
}