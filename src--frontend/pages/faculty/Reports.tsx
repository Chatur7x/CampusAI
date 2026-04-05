import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { 
  FileText, Download, BarChart3, Users, 
  Calendar, TrendingUp, PieChart, DownloadCloud
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportData {
  id: string;
  title: string;
  type: 'attendance' | 'performance' | 'summary' | 'custom';
  generatedAt: string;
  period: string;
  downloadUrl?: string;
}

export default function FacultyReportsPage() {
  const { user } = useSupabaseAuth();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = () => {
    setReports([
      {
        id: '1',
        title: 'Attendance Summary Report',
        type: 'attendance',
        generatedAt: new Date().toISOString(),
        period: 'This Month',
      },
      {
        id: '2',
        title: 'Student Performance Report',
        type: 'performance',
        generatedAt: new Date().toISOString(),
        period: 'Current Semester',
      },
      {
        id: '3',
        title: 'Class Overview Report',
        type: 'summary',
        generatedAt: new Date().toISOString(),
        period: 'Weekly',
      },
    ]);
    setLoading(false);
  };

  const generateReport = async (type: string) => {
    setGenerating(type);
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success('Report generated successfully');
    setGenerating(null);
  };

  const downloadReport = (report: ReportData) => {
    toast.success(`Downloading ${report.title}...`);
  };

  const reportTypes = [
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Detailed attendance records for your classes',
      icon: Calendar,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      id: 'performance',
      title: 'Performance Report',
      description: 'Student grades and assignment submissions',
      icon: TrendingUp,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      id: 'summary',
      title: 'Summary Report',
      description: 'Overview of class statistics and trends',
      icon: PieChart,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'custom',
      title: 'Custom Report',
      description: 'Generate a custom report with selected filters',
      icon: FileText,
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 mt-1">Generate and download reports for your classes</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">12</p>
                <p className="text-sm text-slate-400">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Download className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">8</p>
                <p className="text-sm text-slate-400">Downloads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">3</p>
                <p className="text-sm text-slate-400">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">85%</p>
                <p className="text-sm text-slate-400">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Report */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Generate New Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => generateReport(type.id)}
                disabled={generating !== null}
                className="p-4 rounded-xl bg-slate-700/50 border border-slate-600/50 hover:border-slate-500 transition-all text-left group disabled:opacity-50"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${type.color} flex items-center justify-center mb-3`}>
                  <type.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white mb-1">{type.title}</h4>
                <p className="text-sm text-slate-400">{type.description}</p>
                {generating === type.id && (
                  <p className="text-xs text-emerald-400 mt-2">Generating...</p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-700/30 border border-slate-600/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    report.type === 'attendance' ? 'bg-emerald-500/20' :
                    report.type === 'performance' ? 'bg-blue-500/20' :
                    'bg-purple-500/20'
                  }`}>
                    <FileText className={`w-5 h-5 ${
                      report.type === 'attendance' ? 'text-emerald-400' :
                      report.type === 'performance' ? 'text-blue-400' :
                      'text-purple-400'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{report.title}</h4>
                    <p className="text-sm text-slate-400">{report.period}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {new Date(report.generatedAt).toLocaleDateString()}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadReport(report)}
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    <DownloadCloud className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
