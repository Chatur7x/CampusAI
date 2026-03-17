import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User, Loader2, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { timetableService } from '@/lib/api';

export default function StudentTimetablePage() {
  const { user } = useSupabaseAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Today/Now detection ──
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayIdx = now.getDay(); 
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayDateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
  
  // Sorting slots for each day
  Object.keys(grouped).forEach((d) => {
    grouped[+d].sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-slate-400 font-medium animate-pulse text-sm tracking-widest uppercase">Fetching Schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-rose-400">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Section (Fixed S2) */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-10 shadow-2xl group text-center md:text-left">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-cyan-500/10 opacity-50" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              Academic <span className="text-emerald-400">Schedule</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">{todayDateStr}</p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-8 py-2.5 font-black text-xs tracking-widest uppercase rounded-full shadow-[0_0_20px_rgba(16,185,129,0.1)]">Sync Confirmed</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map((dayIdx) => {
          const dayName = dayNames[dayIdx];
          const slots = grouped[dayIdx] || [];
          const isToday = todayDayIdx === dayIdx;
          
          return (
            <Card key={dayIdx} className={`bg-slate-950/50 border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-700 ${isToday ? 'ring-2 ring-emerald-500/20' : 'opacity-70 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}>
              <CardHeader className={`p-8 pb-4 ${isToday ? 'bg-emerald-500/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-2xl font-black italic tracking-tighter uppercase ${isToday ? 'text-emerald-400' : 'text-white'}`}>
                    {dayName}
                  </CardTitle>
                  {isToday && (
                    <Badge className="bg-emerald-500 text-slate-900 font-black text-[9px] tracking-widest px-3 py-1 uppercase rounded-lg">Now</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                {slots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                    <Clock className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No Classes Scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {slots.map((slot: any, i: number) => {
                      const startTime = slot.start_time?.slice(0, 5) || '00:00';
                      const endTime = slot.end_time?.slice(0, 5) || '00:00';
                      const isNow = isToday && currentTime >= startTime && currentTime < endTime;
                      
                      return (
                        <div key={slot.id || i} className={`p-6 rounded-3xl border transition-all duration-500 relative group overflow-hidden ${isNow ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                          {isNow && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
                          
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isNow ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {startTime} — {endTime}
                            </span>
                            {slot.sessionType && (
                              <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-tighter border-white/10 ${slot.sessionType === 'LAB' ? 'text-cyan-400' : 'text-indigo-400'}`}>
                                {slot.sessionType}
                              </Badge>
                            )}
                          </div>

                          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2 leading-none relative z-10">
                            {slot.course?.name || 'Class Session'}
                          </h3>
                          
                          <div className="flex flex-col gap-1.5 relative z-10">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                               <User className="w-3 h-3 text-emerald-500" />
                               {slot.faculty?.profile?.first_name ? `${slot.faculty.profile.first_name} ${slot.faculty.profile.last_name}` : 'Staff assigned'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                               <MapPin className="w-3 h-3 text-emerald-500" />
                               Room {slot.room || 'TBA'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}