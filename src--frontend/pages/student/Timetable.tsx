import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User, Loader2, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { timetableService } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetablePage() {
  const { user } = useSupabaseAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Today/Now detection ──
  const now = new Date();
  const todayDayIdx = now.getDay(); // 0=Sun,1=Mon..6=Sat
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayDateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
    const day = e.day_of_week ?? 0;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }
  for (const d of Object.keys(grouped)) {
    grouped[+d].sort((a: any, b: any) =>
      (a.start_time || '').localeCompare(b.start_time || ''));
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
        <p className="text-slate-400">{todayDateStr} • {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
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
            const dayNum = index + 1;
            const slots = grouped[dayNum] || grouped[index] || [];
            if (slots.length === 0) return null;
            const isToday = todayDayIdx === dayNum || (todayDayIdx === index + 1);
            return (
              <Card key={day} className={`bg-slate-900/50 border-slate-800 ${isToday ? 'ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10' : ''}`}>
                <CardHeader>
                  <CardTitle className={`text-lg ${isToday ? 'text-emerald-300' : 'text-white'}`}>{day}{isToday ? ' (Today)' : ''}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {slots.map((slot: any, i: number) => {
                      const st = slot.start_time || '';
                      const et = slot.end_time || '';
                      const subj = slot.course?.name || slot.course?.code || '';
                      const fac = slot.faculty_profile ? `${slot.faculty_profile.first_name || ''} ${slot.faculty_profile.last_name || ''}`.trim() : (slot.faculty?.profile ? `${slot.faculty.profile.first_name || ''} ${slot.faculty.profile.last_name || ''}`.trim() : '');
                      const room = slot.room || '';
                      const isCurrentSlot = isToday && st <= currentTime && et > currentTime;
                      return (
                        <div key={slot.id || i} className={`p-3 rounded-lg ${isCurrentSlot ? 'bg-emerald-500/15 border-2 border-emerald-400/50 shadow-md shadow-emerald-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className={`w-4 h-4 ${isCurrentSlot ? 'text-emerald-300 animate-pulse' : 'text-emerald-400'}`} />
                            <span className="text-sm text-emerald-400">{st}{et ? ` - ${et}` : ''}</span>
                            {isCurrentSlot && <span className="text-xs bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-medium">NOW</span>}
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