import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/lib/organization';
import { useTheme } from '@/themes';
import {
  Users, Clock, TrendingUp, CheckCircle, AlertTriangle,
  MapPin, Calendar, Activity, UserPlus, Briefcase,
  ArrowUpRight, ArrowDownRight, Crown, Shield,
  Eye, BarChart3, Map
} from 'lucide-react';

const stats = [
  { label: 'Total Employees', value: '1,247', change: '+12%', positive: true, icon: Users, color: 'violet' },
  { label: 'Present Today', value: '1,189', change: '95.3%', positive: true, icon: CheckCircle, color: 'emerald' },
  { label: 'Late Arrivals', value: '58', change: '-8%', positive: true, icon: Clock, color: 'amber' },
  { label: 'On Leave', value: '23', change: '+5%', positive: false, icon: Calendar, color: 'blue' },
];

const recentActivity = [
  { id: 1, action: 'John Doe checked in', time: '9:02 AM', type: 'checkin', status: 'present' },
  { id: 2, action: 'Sarah Smith checked in', time: '9:15 AM', type: 'checkin', status: 'late' },
  { id: 3, action: 'Mike Johnson requested leave', time: '8:45 AM', type: 'leave', status: 'pending' },
  { id: 4, action: 'Emily Brown checked in', time: '9:30 AM', type: 'checkin', status: 'present' },
  { id: 5, action: 'New employee onboarding', time: '10:00 AM', type: 'onboard', status: 'info' },
];

const departments = [
  { name: 'Engineering', employees: 456, attendance: 96 },
  { name: 'Sales', employees: 234, attendance: 89 },
  { name: 'Marketing', employees: 123, attendance: 94 },
  { name: 'HR', employees: 45, attendance: 98 },
  { name: 'Finance', employees: 89, attendance: 97 },
];

const teamLeads = [
  { name: 'Alice Johnson', role: 'Engineering Lead', avatar: 'AJ', color: 'from-violet-500 to-purple-500' },
  { name: 'Bob Williams', role: 'Sales Lead', avatar: 'BW', color: 'from-emerald-500 to-teal-500' },
  { name: 'Carol Davis', role: 'Marketing Lead', avatar: 'CD', color: 'from-amber-500 to-orange-500' },
];

export default function CompanyOverview() {
  const { organization } = useOrganization();
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState('today');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Welcome back, Admin
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Here's what's happening at {organization?.name || 'your company'} today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={timeRange === 'today' ? 'default' : 'outline'} 
            onClick={() => setTimeRange('today')}
            className={theme === 'glassmorphism' ? 'glass-button' : 'neu-button'}
          >
            Today
          </Button>
          <Button 
            variant={timeRange === 'week' ? 'default' : 'outline'} 
            onClick={() => setTimeRange('week')}
            className={theme === 'glassmorphism' ? 'glass-button' : 'neu-button'}
          >
            This Week
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`${
              theme === 'glassmorphism' ? 'glass-card glass-card-glow' : 'neu-card'
            } relative overflow-hidden`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${
                    stat.color === 'violet' ? 'from-violet-500 to-purple-500' :
                    stat.color === 'emerald' ? 'from-emerald-500 to-teal-500' :
                    stat.color === 'amber' ? 'from-amber-500 to-orange-500' :
                    'from-blue-500 to-cyan-500'
                  } flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <Badge className={stat.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                    {stat.positive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                    {stat.change}
                  </Badge>
                </div>
                <div className="mt-4">
                  <h3 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {stat.value}
                  </h3>
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className={`lg:col-span-2 ${theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className={`${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                    activity.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                    activity.status === 'pending' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-violet-500/20 text-violet-400'
                  }`}>
                    {activity.status === 'present' ? <CheckCircle className="w-5 h-5" /> :
                     activity.status === 'late' ? <Clock className="w-5 h-5" /> :
                     activity.status === 'pending' ? <AlertTriangle className="w-5 h-5" /> :
                     <UserPlus className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{activity.action}</p>
                    <p className="text-sm text-white/50">{activity.time}</p>
                  </div>
                  <Badge className={
                    activity.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                    activity.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Department Attendance */}
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardHeader>
            <CardTitle className={`${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Department Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departments.map((dept) => (
                <div key={dept.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{dept.name}</span>
                    <span className="text-white/50 text-sm">{dept.employees} emp</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        dept.attendance >= 95 ? 'bg-emerald-500' :
                        dept.attendance >= 90 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${dept.attendance}%` }}
                    />
                  </div>
                  <span className="text-sm text-white/50">{dept.attendance}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Leads & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Leads */}
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardHeader>
            <CardTitle className={`${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Team Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamLeads.map((lead) => (
                <div key={lead.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${lead.color} flex items-center justify-center font-bold text-white text-lg`}>
                    {lead.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{lead.name}</p>
                    <p className="text-sm text-white/50">{lead.role}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white/50">
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardHeader>
            <CardTitle className={`${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 hover:border-violet-500/50 transition-all text-left">
                <UserPlus className="w-6 h-6 text-violet-400 mb-2" />
                <p className="font-medium text-white">Add Employee</p>
                <p className="text-xs text-white/50">Onboard new staff</p>
              </button>
              <button className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all text-left">
                <BarChart3 className="w-6 h-6 text-emerald-400 mb-2" />
                <p className="font-medium text-white">View Reports</p>
                <p className="text-xs text-white/50">Analytics dashboard</p>
              </button>
              <button className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all text-left">
                <Map className="w-6 h-6 text-amber-400 mb-2" />
                <p className="font-medium text-white">Live Tracking</p>
                <p className="text-xs text-white/50">Field employees</p>
              </button>
              <button className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-all text-left">
                <Shield className="w-6 h-6 text-blue-400 mb-2" />
                <p className="font-medium text-white">Security</p>
                <p className="text-xs text-white/50">Monitor alerts</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
