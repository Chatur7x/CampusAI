import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User, Loader2, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { timetableService } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function g(slot: any, ...keys: string[]): string {
  for (const k of keys) { const v = slot[k]; if (v != null) return String(v); }
  return '';
}

export default function StudentTimetablePage() {
  const { user } = useSupabaseAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const classId = user?.student?.class_id || '';
        if (!classId) { setLoading(false); return; }
        const data = await timetableService.getForClass(classId);
        setEntries(data as any[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load timetable');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const grouped: Record<number, any[]> = {};
  for (const e of entries) {
    const day = e.dayOfWeek ?? e.day_of_week ?? 0;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }
  for (const d of Object.keys(grouped)) {
    grouped[+d].sort((a: any, b: any) =>
      g(a, 'startTime', 'start_time').localeCompare(g(b, 'startTime', 'start_time')));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-3 text-slate-400">Loading timetable...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400">
        <AlertCircle className="w-6 h-6 mr-2" />{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Timetable</h1>
        <p className="text-slate-400">Your weekly class schedule</p>
      </div>

      {entries.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No timetable entries found. Check with your class incharge.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map((day, index) => {
            const slots = grouped[index + 1] || grouped[index] || [];
            if (slots.length === 0) return null;
            return (
              <Card key={day} className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{day}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {slots.map((slot: any, i: number) => {
                      const st = g(slot, 'startTime', 'start_time');
                      const et = g(slot, 'endTime', 'end_time');
                      const subj = g(slot, 'subject', 'subjectName', 'subjectId', 'subject_id');
                      const fac = g(slot, 'faculty', 'facultyName', 'facultyId', 'faculty_id');
                      const room = g(slot, 'room', 'roomNumber', 'room_number');
                      return (
                        <div key={slot.id || i} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-emerald-400">{st}{et ? ` - ${et}` : ''}</span>
                          </div>
                          <p className="font-medium text-white">{subj || 'Untitled'}</p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                            {fac && <span className="flex items-center gap-1"><User className="w-3 h-3" />{fac}</span>}
                            {room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Room {room}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}