import { useEffect, useState } from 'react';
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

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/analytics/admin-dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.data.stats);
          setMonthlyTrend(data.data.monthlyTrend);
          setDepartmentStats(data.data.departmentStats);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
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
  ];

  const quickActions = [
    { label: 'Add Student', icon: Plus, href: '/admin/students', color: 'text-emerald-400' },
    { label: 'Add Faculty', icon: Plus, href: '/admin/faculty', color: 'text-cyan-400' },
    { label: 'Create Department', icon: Plus, href: '/admin/departments', color: 'text-violet-400' },
    { label: 'Post Notice', icon: FileText, href: '/admin/notices', color: 'text-amber-400' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-slate-400">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
            <Link2 className="w-3 h-3 mr-1" />
            Blockchain Verified
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{stat.title}</p>
                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.trendUp ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stat.trend}
                      </span>
                      <span className="text-xs text-slate-500">vs last month</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 border-slate-700 hover:bg-slate-800"
                  asChild
                >
                  <a href={action.href}>
                    <Icon className={`w-5 h-5 ${action.color}`} />
                    <span className="text-sm text-slate-300">{action.label}</span>
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Monthly Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department-wise Attendance */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Department-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="departmentName" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="attendancePercentage" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Alerts */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Security Alerts
            </CardTitle>
            <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/20">
              {stats?.recentAlerts || 0} New
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <div>
                    <p className="text-sm text-white">Face Mismatch Detected</p>
                    <p className="text-xs text-slate-400">Student ID: STU2024001</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">2 min ago</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <p className="text-sm text-white">Suspicious Login Attempt</p>
                    <p className="text-xs text-slate-400">IP: 192.168.1.100</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">15 min ago</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <div>
                    <p className="text-sm text-white">Geo-location Anomaly</p>
                    <p className="text-xs text-slate-400">Location: Outside campus</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">1 hour ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blockchain Integrity */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-violet-400" />
              Blockchain Integrity
            </CardTitle>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20">
              100% Verified
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Chain Integrity</span>
                  <span className="text-sm text-emerald-400">Valid</span>
                </div>
                <Progress value={100} className="h-2 bg-slate-800" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Verified Records</span>
                  <span className="text-sm text-white">12,847</span>
                </div>
                <Progress value={85} className="h-2 bg-slate-800" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Last Block</span>
                  <span className="text-sm text-slate-400">#12,847</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 font-mono text-xs text-slate-400 truncate">
                  0x7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}