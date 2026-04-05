import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Clock, Search, Download, MapPin, CheckCircle,
  AlertCircle, Calendar, Filter, Eye, Wifi, WifiOff
} from 'lucide-react';

const mockAttendance = [
  { id: 1, name: 'John Doe', employeeId: 'GOOG-001', checkIn: '9:02 AM', checkOut: '6:15 PM', hours: 9.2, status: 'present', location: 'Office' },
  { id: 2, name: 'Sarah Smith', employeeId: 'GOOG-002', checkIn: '9:15 AM', checkOut: '-', hours: 7.5, status: 'present', location: 'Remote' },
  { id: 3, name: 'Mike Johnson', employeeId: 'GOOG-003', checkIn: '-', checkOut: '-', hours: 0, status: 'absent', location: '-' },
  { id: 4, name: 'Emily Brown', employeeId: 'GOOG-004', checkIn: '8:45 AM', checkOut: '5:30 PM', hours: 8.8, status: 'present', location: 'Office' },
  { id: 5, name: 'David Wilson', employeeId: 'GOOG-005', checkIn: '9:00 AM', checkOut: '6:00 PM', hours: 9.0, status: 'present', location: 'Office' },
  { id: 6, name: 'Lisa Anderson', employeeId: 'GOOG-006', checkIn: '9:30 AM', checkOut: '-', hours: 7.0, status: 'late', location: 'Remote' },
];

const locations = ['All Locations', 'Office', 'Remote', 'Field'];
const statuses = ['All Status', 'Present', 'Late', 'Absent', 'On Leave'];

export default function CompanyAttendance() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <CheckCircle className="w-3 h-3 mr-1" /> Present
        </Badge>;
      case 'late':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <AlertCircle className="w-3 h-3 mr-1" /> Late
        </Badge>;
      case 'absent':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <WifiOff className="w-3 h-3 mr-1" /> Absent
        </Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">On Leave</Badge>;
    }
  };

  const getLocationIcon = (location: string) => {
    switch (location) {
      case 'Remote': return <Wifi className="w-4 h-4 text-blue-400" />;
      case 'Office': return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'Field': return <MapPin className="w-4 h-4 text-amber-400" />;
      default: return null;
    }
  };

  const presentCount = mockAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateCount = mockAttendance.filter(a => a.status === 'late').length;
  const avgHours = mockAttendance.reduce((acc, a) => acc + a.hours, 0) / mockAttendance.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Attendance
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Track employee attendance and work hours
          </p>
        </div>
        <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
          theme === 'glassmorphism' ? 'glass-card' : 'bg-slate-100'
        }`}>
          <Calendar className="w-5 h-5 text-white/70" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`border-0 bg-transparent ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>6</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Employees</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{presentCount}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Present</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{lateCount}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Late</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{avgHours.toFixed(1)}h</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Avg Hours</p>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className={`px-4 py-2 rounded-xl border ${
                  theme === 'glassmorphism' 
                    ? 'bg-white/5 border-white/10 text-white' 
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={`px-4 py-2 rounded-xl border ${
                  theme === 'glassmorphism' 
                    ? 'bg-white/5 border-white/10 text-white' 
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {mockAttendance.map((emp) => (
                  <tr key={emp.id} className={`border-b ${
                    theme === 'glassmorphism' ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                  } transition-colors`}>
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                          {emp.name}
                        </p>
                        <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                          {emp.employeeId}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                        {emp.checkIn}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                        {emp.checkOut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                        {emp.hours}h
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getLocationIcon(emp.location)}
                        <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                          {emp.location}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(emp.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
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
    </div>
  );
}
