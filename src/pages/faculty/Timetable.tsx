import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Clock, MapPin, BookOpen } from 'lucide-react';

const schedule = {
  1: [ // Monday
    { time: '9:00 - 10:30', subject: 'Data Structures', class: 'CSE-A', room: '301' },
    { time: '11:00 - 12:30', subject: 'Algorithms', class: 'CSE-B', room: '302' },
    { time: '14:00 - 15:30', subject: 'Database Systems', class: 'CSE-C', room: '303' },
  ],
  2: [ // Tuesday
    { time: '9:00 - 10:30', subject: 'Web Development', class: 'IT-A', room: '401' },
    { time: '11:00 - 12:30', subject: 'Data Structures', class: 'CSE-A', room: '301' },
  ],
  3: [ // Wednesday
    { time: '9:00 - 10:30', subject: 'Algorithms', class: 'CSE-B', room: '302' },
    { time: '11:00 - 12:30', subject: 'Database Systems', class: 'CSE-C', room: '303' },
    { time: '14:00 - 15:30', subject: 'Web Development', class: 'IT-A', room: '401' },
  ],
  4: [ // Thursday
    { time: '9:00 - 10:30', subject: 'Data Structures', class: 'CSE-A', room: '301' },
    { time: '11:00 - 12:30', subject: 'Algorithms', class: 'CSE-B', room: '302' },
  ],
  5: [ // Friday
    { time: '9:00 - 10:30', subject: 'Database Systems', class: 'CSE-C', room: '303' },
    { time: '11:00 - 12:30', subject: 'Web Development', class: 'IT-A', room: '401' },
  ],
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function FacultyTimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Timetable</h1>
        <p className="text-slate-400">Your weekly teaching schedule</p>
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
                    className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-cyan-400">{slot.time}</span>
                    </div>
                    <p className="font-medium text-white">{slot.subject}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {slot.class}
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