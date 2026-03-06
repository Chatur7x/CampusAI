import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, BookOpen, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { timetableService } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FacultyTimetablePage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const fid = user?.faculty?.id || user?.id || '';
        if (!fid) { setLoading(false); return; }
        const data = await timetableService.getForFaculty(fid);
        setEntries(data as any[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load timetable');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Group entries by day of week
  const grouped: Record<number, any[]> = {};
  for (const e of entries) {
    const day = e.day_of_week ?? 0;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }
  for (const d of Object.keys(grouped)) {
    grouped[+d].sort((a: any, b: any) =>
      (a.start_time || '').localeCompare(b.start_time || ''));
  }

  const goToAttendance = (day: string, slot: any) => {
    navigate('/faculty/attendance', {
      state: {
        classId: slot.class_id,
        courseId: slot.course_id,
        className: slot.class?.name || '',
        subject: slot.course?.name || '',
        slot: `${day} • ${slot.start_time || ''} - ${slot.end_time || ''}`,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
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
        <p className="text-slate-400">Your weekly teaching schedule</p>
      </div>

      {entries.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No timetable entries found. Contact admin to set up your schedule.</p>
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
                      const st = slot.start_time || '';
                      const et = slot.end_time || '';
                      const subj = slot.course?.name || slot.course?.code || '';
                      const cls = slot.class?.name || '';
                      const room = slot.room || '';
                      return (
                        <div key={slot.id || i} className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 space-y-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm text-cyan-400">{st}{et ? ` - ${et}` : ''}</span>
                          </div>
                          <p className="font-medium text-white">{subj || 'Untitled'}</p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                            {cls && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{cls}</span>}
                            {room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Room {room}</span>}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="text-xs text-cyan-300 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Tap to mark attendance
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => goToAttendance(day, slot)}>
                              Mark Attendance
                            </Button>
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