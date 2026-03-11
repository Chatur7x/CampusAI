import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  // ── Today/Now detection ──
  const now = new Date();
  const todayDayIdx = now.getDay(); // 0=Sun,1=Mon..6=Sat
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayDateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 glass-premium p-10 shadow-[0_25px_80px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-900/40 to-violet-500/10 opacity-50" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              Strategic <span className="text-cyan-400">Timeline</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">{todayDateStr} • {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-8 py-3 font-black text-xs tracking-widest uppercase rounded-full shadow-[0_0_20px_rgba(34,211,238,0.2)]">Precision Scheduling v1.2</Badge>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="glass-premium border-white/5 rounded-[3rem] shadow-2xl">
          <CardContent className="py-24 text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto" />
            <p className="text-slate-500 font-black uppercase tracking-[0.2em]">Zero Deployment Vectors Found</p>
            <p className="text-slate-600 text-sm">Contact System Administrator for schedule synchronization.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {DAYS.map((day, index) => {
            const dayNum = index + 1;
            const slots = grouped[dayNum] || grouped[index] || [];
            if (slots.length === 0) return null;
            const isToday = todayDayIdx === dayNum || (todayDayIdx === index + 1);
            
            return (
              <Card key={day} className={`glass-premium border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-500 ${isToday ? 'border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)] scale-[1.02]' : 'opacity-80 grayscale-[0.3] hover:grayscale-0 hover:opacity-100'}`}>
                <CardHeader className={`p-8 pb-4 ${isToday ? 'bg-cyan-500/5' : 'bg-white/5'}`}>
                  <CardTitle className={`text-2xl font-black italic tracking-tighter uppercase flex items-center justify-between ${isToday ? 'text-cyan-400' : 'text-white'}`}>
                    {day}
                    {isToday && <span className="text-[10px] font-black tracking-[0.3em] bg-cyan-400 text-black px-4 py-1 rounded-full not-italic">ACTIVE</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-4">
                  <div className="space-y-6">
                    {slots.map((slot: any, i: number) => {
                      const st = slot.start_time || '';
                      const et = slot.end_time || '';
                      const subj = slot.course?.name || slot.course?.code || 'UNIDENTIFIED';
                      const cls = slot.class?.name || 'GENERIC_BLOCK';
                      const room = slot.room || 'TBD';
                      const isCurrentSlot = isToday && st <= currentTime && et > currentTime;
                      
                      return (
                        <div key={slot.id || i} className={`p-6 rounded-[2rem] border transition-all duration-300 relative group cursor-pointer ${isCurrentSlot ? 'bg-cyan-500/10 border-cyan-400/50 shadow-xl' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}>
                          {isCurrentSlot && <div className="absolute -left-1 top-6 bottom-6 w-1 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,1)]" />}
                          
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                               <Clock className={`w-5 h-5 ${isCurrentSlot ? 'text-cyan-300 animate-pulse' : 'text-slate-500'}`} />
                               <span className={`text-sm font-black tracking-tight ${isCurrentSlot ? 'text-cyan-300' : 'text-slate-400'}`}>{st} — {et}</span>
                            </div>
                            {isCurrentSlot && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                          </div>

                          <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-4 leading-none group-hover:text-cyan-300 transition-colors">{subj}</h3>
                          
                          <div className="grid grid-cols-2 gap-4 mb-6">
                             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <BookOpen className="w-3 h-3 text-cyan-500" /> {cls}
                             </div>
                             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <MapPin className="w-3 h-3 text-cyan-500" /> ROOM {room}
                             </div>
                          </div>

                          <Button 
                            className={`w-full py-7 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all ${isCurrentSlot ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20' : 'glass-premium border-white/10 hover:bg-white/5 text-slate-300'}`}
                            onClick={() => goToAttendance(day, slot)}
                          >
                            Mark Attendance
                          </Button>
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