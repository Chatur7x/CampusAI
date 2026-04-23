import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Users, TrendingUp, Clock, CheckCircle, AlertTriangle,
  Activity, ArrowUpRight, ArrowDownRight, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface QuickStat {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}

export default function CompanyOverview() {
  const { organization } = useOrganization();
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState('today');
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ employees: number; attendance: number; leave: number; departments: number }>({
    employees: 0,
    attendance: 0,
    leave: 0,
    departments: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      const [employeesRes, attendanceRes, leaveRes, deptRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('*', { count: 'exact', head: true }),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        employees: employeesRes.count || 0,
        attendance: attendanceRes.count || 0,
        leave: leaveRes.count || 0,
        departments: deptRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-employee':
        navigate('/company/employees');
        break;
      case 'reports':
        navigate('/company/reports');
        break;
      case 'tracking':
        navigate('/company/live-tracking');
        break;
      case 'security':
        navigate('/company/security');
        break;
      default:
        toast.info(`Action: ${action}`);
    }
  };

  const handleViewAll = () => {
    toast.info('Viewing all recent activity');
  };

  const quickStats: QuickStat[] = [
    { label: 'Total Employees', value: stats.employees, change: Math.round(stats.employees * 0.05), trend: 'up', color: 'violet' },
    { label: 'Attendance Today', value: stats.attendance, change: Math.round(stats.attendance * 0.02), trend: stats.attendance > 0 ? 'up' : 'neutral', color: 'emerald' },
    { label: 'Pending Leaves', value: stats.leave, change: stats.leave, trend: stats.leave > 0 ? 'down' : 'neutral', color: 'amber' },
    { label: 'Departments', value: stats.departments, change: 0, trend: 'neutral', color: 'blue' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Dashboard
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Welcome back! Here&apos;s your organization overview.
          </p>
        </div>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className={`px-4 py-2 rounded-xl border ${
            theme === 'glassmorphism' 
              ? 'bg-white/5 border-white/10 text-white' 
              : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickStats.map((stat, index) => (
              <Card key={index} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                      {stat.label}
                    </span>
                    {stat.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
                    {stat.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-400" />}
                  </div>
                  <p className={`text-3xl font-bold mb-1 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {stat.value}
                  </p>
                  {stat.change !== 0 && (
                    <p className={`text-sm ${stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stat.trend === 'up' ? '+' : ''}{stat.change}% from last period
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 hover:border-violet-500/50 transition-all text-left"
              onClick={() => handleQuickAction('add-employee')}
            >
              <Users className="w-6 h-6 text-violet-400 mb-2" />
              <p className="font-medium text-white">Add Employee</p>
              <p className="text-xs text-white/50">Onboard new staff</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all text-left"
              onClick={() => handleQuickAction('reports')}
            >
              <TrendingUp className="w-6 h-6 text-emerald-400 mb-2" />
              <p className="font-medium text-white">View Reports</p>
              <p className="text-xs text-white/50">Analytics dashboard</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all text-left"
              onClick={() => handleQuickAction('tracking')}
            >
              <Activity className="w-6 h-6 text-amber-400 mb-2" />
              <p className="font-medium text-white">Live Tracking</p>
              <p className="text-xs text-white/50">Field employees</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-all text-left"
              onClick={() => handleQuickAction('security')}
            >
              <AlertTriangle className="w-6 h-6 text-blue-400 mb-2" />
              <p className="font-medium text-white">Security</p>
              <p className="text-xs text-white/50">Monitor alerts</p>
            </button>
          </div>

          {/* Recent Activity (Placeholder) */}
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Recent Activity
                </h3>
                <Button variant="ghost" size="sm" className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'} onClick={handleViewAll}>
                  View All
                </Button>
              </div>
              <div className="space-y-4">
                {stats.employees > 0 ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className={`${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                          {stats.employees} employees registered
                        </p>
                        <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                          {stats.departments} departments
                        </p>
                      </div>
                    </div>
                    {stats.leave > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className={`${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                            {stats.leave} pending leave requests
                          </p>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            Awaiting approval
                          </p>
                        </div>
                      </div>
                    )}
                    {stats.attendance > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className={`${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                            {stats.attendance} attendance records
                          </p>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            System tracking active
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    No activity data available yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function useOrganization() {
  return { organization: null };
}