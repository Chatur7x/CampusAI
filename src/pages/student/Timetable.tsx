import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Clock, MapPin, User } from 'lucide-react';

const schedule = {
  1: [
    { time: '9:00 - 10:30', subject: 'Data Structures', faculty: 'Dr. Smith', room: '301' },
    { time: '11:00 - 12:30', subject: 'Algorithms', faculty: 'Dr. Johnson', room: '302' },
    { time: '14:00 - 15:30', subject: 'Database Systems', faculty: 'Dr. Williams', room: '303' },
  ],
  2: [
    { time: '9:00 - 10:30', subject: 'Web Development', faculty: 'Prof. Brown', room: '401' },
    { time: '11:00 - 12:30', subject: 'Data Structures', faculty: 'Dr. Smith', room: '301' },
  ],
  3: [
    { time: '9:00 - 10:30', subject: 'Algorithms', faculty: 'Dr. Johnson', room: '302' },
    { time: '11:00 - 12:30', subject: 'Database Systems', faculty: 'Dr. Williams', room: '303' },
    { time: '14:00 - 15:30', subject: 'Web Development', faculty: 'Prof. Brown', room: '401' },
  ],
  4: [
    { time: '9:00 - 10:30', subject: 'Data Structures', faculty: 'Dr. Smith', room: '301' },
    { time: '11:00 - 12:30', subject: 'Algorithms', faculty: 'Dr. Johnson', room: '302' },
  ],
  5: [
    { time: '9:00 - 10:30', subject: 'Database Systems', faculty: 'Dr. Williams', room: '303' },
    { time: '11:00 - 12:30', subject: 'Web Development', faculty: 'Prof. Brown', room: '401' },
  ],
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentTimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Timetable</h1>
        <p className="text-slate-400">Your weekly class schedule</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {days.map((day, index) => (
          <Card key={day} className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">{day}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {schedule[index + 1 as keyof typeof schedule]?.map((slot, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400">{slot.time}</span>
                    </div>
                    <p className="font-medium text-white">{slot.subject}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {slot.faculty}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Room {slot.room}
                      </span>
                    </div>
                  </div>
                )) || (
                  <p className="text-slate-500 text-center py-4">No classes scheduled</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}