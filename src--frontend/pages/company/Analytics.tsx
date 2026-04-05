import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  BarChart3, TrendingUp, TrendingDown, Users,
  Download, PieChart, Activity, Target
} from 'lucide-react';

const analyticsData = {
  overview: [
    { label: 'Total Employees', value: '247', change: '+12%', trend: 'up' },
    { label: 'Active Today', value: '231', change: '+5%', trend: 'up' },
    { label: 'Avg Work Hours', value: '8.4h', change: '-2%', trend: 'down' },
    { label: 'Productivity Score', value: '87%', change: '+8%', trend: 'up' },
  ],
  departmentData: [
    { name: 'Engineering', employees: 45, productivity: 92 },
    { name: 'Product', employees: 18, productivity: 88 },
    { name: 'Design', employees: 12, productivity: 95 },
    { name: 'Analytics', employees: 15, productivity: 85 },
    { name: 'Sales', employees: 35, productivity: 78 },
  ],
  weeklyTrend: [
    { day: 'Mon', present: 230, absent: 17 },
    { day: 'Tue', present: 235, absent: 12 },
    { day: 'Wed', present: 228, absent: 19 },
    { day: 'Thu', present: 240, absent: 7 },
    { day: 'Fri', present: 231, absent: 16 },
  ],
};

export default function CompanyAnalytics() {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState('week');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Analytics
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Business intelligence and insights
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
          <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {analyticsData.overview.map((stat, index) => (
          <Card key={index} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                {stat.value}
              </p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                {stat.label}
              </p>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{stat.change}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                Weekly Attendance Trend
              </h3>
              <Activity className="w-5 h-5 text-white/50" />
            </div>
            <div className="space-y-4">
              {analyticsData.weeklyTrend.map((day, index) => (
                <div key={index} className="flex items-center gap-4">
                  <span className={`w-12 text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                    {day.day}
                  </span>
                  <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-end pr-2"
                      style={{ width: `${(day.present / 250) * 100}%` }}
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
          </CardContent>
        </Card>

        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                Department Productivity
              </h3>
              <PieChart className="w-5 h-5 text-white/50" />
            </div>
            <div className="space-y-4">
              {analyticsData.departmentData.map((dept, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      {dept.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                        {dept.employees} employees
                      </span>
                      <Badge className={dept.productivity >= 90 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : dept.productivity >= 80 
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }>
                        {dept.productivity}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        dept.productivity >= 90 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : dept.productivity >= 80 
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                      }`}
                      style={{ width: `${dept.productivity}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Performance Metrics
            </h3>
            <Target className="w-5 h-5 text-white/50" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center`}>
                <Target className="w-8 h-8 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>87%</p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Goal Completion</p>
            </div>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center`}>
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>23%</p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Growth Rate</p>
            </div>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center`}>
                <Users className="w-8 h-8 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>4.6</p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Avg Rating</p>
            </div>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center`}>
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>156</p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Projects Done</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
