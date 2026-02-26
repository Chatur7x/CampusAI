import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const attendanceHistory = [
  { date: '2024-03-01', status: 'PRESENT', subject: 'Data Structures' },
  { date: '2024-03-01', status: 'PRESENT', subject: 'Algorithms' },
  { date: '2024-02-29', status: 'ABSENT', subject: 'Database Systems' },
  { date: '2024-02-28', status: 'PRESENT', subject: 'Data Structures' },
  { date: '2024-02-28', status: 'LATE', subject: 'Algorithms' },
  { date: '2024-02-27', status: 'PRESENT', subject: 'Database Systems' },
];

const subjectStats = [
  { subject: 'Data Structures', total: 20, present: 18, percentage: 90 },
  { subject: 'Algorithms', total: 18, present: 16, percentage: 89 },
  { subject: 'Database Systems', total: 15, present: 12, percentage: 80 },
  { subject: 'Web Development', total: 12, present: 11, percentage: 92 },
];

export default function MyAttendancePage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'ABSENT':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'LATE':
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'ABSENT':
        return 'bg-red-500/20 text-red-400';
      case 'LATE':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Attendance</h1>
        <p className="text-slate-400">View your detailed attendance history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendanceHistory.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(record.status)}
                    <div>
                      <p className="font-medium text-white">{record.subject}</p>
                      <p className="text-sm text-slate-400">{record.date}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(record.status)}>{record.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="bg-slate-800/50 rounded-md border-slate-700"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Subject-wise Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjectStats.map((stat) => (
              <div
                key={stat.subject}
                className="p-4 rounded-lg bg-slate-800/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-white">{stat.subject}</p>
                  <span className={`text-lg font-bold ${
                    stat.percentage >= 75 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {stat.percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      stat.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  {stat.present} / {stat.total} classes attended
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}