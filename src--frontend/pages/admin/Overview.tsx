/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo, memo } from 'react';
import { type ComponentType, type SVGProps } from 'react';
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
import { supabase } from '@/lib/supabase';

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

// Dashboard data can be flat (from RPC) or nested

interface AuditSummary {
  integrityScore?: number | string;
  validChains?: number;
  invalidChains?: number;
  totalStudentsAudited?: number;
  lastAuditAt?: string;
}

type StatCardConfig = {
  title: string;
  value: string | number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  trend: string;
  trendUp: boolean;
};

type StatCardProps = {
  stat: StatCardConfig;
};

type SecurityAlert = {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  created_at: string;
  resolved?: boolean;
};

interface ChainSummary {
  integrityScore: number;
  validChains: number;
  invalidChains: number;
  total: number;
  lastAuditAt: string;
}

// Premium Skeleton Loader
const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="rounded-3xl border border-blue-500/20 bg-slate-950/40 backdrop-blur-xl p-6 h-32 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
      <div className="h-8 w-48 bg-slate-800/70 rounded-lg animate-pulse" />
      <div className="h-4 w-72 bg-slate-800/50 rounded mt-3 animate-pulse" />
    </div>
    
    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-slate-950/40 backdrop-blur-xl border border-blue-500/10 rounded-3xl p-6 shadow-xl">
          <div className="h-4 w-24 bg-slate-800/70 rounded mb-3 animate-pulse" />
          <div className="h-8 w-16 bg-slate-800/70 rounded mb-3 animate-pulse" />
          <div className="h-3 w-32 bg-slate-800/50 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
  );
});

// Memoized Stat Card Component
function StatCardComponent({ stat }: StatCardProps): JSX.Element {
  const Icon: ComponentType<SVGProps<SVGSVGElement>> = stat.icon;
  return (
    <Card 
      className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/15 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] transition-all duration-300 hover:scale-[1.02] group"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-blue-100/60 font-medium tracking-wide">{stat.title}</p>
            <p className="text-3xl font-extrabold text-white mt-1 tabular-nums drop-shadow-md">{stat.value}</p>
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
}

const StatCard = memo(StatCardComponent);

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [chainSummary, setChainSummary] = useState<ChainSummary>({ integrityScore: 0, validChains: 0, invalidChains: 0, total: 0, lastAuditAt: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
      try {
        // Use Promise.allSettled so individual failures don't block the whole dashboard
        const results = await Promise.allSettled([
          analyticsService.getAdminDashboard(),
          analyticsService.getDepartmentSummary(),
          securityService.getAlerts(false),
          supabase.functions.invoke('analytics', { body: { reportType: 'blockchain_audit' } }),
        ]);

        if (!isMounted) return;

        // 1) Dashboard stats (RPC returns flat object, not nested)
        if (results[0].status === 'fulfilled' && results[0].value) {
          const dashboard = results[0].value as any;
          // RPC returns flat: { totalStudents, totalFaculty, ... }
          // Check if it's nested (AdminDashboardResponse) or flat
          if (dashboard.stats) {
            setStats(dashboard.stats);
            setMonthlyTrend(dashboard.monthlyTrend ?? []);
            setDepartmentStats(dashboard.departmentStats ?? []);
          } else {
            // Flat object from RPC
            setStats({
              totalStudents: dashboard.totalStudents || 0,
              totalFaculty: dashboard.totalFaculty || 0,
              totalDepartments: dashboard.totalDepartments || 0,
              todayAttendance: dashboard.todayAttendance || 0,
              recentAlerts: dashboard.recentAlerts || 0,
              pendingLeaves: dashboard.pendingLeaves || 0,
            });
          }
        } else if (results[0].status === 'rejected') {
          console.warn('Dashboard stats failed:', results[0].reason);
        }

        // 2) Department summary
        if (results[1].status === 'fulfilled') {
          const deptSummary = results[1].value as DepartmentStat[] | null;
          if (deptSummary && deptSummary.length) {
            setDepartmentStats(deptSummary);
          }
        } else {
          console.warn('Department summary failed:', results[1].reason);
        }

        // 3) Security alerts
        if (results[2].status === 'fulfilled') {
          const securityAlerts = results[2].value as SecurityAlert[] | null;
          if (securityAlerts) {
            setAlerts(securityAlerts.slice(0, 5));
          }
        } else {
          console.warn('Security alerts failed:', results[2].reason);
        }

        // 4) Blockchain audit (edge function — may not be deployed)
        if (results[3].status === 'fulfilled') {
          const audit = results[3].value as { data: { summary?: AuditSummary } | null };
          const summary = audit?.data?.summary;
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
        } else {
          console.warn('Blockchain audit failed (edge function may not be deployed):', results[3].reason);
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

  // Memoized stat cards — trends computed from monthly data when available
  const statCards = useMemo<StatCardConfig[]>(() => {
    // Compute a simple trend: compare last 2 months from monthlyTrend if available
    const computeTrend = (): string => {
      if (monthlyTrend.length >= 2) {
        const last = monthlyTrend[monthlyTrend.length - 1].percentage;
        const prev = monthlyTrend[monthlyTrend.length - 2].percentage;
        const diff = last - prev;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
      }
      return '--';
    };
    const attendanceTrend = computeTrend();
    const isTrendUp = attendanceTrend.startsWith('+') || attendanceTrend === '--';

    return [
    {
      title: 'Total Students',
      value: stats?.totalStudents || 0,
      icon: GraduationCap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      trend: '--',
      trendUp: true,
    },
    {
      title: 'Total Faculty',
      value: stats?.totalFaculty || 0,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      trend: '--',
      trendUp: true,
    },
    {
      title: 'Departments',
      value: stats?.totalDepartments || 0,
      icon: Building2,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      trend: '--',
      trendUp: true,
    },
    {
      title: "Today's Attendance",
      value: `${stats?.todayAttendance || 0}%`,
      icon: TrendingUp,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      trend: attendanceTrend,
      trendUp: isTrendUp,
    },
  ];
  }, [stats, monthlyTrend]);

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
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-10 shadow-[0_25px_80px_rgba(0,0,0,0.5)] group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-slate-900/40 to-emerald-500/10 opacity-50" />
        <div className="absolute top-0 right-0 p-10 flex gap-3">
           <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
           <div className="w-2.5 h-2.5 rounded-full bg-blue-500/40" />
           <div className="w-2.5 h-2.5 rounded-full bg-blue-500/20" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none drop-shadow-2xl">
              System <span className="text-blue-400">Directorate</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.5em]">Enterprise Campus Governance & Intelligence</p>
          </div>
          <Badge className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-8 py-3 font-black text-xs tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Link2 className="w-4 h-4 mr-3" /> BLOCKCHAIN_VERIFIED_NODE
          </Badge>
        </div>
      </div>

      {/* Optimized Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} stat={stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/15 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
        <CardHeader className="border-b border-blue-500/10">
          <CardTitle className="text-blue-100 text-xl font-semibold tracking-wide">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-6 flex flex-col items-center gap-3 border-blue-500/20 bg-slate-900/40 hover:bg-slate-800/80 hover:border-blue-400/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 hover:scale-105 group"
                  asChild
                >
                  <a href={action.href}>
                    <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center group-hover:bg-blue-900/30 transition-colors">
                      <Icon className={`w-6 h-6 ${action.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <span className="text-sm text-blue-100/80 font-medium">{action.label}</span>
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
        <Card className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/15 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
          <CardHeader className="border-b border-blue-500/10">
            <CardTitle className="text-blue-100 text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
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
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(8px)',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#34d399', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department-wise Attendance */}
        <Card className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/15 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
          <CardHeader className="border-b border-blue-500/10">
            <CardTitle className="text-blue-100 text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
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
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(8px)',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Bar dataKey="attendancePercentage" fill="#3b82f6" radius={[6, 6, 0, 0]} />
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
        <Card className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/15 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-blue-500/10">
            <CardTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
              <span className="text-lg font-semibold text-blue-100">Blockchain Integrity</span>
            </CardTitle>
            <Badge className={`${chainSummary.invalidChains > 0 ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'} px-3 py-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]`}>
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