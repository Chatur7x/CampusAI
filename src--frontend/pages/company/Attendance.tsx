import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Clock, Search, Download, MapPin, CheckCircle,
  AlertCircle, Loader2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface AttendanceRecord {
  id: string;
  profile_id: string;
  employee_name: string;
  check_in: string | null;
  check_out: string | null;
  hours_worked: number;
  location: string | null;
  status: string;
  date: string;
}

export default function CompanyAttendance() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query attendance table
      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select(`
          id,
          profile_id,
          check_in,
          check_out,
          location,
          status,
          created_at,
          profiles (
            first_name,
            last_name
          )
        `)
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: AttendanceRecord[] = (data || []).map(att => {
        const checkIn = att.check_in ? new Date(att.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
        const checkOut = att.check_out ? new Date(att.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
        const hoursWorked = checkIn && checkOut ? 
          Math.abs(new Date(att.check_out).getTime() - new Date(att.check_in).getTime()) / (1000 * 60 * 60) : 0;

        return {
          id: att.id,
          profile_id: att.profile_id,
          employee_name: `${(att.profiles as any)?.[0]?.first_name || ''} ${(att.profiles as any)?.[0]?.last_name || ''}`.trim() || 'Unknown',
          check_in: checkIn,
          check_out: checkOut,
          hours_worked: Math.round(hoursWorked * 10) / 10,
          location: att.location,
          status: att.status || 'present',
          date: att.created_at,
        };
      });

      setAttendance(transformedData);

    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      setError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const handleViewAttendance = (record: AttendanceRecord) => {
    toast.info(`Viewing attendance for ${record.employee_name}`);
  };

  const handleExportReport = () => {
    if (attendance.length === 0) {
      toast.info('No attendance records to export');
      return;
    }

    const csvContent = [
      ['Employee', 'Check In', 'Check Out', 'Hours', 'Location', 'Status'].join(','),
      ...attendance.map(emp => [
        emp.employee_name,
        emp.check_in || '-',
        emp.check_out || '-',
        emp.hours_worked,
        emp.location || '-',
        emp.status
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
    const matchesSearch = emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = selectedLocation === 'All Locations' || emp.location === selectedLocation;
    const matchesStatus = selectedStatus === 'All Status' || emp.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesLocation && matchesStatus;
  });

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present' || a.status === 'PRESENT').length,
    absent: attendance.filter(a => a.status === 'absent' || a.status === 'ABSENT').length,
    onTime: attendance.filter(a => a.check_in && new Date(a.check_in).getHours() < 9).length,
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
            Track employee attendance and working hours
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
          <span className="ml-3 text-white/60">Loading attendance...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.total}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total</p>
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
                <p className="text-2xl font-bold text-blue-400">{stats.onTime}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>On Time</p>
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
                    placeholder="Search by employee name..."
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
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
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
                  Attendance records for this date will appear here
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
                        }`}>Check In</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Check Out</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Hours</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Location</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Status</th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((emp) => (
                        <tr key={emp.id} className={`border-b ${
                          theme === 'glassmorphism' ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                        } transition-colors`}>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                              {emp.employee_name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                              {emp.check_in || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                              {emp.check_out || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                              {emp.hours_worked}h
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-4 h-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}`} />
                              <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                                {emp.location || 'N/A'}
                              </span>
                            </div>
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