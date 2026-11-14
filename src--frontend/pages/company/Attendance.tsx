import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Clock, Search, Download,
  AlertCircle, Loader2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetchAllPages';

interface AttendanceRecord {
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

export default function CompanyAttendance() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      const { rows: fetched, truncated: hitCap } = await fetchAllPages<AttendanceRecord>(
        (from, to) =>
          supabase
            .from(VIEW_NAME)
            .select('date, status, method, first_name, last_name, enrollment_id, department, class')
            .eq('date', date)
            // deterministic order across pages (view has no unique id)
            .order('enrollment_id', { ascending: true })
            .order('method', { ascending: true })
            .order('status', { ascending: true })
            .range(from, to)
      );

      setAttendance(fetched);
      setTruncated(hitCap);
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      const msg: string = err?.message || String(err);
      // PGRST/42P01 style failures mean the view is missing (migration 016 not applied)
      const missingView = /company_attendance_summary|does not exist|schema cache|42P01/i.test(msg);
      setError(missingView
        ? `The database view "${VIEW_NAME}" is missing. Apply supabase/migrations/016_company_role.sql and reload.`
        : msg || 'Failed to load attendance');
      setAttendance([]);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const displayName = (r: AttendanceRecord) =>
    `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown';

  const handleViewAttendance = (record: AttendanceRecord) => {
    toast.info(`${displayName(record)} — ${record.status} via ${record.method} on ${record.date}`);
  };

  const handleExportReport = () => {
    if (attendance.length === 0) {
      toast.info('No attendance records to export');
      return;
    }

    const csvContent = [
      ['Employee', 'Enrollment ID', 'Department', 'Class', 'Method', 'Status', 'Date'].join(','),
      ...attendance.map(emp => [
        displayName(emp),
        emp.enrollment_id || '-',
        emp.department || '-',
        emp.class || '-',
        emp.method,
        emp.status,
        emp.date
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance report exported successfully');
  };

  const filteredAttendance = attendance.filter(emp => {
    const matchesSearch = displayName(emp).toLowerCase().includes(searchQuery.toLowerCase())
      || (emp.enrollment_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All Status' || emp.status === selectedStatus.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'PRESENT').length,
    absent: attendance.filter(a => a.status === 'ABSENT').length,
    presentRate: attendance.length > 0
      ? Math.round((attendance.filter(a => a.status === 'PRESENT').length / attendance.length) * 100)
      : 0,
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'present') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Present</Badge>;
    }
    if (statusLower === 'absent') {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Absent</Badge>;
    }
    if (statusLower === 'late') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Late</Badge>;
    }
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Attendance
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Track attendance records shared with your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={theme === 'glassmorphism' ? 'glass-input w-40' : 'neu-input w-40'}
          />
          <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'} onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className={`ml-3 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>Loading attendance...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
              Could Not Load Attendance
            </h3>
            <p className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>{error}</p>
            <Button variant="outline" className={`mt-4 ${theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}`} onClick={fetchAttendance}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Truncation notice — never present capped figures as complete totals */}
          {truncated && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
                <p className={theme === 'glassmorphism' ? 'text-amber-200/90 text-sm' : 'text-amber-700 text-sm'}>
                  Showing the first {attendance.length} records — figures may be incomplete
                </p>
              </CardContent>
            </Card>
          )}
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.total}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Records</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{stats.present}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Present</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{stats.absent}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Absent</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">{stats.presentRate}%</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Present Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    placeholder="Search by name or enrollment ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={`px-4 py-2 rounded-xl border ${
                      theme === 'glassmorphism'
                        ? 'bg-white/5 border-white/10 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="All Status">All Status</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late</option>
                    <option value="EXCUSED">Excused</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          {filteredAttendance.length === 0 ? (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-12 text-center">
                <Clock className={`w-16 h-16 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/20' : 'text-slate-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                  No Attendance Records
                </h3>
                <p className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  {attendance.length === 0
                    ? `No attendance records for ${date}`
                    : 'No records match the current filters'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${theme === 'glassmorphism' ? 'border-white/10' : 'border-slate-200'}`}>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Employee</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Enrollment ID</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Department</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Class</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Method</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Status</th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((emp, idx) => (
                        <tr key={`${emp.enrollment_id || 'row'}-${emp.date}-${emp.method}-${idx}`} className={`border-b ${
                          theme === 'glassmorphism' ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                        } transition-colors`}>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                              {displayName(emp)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                              {emp.enrollment_id || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                              {emp.department || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                              {emp.class || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                              {emp.method}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(emp.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewAttendance(emp)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
