import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  BarChart3, Users,
  Download, PieChart, Activity, Target, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetchAllPages';

interface OverviewStat {
  label: string;
  value: string;
}

interface DepartmentData {
  name: string;
  employees: number;
  attendanceRate: number;
}

interface WeeklyTrend {
  day: string;
  present: number;
  absent: number;
}

interface PerformanceMetric {
  label: string;
  value: string;
  icon: typeof Target;
  gradient: string;
}

interface SummaryRow {
  date: string;
  status: string;
  method: string;
  first_name: string | null;
  last_name: string | null;
  enrollment_id: string | null;
  department: string | null;
  class: string | null;
}

const VIEW_NAME = 'company_attendance_summary';
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const rangeStart = (range: string): string => {
  const d = new Date();
  if (range === 'day') d.setDate(d.getDate() - 1);
  else if (range === 'week') d.setDate(d.getDate() - 7);
  else if (range === 'month') d.setDate(d.getDate() - 30);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
};

const displayName = (r: SummaryRow) =>
  `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown';

export default function CompanyAnalytics() {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [overviewStats, setOverviewStats] = useState<OverviewStat[]>([
    { label: 'Total Employees', value: '0' },
    { label: 'Active Today', value: '0' },
    { label: 'Avg Work Hours', value: 'Not available' },
    { label: 'Productivity Score', value: 'Not available' },
  ]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);

  const computeFromRows = useCallback((data: SummaryRow[]) => {
    const today = new Date().toISOString().split('T')[0];
    const distinctTracked = new Set(data.map(r => r.enrollment_id).filter(Boolean)).size;
    const present = data.filter(r => r.status === 'PRESENT').length;
    const absent = data.filter(r => r.status === 'ABSENT').length;
    const late = data.filter(r => r.status === 'LATE').length;
    const presentRate = data.length > 0 ? Math.round((present / data.length) * 100) : 0;

    const todaysPresent = new Set(
      data.filter(r => r.date === today && r.status === 'PRESENT').map(r => r.enrollment_id).filter(Boolean)
    ).size;

    // Not derivable from attendance data — rendered honestly, never invented.
    setOverviewStats([
      { label: 'Total Employees', value: String(distinctTracked) },
      { label: 'Active Today', value: String(todaysPresent) },
      { label: 'Avg Work Hours', value: 'Not available' },
      { label: 'Productivity Score', value: 'Not available' },
    ]);

    // Department-level attendance stats from real rows
    const byDept = new Map<string, { students: Set<string>; total: number; present: number }>();
    for (const r of data) {
      const dept = r.department || 'Unassigned';
      const entry = byDept.get(dept) || { students: new Set<string>(), total: 0, present: 0 };
      if (r.enrollment_id) entry.students.add(r.enrollment_id);
      entry.total += 1;
      if (r.status === 'PRESENT') entry.present += 1;
      byDept.set(dept, entry);
    }
    setDepartmentData(
      Array.from(byDept.entries())
        .map(([name, v]) => ({
          name,
          employees: v.students.size,
          attendanceRate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.employees - a.employees)
    );

    // Weekday distribution across the selected range, ordered Mon..Sun
    const byWeekday = new Map<string, { present: number; absent: number }>();
    for (const r of data) {
      const day = new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
      const entry = byWeekday.get(day) || { present: 0, absent: 0 };
      if (r.status === 'PRESENT') entry.present += 1;
      else if (r.status === 'ABSENT') entry.absent += 1;
      byWeekday.set(day, entry);
    }
    setWeeklyTrend(
      WEEKDAY_ORDER.filter(d => byWeekday.has(d)).map(day => ({ day, ...byWeekday.get(day)! }))
    );

    setPerformanceMetrics([
      { label: 'Attendance Rate', value: data.length ? `${presentRate}%` : 'Not available', icon: Target, gradient: 'from-violet-500 to-purple-500' },
      { label: 'Records Present', value: String(present), icon: Users, gradient: 'from-emerald-500 to-teal-500' },
      { label: 'Records Absent', value: String(absent), icon: Activity, gradient: 'from-amber-500 to-orange-500' },
      { label: 'Records Late', value: String(late), icon: BarChart3, gradient: 'from-pink-500 to-rose-500' },
    ]);
  }, []);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { rows: fetched, truncated: hitCap } = await fetchAllPages<SummaryRow>(
          (from, to) =>
            supabase
              .from(VIEW_NAME)
              .select('date, status, method, first_name, last_name, enrollment_id, department, class')
              .gte('date', rangeStart(timeRange))
              // deterministic order across pages (view has no unique id)
              .order('date', { ascending: true })
              .order('enrollment_id', { ascending: true })
              .order('method', { ascending: true })
              .order('status', { ascending: true })
              .range(from, to)
        );

        setRows(fetched);
        setTruncated(hitCap);
        computeFromRows(fetched);
      } catch (err: any) {
        console.error('Error fetching analytics data:', err);
        const msg: string = err?.message || String(err);
        const missingView = /company_attendance_summary|does not exist|schema cache|42P01/i.test(msg);
        setError(missingView
          ? `The database view "${VIEW_NAME}" is missing. Apply supabase/migrations/016_company_role.sql and reload.`
          : msg || 'Failed to load analytics');
        setRows([]);
        setTruncated(false);
        setOverviewStats([
          { label: 'Total Employees', value: 'Not available' },
          { label: 'Active Today', value: 'Not available' },
          { label: 'Avg Work Hours', value: 'Not available' },
          { label: 'Productivity Score', value: 'Not available' },
        ]);
        setDepartmentData([]);
        setWeeklyTrend([]);
        setPerformanceMetrics([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalyticsData();
  }, [timeRange, computeFromRows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.info('No data to export for this range');
      return;
    }
    const csvContent = [
      ['Date', 'Employee', 'Enrollment ID', 'Department', 'Class', 'Method', 'Status'].join(','),
      ...rows.map(r => [
        r.date,
        displayName(r),
        r.enrollment_id || '-',
        r.department || '-',
        r.class || '-',
        r.method,
        r.status,
      ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics data exported successfully');
  };

  const maxPresent = weeklyTrend.length > 0 ? Math.max(...weeklyTrend.map(d => d.present), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Analytics
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Attendance insights across your organization
          </p>
        </div>
        <div className="flex gap-2">
          {['day', 'week', 'month', 'year'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              onClick={() => setTimeRange(range)}
              className={timeRange === range
                ? (theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary')
                : (theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button')
              }
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
          <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'} onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error State */}
      {!loading && error && (
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
              Could Not Load Analytics
            </h3>
            <p className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Truncation notice — never present capped figures as complete totals */}
      {!loading && !error && truncated && (
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <p className={theme === 'glassmorphism' ? 'text-amber-200/90 text-sm' : 'text-amber-700 text-sm'}>
              Showing the first {rows.length} records — figures may be incomplete
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {overviewStats.map((stat, index) => (
          <Card key={index} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              ) : (
                <>
                  <p className={`text-2xl font-bold ${
                    stat.value === 'Not available'
                      ? (theme === 'glassmorphism' ? 'text-white/40' : 'text-slate-400')
                      : (theme === 'glassmorphism' ? 'text-white' : 'text-slate-800')
                  }`}>
                    {stat.value}
                  </p>
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {stat.label}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                Attendance by Weekday
              </h3>
              <Activity className="w-5 h-5 text-white/50" />
            </div>
            {weeklyTrend.length === 0 ? (
              <p className={`text-sm py-8 text-center ${theme === 'glassmorphism' ? 'text-white/40' : 'text-slate-400'}`}>
                {loading ? 'Loading…' : 'Not available — no attendance records in this range'}
              </p>
            ) : (
              <div className="space-y-4">
                {weeklyTrend.map((day, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className={`w-12 text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      {day.day}
                    </span>
                    <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-end pr-2"
                        style={{ width: `${(day.present / maxPresent) * 100}%` }}
                      >
                        <span className="text-xs font-medium text-white">{day.present}</span>
                      </div>
                    </div>
                    <span className={`w-16 text-sm text-right ${theme === 'glassmorphism' ? 'text-red-400' : 'text-red-500'}`}>
                      {day.absent} absent
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                Department Attendance
              </h3>
              <PieChart className="w-5 h-5 text-white/50" />
            </div>
            {departmentData.length === 0 ? (
              <p className={`text-sm py-8 text-center ${theme === 'glassmorphism' ? 'text-white/40' : 'text-slate-400'}`}>
                {loading ? 'Loading…' : 'Not available — no attendance records in this range'}
              </p>
            ) : (
              <div className="space-y-4">
                {departmentData.map((dept, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                        {dept.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                          {dept.employees} employees
                        </span>
                        <Badge className={dept.attendanceRate >= 90
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : dept.attendanceRate >= 80
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }>
                          {dept.attendanceRate}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dept.attendanceRate >= 90
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : dept.attendanceRate >= 80
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${dept.attendanceRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Attendance Metrics
            </h3>
            <Target className="w-5 h-5 text-white/50" />
          </div>
          {performanceMetrics.length === 0 ? (
            <p className={`text-sm py-6 text-center ${theme === 'glassmorphism' ? 'text-white/40' : 'text-slate-400'}`}>
              {loading ? 'Loading…' : 'Not available — no attendance records in this range'}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {performanceMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div key={index} className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${metric.gradient} flex items-center justify-center`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>{metric.value}</p>
                    <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>{metric.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
