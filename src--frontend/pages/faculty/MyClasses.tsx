// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, TrendingUp, ListChecks } from 'lucide-react';
import { attendanceService, studentService, timetableService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import type { TimetableEntry, Student } from '@/lib/database.types';

type FacultyTimetableEntry = TimetableEntry & {
  class?: { id?: string; name?: string; section?: string };
  course?: { id?: string; name?: string; code?: string };
};

export default function MyClassesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<FacultyTimetableEntry[]>([]);
  const [rosters, setRosters] = useState<Record<string, Student[]>>({});
  const [attendancePct, setAttendancePct] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const load = async () => {
      if (!user?.faculty?.id) return;
      try {
        setLoading(true);
        const data = await timetableService.getForFaculty(user.faculty.id);
        setEntries(data);

        const classIds = Array.from(new Set(data.map((e) => e.class_id))).filter(Boolean) as string[];
        const stats: Record<string, number> = {};
        const rosterMap: Record<string, Student[]> = {};

        await Promise.all(
          classIds.map(async (classId) => {
            const [students, todayAttendance] = await Promise.all([
              studentService.getAll({ classId }),
              attendanceService.getForClass(classId, today),
            ]);
            rosterMap[classId] = students;
            const present = todayAttendance.filter((r) => r.status === 'PRESENT').length;
            const total = todayAttendance.length || students.length;
            stats[classId] = total ? Math.round((present / total) * 100) : 0;
          })
        );

        setRosters(rosterMap);
        setAttendancePct(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today, user?.faculty?.id]);

  const uniqueClasses = useMemo(() => {
    const grouped = new Map<string, { entry: FacultyTimetableEntry; subjects: string[] }>();
    entries.forEach((entry) => {
      if (!entry.class_id) return;
      const key = entry.class_id;
      const subjectName = entry.course?.name || 'Subject';
      if (!grouped.has(key)) {
        grouped.set(key, { entry, subjects: [subjectName] });
      } else {
        const existing = grouped.get(key)!;
        if (!existing.subjects.includes(subjectName)) existing.subjects.push(subjectName);
      }
    });
    return Array.from(grouped.values());
  }, [entries]);

  const openAttendance = (cls: { entry: FacultyTimetableEntry }) => {
    navigate('/faculty/attendance', {
      state: {
        classId: cls.entry.class_id,
        courseId: cls.entry.course_id,
        slot: 'From My Classes',
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Classes</h1>
        <p className="text-slate-400">Classes assigned to you</p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading classes...</p>
      ) : uniqueClasses.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 text-slate-300">No timetable entries assigned yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uniqueClasses.map((cls) => (
          <Card key={cls.entry.id} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className="bg-cyan-500/20 text-cyan-400 mb-2">{cls.entry.class?.name || 'Class'}</Badge>
                  <h3 className="text-lg font-semibold text-white">{cls.subjects.join(', ')}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-4 h-4" />
                  <span>{rosters[cls.entry.class_id]?.length ?? 0} Students</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>{attendancePct[cls.entry.class_id] ?? 0}% Today</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openAttendance(cls)} disabled={loading}>
                    Mark Attendance
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === cls.entry.class_id ? null : cls.entry.class_id)}>
                    <ListChecks className="w-4 h-4 mr-1" />
                    {expanded === cls.entry.class_id ? 'Hide Roster' : 'View Roster'}
                  </Button>
                </div>
              </div>
              {expanded === cls.entry.class_id && (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-800/40 p-4 text-sm text-slate-200">
                  <p className="font-semibold mb-2">Enrolled students</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300">
                    {(rosters[cls.entry.class_id] || []).map((student) => (
                      <div key={student.id} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        {student.profile?.first_name} {student.profile?.last_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
}