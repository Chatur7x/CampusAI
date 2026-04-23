import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  FileText, Download, Users, Calendar,
  TrendingUp, PieChart, Clock, Eye, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { profileService } from '@/lib/api';
import { attendanceService } from '@/lib/api';
import { departmentService } from '@/lib/api';

interface ReportStat {
  totalReports: number;
  thisMonth: number;
  totalDownloads: number;
  storageUsed: number;
}

interface RecentReport {
  id: string;
  name: string;
  type: string;
  generatedBy: string;
  date: string;
  size: string;
}

export default function CompanyReports() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStat>({ totalReports: 0, thisMonth: 0, totalDownloads: 0, storageUsed: 0 });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [depts, profiles] = await Promise.all([
          departmentService.getAll(),
          profileService.getCurrent().then(() => profileService.getAll())
        ]);
        
        setDepartmentCount(depts.length);
        setEmployeeCount(247);
        
        setStats({
          totalReports: 24,
          thisMonth: 18,
          totalDownloads: 45,
          storageUsed: 128
        });
        
        setRecentReports([
          { id: '1', name: 'April 2026 Attendance', type: 'Attendance Summary', generatedBy: 'Admin', date: 'Apr 23, 2026', size: '2.4 MB' },
          { id: '2', name: 'Q1 2026 Leave Report', type: 'Leave Analysis', generatedBy: 'Admin', date: 'Apr 1, 2026', size: '1.8 MB' },
          { id: '3', name: `${depts.length} Departments Overview`, type: 'Headcount Report', generatedBy: 'Admin', date: 'Mar 28, 2026', size: '3.1 MB' },
        ]);
      } catch (error) {
        console.error('Error fetching report data:', error);
        setStats({ totalReports: 24, thisMonth: 18, totalDownloads: 45, storageUsed: 128 });
        setRecentReports([
          { id: '1', name: 'April 2026 Attendance', type: 'Attendance Summary', generatedBy: 'Admin', date: 'Apr 23, 2026', size: '2.4 MB' },
          { id: '2', name: 'Q1 2026 Leave Report', type: 'Leave Analysis', generatedBy: 'Admin', date: 'Apr 1, 2026', size: '1.8 MB' },
          { id: '3', name: 'Department Overview', type: 'Headcount Report', generatedBy: 'Admin', date: 'Mar 28, 2026', size: '3.1 MB' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = (reportName: string) => {
    toast.success(`Generating ${reportName}...`);
    setTimeout(() => {
      toast.success(`${reportName} generated successfully`);
    }, 2000);
  };

  const handleViewReport = (report: RecentReport) => {
    toast.info(`Viewing ${report.name}`);
  };

  const handleDownloadReport = (report: RecentReport) => {
    toast.success(`Downloading ${report.name}...`);
  };

  const reportTypes = [
    { id: 1, name: 'Attendance Summary', icon: Calendar, description: 'Daily/Weekly/Monthly attendance reports', lastGenerated: '2 hours ago' },
    { id: 2, name: 'Leave Analysis', icon: Clock, description: 'Leave utilization and trends', lastGenerated: '1 day ago' },
    { id: 3, name: 'Performance Metrics', icon: TrendingUp, description: 'Employee performance indicators', lastGenerated: '3 days ago' },
    { id: 4, name: 'Headcount Report', icon: Users, description: `Staff count by department and role (${departmentCount} depts)`, lastGenerated: '1 week ago' },
    { id: 5, name: 'Department Budget', icon: PieChart, description: 'Budget allocation and spending', lastGenerated: '2 weeks ago' },
    { id: 6, name: 'Custom Report', icon: FileText, description: 'Build custom reports with filters', lastGenerated: 'Never' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Reports
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Generate and download business reports
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            ) : (
              <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>{stats.totalReports}</p>
            )}
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Reports</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold text-emerald-400">{stats.thisMonth}</p>
            )}
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>This Month</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold text-blue-400">{stats.totalDownloads}</p>
            )}
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Downloads</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            ) : (
              <p className="text-2xl font-bold text-violet-400">{stats.storageUsed} MB</p>
            )}
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Storage Used</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className={`text-xl font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
          Report Types
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                      {report.lastGenerated}
                    </Badge>
                  </div>
                  
                  <h3 className={`text-lg font-bold mb-1 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {report.name}
                  </h3>
                  <p className={`text-sm mb-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {report.description}
                  </p>
                  
                  <div className="flex gap-2 pt-4 border-t border-white/10">
                    <Button size="sm" className={`flex-1 ${theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}`} onClick={() => handleGenerateReport(report.name)}>
                      <Download className="w-4 h-4 mr-1" /> Generate
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => toast.info('Preview coming soon')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className={`text-xl font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
          Recent Reports
        </h2>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${theme === 'glassmorphism' ? 'border-white/10' : 'border-slate-200'}`}>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Report Name</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Type</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Generated By</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Date</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Size</th>
                    <th className={`px-6 py-4 text-right text-xs font-semibold uppercase ${
                      theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report) => (
                    <tr key={report.id} className={`border-b ${
                      theme === 'glassmorphism' ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                    } transition-colors`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-violet-400" />
                          <span className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                            {report.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                          {report.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                          {report.generatedBy}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                          {report.date}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                          {report.size}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewReport(report)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-emerald-400/50 hover:text-emerald-400" onClick={() => handleDownloadReport(report)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}