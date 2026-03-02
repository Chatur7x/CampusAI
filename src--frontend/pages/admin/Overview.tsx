import { useEffect, useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  GraduationCap,
  Building2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Link2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  BarChart3,
} from 'lucide-react';
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
import { toast } from 'sonner';
import { analyticsService, securityService } from '@/lib/api';
import supabase from '@/lib/supabase';

interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalDepartments: number;
  todayAttendance: number;
  recentAlerts: number;
  pendingLeaves: number;
}

interface MonthlyTrend {
  month: string;
  percentage: number;
}

interface DepartmentStat {
  departmentId: string;
  departmentName: string;
  studentCount: number;
  attendancePercentage: number;
}

type SecurityAlert = {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  created_at: string;
  resolved?: boolean;
};

// Premium Skeleton Loader
const DashboardSkeleton = memo(() => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="rounded-3xl border border-slate-800/50 bg-slate-900/60 p-6 h-32">
      <div className="h-8 w-48 bg-slate-800/70 rounded-lg" />
      <div className="h-4 w-72 bg-slate-800/50 rounded mt-3" />
    </div>
    
    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-slate-950/70 border border-slate-800/50 rounded-3xl p-6">
          <div className="h-4 w-24 bg-slate-800/70 rounded mb-3" />
          <div className="h-8 w-16 bg-slate-800/70 rounded mb-3" />
          <div className="h-3 w-32 bg-slate-800/50 rounded" />
        </div>
      ))}
    </div>
  </div>
));

// Memoized Stat Card Component
const StatCard = memo(({ stat, index }: { stat: any; index: number }) => {
  const Icon = stat.icon;
  return (
    <Card 
      className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] group"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">{stat.title}</p>
            <p className="text-3xl font-bold text-white mt-1 tabular-nums">{stat.value}</p>
            <div className="flex items-center gap-1 mt-2">
              {stat.trendUp ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-semibold ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.trend}
              </span>
              <span className="text-xs text-slate-500">vs last month</span>
            </div>
          </div>
          <div className={`w-14 h-14 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`w-7 h-7 ${stat.color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [chainSummary, setChainSummary] = useState({ integrityScore: 0, validChains: 0, invalidChains: 0, total: 0, lastAuditAt: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
      try {
        const [dashboard, deptSummary, securityAlerts, audit] = await Promise.all([
          analyticsService.getAdminDashboard(),
          analyticsService.getDepartmentSummary(),
          securityService.getAlerts(false),
          supabase.functions.invoke('analytics', { body: { reportType: 'blockchain_audit' } }),
        ]);

        if (!isMounted) return;

        if (dashboard) {
          setStats((dashboard as any).stats ?? (dashboard as any));
          setMonthlyTrend((dashboard as any).monthlyTrend ?? []);
          setDepartmentStats((dashboard as any).departmentStats ?? []);
        }

        if (deptSummary && deptSummary.length) {
          setDepartmentStats(deptSummary as any);
        }

        if (securityAlerts) {
          setAlerts(securityAlerts.slice(0, 5) as SecurityAlert[]);
        }

        const summary = (audit?.data as any)?.data?.summary;
        if (summary) {
          const integrity = parseFloat(String(summary.integrityScore || '0').replace('%', ''));
          setChainSummary({
            integrityScore: Number.isFinite(integrity) ? integrity : 0,
            validChains: summary.validChains || 0,
            invalidChains: summary.invalidChains || 0,
            total: summary.totalStudentsAudited || 0,
            lastAuditAt: summary.lastAuditAt || '',
          });
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboardData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Memoized stat cards to prevent recalculation
  const statCards = useMemo(() => [
    {
      title: 'Total Students',
      value: stats?.totalStudents || 0,
      icon: GraduationCap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Total Faculty',
      value: stats?.totalFaculty || 0,
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      trend: '+5%',
      trendUp: true,
    },
    {
      title: 'Departments',
      value: stats?.totalDepartments || 0,
      icon: Building2,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      trend: '0%',
      trendUp: true,
    },
    {
      title: "Today's Attendance",
      value: `${stats?.todayAttendance || 0}%`,
      icon: TrendingUp,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      trend: '-2%',
      trendUp: false,
    },
  ], [stats]);

  const quickActions = useMemo(() => [
    { label: 'Add Student', icon: Plus, href: '/admin/students', color: 'text-emerald-400' },
    { label: 'Add Faculty', icon: Plus, href: '/admin/faculty', color: 'text-cyan-400' },
    { label: 'Create Department', icon: Plus, href: '/admin/departments', color: 'text-violet-400' },
    { label: 'Post Notice', icon: FileText, href: '/admin/notices', color: 'text-amber-400' },
  ], []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Optimized Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-slate-900 via-slate-900/60 to-violet-900/30 p-8 shadow-2xl">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.1),transparent_40%)]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/5 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-emerald-200 to-violet-200 bg-clip-text text-transparent">
              Admin Portal
            </h1>
            <p className="text-slate-300 text-lg">Live campus control: students, faculty, security.</p>
          </div>
          <Badge variant="outline" className="bg-violet-500/10 text-violet-200 border-violet-500/30 px-4 py-2 text-sm w-fit">
            <Link2 className="w-4 h-4 mr-2" />
            Blockchain Verified
          </Badge>
        </div>
      </div>

      {/* Optimized Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <StatCard key={index} stat={stat} index={index} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/50">
          <CardTitle className="text-white text-xl font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center gap-3 border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-200 hover:scale-105 group"
                  asChild
                >
                  <a href={action.href}>
                    <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center group-hover:bg-slate-700/50 transition-colors">
                      <Icon className={`w-6 h-6 ${action.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <span className="text-sm text-slate-300 font-medium">{action.label}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Attendance Trend */}
        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="text-white text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              Monthly Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#a78bfa' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department-wise Attendance */}
        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="text-white text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Department-wise Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
                  <XAxis dataKey="departmentName" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Bar dataKey="attendancePercentage" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Blockchain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Alerts */}
        <Card className="bg-slate-950/70 border border-red-500/15 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50">
            <CardTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-lg font-semibold">Security Alerts</span>
            </CardTitle>
            <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30 px-3 py-1">
              {stats?.recentAlerts || 0} New
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {alerts.length === 0 && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-sm text-slate-400">
                  No active security alerts.
                </div>
              )}
              {alerts.map((alert) => {
                const colorMap: Record<string, string> = {
                  LOW: 'bg-emerald-500/10 border-emerald-500/20',
                  MEDIUM: 'bg-amber-500/10 border-amber-500/20',
                  HIGH: 'bg-orange-500/10 border-orange-500/20',
                  CRITICAL: 'bg-red-500/10 border-red-500/25',
                };
                const dotMap: Record<string, string> = {
                  LOW: 'bg-emerald-400',
                  MEDIUM: 'bg-amber-400',
                  HIGH: 'bg-orange-400',
                  CRITICAL: 'bg-red-500',
                };
                return (
                  <div
                    key={alert.id}
                    className={`group flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${colorMap[alert.severity] || 'bg-slate-800/50 border-slate-700/60'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${dotMap[alert.severity] || 'bg-slate-400'} ${alert.severity === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                      <div>
                        <p className="text-sm font-medium text-white capitalize">{alert.type.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-400">{alert.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Blockchain Integrity */}
        <Card className="bg-slate-950/70 border border-emerald-500/15 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50">
            <CardTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-lg font-semibold">Blockchain Integrity</span>
            </CardTitle>
            <Badge className={`${chainSummary.invalidChains > 0 ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'} px-3 py-1`}>
              {chainSummary.integrityScore.toFixed(1)}% Integrity
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">Chain Integrity</span>
                  <span className={`text-sm font-semibold ${chainSummary.invalidChains > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {chainSummary.invalidChains > 0 ? 'Issues Detected' : 'Valid'}
                  </span>
                </div>
                <Progress value={chainSummary.integrityScore} className="h-2.5 bg-slate-800/50" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">Verified Records</span>
                  <span className="text-sm font-semibold text-white tabular-nums">{chainSummary.validChains.toLocaleString()}</span>
                </div>
                <Progress value={Math.min(100, (chainSummary.validChains / Math.max(1, chainSummary.total)) * 100)} className="h-2.5 bg-slate-800/50" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">Last Block</span>
                  <span className="text-sm text-slate-400 tabular-nums">#{chainSummary.total}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 font-mono text-xs text-slate-400 truncate hover:text-emerald-400 transition-colors">
                  {chainSummary.lastAuditAt ? `Last audit: ${new Date(chainSummary.lastAuditAt).toLocaleString()}` : 'Audit pending'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}